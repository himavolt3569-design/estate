-- =============================================================================
-- 0017 — Let people who signed in with Google say what they came to do
-- =============================================================================
-- The email signup form asks "what brings you here?" and passes the answer as
-- signup metadata. Google sends no such metadata, so every OAuth account fell
-- through to `customer` and had no route out: role is a protected column, and
-- only admin_set_user_role() could change it. Someone who signed in with Google
-- to list their house could not list their house.
--
-- Two parts to the fix:
--   1. Record whether the account type was actually CHOSEN or merely defaulted,
--      so the app knows who to ask.
--   2. A self-service switch limited to the same non-privileged pair the signup
--      form already offers. Neither role grants elevated access, so letting a
--      user pick between them is not an escalation. Everything above them still
--      requires an admin.
-- =============================================================================
set search_path = public, extensions;

alter table public.profiles
  add column account_type_chosen_at timestamptz;

comment on column public.profiles.account_type_chosen_at is
  'Set when the user actively picked their account type. Null means it was '
  'defaulted (an OAuth signup), and the app should ask.';

-- Existing accounts predate the column. Anything that is not a plain customer
-- was assigned deliberately, so treat those as already chosen and leave only
-- the ambiguous ones to be asked.
update public.profiles
   set account_type_chosen_at = created_at
 where role <> 'customer';

-- -----------------------------------------------------------------------------
-- Signup: record whether the type was chosen
-- -----------------------------------------------------------------------------
create or replace function public.tg_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_requested text := coalesce(new.raw_user_meta_data ->> 'role', '');
  v_role      public.user_role;
  v_chosen    boolean;
begin
  -- Signup metadata travels through the client and can be forged, so only the
  -- non-privileged subset is honoured. Anything else, including a forged
  -- 'platform_admin', silently becomes a customer.
  if v_requested = 'property_owner' then
    v_role := 'property_owner'; v_chosen := true;
  elsif v_requested = 'agent' then
    v_role := 'agent'; v_chosen := true;
  elsif v_requested = 'customer' then
    v_role := 'customer'; v_chosen := true;
  else
    -- No usable intent: an OAuth signup, or a forged value. Default to the
    -- least-privileged role and flag it as unanswered rather than decided.
    v_role := 'customer'; v_chosen := false;
  end if;

  insert into public.profiles (id, full_name, status, role, account_type_chosen_at)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    case when new.email_confirmed_at is not null then 'active'::public.account_status
         else 'pending_verification'::public.account_status end,
    v_role,
    case when v_chosen then now() end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- The self-service switch
-- -----------------------------------------------------------------------------
create or replace function public.choose_account_type(p_role public.user_role)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_current public.user_role;
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = 'insufficient_privilege';
  end if;

  -- The only two a person may give themselves. Agent and agency_manager need an
  -- agency behind them and stay with the admin; platform_admin obviously does.
  if p_role not in ('customer', 'property_owner') then
    raise exception 'that account type is assigned by the platform, not chosen'
      using errcode = 'insufficient_privilege';
  end if;

  select role into v_current from public.profiles where id = auth.uid();

  -- Guard against a privileged account demoting itself through this path and
  -- then being unable to get back. Only the two switchable roles may switch.
  if v_current not in ('customer', 'property_owner') then
    raise exception 'your account type is managed by the platform'
      using errcode = 'insufficient_privilege';
  end if;

  perform set_config('app.privileged_operation', 'on', true);
  update public.profiles
     set role = p_role, account_type_chosen_at = now()
   where id = auth.uid();
  perform set_config('app.privileged_operation', 'off', true);

  perform public.write_audit(
    'role_change', 'profiles', auth.uid(), 'chosen by the user',
    jsonb_build_object('role', v_current), jsonb_build_object('role', p_role)
  );
end;
$$;

comment on function public.choose_account_type is
  'Self-service switch between customer and property_owner only. Everything '
  'above that pair still requires admin_set_user_role().';

grant execute on function public.choose_account_type to authenticated;
