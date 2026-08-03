-- =============================================================================
-- 0030 — An append-only table cannot carry a cascading foreign key
--
-- Deleting a profile has never been possible. Postgres implements
-- `on delete set null` as an UPDATE on the child row, and four of the children
-- of `profiles` are append-only tables whose trigger raises on any UPDATE:
--
--   ERROR 42501: Table public.auth_events is append-only; UPDATE is not permitted
--   CONTEXT: SQL statement "UPDATE ONLY public.auth_events SET user_id = NULL ..."
--
-- The two rules contradict each other, so the delete could never succeed — not
-- from the Table Editor, not from the Auth dashboard (which cascades into
-- profiles), and not from the application.
--
-- Which rule gives way is not a toss-up. Nulling the actor on one of these rows
-- IS editing history, and these four tables exist precisely to make that
-- impossible:
--
--   trust_events    docs/02 §6: append-only "so the history shown to a buyer
--                   cannot be edited by the seller or quietly cleaned up by an
--                   admin". A delete that blanks the actor is exactly the quiet
--                   clean-up that sentence rules out.
--   auth_events     The security page tells the account holder "Nobody can
--                   change or delete this list, not even us."
--   contact_reveals The vendor's record of who saw their number.
--   property_views  Analytics a competitor must not be able to rewrite.
--
-- So the foreign key goes and the column stays. These become historical
-- references: the id of whoever acted, kept verbatim, still correct after the
-- account is gone. That is the ordinary shape of an audit trail, and it is what
-- audit_logs.actor_id already does — it never had a foreign key at all, which is
-- why audit_logs is absent from the list below.
--
-- Reads are unaffected. Every join to these columns is a LEFT JOIN or a
-- scalar subquery that already copes with a missing profile, because the column
-- was nullable to begin with.
-- =============================================================================
set search_path = public, extensions;

alter table public.auth_events     drop constraint if exists auth_events_user_id_fkey;
alter table public.contact_reveals drop constraint if exists contact_reveals_user_id_fkey;
alter table public.property_views  drop constraint if exists property_views_viewer_id_fkey;
alter table public.trust_events    drop constraint if exists trust_events_actor_id_fkey;

comment on column public.auth_events.user_id is
  'Historical reference, deliberately not a foreign key: the sign-in log outlives '
  'the account it describes. See 0030.';
comment on column public.contact_reveals.user_id is
  'Historical reference, deliberately not a foreign key. See 0030.';
comment on column public.property_views.viewer_id is
  'Historical reference, deliberately not a foreign key. See 0030.';
comment on column public.trust_events.actor_id is
  'Historical reference, deliberately not a foreign key: the trust ledger must '
  'survive the deletion of the account that acted. See 0030.';

-- A foreign key never created an index on the child side, so nothing is lost
-- above. These two are added because the columns are now the only way back to a
-- person and both are read that way by the admin surfaces.
create index if not exists auth_events_user_idx
  on public.auth_events (user_id, created_at desc) where user_id is not null;
create index if not exists trust_events_actor_idx
  on public.trust_events (actor_id) where actor_id is not null;

-- -----------------------------------------------------------------------------
-- What still blocks a delete, on purpose:
--
--   properties.owner_id  on delete restrict
--   payments.payer_id    on delete restrict
--   payments.payee_id    on delete restrict
--
-- A seller cannot be deleted out from under their listings, and neither party
-- to a payment can vanish from it. Reassign the listings first
-- (adminReassignListing), or suspend the account instead — which is what the
-- product is built around: profiles carries `deleted_at` and `status`, and
-- nothing in the application ever hard-deletes a person.
-- -----------------------------------------------------------------------------
