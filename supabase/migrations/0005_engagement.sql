  -- =============================================================================
  -- 0005 — Engagement: favorites, saved searches, views, enquiries, appointments,
  --        messages, contact reveals
  -- =============================================================================
  set search_path = public, extensions;

  create table public.favorites (
    user_id     uuid not null references public.profiles(id) on delete cascade,
    property_id uuid not null references public.properties(id) on delete cascade,
    created_at  timestamptz not null default now(),
    primary key (user_id, property_id)
  );

  create index favorites_property_idx on public.favorites (property_id);
  create index favorites_user_recent_idx on public.favorites (user_id, created_at desc);

  -- -----------------------------------------------------------------------------
  create table public.saved_searches (
    id           uuid primary key default gen_random_uuid(),
    user_id      uuid not null references public.profiles(id) on delete cascade,
    name         text not null check (char_length(trim(name)) between 1 and 80),
    filters      jsonb not null,
    notify       boolean not null default true,
    frequency    text not null default 'daily' check (frequency in ('instant','daily','weekly')),
    last_run_at  timestamptz,
    last_match_at timestamptz,
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now()
  );

  create index saved_searches_user_idx on public.saved_searches (user_id);
  create index saved_searches_due_idx  on public.saved_searches (frequency, last_run_at)
    where notify;

  create trigger set_updated_at before update on public.saved_searches
    for each row execute function public.tg_set_updated_at();

  comment on column public.saved_searches.filters is
    'Serialised search filter object. Validated against the same Zod schema the search '
    'form uses before it is stored, so a stored search cannot smuggle an unknown predicate.';

  -- -----------------------------------------------------------------------------
  -- Append-only. Deduped to one row per (property, viewer, day) by a unique index
  -- so a refresh loop cannot inflate a vendor's analytics.
  create table public.property_views (
    id           bigserial primary key,
    property_id  uuid not null references public.properties(id) on delete cascade,
    viewer_id    uuid references public.profiles(id) on delete set null,
    viewer_hash  text not null,     -- sha256(ip + user agent + daily salt) for anonymous
    view_date    date not null default current_date,
    referrer     text,
    created_at   timestamptz not null default now()
  );

  create unique index property_views_dedupe_key
    on public.property_views (property_id, viewer_hash, view_date);
  create index property_views_property_idx on public.property_views (property_id, view_date desc);

  create trigger append_only before update or delete on public.property_views
    for each row execute function public.tg_append_only();

  -- -----------------------------------------------------------------------------
  create table public.enquiries (
    id              uuid primary key default gen_random_uuid(),
    property_id     uuid not null references public.properties(id) on delete cascade,
    customer_id     uuid references public.profiles(id) on delete set null,
    vendor_id       uuid not null references public.profiles(id) on delete cascade,

    -- Captured for guests; for signed-in users these mirror the profile at send time.
    contact_name    text not null check (char_length(trim(contact_name)) between 2 and 120),
    contact_email   text check (contact_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
    contact_phone   text check (contact_phone is null or contact_phone ~ '^\+[1-9][0-9]{7,14}$'),
    preferred_channel public.contact_channel not null default 'phone',

    message         text not null check (char_length(trim(message)) between 10 and 2000),
    status          public.enquiry_status not null default 'new',
    read_at         timestamptz,
    replied_at      timestamptz,
    closed_at       timestamptz,

    source_ip       inet,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),

    constraint enquiries_has_contact check (contact_email is not null or contact_phone is not null)
  );

  create index enquiries_vendor_idx   on public.enquiries (vendor_id, created_at desc);
  create index enquiries_property_idx on public.enquiries (property_id, created_at desc);
  create index enquiries_customer_idx on public.enquiries (customer_id, created_at desc)
    where customer_id is not null;
  create index enquiries_unread_idx   on public.enquiries (vendor_id) where status = 'new';

  create trigger set_updated_at before update on public.enquiries
    for each row execute function public.tg_set_updated_at();

  -- -----------------------------------------------------------------------------
  create table public.appointments (
    id             uuid primary key default gen_random_uuid(),
    property_id    uuid not null references public.properties(id) on delete cascade,
    customer_id    uuid not null references public.profiles(id) on delete cascade,
    vendor_id      uuid not null references public.profiles(id) on delete cascade,
    enquiry_id     uuid references public.enquiries(id) on delete set null,

    requested_slots timestamptz[] not null check (
      array_length(requested_slots, 1) between 1 and 5
    ),
    confirmed_slot timestamptz,
    duration_min   smallint not null default 30 check (duration_min between 15 and 240),
    status         public.appointment_status not null default 'requested',
    customer_note  text check (char_length(customer_note) <= 1000),
    vendor_note    text check (char_length(vendor_note) <= 1000),
    cancelled_by   uuid references public.profiles(id) on delete set null,
    cancel_reason  text,

    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now(),

    constraint appointments_confirmed_has_slot check (
      status <> 'confirmed' or confirmed_slot is not null
    )
  );

  create index appointments_vendor_idx   on public.appointments (vendor_id, confirmed_slot);
  create index appointments_customer_idx on public.appointments (customer_id, created_at desc);
  create index appointments_pending_idx  on public.appointments (vendor_id) where status = 'requested';

  create trigger set_updated_at before update on public.appointments
    for each row execute function public.tg_set_updated_at();

  -- -----------------------------------------------------------------------------
  -- Threaded messages. Realtime carries a notification only; this is not a chat
  -- product (see docs/01-architecture.md §11).
  create table public.message_threads (
    id           uuid primary key default gen_random_uuid(),
    property_id  uuid references public.properties(id) on delete set null,
    enquiry_id   uuid references public.enquiries(id) on delete set null,
    subject      text check (char_length(subject) <= 140),
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now()
  );

  create table public.thread_participants (
    thread_id    uuid not null references public.message_threads(id) on delete cascade,
    user_id      uuid not null references public.profiles(id) on delete cascade,
    last_read_at timestamptz,
    primary key (thread_id, user_id)
  );

  create index thread_participants_user_idx on public.thread_participants (user_id);

  create table public.messages (
    id          uuid primary key default gen_random_uuid(),
    thread_id   uuid not null references public.message_threads(id) on delete cascade,
    sender_id   uuid not null references public.profiles(id) on delete cascade,
    body        text not null check (char_length(trim(body)) between 1 and 4000),
    created_at  timestamptz not null default now(),
    deleted_at  timestamptz
  );

  create index messages_thread_idx on public.messages (thread_id, created_at desc);

  create trigger set_updated_at before update on public.message_threads
    for each row execute function public.tg_set_updated_at();

  -- -----------------------------------------------------------------------------
  -- contact_reveals — simultaneously the rate-limit ledger and a transparency
  -- feature: the vendor sees exactly who revealed their number and when.
  create table public.contact_reveals (
    id          bigserial primary key,
    property_id uuid not null references public.properties(id) on delete cascade,
    user_id     uuid references public.profiles(id) on delete set null,
    subject     text not null,          -- user id, or hashed IP for anonymous
    channel     public.contact_channel not null,
    ip          inet,
    created_at  timestamptz not null default now()
  );

  create index contact_reveals_property_idx on public.contact_reveals (property_id, created_at desc);
  create index contact_reveals_subject_idx  on public.contact_reveals (subject, created_at desc);

  create trigger append_only before update or delete on public.contact_reveals
    for each row execute function public.tg_append_only();

  -- -----------------------------------------------------------------------------
  -- Denormalised counter maintenance. Single writer per counter.
  -- -----------------------------------------------------------------------------
  create or replace function public.tg_sync_favorite_count()
  returns trigger
  language plpgsql
  security definer
  set search_path = public, extensions, pg_temp
  as $$
  begin
    if tg_op = 'INSERT' then
      update public.properties set favorite_count = favorite_count + 1 where id = new.property_id;
    elsif tg_op = 'DELETE' then
      update public.properties set favorite_count = greatest(favorite_count - 1, 0) where id = old.property_id;
    end if;
    return null;
  end;
  $$;

  create trigger sync_favorite_count
    after insert or delete on public.favorites
    for each row execute function public.tg_sync_favorite_count();

  create or replace function public.tg_sync_enquiry_count()
  returns trigger
  language plpgsql
  security definer
  set search_path = public, extensions, pg_temp
  as $$
  begin
    update public.properties set enquiry_count = enquiry_count + 1 where id = new.property_id;
    return null;
  end;
  $$;

  create trigger sync_enquiry_count
    after insert on public.enquiries
    for each row execute function public.tg_sync_enquiry_count();

  create or replace function public.tg_sync_view_count()
  returns trigger
  language plpgsql
  security definer
  set search_path = public, extensions, pg_temp
  as $$
  begin
    update public.properties set view_count = view_count + 1 where id = new.property_id;
    return null;
  end;
  $$;

  create trigger sync_view_count
    after insert on public.property_views
    for each row execute function public.tg_sync_view_count();
