-- =============================================================================
-- 0028 — Detect the service role correctly from inside a SECURITY DEFINER trigger
--
-- 0027 tested `current_user = 'service_role'`. That is right in ordinary code
-- and wrong here: tg_properties_guard_status() is SECURITY DEFINER, so by the
-- time the helper runs, current_user is the function's owner. Measured on this
-- database, from a real PostgREST request made with the service key:
--
--                          outside definer     inside definer
--   current_user           service_role        postgres        <- unusable
--   session_user           authenticator       authenticator   <- unusable
--   current_setting('role')service_role        service_role    <- survives
--   auth.role()            service_role        service_role    <- survives
--
-- Both survivors are set by PostgREST from the verified JWT before the statement
-- runs, and neither is reachable by a client: `authenticated` is not a member of
-- `service_role`, so it cannot SET ROLE to it, and it cannot inject a SET into a
-- PostgREST query. Both are checked, so the test holds whether the caller
-- arrived through PostgREST or through a direct connection that set the role.
-- =============================================================================
set search_path = public, extensions;

create or replace function public.is_service_role()
returns boolean
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  select coalesce(current_setting('role', true), '') = 'service_role'
      or coalesce(auth.role(), '') = 'service_role';
$$;

comment on function public.is_service_role is
  'True on the server-side privileged path only. Read from the GUC and the JWT '
  'claim rather than current_user, which a SECURITY DEFINER context rewrites to '
  'the function owner. Unreachable from a browser: only the service key yields '
  'this role. Callers relying on it must have already authorised a named human '
  'and written an audit row (see modules/admin/master.ts).';

-- Diagnostic helpers from working this out. Not part of the schema.
drop function if exists public.probe_outer();
drop function if exists public.probe_inner();
