-- =============================================================================
-- 0032 — A seller publishes their own listing
--
-- Until now a finished draft could only move to `pending_review`, and a human
-- had to approve it before a buyer could see it. The platform owner has asked
-- for that gate to be removed: a seller who has filled the form in goes live
-- when they press the button.
--
-- What this changes
-- -----------------
-- `draft -> published` (and `rejected -> published`, `archived -> published`,
-- and `pending_review -> published` for anything already sitting in the old
-- queue) becomes a transition a vendor may perform on their own listing.
--
-- What this deliberately does NOT change
-- --------------------------------------
--   * `rejected` stays a moderator-only verdict. Removing the gate in front of
--     publication is not the same as removing the admin's ability to take
--     something down, and the control centre still needs somewhere to put a
--     listing it has pulled.
--   * The verified seal (`verified_at`) is untouched and still requires
--     `property.verify`. Publishing is now automatic; being *checked* is still
--     something a person does, which is the distinction the whole product rests
--     on — "live" and "verified" were always two different claims.
--   * The photo minimum and the cover-image rule in
--     tg_properties_require_media() still run, and they already fire on the
--     transition into `published` as well as into `pending_review`. A listing
--     with two photos cannot go live.
--   * `pending_review` remains a valid state and the moderation queue keeps
--     working, so anything submitted before this migration is still reachable
--     and approvable rather than being stranded.
--
-- Ownership is unchanged: "properties: vendor updates own" already scopes every
-- one of these transitions to the caller's own rows, so this widens what an
-- owner may do to their listing and nothing else.
-- =============================================================================
set search_path = public, extensions;

create or replace function public.tg_properties_guard_status()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  -- The audited master-admin path (see 0027). Authorisation happened before the
  -- statement was issued, by code that could see who was asking.
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

  -- Sending a listing back is a verdict on somebody else's work, so it stays
  -- with the people who hold the moderation permission.
  if new.status = 'rejected' and not public.has_permission('property.publish') then
    raise exception 'only a moderator may send a listing back'
      using errcode = 'insufficient_privilege';
  end if;

  -- Vendor-permitted transitions.
  if not public.has_permission('property.publish') then
    if not (
         (old.status in ('draft','rejected','archived','pending_review')
            and new.status = 'published')
      -- Kept so a listing already in the queue can still be pulled back, and so
      -- an older client that has not been redeployed does not start failing.
      or (old.status in ('draft','rejected','archived') and new.status = 'pending_review')
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
  'Moderation guard for authenticated callers. Since 0032 a vendor publishes '
  'their own listing directly; rejection and verification remain moderator acts. '
  'The service role passes through, having been authorised and audited by the '
  'caller (see modules/admin/master.ts).';
