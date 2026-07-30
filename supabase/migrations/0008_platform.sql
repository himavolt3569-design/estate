-- =============================================================================
-- 0008 — Platform: notifications, audit log, system health
-- =============================================================================
set search_path = public, extensions;

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  type       public.notification_type not null,
  title      text not null check (char_length(title) between 1 and 140),
  body       text check (char_length(body) <= 500),
  entity_type text,
  entity_id  uuid,
  href       text,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_idx   on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;

-- -----------------------------------------------------------------------------
-- Push subscriptions (Web Push / VAPID)
-- -----------------------------------------------------------------------------
create table public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth_key   text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- =============================================================================
-- audit_logs — append-only, monthly range partitions
-- =============================================================================
-- Written by triggers rather than application code: application code can be
-- forgotten, a trigger cannot. UPDATE and DELETE are blocked for every role
-- including service_role, so a compromised admin cannot rewrite history.
-- =============================================================================
create table public.audit_logs (
  id           bigint generated always as identity,
  actor_id     uuid,
  actor_role   public.user_role,
  action       public.audit_action not null,
  entity_type  text not null,
  entity_id    uuid,
  summary      text,
  previous_value jsonb,
  new_value      jsonb,
  ip           inet,
  user_agent   text,
  request_id   text,
  created_at   timestamptz not null default now(),
  primary key (id, created_at)
) partition by range (created_at);

create index audit_logs_actor_idx  on public.audit_logs (actor_id, created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id, created_at desc);
create index audit_logs_action_idx on public.audit_logs (action, created_at desc);

create trigger append_only before update or delete on public.audit_logs
  for each row execute function public.tg_append_only();

comment on table public.audit_logs is
  'Append-only audit trail. Partitioned monthly. Sensitive keys are redacted by '
  'audit_redact() before the diff is stored.';

-- Creates the partition covering a given month if it does not exist. Called by
-- the write helper so a log entry can never fail for want of a partition.
create or replace function public.ensure_audit_partition(at timestamptz default now())
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  start_ts date := date_trunc('month', at)::date;
  end_ts   date := (date_trunc('month', at) + interval '1 month')::date;
  part     text := format('audit_logs_%s', to_char(start_ts, 'YYYY_MM'));
begin
  if to_regclass(format('public.%I', part)) is null then
    execute format(
      'create table public.%I partition of public.audit_logs for values from (%L) to (%L)',
      part, start_ts, end_ts
    );
    execute format('alter table public.%I enable row level security', part);
  end if;
end;
$$;

-- Bootstrap the current month and the next two.
select public.ensure_audit_partition(now());
select public.ensure_audit_partition(now() + interval '1 month');
select public.ensure_audit_partition(now() + interval '2 months');

-- Anything under these keys is replaced with '[redacted]' before storage. An
-- audit log that leaks the secrets it was recording is worse than no log.
create or replace function public.audit_redact(payload jsonb)
returns jsonb
language sql
immutable
parallel safe
as $$
  select coalesce(
    (select jsonb_object_agg(
       key,
       case when key = any (array[
              'account_number','password','token','code_hash','proof_path',
              'auth_key','p256dh','email_hash','storage_path'
            ])
            then '"[redacted]"'::jsonb
            else value
       end)
     from jsonb_each(payload)),
    '{}'::jsonb
  );
$$;

-- The single write path for audit entries.
create or replace function public.write_audit(
  p_action        public.audit_action,
  p_entity_type   text,
  p_entity_id     uuid,
  p_summary       text default null,
  p_previous      jsonb default null,
  p_new           jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_role public.user_role;
begin
  perform public.ensure_audit_partition(now());

  select p.role into v_role from public.profiles p where p.id = auth.uid();

  insert into public.audit_logs (
    actor_id, actor_role, action, entity_type, entity_id, summary,
    previous_value, new_value, ip, user_agent, request_id
  )
  values (
    auth.uid(), v_role, p_action, p_entity_type, p_entity_id, p_summary,
    case when p_previous is null then null else public.audit_redact(p_previous) end,
    case when p_new      is null then null else public.audit_redact(p_new)      end,
    nullif(current_setting('request.headers', true)::jsonb ->> 'x-forwarded-for', '')::inet,
    current_setting('request.headers', true)::jsonb ->> 'user-agent',
    current_setting('request.headers', true)::jsonb ->> 'x-request-id'
  );
exception
  when others then
    -- Auditing must never take down the operation it is recording, but a failure
    -- must be visible. Surface it as a warning in the Postgres log.
    raise warning 'write_audit failed for % %: %', p_entity_type, p_entity_id, sqlerrm;
end;
$$;

-- Generic row-diff auditor. Attach to any table whose changes matter.
create or replace function public.tg_audit_row()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_action public.audit_action;
  v_prev   jsonb;
  v_new    jsonb;
  v_id     uuid;
begin
  if tg_op = 'INSERT' then
    v_action := 'create';
    v_new    := to_jsonb(new);
    v_id     := (to_jsonb(new) ->> 'id')::uuid;
  elsif tg_op = 'UPDATE' then
    v_prev := to_jsonb(old);
    v_new  := to_jsonb(new);
    v_id   := (to_jsonb(new) ->> 'id')::uuid;
    -- Store only the columns that actually changed. A full row snapshot on every
    -- update makes the table unreadable and enormous.
    select jsonb_object_agg(key, value) into v_prev
      from jsonb_each(v_prev) where value is distinct from (v_new -> key);
    select jsonb_object_agg(key, value) into v_new
      from jsonb_each(to_jsonb(new)) where value is distinct from (to_jsonb(old) -> key);
    if v_new is null or v_new = '{}'::jsonb then
      return null;   -- nothing changed
    end if;
    v_action := case when v_new ? 'status' then 'status_change' else 'update' end;
  else
    v_action := 'delete';
    v_prev   := to_jsonb(old);
    v_id     := (to_jsonb(old) ->> 'id')::uuid;
  end if;

  perform public.write_audit(v_action, tg_table_name, v_id, null, v_prev, v_new);
  return null;
end;
$$;

-- Tables whose changes are consequential enough to audit.
create trigger audit_row after insert or update or delete on public.properties
  for each row execute function public.tg_audit_row();
create trigger audit_row after update or delete on public.profiles
  for each row execute function public.tg_audit_row();
create trigger audit_row after insert or update or delete on public.payments
  for each row execute function public.tg_audit_row();
create trigger audit_row after insert or update or delete on public.payment_methods
  for each row execute function public.tg_audit_row();
create trigger audit_row after update on public.verification_requests
  for each row execute function public.tg_audit_row();
create trigger audit_row after update on public.reports
  for each row execute function public.tg_audit_row();
create trigger audit_row after update on public.reviews
  for each row execute function public.tg_audit_row();
create trigger audit_row after insert or update or delete on public.agencies
  for each row execute function public.tg_audit_row();

-- -----------------------------------------------------------------------------
-- system_health — rolling samples surfaced on the admin dashboard
-- -----------------------------------------------------------------------------
create table public.system_health (
  id          bigserial primary key,
  metric      text not null,
  value       numeric not null,
  unit        text,
  detail      jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default now()
);

create index system_health_metric_idx on public.system_health (metric, recorded_at desc);
