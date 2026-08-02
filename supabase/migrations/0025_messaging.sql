-- =============================================================================
-- 0025 — Direct messaging between a buyer and a listing's owner
--
-- The tables have existed since 0005 (message_threads, thread_participants,
-- messages) with sound RLS, and nothing has ever written to them: there was no
-- way anywhere in the product to start a conversation. This migration adds the
-- three things that were missing, and no new tables.
--
--   1. A way to open a thread that cannot produce duplicates and cannot be
--      pointed at yourself.
--   2. Read state that survives a refresh, so an unread count means something.
--   3. Realtime on the two tables an inbox has to react to.
--
-- The docs called this "notification only, not a chat product". It is a chat
-- product now, which is why last_read_at gains an index and messages gains a
-- forward-ordered one: an inbox reads threads by recency and a thread reads
-- messages oldest-first, and neither had an index shaped for it.
-- =============================================================================
set search_path = public, extensions;

-- -----------------------------------------------------------------------------
-- One thread per (listing, buyer). Without this, every tap of "Message the
-- owner" opens a new empty thread and the seller's inbox fills with them.
--
-- created_by is the buyer: the person who opened the conversation. The owner is
-- the other participant, and is derivable from the property, so the constraint
-- only needs these two columns.
-- -----------------------------------------------------------------------------
alter table public.message_threads
  add column if not exists created_by uuid references public.profiles(id) on delete set null;

create unique index if not exists message_threads_property_starter_key
  on public.message_threads (property_id, created_by)
  where property_id is not null and created_by is not null;

create index if not exists message_threads_recent_idx
  on public.message_threads (updated_at desc);

create index if not exists messages_thread_forward_idx
  on public.messages (thread_id, created_at asc);

-- -----------------------------------------------------------------------------
-- A thread's updated_at is what orders an inbox, so a new message has to move
-- it. Nothing did.
-- -----------------------------------------------------------------------------
create or replace function public.tg_messages_touch_thread()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  update public.message_threads
     set updated_at = now()
   where id = new.thread_id;
  return null;
end;
$$;

drop trigger if exists messages_touch_thread on public.messages;
create trigger messages_touch_thread
  after insert on public.messages
  for each row execute function public.tg_messages_touch_thread();

-- -----------------------------------------------------------------------------
-- Open (or find) the conversation between the caller and a listing's owner.
--
-- SECURITY DEFINER because it has to add the *owner* as a participant, and the
-- "participants: join" policy deliberately only lets a caller add themselves —
-- otherwise anyone could drag a stranger into a thread.
-- -----------------------------------------------------------------------------
create or replace function public.start_property_conversation(p_property_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_me      uuid := auth.uid();
  v_owner   uuid;
  v_title   text;
  v_thread  uuid;
begin
  if v_me is null then
    raise exception 'sign in to send a message'
      using errcode = 'insufficient_privilege';
  end if;

  if not exists (select 1 from public.profiles where id = v_me and status = 'active' and deleted_at is null) then
    raise exception 'this account cannot send messages'
      using errcode = 'insufficient_privilege';
  end if;

  select p.owner_id, p.title into v_owner, v_title
    from public.properties p
   where p.id = p_property_id
     and p.status = 'published'
     and p.deleted_at is null;

  if v_owner is null then
    raise exception 'listing not found';
  end if;

  if v_owner = v_me then
    raise exception 'this is your own listing'
      using errcode = 'check_violation';
  end if;

  -- Existing conversation wins. The unique index makes this the only outcome
  -- for a second caller too, but checking first avoids relying on a caught
  -- exception for the common path.
  select id into v_thread
    from public.message_threads
   where property_id = p_property_id and created_by = v_me;

  if v_thread is not null then
    return v_thread;
  end if;

  insert into public.message_threads (property_id, created_by, subject)
  values (p_property_id, v_me, left(v_title, 140))
  on conflict (property_id, created_by) where property_id is not null and created_by is not null
    do update set updated_at = now()
  returning id into v_thread;

  insert into public.thread_participants (thread_id, user_id, last_read_at)
  values (v_thread, v_me, now()), (v_thread, v_owner, null)
  on conflict (thread_id, user_id) do nothing;

  return v_thread;
end;
$$;

comment on function public.start_property_conversation is
  'Opens or returns the one conversation between the caller and a listing owner. '
  'Refuses self-messaging and cannot create a duplicate.';

grant execute on function public.start_property_conversation(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Read state.
-- -----------------------------------------------------------------------------
create or replace function public.mark_thread_read(p_thread_id uuid)
returns void
language sql
security definer
set search_path = public, extensions, pg_temp
as $$
  update public.thread_participants
     set last_read_at = now()
   where thread_id = p_thread_id
     and user_id = auth.uid();
$$;

grant execute on function public.mark_thread_read(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- The inbox, in one round trip: thread, counterparty, listing preview, last
-- message, unread count.
--
-- Assembling this client-side would be four queries per thread and would leak
-- the shape of the schema into the component.
-- -----------------------------------------------------------------------------
create or replace function public.list_conversations()
returns jsonb
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select coalesce(jsonb_agg(row order by row->>'updatedAt' desc), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'id', t.id,
      'subject', t.subject,
      'updatedAt', t.updated_at,
      'property', (
        select jsonb_build_object(
          'id', p.id,
          'title', p.title,
          'slug', p.slug,
          'price', p.price,
          'pricePeriod', p.price_period,
          'locality', l.name_en,
          'provinceSlug', (select a.slug from public.locations a
                            where a.path @> l.path and a.level = 'province' limit 1),
          'locationSlug', l.slug,
          'cover', (
            select jsonb_build_object('renditions', i.rendition_paths, 'storagePath', i.storage_path)
              from public.property_images i
             where i.property_id = p.id
             order by i.is_cover desc, i.position asc
             limit 1
          )
        )
        from public.properties p
        join public.locations l on l.id = p.location_id
        where p.id = t.property_id
      ),
      'other', (
        select jsonb_build_object(
          'id', pr.id, 'name', pr.full_name, 'avatarUrl', pr.avatar_url, 'role', pr.role
        )
        from public.thread_participants tp2
        join public.profiles pr on pr.id = tp2.user_id
        where tp2.thread_id = t.id and tp2.user_id <> auth.uid()
        limit 1
      ),
      'lastMessage', (
        select jsonb_build_object(
          'body', m.body, 'createdAt', m.created_at, 'senderId', m.sender_id
        )
        from public.messages m
        where m.thread_id = t.id and m.deleted_at is null
        order by m.created_at desc
        limit 1
      ),
      'unread', (
        select count(*)
          from public.messages m
         where m.thread_id = t.id
           and m.deleted_at is null
           and m.sender_id <> auth.uid()
           and (tp.last_read_at is null or m.created_at > tp.last_read_at)
      )
    ) as row
    from public.thread_participants tp
    join public.message_threads t on t.id = tp.thread_id
    where tp.user_id = auth.uid()
  ) rows;
$$;

grant execute on function public.list_conversations() to authenticated;

-- -----------------------------------------------------------------------------
-- Total unread, for the badge in the navigation.
-- -----------------------------------------------------------------------------
create or replace function public.unread_message_count()
returns integer
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select coalesce(count(*), 0)::integer
    from public.thread_participants tp
    join public.messages m on m.thread_id = tp.thread_id
   where tp.user_id = auth.uid()
     and m.sender_id <> auth.uid()
     and m.deleted_at is null
     and (tp.last_read_at is null or m.created_at > tp.last_read_at);
$$;

grant execute on function public.unread_message_count() to authenticated;

-- -----------------------------------------------------------------------------
-- One thread with its messages. RLS still applies to the reads inside, but the
-- participant test is repeated explicitly so the function refuses rather than
-- returning an empty conversation that looks like a bug.
-- -----------------------------------------------------------------------------
create or replace function public.get_conversation(p_thread_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_me uuid := auth.uid();
  v_out jsonb;
begin
  if v_me is null then
    raise exception 'sign in to continue' using errcode = 'insufficient_privilege';
  end if;

  if not exists (
    select 1 from public.thread_participants
     where thread_id = p_thread_id and user_id = v_me
  ) then
    raise exception 'this conversation is not yours'
      using errcode = 'insufficient_privilege';
  end if;

  select jsonb_build_object(
    'id', t.id,
    'subject', t.subject,
    'property', (
      select jsonb_build_object(
        'id', p.id, 'title', p.title, 'slug', p.slug, 'price', p.price,
        'pricePeriod', p.price_period, 'locality', l.name_en,
        'provinceSlug', (select a.slug from public.locations a
                          where a.path @> l.path and a.level = 'province' limit 1),
        'locationSlug', l.slug,
        'cover', (
          select jsonb_build_object('renditions', i.rendition_paths, 'storagePath', i.storage_path)
            from public.property_images i
           where i.property_id = p.id
           order by i.is_cover desc, i.position asc
           limit 1
        )
      )
      from public.properties p
      join public.locations l on l.id = p.location_id
      where p.id = t.property_id
    ),
    'other', (
      select jsonb_build_object(
        'id', pr.id, 'name', pr.full_name, 'avatarUrl', pr.avatar_url, 'role', pr.role
      )
      from public.thread_participants tp2
      join public.profiles pr on pr.id = tp2.user_id
      where tp2.thread_id = t.id and tp2.user_id <> v_me
      limit 1
    ),
    'messages', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', m.id, 'body', m.body, 'senderId', m.sender_id, 'createdAt', m.created_at
             ) order by m.created_at), '[]'::jsonb)
        from public.messages m
       where m.thread_id = t.id and m.deleted_at is null
    )
  )
  into v_out
  from public.message_threads t
  where t.id = p_thread_id;

  return v_out;
end;
$$;

grant execute on function public.get_conversation(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Administrative access, made explicit and auditable.
--
-- The "messages: participants read" policy already carries `or is_admin()`,
-- which is the platform's stated position. A policy cannot log, though, so the
-- admin UI goes through this instead: same data, plus a row in audit_logs
-- naming who looked at whose conversation and why.
-- -----------------------------------------------------------------------------
create or replace function public.admin_read_conversation(p_thread_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_out jsonb;
begin
  if not public.is_admin() then
    raise exception 'administrators only' using errcode = 'insufficient_privilege';
  end if;

  if p_reason is null or char_length(trim(p_reason)) < 10 then
    raise exception 'a reason of at least 10 characters is required to open a private conversation'
      using errcode = 'check_violation';
  end if;

  perform public.write_audit(
    'update', 'message_threads', p_thread_id,
    trim(p_reason), null,
    jsonb_build_object('action', 'admin_read_conversation')
  );

  select jsonb_build_object(
    'id', t.id,
    'subject', t.subject,
    'participants', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', pr.id, 'name', pr.full_name, 'avatarUrl', pr.avatar_url
             )), '[]'::jsonb)
        from public.thread_participants tp
        join public.profiles pr on pr.id = tp.user_id
       where tp.thread_id = t.id
    ),
    'messages', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', m.id, 'body', m.body, 'senderId', m.sender_id, 'createdAt', m.created_at
             ) order by m.created_at), '[]'::jsonb)
        from public.messages m
       where m.thread_id = t.id
    )
  )
  into v_out
  from public.message_threads t
  where t.id = p_thread_id;

  return v_out;
end;
$$;

grant execute on function public.admin_read_conversation(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Realtime. `messages` was already published; an inbox also has to react when a
-- thread it is not currently looking at gains one, and when its own read marker
-- moves in another tab.
--
-- The client contract is unchanged: an event is a signal, not a payload.
-- Handlers refetch through RLS, so a broadcast cannot leak a message to
-- somebody who could not already read it.
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public' and tablename = 'message_threads'
  ) then
    alter publication supabase_realtime add table public.message_threads;
  end if;

  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public' and tablename = 'thread_participants'
  ) then
    alter publication supabase_realtime add table public.thread_participants;
  end if;
end;
$$;
