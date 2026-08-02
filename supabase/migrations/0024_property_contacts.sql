-- =============================================================================
-- 0024 — Per-listing contact numbers
--
-- Contact was a single profiles.phone, shared by every listing a seller owned,
-- with three booleans on properties (show_phone / show_whatsapp / show_email)
-- deciding whether it could be revealed. An agent handling six properties from
-- three numbers had no way to express that, and there was nowhere at all to say
-- "this number is on WhatsApp".
--
-- property_contacts holds up to three numbers per listing, normalised to E.164,
-- with one of them optionally flagged as the WhatsApp number. Existing data is
-- migrated in, so no seller loses a number and nobody has to re-enter one.
--
-- Numbers stay behind reveal_contact(): they are the asset scrapers come for,
-- and the rate limit and the disclosure ledger are the reason the platform can
-- promise a seller their number will not end up on a list. The reveal now
-- returns the whole contact set in one call rather than one channel at a time.
-- =============================================================================
set search_path = public, extensions;

create table if not exists public.property_contacts (
  id           uuid primary key default gen_random_uuid(),
  property_id  uuid not null references public.properties(id) on delete cascade,

  -- E.164, which for Nepal is +977 followed by 9 or 10 digits. Storing the
  -- normalised form is what makes a WhatsApp link constructible without
  -- guessing, and what stops "9840838944" and "+977 984-083-8944" being two
  -- different numbers.
  phone_e164   text not null check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),

  label        text check (label is null or char_length(trim(label)) between 1 and 40),
  is_whatsapp  boolean not null default false,
  position     smallint not null default 0 check (position between 0 and 2),

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint property_contacts_unique_number unique (property_id, phone_e164)
);

create index if not exists property_contacts_property_idx
  on public.property_contacts (property_id, position);

-- One WhatsApp number per listing. A partial unique index rather than a check,
-- because the rule is about the set of rows, not about any single row.
create unique index if not exists property_contacts_one_whatsapp
  on public.property_contacts (property_id) where is_whatsapp;

create trigger set_updated_at before update on public.property_contacts
  for each row execute function public.tg_set_updated_at();

-- -----------------------------------------------------------------------------
-- At most three numbers per listing. Enforced in the database because the limit
-- is a data rule, and a client-side count is a suggestion.
-- -----------------------------------------------------------------------------
create or replace function public.tg_property_contacts_limit()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_count integer;
begin
  select count(*) into v_count
    from public.property_contacts
   where property_id = new.property_id
     and id <> new.id;

  if v_count >= 3 then
    raise exception 'a listing may carry at most three contact numbers'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger property_contacts_limit
  before insert or update on public.property_contacts
  for each row execute function public.tg_property_contacts_limit();

-- -----------------------------------------------------------------------------
-- Migrate the numbers that already exist.
--
-- Every published or draft listing whose owner has a phone on their profile
-- gets that number as its first contact. show_whatsapp on the listing is what
-- decides whether it is flagged for WhatsApp, which is exactly what that
-- boolean meant.
-- -----------------------------------------------------------------------------
insert into public.property_contacts (property_id, phone_e164, label, is_whatsapp, position)
select p.id,
       pr.phone,
       'Owner',
       coalesce(p.show_whatsapp, false),
       0
  from public.properties p
  join public.profiles pr on pr.id = p.owner_id
 where p.deleted_at is null
   and pr.phone is not null
   and pr.phone ~ '^\+[1-9][0-9]{7,14}$'
on conflict (property_id, phone_e164) do nothing;

-- -----------------------------------------------------------------------------
-- RLS. Numbers are never readable straight off the table by the public: that is
-- the whole point of routing them through reveal_contact(). Owners manage their
-- own, admins can see everything.
-- -----------------------------------------------------------------------------
alter table public.property_contacts enable row level security;
grant select, insert, update, delete on public.property_contacts to authenticated;

create policy "property_contacts: owner reads own"
  on public.property_contacts for select to authenticated
  using (public.owns_property(property_id) or public.is_admin());

create policy "property_contacts: owner writes own"
  on public.property_contacts for insert to authenticated
  with check (public.is_active_user() and public.owns_property(property_id));

create policy "property_contacts: owner updates own"
  on public.property_contacts for update to authenticated
  using (public.owns_property(property_id))
  with check (public.owns_property(property_id));

create policy "property_contacts: owner deletes own"
  on public.property_contacts for delete to authenticated
  using (public.owns_property(property_id));

-- -----------------------------------------------------------------------------
-- The reveal, widened to return every channel at once.
--
-- Three separate reveals meant three round trips, three rate-limit charges and
-- three separate "Show ..." buttons for what a visitor experiences as one
-- decision. One call, one ledger entry, one charge against the budget.
-- -----------------------------------------------------------------------------
create or replace function public.reveal_property_contacts(p_property_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_subject text := coalesce(auth.uid()::text, 'anon');
  v_owner   uuid;
  v_show_phone boolean;
  v_show_whatsapp boolean;
  v_show_email boolean;
  v_email   text;
  v_numbers jsonb;
begin
  if auth.uid() is null then
    raise exception 'sign in to see contact details'
      using errcode = 'insufficient_privilege';
  end if;

  select p.owner_id, p.show_phone, p.show_whatsapp, p.show_email
    into v_owner, v_show_phone, v_show_whatsapp, v_show_email
    from public.properties p
   where p.id = p_property_id
     and p.status = 'published'
     and p.deleted_at is null;

  if v_owner is null then
    raise exception 'listing not found';
  end if;

  if not (v_show_phone or v_show_whatsapp or v_show_email) then
    raise exception 'the lister has not shared any contact details'
      using errcode = 'insufficient_privilege';
  end if;

  -- The owner looking at their own listing is not a disclosure event, so it is
  -- neither rate limited nor written to the ledger.
  if v_owner <> auth.uid() then
    if not public.consume_rate_limit('contact_reveal', v_subject, 30, interval '1 day') then
      raise exception 'daily contact reveal limit reached'
        using errcode = 'too_many_connections',
              hint = 'This limit exists to stop bulk harvesting of vendor numbers.';
    end if;
  end if;

  if v_show_phone or v_show_whatsapp then
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', c.id,
             'phone', c.phone_e164,
             'label', c.label,
             -- A number is only offered for WhatsApp if the listing allows that
             -- channel at all.
             'isWhatsapp', c.is_whatsapp and v_show_whatsapp
           ) order by c.position), '[]'::jsonb)
      into v_numbers
      from public.property_contacts c
     where c.property_id = p_property_id;
  else
    v_numbers := '[]'::jsonb;
  end if;

  if v_show_email then
    select u.email into v_email from auth.users u where u.id = v_owner;
  end if;

  if v_owner <> auth.uid() then
    insert into public.contact_reveals (property_id, user_id, subject, channel)
    values (p_property_id, auth.uid(), v_subject, 'phone');

    perform public.write_audit(
      'contact_reveal', 'properties', p_property_id,
      'revealed contact details', null,
      jsonb_build_object('numbers', jsonb_array_length(v_numbers), 'email', v_email is not null)
    );
  end if;

  return jsonb_build_object('numbers', v_numbers, 'email', v_email);
end;
$$;

comment on function public.reveal_property_contacts is
  'Authenticated, rate-limited, audited disclosure of a listing''s contact set. '
  'Replaces per-channel reveal_contact() calls with one round trip.';

grant execute on function public.reveal_property_contacts(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- The detail page needs to know which buttons to draw before anything is
-- revealed, without learning any digits.
-- -----------------------------------------------------------------------------
create or replace function public.property_contact_summary(p_property_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select jsonb_build_object(
    'phone', p.show_phone and exists (
      select 1 from public.property_contacts c where c.property_id = p.id
    ),
    'whatsapp', p.show_whatsapp and exists (
      select 1 from public.property_contacts c where c.property_id = p.id and c.is_whatsapp
    ),
    'email', p.show_email,
    'numberCount', (select count(*) from public.property_contacts c where c.property_id = p.id)
  )
  from public.properties p
  where p.id = p_property_id
    and p.status = 'published'
    and p.deleted_at is null;
$$;

grant execute on function public.property_contact_summary(uuid) to anon, authenticated;
