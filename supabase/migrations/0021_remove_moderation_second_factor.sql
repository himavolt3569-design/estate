-- =============================================================================
-- 0021 — Remove the second-factor requirement from listing moderation
--
-- 0019 took the aal2 test out of is_admin(), but tg_properties_guard_status()
-- kept its own copies of it. The effect was that the master admin could open the
-- moderation queue and then have every decision rejected by the database with
-- "moderation requires a verified second factor", which is why no listing has
-- ever carried a verified seal.
--
-- The permission tests stay exactly as they were. Only the assurance-level tests
-- are removed, and current_aal() is dropped with them because nothing else calls
-- it.
--
-- This also fixes a real bug in the same function: the verified_at branch sat
-- below an early `return new` that fires whenever status is unchanged, so the
-- property.verify permission was never actually checked on a verification-only
-- update. The permission tests are now reached on every UPDATE.
-- =============================================================================
set search_path = public, extensions;

create or replace function public.tg_properties_guard_status()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  -- Verification is independent of the status transition, so it is tested
  -- first and unconditionally. It used to sit after the early return below,
  -- which made it unreachable for the one update that actually sets it.
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
  'Moderation guard. Permission-based only: MFA is deliberately not required of '
  'the platform admin, so no assurance level is tested here.';

drop function if exists public.current_aal();
