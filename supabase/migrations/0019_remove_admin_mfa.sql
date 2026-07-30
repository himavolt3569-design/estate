-- =============================================================================
-- 0019 — Remove Admin MFA Requirement
-- Overrides the is_admin() function to remove the AAL2 (TOTP) requirement,
-- as requested by the user, effectively bypassing MFA for platform admins.
-- =============================================================================

set search_path = public, extensions;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select exists (
    select 1 from public.profiles p
     where p.id = auth.uid()
       and p.role = 'platform_admin'
       and p.status = 'active'
       and p.deleted_at is null
  );
$$;

comment on function public.is_admin is
  'Platform admin check without AAL2 requirement. MFA has been explicitly disabled for this role.';
