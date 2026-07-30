-- =============================================================================
-- 0019 — The one-time bootstrap for the master admin seat
-- =============================================================================
-- Chicken and egg: admin_set_user_role() requires an existing admin, so the
-- FIRST admin can never be created through it. This function fills that gap and
-- nothing else.
--
-- It is safe because it refuses to run if a master admin already exists. That
-- makes it usable exactly once on a fresh database. After that, the only way to
-- move the seat is transfer_master_admin(), which requires the current admin.
--
-- It is also revoked from `authenticated` and `anon` below: only the service
-- role can call it, which means scripts/seed-master-admin.mjs run by an
-- operator, never a request from a browser.
-- =============================================================================
set search_path = public, extensions;

create or replace function public.bootstrap_master_admin(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if exists (
    select 1 from public.profiles
     where role = 'platform_admin' and deleted_at is null
  ) then
    raise exception 'a master admin already exists; use transfer_master_admin()'
      using errcode = 'unique_violation';
  end if;

  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'no profile for %; create the auth user first', p_user_id;
  end if;

  perform set_config('app.privileged_operation', 'on', true);
  update public.profiles
     set role = 'platform_admin',
         status = 'active',
         account_type_chosen_at = now()
   where id = p_user_id;
  perform set_config('app.privileged_operation', 'off', true);

  perform public.write_audit(
    'role_change', 'profiles', p_user_id, 'master admin bootstrapped',
    null, jsonb_build_object('role', 'platform_admin')
  );
end;
$$;

-- Operator tool only. A browser must never be able to reach this, even in the
-- window before the first admin exists.
revoke execute on function public.bootstrap_master_admin from public, anon, authenticated;
grant execute on function public.bootstrap_master_admin to service_role;

comment on function public.bootstrap_master_admin is
  'One-shot creation of the first master admin. Refuses once one exists. '
  'Callable only by the service role, from scripts/seed-master-admin.mjs.';
