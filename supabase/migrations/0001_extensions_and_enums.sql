-- =============================================================================
-- 0001 — Extensions, schema hardening, enums, shared trigger helpers
-- =============================================================================
-- Extensions are installed into the `extensions` schema (Supabase convention)
-- rather than `public`, so that a compromised `public` cannot shadow extension
-- functions. SECURITY DEFINER functions in later migrations therefore run with
-- `search_path = public, extensions, pg_temp`.
--
-- That is only safe if untrusted roles cannot CREATE objects in `public` and
-- shadow our own functions, so we revoke that right explicitly below rather
-- than relying on the platform default staying what it is today.
-- =============================================================================

create extension if not exists "pgcrypto"  with schema extensions;
create extension if not exists "postgis"   with schema extensions;
create extension if not exists "ltree"     with schema extensions;
create extension if not exists "pg_trgm"   with schema extensions;

-- -----------------------------------------------------------------------------
-- Schema hardening
-- -----------------------------------------------------------------------------
revoke create on schema public from public;
revoke create on schema public from anon, authenticated;

-- New tables must not be readable by accident. We grant per-table, per-column
-- in 0010 after policies exist.
alter default privileges in schema public revoke all on tables from anon, authenticated;

-- =============================================================================
-- Enums
-- =============================================================================

-- Identity ---------------------------------------------------------------------
create type public.user_role as enum (
  'platform_admin',
  'agency_manager',
  'agent',
  'property_owner',
  'customer'
);

create type public.account_status as enum (
  'pending_verification',
  'active',
  'suspended',
  'banned'
);

-- Location ---------------------------------------------------------------------
create type public.location_level as enum (
  'country',
  'province',
  'district',
  'municipality',
  'ward'
);

-- Catalog ----------------------------------------------------------------------
create type public.property_category as enum (
  'residential',
  'land',
  'commercial'
);

create type public.property_subtype as enum (
  -- residential
  'house', 'apartment', 'villa', 'condo', 'townhouse', 'studio',
  -- land
  'residential_land', 'agricultural_land', 'commercial_land',
  -- commercial
  'office', 'shop', 'warehouse', 'factory'
);

create type public.transaction_type as enum ('sale', 'rent', 'lease', 'short_stay');

create type public.price_period as enum ('month', 'year', 'night');

create type public.property_status as enum (
  'draft',
  'pending_review',
  'published',
  'rejected',
  'sold',
  'rented',
  'archived'
);

create type public.geo_precision as enum ('exact', 'approximate');

-- Nepal uses two traditional area systems alongside metric. Both are in daily
-- use: ropani/aana/paisa/daam in the hills, bigha/kattha/dhur in the terai.
create type public.area_unit as enum (
  'sqm', 'sqft',
  'ropani', 'aana', 'paisa', 'daam',
  'bigha', 'kattha', 'dhur'
);

create type public.video_kind as enum ('upload', 'youtube', 'vimeo', 'virtual_tour');

create type public.document_kind as enum ('floor_plan', 'lalpurja', 'identity', 'other');

create type public.attribute_value_type as enum ('text', 'number', 'boolean', 'enum');

-- Engagement -------------------------------------------------------------------
create type public.enquiry_status as enum ('new', 'read', 'replied', 'closed');

create type public.appointment_status as enum (
  'requested', 'confirmed', 'rescheduled', 'completed', 'cancelled', 'declined'
);

create type public.contact_channel as enum ('phone', 'email', 'whatsapp');

-- Settlement -------------------------------------------------------------------
create type public.payment_provider as enum ('esewa', 'khalti', 'imepay', 'connectips', 'bank');

create type public.payment_status as enum ('pending', 'approved', 'rejected');

-- Trust ------------------------------------------------------------------------
create type public.verification_status as enum ('pending', 'approved', 'rejected');

create type public.review_status as enum ('pending', 'published', 'rejected');

create type public.report_target as enum ('property', 'review', 'user', 'message');

create type public.report_status as enum ('open', 'investigating', 'resolved', 'dismissed');

-- The trust ledger. Append-only history shown to buyers.
create type public.trust_event_type as enum (
  'listed',
  'published',
  'price_changed',
  'relisted',
  'identity_verified',
  'document_sighted',
  'gps_confirmed',
  'reported',
  'report_resolved',
  'verification_revoked'
);

-- Platform ---------------------------------------------------------------------
create type public.notification_type as enum (
  'enquiry', 'appointment', 'message', 'payment', 'moderation', 'saved_search', 'system'
);

create type public.audit_action as enum (
  'create', 'update', 'delete', 'status_change', 'role_change',
  'permission_change', 'contact_reveal', 'verification', 'payment_review',
  'login', 'logout', 'suspend', 'service_role_write'
);

-- =============================================================================
-- Shared trigger helpers
-- =============================================================================

-- Maintains updated_at on any table that carries the column.
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.tg_set_updated_at is
  'Generic updated_at maintenance. Attach as BEFORE UPDATE on every table with the column.';

-- Blocks UPDATE and DELETE outright. Used on append-only tables (audit_logs,
-- trust_events, property_views, auth_events) so that history cannot be rewritten
-- even by the service role, which bypasses RLS.
create or replace function public.tg_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception
    'Table %.% is append-only; % is not permitted',
    tg_table_schema, tg_table_name, tg_op
    using errcode = 'insufficient_privilege';
end;
$$;

comment on function public.tg_append_only is
  'Raises on UPDATE/DELETE. Enforces append-only tables against ALL roles including service_role.';
