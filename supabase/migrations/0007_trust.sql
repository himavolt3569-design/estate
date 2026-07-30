-- =============================================================================
-- 0007 — Trust: verification, the trust ledger, reviews, reports
-- =============================================================================
set search_path = public, extensions;

create table public.verification_requests (
  id            uuid primary key default gen_random_uuid(),
  subject_type  text not null check (subject_type in ('user','agency','property')),
  subject_id    uuid not null,
  requested_by  uuid not null references public.profiles(id) on delete cascade,
  document_ids  uuid[] not null default '{}'::uuid[],
  note          text check (char_length(note) <= 1000),
  status        public.verification_status not null default 'pending',
  reviewed_by   uuid references public.profiles(id) on delete set null,
  reviewed_at   timestamptz,
  decision_note text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint verification_decision_has_note check (
    status <> 'rejected' or (decision_note is not null and char_length(trim(decision_note)) >= 5)
  )
);

create index verification_requests_pending_idx on public.verification_requests (created_at)
  where status = 'pending';
create index verification_requests_subject_idx on public.verification_requests (subject_type, subject_id);
create index verification_requests_requester_idx on public.verification_requests (requested_by, created_at desc);

create trigger set_updated_at before update on public.verification_requests
  for each row execute function public.tg_set_updated_at();

-- -----------------------------------------------------------------------------
-- THE TRUST LEDGER
-- -----------------------------------------------------------------------------
-- The schema-level expression of the product's core promise. Append-only, so
-- the history a buyer sees cannot be edited by the seller or quietly tidied by
-- an admin. This is the data behind components/brand/TrustLedger.tsx.
create table public.trust_events (
  id          bigserial primary key,
  property_id uuid not null references public.properties(id) on delete cascade,
  event       public.trust_event_type not null,
  actor_id    uuid references public.profiles(id) on delete set null,
  actor_role  public.user_role,
  detail      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index trust_events_property_idx on public.trust_events (property_id, created_at desc);
create index trust_events_type_idx     on public.trust_events (event, created_at desc);

create trigger append_only before update or delete on public.trust_events
  for each row execute function public.tg_append_only();

comment on table public.trust_events is
  'Append-only provenance ledger shown publicly on every listing. Records who listed it, '
  'when, price history, whether the lalpurja was sighted, whether GPS was confirmed, '
  'and how many times it has been relisted.';

-- Writes the ledger automatically from property lifecycle changes, so a code
-- path that forgets to record provenance cannot exist.
create or replace function public.tg_properties_trust_ledger()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.trust_events (property_id, event, actor_id, actor_role, detail)
    values (new.id, 'listed', new.owner_id, new.listed_by_role,
            jsonb_build_object('reference_code', new.reference_code));
    return new;
  end if;

  if new.status is distinct from old.status and new.status = 'published' then
    insert into public.trust_events (property_id, event, actor_id, actor_role, detail)
    values (new.id,
            -- The cast is required: a CASE over string literals is text, and the
            -- column is trust_event_type.
            (case when old.published_at is null then 'published' else 'relisted' end)
              ::public.trust_event_type,
            auth.uid(), null,
            jsonb_build_object('from', old.status, 'to', new.status));
  end if;

  if new.price is distinct from old.price then
    insert into public.trust_events (property_id, event, actor_id, actor_role, detail)
    values (new.id, 'price_changed', auth.uid(), null,
            jsonb_build_object('from', old.price, 'to', new.price,
                               'direction', case when new.price > old.price then 'up' else 'down' end));
  end if;

  if new.verified_at is distinct from old.verified_at and new.verified_at is not null then
    insert into public.trust_events (property_id, event, actor_id, actor_role, detail)
    values (new.id, 'document_sighted', new.verified_by, 'platform_admin', '{}'::jsonb);
  end if;

  return new;
end;
$$;

create trigger properties_trust_ledger
  after insert or update on public.properties
  for each row execute function public.tg_properties_trust_ledger();

-- -----------------------------------------------------------------------------
create table public.reviews (
  id            uuid primary key default gen_random_uuid(),
  subject_type  text not null check (subject_type in ('vendor','agency','property')),
  subject_id    uuid not null,
  author_id     uuid not null references public.profiles(id) on delete cascade,
  property_id   uuid references public.properties(id) on delete set null,
  rating        smallint not null check (rating between 1 and 5),
  title         text check (char_length(title) <= 120),
  body          text not null check (char_length(trim(body)) between 20 and 2000),
  status        public.review_status not null default 'pending',
  moderated_by  uuid references public.profiles(id) on delete set null,
  moderated_at  timestamptz,
  moderation_note text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

-- One review per author per subject. Prevents rating brigading by a single account.
create unique index reviews_one_per_author
  on public.reviews (author_id, subject_type, subject_id) where deleted_at is null;
create index reviews_subject_idx on public.reviews (subject_type, subject_id, created_at desc)
  where status = 'published' and deleted_at is null;
create index reviews_pending_idx on public.reviews (created_at) where status = 'pending';

create trigger set_updated_at before update on public.reviews
  for each row execute function public.tg_set_updated_at();

-- -----------------------------------------------------------------------------
create table public.reports (
  id            uuid primary key default gen_random_uuid(),
  target_type   public.report_target not null,
  target_id     uuid not null,
  reporter_id   uuid references public.profiles(id) on delete set null,
  reason        text not null check (reason in (
                  'fraud','duplicate','wrong_location','sold_already','offensive',
                  'spam','misleading_price','not_owner','other'
                )),
  detail        text check (char_length(detail) <= 2000),
  status        public.report_status not null default 'open',

  -- SLA tracking exists from day one so the staffing signal arrives before the
  -- queue becomes a backlog.
  due_at        timestamptz not null default (now() + interval '48 hours'),
  assigned_to   uuid references public.profiles(id) on delete set null,
  resolved_by   uuid references public.profiles(id) on delete set null,
  resolved_at   timestamptz,
  resolution    text,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint reports_resolution_present check (
    status not in ('resolved','dismissed')
    or (resolution is not null and char_length(trim(resolution)) >= 5)
  )
);

create index reports_open_idx   on public.reports (due_at) where status in ('open','investigating');
create index reports_target_idx on public.reports (target_type, target_id, created_at desc);
create index reports_reporter_idx on public.reports (reporter_id, created_at desc)
  where reporter_id is not null;

create trigger set_updated_at before update on public.reports
  for each row execute function public.tg_set_updated_at();

-- Mirror report activity into the public trust ledger when it concerns a listing.
create or replace function public.tg_reports_trust_ledger()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if new.target_type <> 'property' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    insert into public.trust_events (property_id, event, actor_id, detail)
    values (new.target_id, 'reported', null, jsonb_build_object('reason', new.reason));
  elsif new.status is distinct from old.status and new.status in ('resolved','dismissed') then
    insert into public.trust_events (property_id, event, actor_id, detail)
    values (new.target_id, 'report_resolved', new.resolved_by,
            jsonb_build_object('outcome', new.status));
  end if;

  return new;
end;
$$;

create trigger reports_trust_ledger
  after insert or update on public.reports
  for each row execute function public.tg_reports_trust_ledger();
