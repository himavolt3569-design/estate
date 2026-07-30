-- =============================================================================
-- 0006 — Settlement: vendor payment instructions and proof-of-payment review
-- =============================================================================
-- No gateway. No money moves through the platform in v1. We store the vendor's
-- payment instructions and accept a screenshot for manual review.
-- =============================================================================
set search_path = public, extensions;

create table public.payment_methods (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references public.profiles(id) on delete cascade,
  provider       public.payment_provider not null,
  account_name   text not null check (char_length(trim(account_name)) between 2 and 120),

  -- SENSITIVE. Column grant is withheld from anon/authenticated in 0010; public
  -- reads go through get_payment_methods_public(), which applies the vendor's
  -- per-listing disclosure toggle.
  account_number text not null check (char_length(trim(account_number)) between 3 and 64),

  bank_name      text,
  branch         text,
  qr_image_path  text,
  instructions   text check (char_length(instructions) <= 500),
  is_active      boolean not null default true,
  is_default     boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz,

  constraint payment_methods_bank_needs_name check (
    provider <> 'bank' or bank_name is not null
  )
);

create index payment_methods_owner_idx on public.payment_methods (owner_id)
  where is_active and deleted_at is null;
create unique index payment_methods_one_default
  on public.payment_methods (owner_id) where is_default and deleted_at is null;

create trigger set_updated_at before update on public.payment_methods
  for each row execute function public.tg_set_updated_at();

comment on table public.payment_methods is
  'Vendor payment instructions (eSewa/Khalti/IME Pay/connectIPS/bank). Display only.';

-- -----------------------------------------------------------------------------
create table public.payments (
  id                uuid primary key default gen_random_uuid(),
  property_id       uuid not null references public.properties(id) on delete cascade,
  payer_id          uuid not null references public.profiles(id) on delete restrict,
  payee_id          uuid not null references public.profiles(id) on delete restrict,
  payment_method_id uuid references public.payment_methods(id) on delete set null,

  amount            bigint not null check (amount > 0),      -- paisa
  purpose           text not null default 'booking'
                    check (purpose in ('booking','advance','rent','deposit','commission','other')),
  reference         text check (char_length(reference) <= 120),
  note              text check (char_length(note) <= 500),

  -- Private bucket; served only through a 60s signed URL after authorization.
  proof_path        text not null,

  status            public.payment_status not null default 'pending',
  reviewed_by       uuid references public.profiles(id) on delete set null,
  reviewed_at       timestamptz,
  rejection_reason  text,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint payments_rejection_has_reason check (
    status <> 'rejected' or (rejection_reason is not null and char_length(trim(rejection_reason)) >= 5)
  ),
  constraint payments_reviewed_consistency check (
    (status = 'pending' and reviewed_at is null and reviewed_by is null)
    or (status <> 'pending' and reviewed_at is not null)
  ),
  constraint payments_no_self_payment check (payer_id <> payee_id)
);

create index payments_payee_idx    on public.payments (payee_id, created_at desc);
create index payments_payer_idx    on public.payments (payer_id, created_at desc);
create index payments_property_idx on public.payments (property_id, created_at desc);
create index payments_pending_idx  on public.payments (created_at) where status = 'pending';

create trigger set_updated_at before update on public.payments
  for each row execute function public.tg_set_updated_at();

comment on table public.payments is
  'Proof-of-payment records. The platform never holds funds; this is a review workflow.';

-- -----------------------------------------------------------------------------
-- Status is a one-way state machine: pending -> approved | rejected. Nothing
-- returns to pending, and nothing moves between terminal states. Enforced here
-- rather than in application code so that a service-role write cannot skip it.
-- -----------------------------------------------------------------------------
create or replace function public.tg_payments_guard_transition()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if new.status is distinct from old.status then
    if old.status <> 'pending' then
      raise exception 'payment % is already %; its status is final', old.id, old.status
        using errcode = 'check_violation';
    end if;

    if new.status not in ('approved','rejected') then
      raise exception 'invalid payment transition % -> %', old.status, new.status
        using errcode = 'check_violation';
    end if;

    new.reviewed_at := coalesce(new.reviewed_at, now());
    new.reviewed_by := coalesce(new.reviewed_by, auth.uid());
  end if;

  -- The proof and amount are the evidence. They are immutable after submission.
  if new.proof_path is distinct from old.proof_path or new.amount is distinct from old.amount then
    raise exception 'payment proof and amount are immutable after submission'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger payments_guard_transition
  before update on public.payments
  for each row execute function public.tg_payments_guard_transition();
