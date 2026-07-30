-- =============================================================================
-- 0004 — Property catalog: properties, attributes, features, media
-- =============================================================================
set search_path = public, extensions;

-- -----------------------------------------------------------------------------
-- properties
-- -----------------------------------------------------------------------------
-- One wide table rather than per-category tables: search filters across all
-- categories simultaneously ("anything under 1 crore within 5 km"), and a
-- polymorphic join would make that query unindexable. Category-specific fields
-- live in property_attributes (EAV), with the five hot filter columns mirrored
-- back onto this table by trigger. See docs/02-database-schema.md §3.
create table public.properties (
  id                 uuid primary key default gen_random_uuid(),
  reference_code     text not null unique,
  slug               text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),

  title              text not null check (char_length(trim(title)) between 10 and 140),
  description        text not null check (char_length(trim(description)) between 50 and 5000),

  category           public.property_category not null,
  subtype            public.property_subtype  not null,
  transaction_type   public.transaction_type  not null,

  -- Money is paisa (1/100 NPR) as bigint. Never a float, never a numeric with
  -- rounding ambiguity. A 2.45 crore listing (Rs 24,500,000) is 2_450_000_000.
  price              bigint not null check (price >= 0 and price < 1000000000000000),
  price_period       public.price_period,
  price_negotiable   boolean not null default false,
  service_charge     bigint check (service_charge is null or service_charge >= 0),

  status             public.property_status not null default 'draft',
  rejection_reason   text,

  owner_id           uuid not null references public.profiles(id) on delete restrict,
  agency_id          uuid references public.agencies(id) on delete set null,
  listed_by_role     public.user_role not null,

  location_id        uuid not null references public.locations(id) on delete restrict,
  address_line       text check (char_length(address_line) <= 300),
  geom               geography(Point, 4326) not null,
  geom_precision     public.geo_precision not null default 'exact',

  area_sqm           numeric(14,4) check (area_sqm is null or area_sqm > 0),
  area_unit_entered  public.area_unit not null default 'ropani',
  area_raw           jsonb not null default '{}'::jsonb,
  built_area_sqm     numeric(14,4) check (built_area_sqm is null or built_area_sqm > 0),

  -- Mirrored hot filters. Single writer: tg_sync_hot_attributes(). Do not write
  -- these directly.
  bedrooms           smallint check (bedrooms      is null or bedrooms      between 0 and 100),
  bathrooms          smallint check (bathrooms     is null or bathrooms     between 0 and 100),
  floors             smallint check (floors        is null or floors        between 0 and 200),
  parking            smallint check (parking       is null or parking       between 0 and 100),
  road_access_ft     smallint check (road_access_ft is null or road_access_ft between 0 and 500),

  feature_ids        uuid[] not null default '{}'::uuid[],

  -- Vendor-controlled contact disclosure. Read through reveal_contact() only.
  show_phone         boolean not null default true,
  show_email         boolean not null default false,
  show_whatsapp      boolean not null default true,
  show_payment_info  boolean not null default false,

  view_count         integer not null default 0,
  enquiry_count      integer not null default 0,
  favorite_count     integer not null default 0,

  published_at       timestamptz,
  expires_at         timestamptz,
  verified_at        timestamptz,
  verified_by        uuid references public.profiles(id) on delete set null,

  search_vector      tsvector generated always as (
                       setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
                       setweight(to_tsvector('simple', coalesce(address_line, '')), 'B') ||
                       setweight(to_tsvector('simple', coalesce(description, '')), 'C')
                     ) stored,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz,

  -- A rental must state its period; a sale must not.
  constraint properties_price_period_consistency check (
    (transaction_type = 'sale' and price_period is null)
    or (transaction_type <> 'sale' and price_period is not null)
  ),
  -- The subtype must belong to the declared category.
  constraint properties_subtype_matches_category check (
    (category = 'residential' and subtype in ('house','apartment','villa','condo','townhouse','studio'))
    or (category = 'land'       and subtype in ('residential_land','agricultural_land','commercial_land'))
    or (category = 'commercial' and subtype in ('office','shop','warehouse','factory'))
  ),
  constraint properties_published_has_timestamp check (
    status <> 'published' or published_at is not null
  )
);

create unique index properties_slug_in_location_key
  on public.properties (location_id, slug) where deleted_at is null;

-- Geo: the driver of every "nearby" search. Partial, because ~70% of rows will
-- eventually be drafts/archived/sold and indexing them keeps the hot index out
-- of cache.
create index properties_geom_gix on public.properties using gist (geom)
  where status = 'published' and deleted_at is null;

-- The composite that serves filter + keyset sort in one scan.
create index properties_search_idx on public.properties
  (category, transaction_type, price, published_at desc, id desc)
  where status = 'published' and deleted_at is null;

create index properties_location_idx on public.properties (location_id)
  where status = 'published' and deleted_at is null;
create index properties_subtype_idx on public.properties (subtype, price)
  where status = 'published' and deleted_at is null;
create index properties_bedrooms_idx on public.properties (bedrooms)
  where status = 'published' and deleted_at is null and bedrooms is not null;
create index properties_area_idx on public.properties (area_sqm)
  where status = 'published' and deleted_at is null and area_sqm is not null;
create index properties_verified_idx on public.properties (verified_at)
  where status = 'published' and deleted_at is null and verified_at is not null;

create index properties_fts_gin      on public.properties using gin (search_vector);
create index properties_features_gin on public.properties using gin (feature_ids);

-- Ownership lookups: hit by owns_property() on every single policy evaluation.
create index properties_owner_idx  on public.properties (owner_id)  where deleted_at is null;
create index properties_agency_idx on public.properties (agency_id) where agency_id is not null and deleted_at is null;
create index properties_status_idx on public.properties (status, created_at desc) where deleted_at is null;
-- Moderation queue.
create index properties_pending_idx on public.properties (created_at)
  where status = 'pending_review' and deleted_at is null;
create index properties_expiry_idx on public.properties (expires_at)
  where status = 'published' and deleted_at is null;

comment on table public.properties is 'Listing root. See docs/02-database-schema.md §3.';
comment on column public.properties.price is 'Paisa (1/100 NPR) as bigint. Never a float.';
comment on column public.properties.geom_precision is
  'Vendors may publish an approximate point (~300 m jitter) to protect an occupied home.';

create trigger set_updated_at before update on public.properties
  for each row execute function public.tg_set_updated_at();

-- -----------------------------------------------------------------------------
-- Human-quotable reference code: GB-KTM-4821
-- -----------------------------------------------------------------------------
create sequence public.property_reference_seq start 1000;

create or replace function public.tg_properties_set_reference()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  district_code text;
begin
  if new.reference_code is not null then
    return new;
  end if;

  select upper(substring(regexp_replace(l.name_en, '[^a-zA-Z]', '', 'g') from 1 for 3))
    into district_code
    from public.locations l
   where l.path @> (select p.path from public.locations p where p.id = new.location_id)
     and l.level = 'district'
   limit 1;

  new.reference_code := 'GB-' || coalesce(district_code, 'NPL') || '-'
                        || nextval('public.property_reference_seq')::text;
  return new;
end;
$$;

create trigger properties_set_reference
  before insert on public.properties
  for each row execute function public.tg_properties_set_reference();

-- -----------------------------------------------------------------------------
-- Attribute definitions + values (EAV for the long tail)
-- -----------------------------------------------------------------------------
create table public.attribute_definitions (
  key           text primary key check (key ~ '^[a-z][a-z0-9_]*$'),
  label_en      text not null,
  label_ne      text,
  value_type    public.attribute_value_type not null,
  unit          text,
  options       text[],                       -- for value_type = 'enum'
  applies_to    public.property_subtype[] not null,
  is_required   boolean not null default false,
  min_value     numeric,
  max_value     numeric,
  display_group text not null default 'details',
  position      smallint not null default 0
);

comment on table public.attribute_definitions is
  'Describes which attributes apply to which subtype, their type and validation. '
  'Adding "has solar water heater" is a seed row, not a schema migration.';

create table public.property_attributes (
  property_id  uuid not null references public.properties(id) on delete cascade,
  key          text not null references public.attribute_definitions(key) on delete cascade,
  value_text   text,
  value_number numeric,
  value_bool   boolean,
  primary key (property_id, key),
  constraint property_attributes_one_value check (
    (value_text is not null)::int + (value_number is not null)::int + (value_bool is not null)::int = 1
  )
);

create index property_attributes_key_number_idx on public.property_attributes (key, value_number)
  where value_number is not null;

-- -----------------------------------------------------------------------------
-- Features (amenities)
-- -----------------------------------------------------------------------------
create table public.features (
  id         uuid primary key default gen_random_uuid(),
  key        text not null unique check (key ~ '^[a-z][a-z0-9_]*$'),
  label_en   text not null,
  label_ne   text,
  icon       text,
  category   text not null default 'general',
  position   smallint not null default 0,
  is_active  boolean not null default true
);

create table public.property_features (
  property_id uuid not null references public.properties(id) on delete cascade,
  feature_id  uuid not null references public.features(id) on delete cascade,
  primary key (property_id, feature_id)
);

create index property_features_feature_idx on public.property_features (feature_id);

-- -----------------------------------------------------------------------------
-- Media
-- -----------------------------------------------------------------------------
create table public.property_images (
  id              uuid primary key default gen_random_uuid(),
  property_id     uuid not null references public.properties(id) on delete cascade,
  storage_path    text not null,
  -- {"thumb":"...400.webp","card":"...800.webp","full":"...1920.webp"}
  rendition_paths jsonb not null default '{}'::jsonb,
  width           integer check (width  is null or width  > 0),
  height          integer check (height is null or height > 0),
  bytes           integer check (bytes  is null or bytes between 1 and 5242880),
  blurhash        text,
  phash           text,          -- perceptual hash, for duplicate-listing detection
  alt_text        text check (char_length(alt_text) <= 200),
  position        smallint not null default 0,
  is_cover        boolean not null default false,
  created_at      timestamptz not null default now()
);

create index property_images_property_idx on public.property_images (property_id, position);
create unique index property_images_one_cover on public.property_images (property_id)
  where is_cover;
create index property_images_phash_idx on public.property_images (phash) where phash is not null;

comment on column public.property_images.phash is
  'Perceptual hash. Reposting another listing''s photos is the most common fraud pattern.';

create table public.property_videos (
  id           uuid primary key default gen_random_uuid(),
  property_id  uuid not null references public.properties(id) on delete cascade,
  kind         public.video_kind not null,
  storage_path text,
  external_id  text,
  url          text,
  title        text check (char_length(title) <= 140),
  position     smallint not null default 0,
  created_at   timestamptz not null default now(),
  constraint property_videos_source_present check (
    (kind = 'upload' and storage_path is not null)
    or (kind <> 'upload' and (external_id is not null or url is not null))
  )
);

create index property_videos_property_idx on public.property_videos (property_id, position);

comment on table public.property_videos is
  'External URLs are validated against a host allowlist in the application layer '
  '(YouTube, Vimeo, Matterport, Kuula). An arbitrary iframe source is an XSS vector.';

create table public.property_documents (
  id           uuid primary key default gen_random_uuid(),
  property_id  uuid not null references public.properties(id) on delete cascade,
  kind         public.document_kind not null,
  storage_path text not null,
  file_name    text,
  bytes        integer check (bytes is null or bytes between 1 and 10485760),
  is_public    boolean not null default false,
  uploaded_by  uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  -- The lalpurja (land ownership certificate) is never public, whatever the caller asks for.
  constraint property_documents_private_kinds check (
    not (is_public and kind in ('lalpurja','identity'))
  )
);

create index property_documents_property_idx on public.property_documents (property_id, kind);
