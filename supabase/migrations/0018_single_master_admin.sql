-- =============================================================================
-- 0018 — Exactly one master admin, ever
-- =============================================================================
-- The platform has a single owner. Nothing in the product should be able to
-- mint a second master admin, including a bug in our own admin tooling.
--
-- Three doors were already shut:
--   * tg_handle_new_user() only honours customer / property_owner / agent from
--     signup metadata, so a forged role in a signup payload is discarded.
--   * choose_account_type() refuses anything outside customer / property_owner.
--   * admin_set_user_role() requires an existing admin with a second factor.
--
-- What was missing is a rule that holds even when the caller IS a legitimate
-- admin, or when someone reaches the table with the service role and bypasses
-- RLS entirely. A unique index is that rule: the database will simply refuse to
-- store a second one.
-- =============================================================================
set search_path = public, extensions;

-- A unique index over a constant, restricted to admins, permits exactly one
-- matching row. Soft-deleted rows are excluded so the seat can be reassigned.
create unique index profiles_single_platform_admin
  on public.profiles ((true))
  where role = 'platform_admin' and deleted_at is null;

comment on index public.profiles_single_platform_admin is
  'At most one platform_admin. Enforced in storage, so it survives a bug in the '
  'admin tools and a service-role write that bypasses RLS.';

-- -----------------------------------------------------------------------------
-- Handing the seat over
-- -----------------------------------------------------------------------------
-- With the index in place, promoting a second person now fails with a unique
-- violation, which is a confusing thing to read. This makes the transfer
-- explicit and atomic: the outgoing admin is demoted and the incoming one
-- promoted in a single statement, so there is never a moment with zero admins
-- and never a moment with two.
create or replace function public.transfer_master_admin(p_to_user_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_from uuid;
begin
  if not (public.is_admin() and public.has_permission('user.manage')) then
    raise exception 'only the current master admin can hand over the seat'
      using errcode = 'insufficient_privilege';
  end if;

  if p_reason is null or char_length(trim(p_reason)) < 10 then
    raise exception 'handing over the platform needs a reason of at least 10 characters'
      using errcode = 'check_violation';
  end if;

  select id into v_from from public.profiles
   where role = 'platform_admin' and deleted_at is null;

  if v_from = p_to_user_id then
    raise exception 'that account is already the master admin';
  end if;

  if not exists (select 1 from public.profiles
                  where id = p_to_user_id and status = 'active' and deleted_at is null) then
    raise exception 'the incoming admin must be an active account';
  end if;

  perform set_config('app.privileged_operation', 'on', true);
  -- Demote first: the unique index would reject the promotion otherwise.
  update public.profiles set role = 'property_owner' where id = v_from;
  update public.profiles set role = 'platform_admin', account_type_chosen_at = now()
   where id = p_to_user_id;
  perform set_config('app.privileged_operation', 'off', true);

  perform public.write_audit(
    'role_change', 'profiles', p_to_user_id, p_reason,
    jsonb_build_object('master_admin', v_from),
    jsonb_build_object('master_admin', p_to_user_id)
  );
end;
$$;

grant execute on function public.transfer_master_admin to authenticated;
