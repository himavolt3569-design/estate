-- =============================================================================
-- 0016 — Fix: confirming an email address failed
-- =============================================================================
-- tg_handle_user_confirmed() flips profiles.status from pending_verification to
-- active once GoTrue sets email_confirmed_at. But `status` is a protected
-- column, and tg_prevent_privilege_escalation() rejects any change to it unless
-- the caller is a platform admin or the privileged-operation flag is set.
--
-- Neither was true here. GoTrue performs the confirmation with no auth.uid(),
-- so the guard raised, and because the guard fires inside the same transaction
-- as the UPDATE on auth.users, the raise rolled the confirmation back. The user
-- clicked the link and remained unconfirmed, with no error they could see.
--
-- The fix is the same mechanism admin_set_user_role() already uses: mark the
-- operation as privileged for the duration of the statement. The guard stays
-- fully in force for every other writer, which is the point of it.
-- =============================================================================
set search_path = public, extensions;

create or replace function public.tg_handle_user_confirmed()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if new.email_confirmed_at is not null and old.email_confirmed_at is null then
    -- Scoped to this transaction by the `true` third argument, so it cannot
    -- leak into any later statement on the same connection.
    perform set_config('app.privileged_operation', 'on', true);

    update public.profiles
       set status = 'active'
     where id = new.id and status = 'pending_verification';

    perform set_config('app.privileged_operation', 'off', true);
  end if;

  return new;
end;
$$;

comment on function public.tg_handle_user_confirmed is
  'Promotes a profile to active once the email is confirmed. Runs as a '
  'privileged operation because status is guarded against ordinary writers.';
