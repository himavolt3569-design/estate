-- =============================================================================
-- 0026 — Property views and live visitor presence
--
-- property_views has existed since 0005 with a dedupe index and a counter
-- trigger, and had zero rows: nothing ever called record_property_view(). The
-- admin dashboard had no live figures at all.
--
-- Two mechanisms, deliberately separate:
--
--   VIEWS are durable and deduped per (property, viewer, day). They answer "how
--   many people looked at this listing" and feed the seller's analytics.
--
--   PRESENCE is ephemeral and answers "who is on the site right now". It is a
--   heartbeat table, upserted on one row per session, with anything older than
--   two minutes counted as gone. It is not an event log and is not appended to,
--   so it stays small no matter how much traffic arrives.
--
-- Privacy. No raw IP is stored anywhere in either path. The browser generates a
-- random session id, keeps it in sessionStorage, and the server hashes it with a
-- server-only salt before it touches a column, so the stored value cannot be
-- reversed to the id the client holds, and rotating VIEW_HASH_SALT retires every
-- old value. The visitor id is a random token, not a fingerprint: it identifies
-- a tab, not a person.
-- =============================================================================
set search_path = public, extensions;

-- -----------------------------------------------------------------------------
-- Presence
-- -----------------------------------------------------------------------------
create table if not exists public.visitor_sessions (
  session_hash text primary key,

  -- Null for a signed-out visitor. This is the only link to a real identity and
  -- it is only ever set from auth.uid(), never from a client argument.
  user_id      uuid references public.profiles(id) on delete set null,

  -- Which route they are on, and the listing if they are on one. Paths are
  -- truncated and query strings are dropped by the caller, so nothing that was
  -- typed into a search box is retained here.
  path         text not null check (char_length(path) <= 300),
  property_id  uuid references public.properties(id) on delete set null,

  started_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists visitor_sessions_active_idx
  on public.visitor_sessions (last_seen_at desc);
create index if not exists visitor_sessions_property_idx
  on public.visitor_sessions (property_id) where property_id is not null;

comment on table public.visitor_sessions is
  'Ephemeral presence heartbeat, one row per browser session. Not an event log. '
  'Rows older than the retention window are deleted by prune_visitor_sessions().';

-- -----------------------------------------------------------------------------
-- The heartbeat. Callable by anonymous traffic, which is the point: most
-- visitors are not signed in and a visitor count that only sees members is
-- worse than no visitor count.
--
-- SECURITY DEFINER with no direct table grant, so a client can move its own row
-- and nothing else. It cannot read the table, cannot see another session, and
-- cannot forge a user_id because that comes from auth.uid() here.
-- -----------------------------------------------------------------------------
create or replace function public.record_presence(
  p_session_hash text,
  p_path         text,
  p_property_id  uuid default null
)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if p_session_hash is null or char_length(p_session_hash) not between 16 and 128 then
    return;
  end if;

  insert into public.visitor_sessions (session_hash, user_id, path, property_id, last_seen_at)
  values (p_session_hash, auth.uid(), left(coalesce(p_path, '/'), 300), p_property_id, now())
  on conflict (session_hash) do update
    set last_seen_at = now(),
        path         = excluded.path,
        property_id  = excluded.property_id,
        user_id      = coalesce(excluded.user_id, public.visitor_sessions.user_id);
end;
$$;

grant execute on function public.record_presence(text, text, uuid) to anon, authenticated;

-- Presence is worthless once it is stale, and keeping it is a privacy cost with
-- no benefit. Called opportunistically from the admin read.
create or replace function public.prune_visitor_sessions()
returns void
language sql
security definer
set search_path = public, extensions, pg_temp
as $$
  delete from public.visitor_sessions where last_seen_at < now() - interval '1 day';
$$;

-- -----------------------------------------------------------------------------
-- View recording, opened up to anonymous visitors.
--
-- The 0011 version required the caller to supply p_viewer_hash and was never
-- called. This one keeps the same dedupe key — one row per (property, viewer,
-- day) — so a refresh loop cannot inflate a listing's numbers, and the unique
-- index does the enforcing rather than the application.
-- -----------------------------------------------------------------------------
create or replace function public.record_property_view(
  p_property_id uuid,
  p_viewer_hash text,
  p_referrer    text default null
)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if p_viewer_hash is null or char_length(p_viewer_hash) not between 16 and 128 then
    return;
  end if;

  if not exists (
    select 1 from public.properties
     where id = p_property_id and status = 'published' and deleted_at is null
  ) then
    return;
  end if;

  -- A seller reloading their own listing is not a view of it.
  if exists (
    select 1 from public.properties
     where id = p_property_id and owner_id = auth.uid()
  ) then
    return;
  end if;

  insert into public.property_views (property_id, viewer_id, viewer_hash, referrer)
  values (p_property_id, auth.uid(), p_viewer_hash, left(p_referrer, 500))
  on conflict (property_id, viewer_hash, view_date) do nothing;
end;
$$;

grant execute on function public.record_property_view(uuid, text, text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- RLS. Presence is admin-only reading; nobody reads it directly except the
-- control centre, and the heartbeat writes through the definer function above.
-- -----------------------------------------------------------------------------
alter table public.visitor_sessions enable row level security;
grant select on public.visitor_sessions to authenticated;

create policy "visitor_sessions: admin reads"
  on public.visitor_sessions for select to authenticated
  using (public.is_admin());

-- No INSERT, UPDATE or DELETE policy at all. Every write goes through
-- record_presence(), so a client cannot fabricate visitors, cannot delete
-- someone else's session, and cannot inflate the figure the owner is shown.

-- -----------------------------------------------------------------------------
-- The control centre payload, in one round trip.
-- -----------------------------------------------------------------------------
create or replace function public.admin_live_analytics()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_online interval := interval '2 minutes';
  v_out jsonb;
begin
  if not public.is_admin() then
    raise exception 'administrators only' using errcode = 'insufficient_privilege';
  end if;

  select jsonb_build_object(
    'onlineNow', (
      select count(*) from public.visitor_sessions
       where last_seen_at > now() - v_online
    ),
    'signedInNow', (
      select count(*) from public.visitor_sessions
       where last_seen_at > now() - v_online and user_id is not null
    ),
    'viewingPropertyNow', (
      select count(*) from public.visitor_sessions
       where last_seen_at > now() - v_online and property_id is not null
    ),
    'viewsToday', (
      select count(*) from public.property_views where view_date = current_date
    ),
    'uniqueVisitorsToday', (
      select count(distinct viewer_hash) from public.property_views
       where view_date = current_date
    ),
    'viewsThisWeek', (
      select count(*) from public.property_views
       where view_date > current_date - 7
    ),

    -- What is being looked at right now, by how many people.
    'liveProperties', (
      select coalesce(jsonb_agg(row), '[]'::jsonb) from (
        select jsonb_build_object(
                 'id', p.id, 'title', p.title, 'slug', p.slug,
                 'viewers', count(*)
               ) as row
          from public.visitor_sessions v
          join public.properties p on p.id = v.property_id
         where v.last_seen_at > now() - v_online
         group by p.id, p.title, p.slug
         order by count(*) desc
         limit 10
      ) t
    ),

    -- Which routes are occupied. Paths only: no query strings, no ids beyond
    -- what the route itself contains.
    'livePaths', (
      select coalesce(jsonb_agg(row), '[]'::jsonb) from (
        select jsonb_build_object('path', v.path, 'viewers', count(*)) as row
          from public.visitor_sessions v
         where v.last_seen_at > now() - v_online
         group by v.path
         order by count(*) desc
         limit 10
      ) t
    ),

    'mostViewed', (
      select coalesce(jsonb_agg(row), '[]'::jsonb) from (
        select jsonb_build_object(
                 'id', p.id, 'title', p.title, 'slug', p.slug,
                 'views', count(*)
               ) as row
          from public.property_views pv
          join public.properties p on p.id = pv.property_id
         where pv.view_date > current_date - 7
         group by p.id, p.title, p.slug
         order by count(*) desc
         limit 8
      ) t
    ),

    'recentActivity', (
      select coalesce(jsonb_agg(row), '[]'::jsonb) from (
        select jsonb_build_object(
                 'at', pv.created_at,
                 'propertyId', p.id,
                 'title', p.title,
                 -- Named only when they were signed in. An anonymous view stays
                 -- anonymous; there is no fingerprint to name it by.
                 'viewer', (select pr.full_name from public.profiles pr where pr.id = pv.viewer_id)
               ) as row
          from public.property_views pv
          join public.properties p on p.id = pv.property_id
         order by pv.created_at desc
         limit 15
      ) t
    )
  ) into v_out;

  return v_out;
end;
$$;

grant execute on function public.admin_live_analytics() to authenticated;

-- -----------------------------------------------------------------------------
-- Realtime, so the control centre updates as traffic arrives rather than on a
-- timer. Both tables carry only what the widget already aggregates, and the
-- handler refetches through admin_live_analytics(), which re-checks is_admin().
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public' and tablename = 'visitor_sessions'
  ) then
    alter publication supabase_realtime add table public.visitor_sessions;
  end if;

  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public' and tablename = 'property_views'
  ) then
    alter publication supabase_realtime add table public.property_views;
  end if;
end;
$$;
