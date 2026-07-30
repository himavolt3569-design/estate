-- =============================================================================
-- 0009 — Authorization helpers and invariant triggers
-- =============================================================================
-- These four functions are the vocabulary every RLS policy is written in. They
-- are SECURITY DEFINER (so they can read profiles/role_permissions regardless of
-- the caller's own policies) and STABLE (so Postgres evaluates them once per
-- statement rather than once per row — this is the difference between a search
-- that takes 40 ms and one that takes 4 s).
--
-- They read from public.profiles rather than from JWT claims. A JWT is up to an
-- hour stale; a suspended vendor must lose write access immediately, not at
-- their next token refresh. The cost is one primary-key lookup per statement.
-- =============================================================================
set search_path = public, extensions;

create or replace function public.auth_role()
returns public.user_role
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select p.role
    from public.profiles p
   where p.id = auth.uid()
     and p.deleted_at is null;
$$;

comment on function public.auth_role is 'The caller''s role, or NULL when anonymous.';

-- A user who is not `active` can read but cannot write anything, anywhere.
create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select exists (
    select 1 from public.profiles p
     where p.id = auth.uid()
       and p.status = 'active'
       and p.deleted_at is null
  );
$$;

create or replace function public.current_aal()
returns text
language sql
stable
as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1');
$$;

comment on function public.current_aal is
  'Authenticator assurance level from the JWT. aal2 means a TOTP challenge was '
  'satisfied in this session. Admin surfaces require aal2 at the database level, '
  'so a stolen aal1 token cannot read them even by calling the REST API directly.';

create or replace function public.has_permission(p_key text)
returns boolean
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select exists (
    select 1
      from public.profiles p
      join public.role_permissions rp on rp.role = p.role
     where p.id = auth.uid()
       and p.status = 'active'
       and p.deleted_at is null
       and rp.permission_key = p_key
  );
$$;

comment on function public.has_permission is
  'Answers "may this class of user do this at all". The RLS row predicate '
  'separately answers "on which rows". Both are always required.';

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select exists (
    select 1 from public.profiles p
     where p.id = auth.uid()
       and p.role = 'platform_admin'
       and p.status = 'active'
       and p.deleted_at is null
  )
  and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;

comment on function public.is_admin is
  'Platform admin AND a second factor satisfied. 2FA for admins is enforced here, '
  'in the database, not only in the UI.';

-- Resolves ownership across all three vendor shapes: the direct owner, the agent
-- of record, and the manager of the owning agency. Every ownership policy in
-- 0010 delegates to this one function so the rule exists in exactly one place.
create or replace function public.owns_property(p_property_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select exists (
    select 1
      from public.properties pr
      join public.profiles me on me.id = auth.uid()
     where pr.id = p_property_id
       and pr.deleted_at is null
       and me.deleted_at is null
       and (
            pr.owner_id = me.id
         or (me.role = 'agency_manager' and pr.agency_id is not null and pr.agency_id = me.agency_id)
       )
  );
$$;

-- Same rule, applied to a row already in hand. Avoids a self-join when the
-- policy is on the properties table itself.
create or replace function public.owns_property_row(p_owner_id uuid, p_agency_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select exists (
    select 1 from public.profiles me
     where me.id = auth.uid()
       and me.deleted_at is null
       and (
            p_owner_id = me.id
         or (me.role = 'agency_manager' and p_agency_id is not null and p_agency_id = me.agency_id)
       )
  );
$$;

-- -----------------------------------------------------------------------------
-- Thread membership.
--
-- These exist because a policy on thread_participants that queries
-- thread_participants re-enters its own policy and Postgres raises
-- "infinite recursion detected in policy". The recursion also propagates: the
-- profiles "read counterparties" policy joins thread_participants, so a plain
-- self-referencing policy there breaks reads on profiles too.
--
-- SECURITY DEFINER breaks the cycle: the function runs as the table owner, for
-- whom RLS does not apply, so the membership lookup does not re-trigger the
-- policy that called it.
-- -----------------------------------------------------------------------------
create or replace function public.is_thread_participant(p_thread_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select exists (
    select 1 from public.thread_participants tp
     where tp.thread_id = p_thread_id
       and tp.user_id = auth.uid()
  );
$$;

create or replace function public.shares_thread_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select exists (
    select 1
      from public.thread_participants mine
      join public.thread_participants theirs on theirs.thread_id = mine.thread_id
     where mine.user_id = auth.uid()
       and theirs.user_id = p_user_id
  );
$$;

-- =============================================================================
-- Invariant triggers
-- =============================================================================

-- Mirrors the five hot filter attributes from the EAV table onto properties.
-- Single writer, so the denormalisation cannot drift.
create or replace function public.tg_sync_hot_attributes()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_property uuid := coalesce(new.property_id, old.property_id);
begin
  update public.properties p
     set bedrooms       = (select pa.value_number::smallint from public.property_attributes pa
                            where pa.property_id = v_property and pa.key = 'bedrooms'),
         bathrooms      = (select pa.value_number::smallint from public.property_attributes pa
                            where pa.property_id = v_property and pa.key = 'bathrooms'),
         floors         = (select pa.value_number::smallint from public.property_attributes pa
                            where pa.property_id = v_property and pa.key = 'floors'),
         parking        = (select pa.value_number::smallint from public.property_attributes pa
                            where pa.property_id = v_property and pa.key = 'parking'),
         road_access_ft = (select pa.value_number::smallint from public.property_attributes pa
                            where pa.property_id = v_property and pa.key = 'road_access_ft')
   where p.id = v_property;
  return null;
end;
$$;

create trigger sync_hot_attributes
  after insert or update or delete on public.property_attributes
  for each row execute function public.tg_sync_hot_attributes();

-- Mirrors the feature join table into properties.feature_ids so amenity filters
-- are a single GIN index lookup instead of a join per candidate row.
create or replace function public.tg_sync_feature_ids()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_property uuid := coalesce(new.property_id, old.property_id);
begin
  update public.properties p
     set feature_ids = coalesce(
           (select array_agg(pf.feature_id order by pf.feature_id)
              from public.property_features pf
             where pf.property_id = v_property),
           '{}'::uuid[])
   where p.id = v_property;
  return null;
end;
$$;

create trigger sync_feature_ids
  after insert or delete on public.property_features
  for each row execute function public.tg_sync_feature_ids();

-- The brief requires a minimum of five images. Enforced at the status
-- transition, in the database — a client-side check is a suggestion, not a rule.
create or replace function public.tg_properties_require_media()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_count integer;
begin
  if new.status in ('pending_review','published')
     and (tg_op = 'INSERT' or old.status is distinct from new.status) then

    select count(*) into v_count from public.property_images where property_id = new.id;

    if v_count < 5 then
      raise exception 'a listing needs at least 5 images before review (currently %)', v_count
        using errcode = 'check_violation',
              hint = 'Add more photos on the Media step.';
    end if;

    if not exists (select 1 from public.property_images where property_id = new.id and is_cover) then
      raise exception 'a listing needs a cover image before review'
        using errcode = 'check_violation';
    end if;
  end if;

  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
    new.expires_at   := now() + interval '90 days';
  end if;

  return new;
end;
$$;

create trigger properties_require_media
  before insert or update of status on public.properties
  for each row execute function public.tg_properties_require_media();

-- Keeps agency_id aligned with the owner's agency, and records which kind of
-- vendor listed it. Buyers are shown "listed by owner" vs "listed by agent";
-- that distinction matters in a market with low broker trust, so it is derived
-- from the account rather than self-declared.
create or replace function public.tg_properties_set_vendor_context()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_role   public.user_role;
  v_agency uuid;
begin
  select p.role, p.agency_id into v_role, v_agency
    from public.profiles p where p.id = new.owner_id;

  new.listed_by_role := v_role;
  new.agency_id      := v_agency;
  return new;
end;
$$;

create trigger properties_set_vendor_context
  before insert or update of owner_id on public.properties
  for each row execute function public.tg_properties_set_vendor_context();

-- Canonicalise area to square metres whenever the raw entry changes.
create or replace function public.tg_properties_normalise_area()
returns trigger
language plpgsql
set search_path = public, extensions, pg_temp
as $$
declare
  v_sqm numeric := 0;
  v_key text;
  v_val numeric;
begin
  if new.area_raw is null or new.area_raw = '{}'::jsonb then
    return new;
  end if;

  for v_key, v_val in select key, (value #>> '{}')::numeric from jsonb_each(new.area_raw)
  loop
    if v_key = any (enum_range(null::public.area_unit)::text[]) then
      v_sqm := v_sqm + public.area_to_sqm(v_val, v_key::public.area_unit);
    end if;
  end loop;

  if v_sqm > 0 then
    new.area_sqm := round(v_sqm, 4);
  end if;

  return new;
end;
$$;

create trigger properties_normalise_area
  before insert or update of area_raw on public.properties
  for each row execute function public.tg_properties_normalise_area();
