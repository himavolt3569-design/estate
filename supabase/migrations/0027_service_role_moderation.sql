-- =============================================================================
-- 0027 — Let the master admin's audited service-role path through the guard
--
-- Regression introduced by 0021. That migration moved the property.verify test
-- above the early `return new`, to fix a genuine bug: the test was unreachable
-- on a verification-only update, so the permission was never actually enforced.
--
-- What it missed is that the master admin does not reach this trigger as
-- `authenticated`. modules/admin/master.ts writes with the service role, where
-- auth.uid() is NULL, so has_permission() returns false and the trigger raises
-- "only a moderator may change verification status" — at the one person on the
-- platform who holds every permission. Before 0021 the branch was dead code, so
-- the write happened to succeed.
--
-- The same applies to the status branch: an admin publishing, rejecting or
-- archiving through master.ts was equally refused, and would have fallen through
-- to the vendor-transition whitelist besides.
--
-- Why the service role is allowed to pass rather than being made to satisfy
-- has_permission(): it is unreachable from a browser. There is exactly one way
-- to it — createAdminClient(), used only by modules/admin/master.ts — and every
-- function there resolves the caller from the session, refuses anybody who is
-- not an active platform_admin, and writes an audit row naming the actor, the
-- target and the reason before returning. The authorization decision is made
-- there, in code that can identify a human; asking the database to re-derive it
-- from a connection with no user attached is asking for something it cannot
-- know. This is the pattern the architecture already documents for the four
-- privileged operations.
--
-- A client cannot forge this. The Postgres role is set by PostgREST from a
-- verified JWT, and only the service key produces service_role.
-- =============================================================================
set search_path = public, extensions;

create or replace function public.is_service_role()
returns boolean
language sql
stable
as $$
  select current_user = 'service_role';
$$;

comment on function public.is_service_role is
  'True on the server-side privileged path only. Unreachable from a browser: '
  'PostgREST sets the role from a verified JWT and only the service key yields it. '
  'Callers that rely on this must have already authorised a named human and '
  'written an audit row (see modules/admin/master.ts).';

grant execute on function public.is_service_role() to authenticated, anon, service_role;

create or replace function public.tg_properties_guard_status()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  -- The audited master-admin path. Authorisation happened before the statement
  -- was issued, by code that could see who was asking.
  if public.is_service_role() then
    return new;
  end if;

  -- Verification is independent of the status transition, so it is tested
  -- unconditionally rather than below the early return.
  if new.verified_at is distinct from old.verified_at then
    if not public.has_permission('property.verify') then
      raise exception 'only a moderator may change verification status'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  if new.status is not distinct from old.status then
    return new;
  end if;

  if new.status in ('published', 'rejected') then
    if not public.has_permission('property.publish') then
      raise exception 'only a moderator may move a listing to %', new.status
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  -- Vendor-permitted transitions.
  if not public.has_permission('property.publish') then
    if not (
         (old.status = 'draft'          and new.status = 'pending_review')
      or (old.status = 'rejected'       and new.status = 'pending_review')
      or (old.status = 'archived'       and new.status = 'pending_review')
      or (old.status = 'pending_review' and new.status = 'draft')
      or (old.status = 'published'      and new.status in ('sold','rented','archived'))
      or (old.status in ('sold','rented') and new.status = 'archived')
    ) then
      raise exception 'transition % -> % is not permitted for your role', old.status, new.status
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  return new;
end;
$$;

comment on function public.tg_properties_guard_status is
  'Moderation guard for authenticated callers. Permission-based only: MFA is '
  'deliberately not required of the platform admin. The service role passes '
  'through, having been authorised and audited by the caller.';

-- Left behind by a diagnostic session. It exposed nothing, but it has no
-- business being a permanent part of the schema.
drop function if exists public.debug_role_identity();
