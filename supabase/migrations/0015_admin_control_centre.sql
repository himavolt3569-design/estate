-- =============================================================================
-- 0015 — Master Admin Control Centre
-- =============================================================================
-- Every function here is SECURITY DEFINER and starts by asserting a permission
-- AND aal2 (via is_admin()). None of them accept an actor id from the caller:
-- the actor is always auth.uid(). Every one writes an audit entry, so a
-- moderation decision cannot be made without a record of who made it.
-- =============================================================================
set search_path = public, extensions;

-- -----------------------------------------------------------------------------
-- Dashboard counters
-- -----------------------------------------------------------------------------
-- One round trip instead of nine. Every count is a partial-index lookup, so
-- this stays cheap as the tables grow.
create or replace function public.admin_dashboard_stats()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v jsonb;
begin
  if not public.is_admin() then
    raise exception 'admin access with a second factor is required'
      using errcode = 'insufficient_privilege';
  end if;

  select jsonb_build_object(
    'users_total',        (select count(*) from public.profiles where deleted_at is null),
    'users_new_7d',       (select count(*) from public.profiles
                            where deleted_at is null and created_at > now() - interval '7 days'),
    'users_suspended',    (select count(*) from public.profiles where status = 'suspended'),
    'vendors_total',      (select count(*) from public.profiles
                            where deleted_at is null
                              and role in ('property_owner','agent','agency_manager')),
    'properties_published',(select count(*) from public.properties
                            where status = 'published' and deleted_at is null),
    'properties_pending', (select count(*) from public.properties
                            where status = 'pending_review' and deleted_at is null),
    'properties_total',   (select count(*) from public.properties where deleted_at is null),
    'reports_open',       (select count(*) from public.reports
                            where status in ('open','investigating')),
    'reports_overdue',    (select count(*) from public.reports
                            where status in ('open','investigating') and due_at < now()),
    'payments_pending',   (select count(*) from public.payments where status = 'pending'),
    'enquiries_7d',       (select count(*) from public.enquiries
                            where created_at > now() - interval '7 days'),
    'verifications_pending',(select count(*) from public.verification_requests
                            where status = 'pending')
  ) into v;

  return v;
end;
$$;

comment on function public.admin_dashboard_stats is
  'Counters for the admin overview. Requires platform_admin with aal2.';

-- -----------------------------------------------------------------------------
-- Moderation: publish or reject a pending listing
-- -----------------------------------------------------------------------------
create or replace function public.admin_moderate_property(
  p_property_id uuid,
  p_decision    text,          -- 'approve' | 'reject'
  p_reason      text default null
)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_old public.property_status;
  v_owner uuid;
begin
  if not (public.is_admin() and public.has_permission('property.publish')) then
    raise exception 'property.publish with a second factor is required'
      using errcode = 'insufficient_privilege';
  end if;

  if p_decision not in ('approve','reject') then
    raise exception 'decision must be approve or reject';
  end if;

  -- A rejection without a reason is not a decision, it is a dead end for the
  -- lister. The reason is shown to them and stored on the row.
  if p_decision = 'reject' and (p_reason is null or char_length(trim(p_reason)) < 10) then
    raise exception 'a rejection reason of at least 10 characters is required'
      using errcode = 'check_violation';
  end if;

  select status, owner_id into v_old, v_owner
    from public.properties
   where id = p_property_id and deleted_at is null;

  if v_old is null then
    raise exception 'property % not found', p_property_id;
  end if;

  if v_old <> 'pending_review' then
    raise exception 'property % is %, not pending review', p_property_id, v_old
      using errcode = 'check_violation';
  end if;

  if p_decision = 'approve' then
    update public.properties
       set status = 'published',
           published_at = coalesce(published_at, now()),
           expires_at = now() + interval '90 days',
           rejection_reason = null
     where id = p_property_id;
  else
    update public.properties
       set status = 'rejected', rejection_reason = p_reason
     where id = p_property_id;
  end if;

  -- Tell the lister. A moderation queue that decides silently generates
  -- support load and looks arbitrary.
  insert into public.notifications (user_id, type, title, body, entity_type, entity_id, href)
  values (
    v_owner, 'moderation',
    case when p_decision = 'approve' then 'Your property is now live'
         else 'Your property needs changes' end,
    coalesce(p_reason, case when p_decision = 'approve'
                           then 'Our team checked it and it is published.' end),
    'properties', p_property_id, '/dashboard/listings'
  );

  perform public.write_audit(
    'status_change', 'properties', p_property_id, p_reason,
    jsonb_build_object('status', v_old),
    jsonb_build_object('status', case when p_decision = 'approve' then 'published' else 'rejected' end)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Verification decision (sets the seal on a listing)
-- -----------------------------------------------------------------------------
create or replace function public.admin_set_property_verified(
  p_property_id uuid,
  p_verified    boolean,
  p_reason      text default null
)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if not (public.is_admin() and public.has_permission('property.verify')) then
    raise exception 'property.verify with a second factor is required'
      using errcode = 'insufficient_privilege';
  end if;

  update public.properties
     set verified_at = case when p_verified then now() else null end,
         verified_by = case when p_verified then auth.uid() else null end
   where id = p_property_id and deleted_at is null;

  if not found then
    raise exception 'property % not found', p_property_id;
  end if;

  -- Withdrawing verification is written to the public ledger too. A seal that
  -- can be removed quietly is not worth anything.
  if not p_verified then
    insert into public.trust_events (property_id, event, actor_id, actor_role, detail)
    values (p_property_id, 'verification_revoked', auth.uid(), 'platform_admin',
            jsonb_build_object('reason', p_reason));
  end if;

  perform public.write_audit('verification', 'properties', p_property_id, p_reason,
                             null, jsonb_build_object('verified', p_verified));
end;
$$;

-- -----------------------------------------------------------------------------
-- Reports
-- -----------------------------------------------------------------------------
create or replace function public.admin_resolve_report(
  p_report_id  uuid,
  p_status     public.report_status,
  p_resolution text
)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_old public.report_status;
begin
  if not (public.is_admin() and public.has_permission('report.resolve')) then
    raise exception 'report.resolve with a second factor is required'
      using errcode = 'insufficient_privilege';
  end if;

  if p_status in ('resolved','dismissed')
     and (p_resolution is null or char_length(trim(p_resolution)) < 5) then
    raise exception 'a resolution note is required' using errcode = 'check_violation';
  end if;

  select status into v_old from public.reports where id = p_report_id;
  if v_old is null then
    raise exception 'report % not found', p_report_id;
  end if;

  update public.reports
     set status = p_status,
         resolution = p_resolution,
         resolved_by = case when p_status in ('resolved','dismissed') then auth.uid() end,
         resolved_at = case when p_status in ('resolved','dismissed') then now() end,
         assigned_to = coalesce(assigned_to, auth.uid())
   where id = p_report_id;

  perform public.write_audit('update', 'reports', p_report_id, p_resolution,
                             jsonb_build_object('status', v_old),
                             jsonb_build_object('status', p_status));
end;
$$;

-- -----------------------------------------------------------------------------
-- Payments
-- -----------------------------------------------------------------------------
-- The state machine itself is enforced by tg_payments_guard_transition; this
-- adds the admin permission check and the audit entry on top of it.
create or replace function public.admin_review_payment(
  p_payment_id uuid,
  p_decision   text,           -- 'approve' | 'reject'
  p_reason     text default null
)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_payer uuid;
begin
  if not (public.is_admin() and public.has_permission('payment.verify')) then
    raise exception 'payment.verify with a second factor is required'
      using errcode = 'insufficient_privilege';
  end if;

  if p_decision not in ('approve','reject') then
    raise exception 'decision must be approve or reject';
  end if;

  if p_decision = 'reject' and (p_reason is null or char_length(trim(p_reason)) < 5) then
    raise exception 'a rejection reason is required' using errcode = 'check_violation';
  end if;

  update public.payments
     set status = case when p_decision = 'approve' then 'approved' else 'rejected' end,
         rejection_reason = case when p_decision = 'reject' then p_reason end,
         reviewed_by = auth.uid(),
         reviewed_at = now()
   where id = p_payment_id
  returning payer_id into v_payer;

  if v_payer is null then
    raise exception 'payment % not found or already reviewed', p_payment_id;
  end if;

  insert into public.notifications (user_id, type, title, body, entity_type, entity_id, href)
  values (
    v_payer, 'payment',
    case when p_decision = 'approve' then 'Your payment was accepted'
         else 'Your payment was not accepted' end,
    p_reason, 'payments', p_payment_id, '/dashboard'
  );

  perform public.write_audit('payment_review', 'payments', p_payment_id, p_reason, null,
                             jsonb_build_object('decision', p_decision));
end;
$$;

-- -----------------------------------------------------------------------------
-- Lifting a suspension
-- -----------------------------------------------------------------------------
-- suspend_user() already exists. Its counterpart deliberately does NOT restore
-- the listings it archived: republishing someone's listings on their behalf
-- would put unreviewed content back in front of buyers. They go back through
-- the moderation queue.
create or replace function public.reinstate_user(p_user_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if not (public.is_admin() and public.has_permission('user.suspend')) then
    raise exception 'user.suspend with a second factor is required'
      using errcode = 'insufficient_privilege';
  end if;

  perform set_config('app.privileged_operation', 'on', true);
  update public.profiles
     set status = 'active', suspended_reason = null, suspended_at = null
   where id = p_user_id and status = 'suspended';
  perform set_config('app.privileged_operation', 'off', true);

  if not found then
    raise exception 'user % is not suspended', p_user_id;
  end if;

  perform public.write_audit('update', 'profiles', p_user_id, p_reason,
                             jsonb_build_object('status', 'suspended'),
                             jsonb_build_object('status', 'active'));
end;
$$;

-- -----------------------------------------------------------------------------
-- Realtime
-- -----------------------------------------------------------------------------
-- The admin activity feed subscribes to these. Realtime carries a signal only:
-- the client refetches through RLS, so a broadcast can never leak a row the
-- viewer is not allowed to read.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.properties;
    alter publication supabase_realtime add table public.reports;
    alter publication supabase_realtime add table public.payments;
    alter publication supabase_realtime add table public.profiles;
  end if;
exception
  when duplicate_object then null;
end;
$$;

grant execute on function
  public.admin_dashboard_stats,
  public.admin_moderate_property,
  public.admin_set_property_verified,
  public.admin_resolve_report,
  public.admin_review_payment,
  public.reinstate_user
to authenticated;
