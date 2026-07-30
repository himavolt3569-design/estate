-- =============================================================================
-- 0002 — Identity, agencies, RBAC, sessions
-- =============================================================================

-- -----------------------------------------------------------------------------
-- agencies
-- -----------------------------------------------------------------------------
create table public.agencies (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null check (char_length(trim(name)) between 2 and 120),
  slug                text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  registration_number text,
  description         text check (char_length(description) <= 2000),
  logo_url            text,
  phone               text,
  email               text,
  address_line        text,
  owner_id            uuid,  -- FK added after profiles exists (circular)
  verified_at         timestamptz,
  verified_by         uuid,
  status              public.account_status not null default 'pending_verification',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);

comment on table public.agencies is 'Real estate agencies. Agents belong to one; managers administer one.';

-- -----------------------------------------------------------------------------
-- profiles — 1:1 with auth.users
-- -----------------------------------------------------------------------------
create table public.profiles (
  id                    uuid primary key references auth.users(id) on delete cascade,
  full_name             text check (char_length(trim(full_name)) between 2 and 120),
  phone                 text check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$'),
  avatar_url            text,

  -- SECURITY: role and status are not user-writable. Protected by (1) the RLS
  -- WITH CHECK in 0010, (2) tg_prevent_privilege_escalation below, and
  -- (3) the absence of a column-level UPDATE grant in 0010.
  role                  public.user_role   not null default 'customer',
  status                public.account_status not null default 'pending_verification',

  agency_id             uuid references public.agencies(id) on delete set null,
  bio                   text check (char_length(bio) <= 1000),
  preferred_locale      text not null default 'en' check (preferred_locale in ('en','ne')),
  preferred_area_unit   public.area_unit not null default 'ropani',

  identity_verified_at  timestamptz,
  identity_verified_by  uuid references public.profiles(id) on delete set null,

  suspended_reason      text,
  suspended_at          timestamptz,

  last_seen_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  deleted_at            timestamptz,

  -- An agent or agency manager must belong to an agency; owners/customers must not.
  constraint profiles_agency_consistency check (
    (role in ('agent','agency_manager') and agency_id is not null)
    or (role not in ('agent','agency_manager'))
  )
);

create unique index profiles_phone_key on public.profiles (phone) where phone is not null and deleted_at is null;
create index profiles_role_idx      on public.profiles (role)      where deleted_at is null;
create index profiles_status_idx    on public.profiles (status)    where deleted_at is null;
create index profiles_agency_idx    on public.profiles (agency_id) where agency_id is not null and deleted_at is null;

comment on table public.profiles is 'Public-facing user record, 1:1 with auth.users. role/status are privileged columns.';

alter table public.agencies
  add constraint agencies_owner_fk foreign key (owner_id) references public.profiles(id) on delete set null,
  add constraint agencies_verified_by_fk foreign key (verified_by) references public.profiles(id) on delete set null;

create index agencies_owner_idx on public.agencies (owner_id) where deleted_at is null;

-- -----------------------------------------------------------------------------
-- RBAC: roles hold permissions; every check is against a permission.
-- -----------------------------------------------------------------------------
create table public.permissions (
  key         text primary key check (key ~ '^[a-z_]+\.[a-z_]+$'),
  description text not null,
  created_at  timestamptz not null default now()
);

comment on table public.permissions is 'Closed set of capability keys, e.g. property.publish. Seeded in 0013.';

create table public.role_permissions (
  role           public.user_role not null,
  permission_key text not null references public.permissions(key) on delete cascade,
  primary key (role, permission_key)
);

comment on table public.role_permissions is
  'Grants a capability to a role. Answers "may this class of user do this at all". '
  'The RLS row predicate separately answers "on which rows".';

-- -----------------------------------------------------------------------------
-- Session inventory and sign-in history
-- -----------------------------------------------------------------------------
create table public.user_sessions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  session_id      uuid,                       -- auth.sessions id when available
  user_agent      text,
  ip              inet,
  device_label    text,
  city            text,
  country_code    text check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  created_at      timestamptz not null default now(),
  last_seen_at    timestamptz not null default now(),
  revoked_at      timestamptz,
  revoked_by      uuid references public.profiles(id) on delete set null
);

create index user_sessions_user_idx on public.user_sessions (user_id, last_seen_at desc);

-- Append-only. Records every sign-in attempt, successful or not.
create table public.auth_events (
  id            bigserial primary key,
  user_id       uuid references public.profiles(id) on delete set null,
  email_hash    text,          -- sha256 of lowercased email; never the address itself
  event         text not null check (event in (
                  'login_success','login_failed','logout','password_reset_requested',
                  'password_reset_completed','mfa_enrolled','mfa_verified','mfa_failed',
                  'mfa_recovery_used','email_verified','session_revoked'
                )),
  ip            inet,
  user_agent    text,
  city          text,
  country_code  text,
  detail        jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create index auth_events_user_idx    on public.auth_events (user_id, created_at desc);
create index auth_events_created_idx on public.auth_events (created_at desc);

comment on table public.auth_events is
  'Append-only sign-in log. email_hash rather than email so a leak of this table '
  'does not yield an address list.';

-- -----------------------------------------------------------------------------
-- MFA recovery codes — Argon2id/bcrypt hashes, single use
-- -----------------------------------------------------------------------------
create table public.mfa_recovery_codes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  code_hash  text not null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);

create index mfa_recovery_user_idx on public.mfa_recovery_codes (user_id) where used_at is null;

comment on table public.mfa_recovery_codes is
  'Single-use TOTP recovery codes. Stored hashed; the plaintext is shown once at enrolment.';

-- -----------------------------------------------------------------------------
-- Rate limiting — fixed window counters
-- -----------------------------------------------------------------------------
create table public.rate_limit_buckets (
  bucket       text not null,
  subject      text not null,          -- user id, ip, or "ip:email" composite
  window_start timestamptz not null,
  count        integer not null default 0,
  primary key (bucket, subject, window_start)
);

create index rate_limit_window_idx on public.rate_limit_buckets (window_start);

comment on table public.rate_limit_buckets is
  'Fixed-window counters. Rows older than the widest window are swept by a scheduled job.';

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------
create trigger set_updated_at before update on public.profiles
  for each row execute function public.tg_set_updated_at();
create trigger set_updated_at before update on public.agencies
  for each row execute function public.tg_set_updated_at();

create trigger append_only before update or delete on public.auth_events
  for each row execute function public.tg_append_only();

-- Provision a profile whenever an auth user is created. Runs as definer because
-- the signing-up user has no rights on public.profiles yet.
create or replace function public.tg_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  insert into public.profiles (id, full_name, status, role)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    case when new.email_confirmed_at is not null then 'active'::public.account_status
         else 'pending_verification'::public.account_status end,
    -- Role from signup metadata is ACCEPTED ONLY for the non-privileged subset.
    -- Anything else, including a forged 'platform_admin', falls back to customer.
    case coalesce(new.raw_user_meta_data ->> 'role', 'customer')
      when 'property_owner' then 'property_owner'::public.user_role
      when 'agent'          then 'agent'::public.user_role
      else 'customer'::public.user_role
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

comment on function public.tg_handle_new_user is
  'Creates the profile row on signup. Deliberately ignores any privileged role in '
  'user metadata: signup metadata is attacker-controlled.';

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.tg_handle_new_user();

-- Promote pending_verification -> active once the email is confirmed.
create or replace function public.tg_handle_user_confirmed()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if new.email_confirmed_at is not null and old.email_confirmed_at is null then
    update public.profiles
       set status = 'active'
     where id = new.id and status = 'pending_verification';
  end if;
  return new;
end;
$$;

create trigger on_auth_user_confirmed
  after update of email_confirmed_at on auth.users
  for each row execute function public.tg_handle_user_confirmed();

-- SECURITY: layer 2 of 3 protecting role/status. Fires even for service_role
-- writes, which bypass RLS entirely.
create or replace function public.tg_prevent_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  caller_role public.user_role;
begin
  if new.role is distinct from old.role or new.status is distinct from old.status then
    -- current_setting is set by admin_set_user_role()/suspend_user(), the only
    -- sanctioned paths. Absent that, the caller must be a platform admin.
    if coalesce(current_setting('app.privileged_operation', true), '') = 'on' then
      return new;
    end if;

    select p.role into caller_role from public.profiles p where p.id = auth.uid();

    if caller_role is distinct from 'platform_admin' then
      raise exception 'role and status may only be changed by a platform admin'
        using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end;
$$;

create trigger prevent_privilege_escalation
  before update on public.profiles
  for each row execute function public.tg_prevent_privilege_escalation();
