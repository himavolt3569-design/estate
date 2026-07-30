-- =============================================================================
-- 0010 — Row Level Security: grants and policies
-- =============================================================================
-- RLS is enabled on EVERY table in public. A table with RLS on and no policy
-- denies everything, which is the correct default; the meta-check at the bottom
-- of this file fails the migration if a table was added without it.
--
-- Four patterns are used throughout (docs/03-security-model.md §4):
--   A  owner-scoped resource        — USING ownership, WITH CHECK ownership + invariants
--   B  public read of a subset      — SELECT only, narrow predicate
--   C  column-level protection      — sensitive columns reached only via SECURITY DEFINER
--   D  append-only                  — INSERT allowed, UPDATE/DELETE granted to no one
--
-- EVERY update policy carries a WITH CHECK. USING says which rows you may act
-- on; WITH CHECK says what the row may look like afterwards. Without the latter,
-- a vendor could update their own listing and set owner_id to someone else.
-- =============================================================================
set search_path = public, extensions;

grant usage on schema public to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Status-transition guard for properties.
-- WITH CHECK cannot see OLD, so the "who may publish" rule lives in a trigger.
-- -----------------------------------------------------------------------------
create or replace function public.tg_properties_guard_status()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  -- Publishing, rejecting and verifying are moderation acts. Only a permission
  -- holder with a satisfied second factor may perform them, whatever the client
  -- asked for.
  --
  -- The aal2 requirement is repeated here rather than left to the RLS policy
  -- alone. A policy denial on UPDATE silently filters the row to zero rows
  -- affected; raising here means an aal1 moderator gets told why, and the
  -- guarantee survives any future policy that grants a broader UPDATE path.
  if new.status in ('published', 'rejected') then
    if not public.has_permission('property.publish') then
      raise exception 'only a moderator may move a listing to %', new.status
        using errcode = 'insufficient_privilege';
    end if;
    if public.current_aal() <> 'aal2' then
      raise exception 'moderation requires a verified second factor'
        using errcode = 'insufficient_privilege',
              hint = 'Complete the 2FA challenge and try again.';
    end if;
  end if;

  if new.verified_at is distinct from old.verified_at then
    if not public.has_permission('property.verify') then
      raise exception 'only a moderator may change verification status'
        using errcode = 'insufficient_privilege';
    end if;
    if public.current_aal() <> 'aal2' then
      raise exception 'verification requires a verified second factor'
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

create trigger properties_guard_status
  before update on public.properties
  for each row execute function public.tg_properties_guard_status();

-- =============================================================================
-- IDENTITY
-- =============================================================================

alter table public.profiles enable row level security;

-- Column-level grant: layer 3 of 3 protecting role/status. `authenticated` has
-- no UPDATE privilege on those columns at all, so even a policy mistake cannot
-- expose them. Role changes go through admin_set_user_role() (SECURITY DEFINER).
grant select on public.profiles to authenticated;
grant update (
  full_name, phone, avatar_url, bio, preferred_locale, preferred_area_unit, last_seen_at
) on public.profiles to authenticated;

-- Threat 3 (contact harvesting): anonymous visitors get no direct read of
-- profiles at all. Public vendor details are served by get_property_public().
revoke all on public.profiles from anon;

create policy "profiles: read own"
  on public.profiles for select to authenticated
  using (id = auth.uid());

-- A vendor must be able to see who enquired; a customer must be able to see the
-- vendor they are talking to. Scoped strictly to actual counterparties.
create policy "profiles: read counterparties"
  on public.profiles for select to authenticated
  using (
    exists (
      select 1 from public.enquiries e
       where (e.customer_id = auth.uid() and e.vendor_id = profiles.id)
          or (e.vendor_id   = auth.uid() and e.customer_id = profiles.id)
    )
    or exists (
      select 1 from public.appointments a
       where (a.customer_id = auth.uid() and a.vendor_id = profiles.id)
          or (a.vendor_id   = auth.uid() and a.customer_id = profiles.id)
    )
    or public.shares_thread_with(profiles.id)
  );

create policy "profiles: admin reads all"
  on public.profiles for select to authenticated
  using (public.is_admin());

-- WITH CHECK repeats the row predicate so a user cannot rewrite their row into
-- somebody else's id. role/status are additionally unreachable via the grant.
create policy "profiles: update own"
  on public.profiles for update to authenticated
  using (id = auth.uid() and deleted_at is null)
  with check (id = auth.uid());

-- -----------------------------------------------------------------------------
alter table public.agencies enable row level security;
grant select on public.agencies to anon, authenticated;
grant insert, update on public.agencies to authenticated;

create policy "agencies: public reads verified"          -- Pattern B
  on public.agencies for select to anon, authenticated
  using (status = 'active' and deleted_at is null);

create policy "agencies: members read own"
  on public.agencies for select to authenticated
  using (
    public.is_admin()
    or owner_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.agency_id = agencies.id)
  );

create policy "agencies: manager updates own"            -- Pattern A
  on public.agencies for update to authenticated
  using (
    public.is_active_user()
    and (owner_id = auth.uid() or public.is_admin())
    and deleted_at is null
  )
  with check (
    -- The agency cannot be handed to another account, and its verification
    -- cannot be self-granted.
    (owner_id = auth.uid() or public.is_admin())
    and (public.is_admin() or status = 'active')
  );

create policy "agencies: admin writes"
  on public.agencies for insert to authenticated
  with check (public.is_admin() or auth.uid() = owner_id);

-- -----------------------------------------------------------------------------
-- RBAC reference data: readable so the UI can render capability, never writable.
alter table public.permissions      enable row level security;
alter table public.role_permissions enable row level security;
grant select on public.permissions, public.role_permissions to authenticated;

create policy "permissions: readable"
  on public.permissions for select to authenticated using (true);
create policy "role_permissions: readable"
  on public.role_permissions for select to authenticated using (true);
-- No INSERT/UPDATE/DELETE policy: authorization data changes only by migration.

-- -----------------------------------------------------------------------------
alter table public.user_sessions enable row level security;
grant select, update on public.user_sessions to authenticated;

create policy "sessions: read own"
  on public.user_sessions for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- Revocation is the only permitted mutation, and only forward.
create policy "sessions: revoke own"
  on public.user_sessions for update to authenticated
  using ((user_id = auth.uid() or public.is_admin()) and revoked_at is null)
  with check (revoked_at is not null);

-- -----------------------------------------------------------------------------
alter table public.auth_events enable row level security;    -- Pattern D
grant select on public.auth_events to authenticated;
-- No INSERT policy: written by SECURITY DEFINER helpers only.
-- No UPDATE/DELETE policy, plus tg_append_only blocks even the service role.

create policy "auth_events: read own"
  on public.auth_events for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- -----------------------------------------------------------------------------
alter table public.mfa_recovery_codes enable row level security;
grant select on public.mfa_recovery_codes to authenticated;
-- Only the hash column is ever stored; codes are issued and consumed by
-- SECURITY DEFINER functions, so no write policy exists.

create policy "mfa codes: read own metadata"
  on public.mfa_recovery_codes for select to authenticated
  using (user_id = auth.uid());

-- -----------------------------------------------------------------------------
alter table public.rate_limit_buckets enable row level security;
revoke all on public.rate_limit_buckets from anon, authenticated;
-- Reached only through consume_rate_limit(). If a user could read this table
-- they could measure how close they are to a limit; if they could write it they
-- could reset it.

-- =============================================================================
-- LOCATION — public reference data
-- =============================================================================
alter table public.locations enable row level security;
grant select on public.locations to anon, authenticated;

create policy "locations: public read"                     -- Pattern B
  on public.locations for select to anon, authenticated
  using (is_active);

create policy "locations: admin writes"
  on public.locations for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- =============================================================================
-- CATALOG
-- =============================================================================
alter table public.properties enable row level security;
grant select on public.properties to anon, authenticated;
grant insert, update, delete on public.properties to authenticated;

-- Pattern B. This is the only way anonymous traffic sees a listing, and it is
-- SELECT-only. Note it grants nothing about drafts, so a vendor's unpublished
-- work is invisible to everyone else including other vendors.
create policy "properties: public reads published"
  on public.properties for select to anon, authenticated
  using (status = 'published' and deleted_at is null);

-- Pattern A read side. Vendors additionally see their own work in any status.
create policy "properties: vendor reads own"
  on public.properties for select to authenticated
  using (public.owns_property_row(owner_id, agency_id));

create policy "properties: admin reads all"
  on public.properties for select to authenticated
  using (public.is_admin());

-- A vendor creates only in their own name, only as a draft, and only while
-- active. `status = 'draft'` in WITH CHECK is what stops an insert that arrives
-- pre-published.
create policy "properties: vendor creates own draft"
  on public.properties for insert to authenticated
  with check (
    public.is_active_user()
    and public.has_permission('property.create')
    and public.owns_property_row(owner_id, agency_id)
    and status = 'draft'
    and deleted_at is null
  );

-- WITH CHECK re-asserts ownership on the NEW row, which is what prevents a
-- vendor from reassigning their listing to another account. The status
-- transition rules live in tg_properties_guard_status (WITH CHECK cannot see OLD).
create policy "properties: vendor updates own"
  on public.properties for update to authenticated
  using (
    public.is_active_user()
    and public.has_permission('property.edit')
    and public.owns_property_row(owner_id, agency_id)
    and deleted_at is null
  )
  with check (public.owns_property_row(owner_id, agency_id));

create policy "properties: admin updates all"
  on public.properties for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Hard DELETE is never granted. Removal is a soft delete via UPDATE, so an
-- erroneous deletion is always recoverable and the audit trail survives.
create policy "properties: nobody hard-deletes"
  on public.properties for delete to authenticated
  using (false);

-- -----------------------------------------------------------------------------
-- Child tables of a property inherit its authorization via owns_property().
-- -----------------------------------------------------------------------------
alter table public.property_images    enable row level security;
alter table public.property_videos    enable row level security;
alter table public.property_attributes enable row level security;
alter table public.property_features  enable row level security;
alter table public.property_documents enable row level security;

grant select on public.property_images, public.property_videos,
                public.property_attributes, public.property_features to anon, authenticated;
grant insert, update, delete on public.property_images, public.property_videos,
                public.property_attributes, public.property_features to authenticated;
grant select, insert, delete on public.property_documents to authenticated;
revoke all on public.property_documents from anon;

do $$
declare
  t text;
begin
  foreach t in array array['property_images','property_videos','property_attributes','property_features']
  loop
    -- Public read, but only for listings that are themselves public.
    execute format($p$
      create policy "%1$s: public reads published parent"
        on public.%1$I for select to anon, authenticated
        using (exists (
          select 1 from public.properties p
           where p.id = %1$I.property_id and p.status = 'published' and p.deleted_at is null
        ));
    $p$, t);

    execute format($p$
      create policy "%1$s: vendor reads own"
        on public.%1$I for select to authenticated
        using (public.owns_property(%1$I.property_id) or public.is_admin());
    $p$, t);

    execute format($p$
      create policy "%1$s: vendor writes own"
        on public.%1$I for insert to authenticated
        with check (public.is_active_user() and public.owns_property(%1$I.property_id));
    $p$, t);

    execute format($p$
      create policy "%1$s: vendor updates own"
        on public.%1$I for update to authenticated
        using (public.is_active_user() and public.owns_property(%1$I.property_id))
        with check (public.owns_property(%1$I.property_id));
    $p$, t);

    execute format($p$
      create policy "%1$s: vendor deletes own"
        on public.%1$I for delete to authenticated
        using (public.is_active_user() and public.owns_property(%1$I.property_id));
    $p$, t);
  end loop;
end;
$$;

-- Documents are never public as a class. The lalpurja is the ownership
-- certificate; publishing it would be a gift to identity thieves.
create policy "property_documents: owner and admin only"
  on public.property_documents for select to authenticated
  using (public.owns_property(property_id) or public.is_admin());

create policy "property_documents: owner uploads"
  on public.property_documents for insert to authenticated
  with check (public.is_active_user() and public.owns_property(property_id) and uploaded_by = auth.uid());

create policy "property_documents: owner deletes"
  on public.property_documents for delete to authenticated
  using (public.is_active_user() and public.owns_property(property_id));

-- -----------------------------------------------------------------------------
alter table public.features               enable row level security;
alter table public.attribute_definitions  enable row level security;
grant select on public.features, public.attribute_definitions to anon, authenticated;

create policy "features: public read"
  on public.features for select to anon, authenticated using (is_active);
create policy "features: admin writes"
  on public.features for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "attribute_definitions: public read"
  on public.attribute_definitions for select to anon, authenticated using (true);
create policy "attribute_definitions: admin writes"
  on public.attribute_definitions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- =============================================================================
-- ENGAGEMENT
-- =============================================================================
alter table public.favorites enable row level security;
grant select, insert, delete on public.favorites to authenticated;

create policy "favorites: own only"
  on public.favorites for select to authenticated using (user_id = auth.uid());
create policy "favorites: add own"
  on public.favorites for insert to authenticated
  with check (public.is_active_user() and user_id = auth.uid());
create policy "favorites: remove own"
  on public.favorites for delete to authenticated using (user_id = auth.uid());

-- -----------------------------------------------------------------------------
alter table public.saved_searches enable row level security;
grant select, insert, update, delete on public.saved_searches to authenticated;

create policy "saved_searches: own only"
  on public.saved_searches for select to authenticated using (user_id = auth.uid());
create policy "saved_searches: create own"
  on public.saved_searches for insert to authenticated
  with check (public.is_active_user() and user_id = auth.uid());
create policy "saved_searches: update own"
  on public.saved_searches for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "saved_searches: delete own"
  on public.saved_searches for delete to authenticated using (user_id = auth.uid());

-- -----------------------------------------------------------------------------
alter table public.property_views enable row level security;      -- Pattern D
grant select on public.property_views to authenticated;
-- Written only by record_property_view(). No INSERT policy for clients: a client
-- that could insert directly could fabricate a competitor's analytics.

create policy "property_views: vendor reads own analytics"
  on public.property_views for select to authenticated
  using (public.owns_property(property_id) or public.is_admin());

-- -----------------------------------------------------------------------------
alter table public.enquiries enable row level security;
grant select, insert, update on public.enquiries to authenticated;
grant insert on public.enquiries to anon;   -- guests may enquire

create policy "enquiries: participants read"
  on public.enquiries for select to authenticated
  using (customer_id = auth.uid() or public.owns_property(property_id) or public.is_admin());

-- vendor_id is derived from the property by trigger, not trusted from the
-- client, so an enquiry cannot be addressed to an arbitrary account.
create policy "enquiries: anyone may enquire on a published listing"
  on public.enquiries for insert to anon, authenticated
  with check (
    exists (
      select 1 from public.properties p
       where p.id = property_id and p.status = 'published' and p.deleted_at is null
    )
    and (customer_id is null or customer_id = auth.uid())
  );

-- The vendor may only move it along the workflow; the message itself is
-- immutable (enforced in tg_enquiries_guard below).
create policy "enquiries: vendor updates status"
  on public.enquiries for update to authenticated
  using (public.is_active_user() and (public.owns_property(property_id) or public.is_admin()))
  with check (public.owns_property(property_id) or public.is_admin());

-- -----------------------------------------------------------------------------
alter table public.appointments enable row level security;
grant select, insert, update on public.appointments to authenticated;

create policy "appointments: participants read"
  on public.appointments for select to authenticated
  using (customer_id = auth.uid() or vendor_id = auth.uid()
         or public.owns_property(property_id) or public.is_admin());

create policy "appointments: customer requests"
  on public.appointments for insert to authenticated
  with check (
    public.is_active_user()
    and customer_id = auth.uid()
    and exists (
      select 1 from public.properties p
       where p.id = property_id and p.status = 'published' and p.deleted_at is null
    )
  );

create policy "appointments: participants update"
  on public.appointments for update to authenticated
  using (
    public.is_active_user()
    and (customer_id = auth.uid() or vendor_id = auth.uid() or public.is_admin())
  )
  with check (customer_id = auth.uid() or vendor_id = auth.uid() or public.is_admin());

-- -----------------------------------------------------------------------------
alter table public.message_threads      enable row level security;
alter table public.thread_participants  enable row level security;
alter table public.messages             enable row level security;
grant select, insert on public.message_threads to authenticated;
grant select, insert, update on public.thread_participants to authenticated;
grant select, insert, update on public.messages to authenticated;

create policy "threads: participants read"
  on public.message_threads for select to authenticated
  using (public.is_thread_participant(message_threads.id) or public.is_admin());

create policy "threads: create"
  on public.message_threads for insert to authenticated
  with check (public.is_active_user());

-- Delegates to a SECURITY DEFINER helper rather than querying this same table,
-- which would re-enter this policy and raise "infinite recursion detected".
create policy "participants: read own threads"
  on public.thread_participants for select to authenticated
  using (user_id = auth.uid() or public.is_thread_participant(thread_participants.thread_id));

create policy "participants: join"
  on public.thread_participants for insert to authenticated
  with check (public.is_active_user());

create policy "participants: update own read marker"
  on public.thread_participants for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "messages: participants read"
  on public.messages for select to authenticated
  using (public.is_thread_participant(messages.thread_id) or public.is_admin());

-- sender_id must be the caller: you cannot put words in another user's mouth.
create policy "messages: participants send"
  on public.messages for insert to authenticated
  with check (
    public.is_active_user()
    and sender_id = auth.uid()
    and public.is_thread_participant(messages.thread_id)
  );

create policy "messages: sender soft-deletes own"
  on public.messages for update to authenticated
  using (sender_id = auth.uid()) with check (sender_id = auth.uid());

-- -----------------------------------------------------------------------------
alter table public.contact_reveals enable row level security;      -- Pattern D
grant select on public.contact_reveals to authenticated;
-- Insert happens only inside reveal_contact(); a client-side insert would be a
-- way to forge the rate-limit ledger.

create policy "contact_reveals: vendor sees who revealed"
  on public.contact_reveals for select to authenticated
  using (public.owns_property(property_id) or user_id = auth.uid() or public.is_admin());

-- =============================================================================
-- SETTLEMENT
-- =============================================================================
alter table public.payment_methods enable row level security;
grant select, insert, update, delete on public.payment_methods to authenticated;
-- Pattern C: anonymous has no access at all. Public display of payment
-- instructions goes through get_payment_methods_public(), which applies the
-- vendor's per-listing show_payment_info toggle.
revoke all on public.payment_methods from anon;

create policy "payment_methods: owner reads own"
  on public.payment_methods for select to authenticated
  using (owner_id = auth.uid() or public.is_admin());

create policy "payment_methods: owner creates own"
  on public.payment_methods for insert to authenticated
  with check (public.is_active_user() and owner_id = auth.uid());

create policy "payment_methods: owner updates own"
  on public.payment_methods for update to authenticated
  using (public.is_active_user() and owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "payment_methods: owner deletes own"
  on public.payment_methods for delete to authenticated
  using (owner_id = auth.uid());

-- -----------------------------------------------------------------------------
alter table public.payments enable row level security;
grant select, insert, update on public.payments to authenticated;
revoke all on public.payments from anon;

create policy "payments: participants read"
  on public.payments for select to authenticated
  using (payer_id = auth.uid() or payee_id = auth.uid()
         or public.owns_property(property_id) or public.is_admin());

create policy "payments: payer submits proof"
  on public.payments for insert to authenticated
  with check (
    public.is_active_user()
    and payer_id = auth.uid()
    and status = 'pending'          -- cannot arrive pre-approved
    and reviewed_by is null
    and exists (
      select 1 from public.properties p
       where p.id = property_id and p.status = 'published' and p.deleted_at is null
    )
  );

-- Only the payee or an admin may review, and only with payment.verify. The
-- one-way state machine and the immutability of proof/amount are enforced by
-- tg_payments_guard_transition.
create policy "payments: payee or admin reviews"
  on public.payments for update to authenticated
  using (
    public.is_active_user()
    and public.has_permission('payment.verify')
    and (payee_id = auth.uid() or public.owns_property(property_id) or public.is_admin())
  )
  with check (payee_id = auth.uid() or public.owns_property(property_id) or public.is_admin());

-- =============================================================================
-- TRUST
-- =============================================================================
alter table public.verification_requests enable row level security;
grant select, insert on public.verification_requests to authenticated;
grant update on public.verification_requests to authenticated;

create policy "verification: requester reads own"
  on public.verification_requests for select to authenticated
  using (requested_by = auth.uid() or public.is_admin());

create policy "verification: user requests own"
  on public.verification_requests for insert to authenticated
  with check (public.is_active_user() and requested_by = auth.uid() and status = 'pending');

create policy "verification: admin decides"
  on public.verification_requests for update to authenticated
  using (public.is_admin() and public.has_permission('property.verify'))
  with check (public.is_admin());

-- -----------------------------------------------------------------------------
alter table public.trust_events enable row level security;         -- Pattern D
grant select on public.trust_events to anon, authenticated;
-- No write policy anywhere: the ledger is written exclusively by triggers, and
-- tg_append_only blocks UPDATE/DELETE for every role. This is what makes the
-- provenance shown to a buyer trustworthy.

create policy "trust_events: public for published listings"
  on public.trust_events for select to anon, authenticated
  using (exists (
    select 1 from public.properties p
     where p.id = trust_events.property_id and p.status = 'published' and p.deleted_at is null
  ));

create policy "trust_events: vendor and admin read all"
  on public.trust_events for select to authenticated
  using (public.owns_property(property_id) or public.is_admin());

-- -----------------------------------------------------------------------------
alter table public.reviews enable row level security;
grant select on public.reviews to anon, authenticated;
grant insert, update on public.reviews to authenticated;

create policy "reviews: public reads published"
  on public.reviews for select to anon, authenticated
  using (status = 'published' and deleted_at is null);

create policy "reviews: author reads own"
  on public.reviews for select to authenticated
  using (author_id = auth.uid() or public.is_admin());

create policy "reviews: author writes own"
  on public.reviews for insert to authenticated
  with check (
    public.is_active_user()
    and author_id = auth.uid()
    and status = 'pending'          -- everything is moderated before it appears
  );

create policy "reviews: author edits own pending"
  on public.reviews for update to authenticated
  using (author_id = auth.uid() and status = 'pending')
  with check (author_id = auth.uid() and status = 'pending');

create policy "reviews: moderator decides"
  on public.reviews for update to authenticated
  using (public.has_permission('review.moderate') and public.is_admin())
  with check (public.is_admin());

-- -----------------------------------------------------------------------------
alter table public.reports enable row level security;
grant select, insert on public.reports to authenticated;
grant update on public.reports to authenticated;

create policy "reports: reporter reads own"
  on public.reports for select to authenticated
  using (reporter_id = auth.uid() or public.is_admin());

create policy "reports: anyone active may report"
  on public.reports for insert to authenticated
  with check (public.is_active_user() and reporter_id = auth.uid() and status = 'open');

create policy "reports: moderator resolves"
  on public.reports for update to authenticated
  using (public.has_permission('report.resolve') and public.is_admin())
  with check (public.is_admin());

-- =============================================================================
-- PLATFORM
-- =============================================================================
alter table public.notifications enable row level security;
grant select, update on public.notifications to authenticated;
-- Insert is server-side only: a client that could insert notifications could
-- phish other users inside the product's own UI.

create policy "notifications: read own"
  on public.notifications for select to authenticated using (user_id = auth.uid());

create policy "notifications: mark own read"
  on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- -----------------------------------------------------------------------------
alter table public.push_subscriptions enable row level security;
grant select, insert, delete on public.push_subscriptions to authenticated;

create policy "push: own only"
  on public.push_subscriptions for select to authenticated using (user_id = auth.uid());
create policy "push: register own"
  on public.push_subscriptions for insert to authenticated
  with check (public.is_active_user() and user_id = auth.uid());
create policy "push: remove own"
  on public.push_subscriptions for delete to authenticated using (user_id = auth.uid());

-- -----------------------------------------------------------------------------
alter table public.audit_logs enable row level security;           -- Pattern D
grant select on public.audit_logs to authenticated;

-- Requires audit.view AND aal2 (is_admin embeds the second-factor check).
create policy "audit: admin reads"
  on public.audit_logs for select to authenticated
  using (public.is_admin() and public.has_permission('audit.view'));

-- -----------------------------------------------------------------------------
alter table public.system_health enable row level security;
grant select on public.system_health to authenticated;

create policy "system_health: admin reads"
  on public.system_health for select to authenticated
  using (public.is_admin() and public.has_permission('system.manage'));

-- =============================================================================
-- Meta-check: fail the migration if any public table lacks RLS.
-- =============================================================================
-- This is the guard that makes "RLS on every table" a property of the system
-- rather than a habit. Mirrored as a pgTAP test so it also runs in CI.
do $$
declare
  missing text;
begin
  select string_agg(c.relname, ', ' order by c.relname)
    into missing
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind in ('r', 'p')
     and not c.relrowsecurity;

  if missing is not null then
    raise exception 'RLS is not enabled on: %', missing;
  end if;
end;
$$;
