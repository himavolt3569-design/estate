-- =============================================================================
-- 0022 — Make images reachable, and make published listings visible
--
-- Two defects, both of which made correct data look like missing data.
--
-- 1. MEDIA. property_images carries both `storage_path` (the object that was
--    actually uploaded) and `rendition_paths` (a {thumb,card,full} map). The
--    uploader only ever wrote the first; every reader only ever read the second.
--    So thirteen uploaded photos, all present in the bucket, rendered as "No
--    photo" everywhere. The fix is to treat storage_path as the source of truth
--    and rendition_paths as an optimisation that may be absent: readers now
--    receive both and fall back. No re-upload is required, and no backfill
--    invents renditions that were never generated.
--
-- 2. VISIBILITY. search_properties() had no expiry predicate, so a lapsed
--    listing kept appearing, and it had no way to order verified listings first,
--    which is what the home page needs. `verified_first` is added as a sort
--    rather than as a filter, because filtering on verified_at is what left the
--    home page permanently empty while /search worked.
-- =============================================================================
set search_path = public, extensions;

-- -----------------------------------------------------------------------------
-- Media hygiene, applied once to the rows that exist.
-- -----------------------------------------------------------------------------

-- Photos were uploaded in more than one batch and each batch numbered itself
-- from zero, so a property could have two images at position 0 and two at
-- position 1. Renumber deterministically, keeping the cover first and then the
-- order the rows were created in, which is the order they were uploaded in.
with ordered as (
  select id,
         row_number() over (
           partition by property_id
           order by is_cover desc, position asc, created_at asc, id asc
         ) - 1 as new_position
    from public.property_images
)
update public.property_images i
   set position = o.new_position
  from ordered o
 where o.id = i.id
   and i.position is distinct from o.new_position;

-- A listing with photos must have exactly one cover. Where none was ever set,
-- promote the first.
with missing as (
  select distinct property_id
    from public.property_images
   where property_id not in (
     select property_id from public.property_images where is_cover
   )
),
promote as (
  select distinct on (i.property_id) i.id
    from public.property_images i
    join missing m on m.property_id = i.property_id
   order by i.property_id, i.position asc, i.created_at asc
)
update public.property_images
   set is_cover = true
 where id in (select id from promote);

-- -----------------------------------------------------------------------------
-- Public projection: hand the caller the storage path as well as the renditions.
-- -----------------------------------------------------------------------------
create or replace function public.get_property_public(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select jsonb_build_object(
    'id', p.id,
    'referenceCode', p.reference_code,
    'slug', p.slug,
    'title', p.title,
    'description', p.description,
    'category', p.category,
    'subtype', p.subtype,
    'transactionType', p.transaction_type,
    'price', p.price,
    'pricePeriod', p.price_period,
    'priceNegotiable', p.price_negotiable,
    'serviceCharge', p.service_charge,
    'areaSqm', p.area_sqm,
    'areaUnitEntered', p.area_unit_entered,
    'areaRaw', p.area_raw,
    'builtAreaSqm', p.built_area_sqm,
    'bedrooms', p.bedrooms,
    'bathrooms', p.bathrooms,
    'floors', p.floors,
    'parking', p.parking,
    'addressLine', p.address_line,
    'lat', st_y(p.geom::geometry),
    'lng', st_x(p.geom::geometry),
    'geomPrecision', p.geom_precision,
    'verifiedAt', p.verified_at,
    'publishedAt', p.published_at,
    'viewCount', p.view_count,
    'favoriteCount', p.favorite_count,
    'listedByRole', p.listed_by_role,

    'contact', jsonb_build_object(
      'phone', p.show_phone, 'email', p.show_email, 'whatsapp', p.show_whatsapp
    ),
    'showPaymentInfo', p.show_payment_info,

    'location', (
      select jsonb_build_object(
        'id', l.id, 'nameEn', l.name_en, 'nameNe', l.name_ne,
        'slug', l.slug, 'level', l.level, 'path', l.path::text,
        'ancestors', (
          select coalesce(jsonb_agg(jsonb_build_object(
                   'nameEn', a.name_en, 'slug', a.slug, 'level', a.level
                 ) order by nlevel(a.path)), '[]'::jsonb)
            from public.locations a
           where a.path @> l.path and a.id <> l.id
        )
      ) from public.locations l where l.id = p.location_id
    ),

    'vendor', (
      select jsonb_build_object(
        'id', v.id,
        'name', v.full_name,
        'avatarUrl', v.avatar_url,
        'role', v.role,
        'identityVerified', v.identity_verified_at is not null,
        'memberSince', v.created_at,
        'agency', (
          select jsonb_build_object('id', ag.id, 'name', ag.name, 'slug', ag.slug,
                                    'logoUrl', ag.logo_url, 'verified', ag.verified_at is not null)
            from public.agencies ag where ag.id = v.agency_id
        )
      ) from public.profiles v where v.id = p.owner_id
    ),

    'images', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', i.id,
               'renditions', i.rendition_paths,
               -- The object that was actually uploaded. Renditions are derived
               -- from it and may not exist; this always does.
               'storagePath', i.storage_path,
               'blurhash', i.blurhash,
               'width', i.width, 'height', i.height, 'alt', i.alt_text, 'isCover', i.is_cover
             ) order by i.is_cover desc, i.position), '[]'::jsonb)
        from public.property_images i where i.property_id = p.id
    ),
    'videos', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', vd.id, 'kind', vd.kind, 'externalId', vd.external_id,
               'url', vd.url, 'title', vd.title
             ) order by vd.position), '[]'::jsonb)
        from public.property_videos vd where vd.property_id = p.id
    ),
    'floorPlans', (
      select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'path', d.storage_path))
             , '[]'::jsonb)
        from public.property_documents d
       where d.property_id = p.id and d.kind = 'floor_plan' and d.is_public
    ),
    'attributes', (
      select coalesce(jsonb_object_agg(pa.key,
               coalesce(to_jsonb(pa.value_number), to_jsonb(pa.value_bool), to_jsonb(pa.value_text))
             ), '{}'::jsonb)
        from public.property_attributes pa where pa.property_id = p.id
    ),
    'features', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'key', f.key, 'labelEn', f.label_en, 'labelNe', f.label_ne, 'icon', f.icon
             ) order by f.position), '[]'::jsonb)
        from public.property_features pf
        join public.features f on f.id = pf.feature_id
       where pf.property_id = p.id and f.is_active
    ),

    'trustLedger', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'event', te.event, 'at', te.created_at, 'detail', te.detail
             ) order by te.created_at), '[]'::jsonb)
        from public.trust_events te where te.property_id = p.id
    )
  )
  from public.properties p
  where p.slug = p_slug
    and p.status = 'published'
    and p.deleted_at is null
  limit 1;
$$;

comment on function public.get_property_public is
  'The only public read path for a listing. Contact values are excluded by design; '
  'the client receives availability flags and must call reveal_contact() for a value.';

-- -----------------------------------------------------------------------------
-- Search: expiry predicate, storage_path on the cover, verified_first sort.
-- -----------------------------------------------------------------------------
create or replace function public.search_properties(
  p_filters jsonb    default '{}'::jsonb,
  p_cursor  jsonb    default null,
  p_limit   integer  default 24
)
returns table (
  id             uuid,
  reference_code text,
  slug           text,
  title          text,
  category       public.property_category,
  subtype        public.property_subtype,
  transaction_type public.transaction_type,
  price          bigint,
  price_period   public.price_period,
  area_sqm       numeric,
  bedrooms       smallint,
  bathrooms      smallint,
  address_line   text,
  location_name  text,
  location_slug  text,
  province_slug  text,
  lat            double precision,
  lng            double precision,
  distance_m     double precision,
  cover          jsonb,
  verified       boolean,
  listed_by_role public.user_role,
  published_at   timestamptz,
  favorite_count integer
)
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_sort      text := coalesce(p_filters ->> 'sort', 'newest');
  v_order     text;
  v_keyset    text := '';
  v_sql       text;
  v_lat       double precision := (p_filters ->> 'lat')::double precision;
  v_lng       double precision := (p_filters ->> 'lng')::double precision;
  v_radius    double precision := coalesce((p_filters ->> 'radius_m')::double precision, 0);
  v_point     geography;
begin
  p_limit := least(greatest(coalesce(p_limit, 24), 1), 48);

  if v_lat is not null and v_lng is not null then
    v_point := st_setsrid(st_makepoint(v_lng, v_lat), 4326)::geography;
  end if;

  -- Closed whitelist. Anything unrecognised falls back to 'newest'.
  case v_sort
    when 'price_asc'  then v_order := 'p.price asc, p.id asc';
    when 'price_desc' then v_order := 'p.price desc, p.id desc';
    -- Verified listings lead, newest within each group. This is what the home
    -- page asks for: a checked listing earns the top of the page, but an
    -- unchecked one is still on it.
    when 'verified_first' then v_order := '(p.verified_at is not null) desc, p.published_at desc, p.id desc';
    when 'distance'   then v_order := case when v_point is null
                                           then 'p.published_at desc, p.id desc'
                                           else 'distance_m asc, p.id asc' end;
    else                   v_order := 'p.published_at desc, p.id desc';
  end case;

  -- Keyset pagination. Row comparison so the composite index is used directly;
  -- OFFSET 10000 would scan 10000 rows, this scans p_limit.
  if p_cursor is not null then
    case v_sort
      when 'price_asc'  then v_keyset := ' and (p.price, p.id) > ($10::bigint, $11::uuid) ';
      when 'price_desc' then v_keyset := ' and (p.price, p.id) < ($10::bigint, $11::uuid) ';
      -- Three-part cursor, because the sort is three-part. Postgres orders
      -- false before true, which is the same direction the ORDER BY uses.
      when 'verified_first' then v_keyset :=
        ' and ((p.verified_at is not null), p.published_at, p.id) < ($21::boolean, $12::timestamptz, $11::uuid) ';
      when 'distance'   then v_keyset := case when v_point is null
                                              then ' and (p.published_at, p.id) < ($12::timestamptz, $11::uuid) '
                                              else ' and (st_distance(p.geom, $9::geography), p.id) > ($13::double precision, $11::uuid) ' end;
      else                   v_keyset := ' and (p.published_at, p.id) < ($12::timestamptz, $11::uuid) ';
    end case;
  end if;

  v_sql := format($q$
    select
      p.id, p.reference_code, p.slug, p.title, p.category, p.subtype, p.transaction_type,
      p.price, p.price_period, p.area_sqm, p.bedrooms, p.bathrooms, p.address_line,
      l.name_en as location_name,
      l.slug    as location_slug,
      (select a.slug from public.locations a
        where a.path @> l.path and a.level = 'province' limit 1) as province_slug,
      st_y(p.geom::geometry) as lat,
      st_x(p.geom::geometry) as lng,
      case when $9::geography is null then null
           else st_distance(p.geom, $9::geography) end as distance_m,
      (select jsonb_build_object('renditions', i.rendition_paths,
                                 'storagePath', i.storage_path,
                                 'blurhash', i.blurhash,
                                 'alt', i.alt_text, 'width', i.width, 'height', i.height)
         from public.property_images i
        where i.property_id = p.id
        order by i.is_cover desc, i.position asc
        limit 1) as cover,
      p.verified_at is not null as verified,
      p.listed_by_role, p.published_at, p.favorite_count
    from public.properties p
    join public.locations l on l.id = p.location_id
    where p.status = 'published'
      and p.deleted_at is null
      -- A listing runs for 90 days and the vendor renews it. Without this an
      -- expired listing stayed on the site forever.
      and (p.expires_at is null or p.expires_at > now())
      and ($1::text is null or p.search_vector @@ plainto_tsquery('simple', $1))
      and ($2::public.property_category   is null or p.category = $2)
      and ($3::public.transaction_type    is null or p.transaction_type = $3)
      and ($4::public.property_subtype[]  is null or p.subtype = any($4))
      and ($5::bigint is null or p.price >= $5)
      and ($6::bigint is null or p.price <= $6)
      and ($7::smallint is null or p.bedrooms  >= $7)
      and ($8::smallint is null or p.bathrooms >= $8)
      and ($9::geography is null or st_dwithin(p.geom, $9::geography, $14::double precision))
      and ($15::uuid[] is null or p.feature_ids @> $15)
      and ($16::text is null or l.path <@ $16::ltree)
      and ($17::numeric is null or p.area_sqm >= $17)
      and ($18::numeric is null or p.area_sqm <= $18)
      and (not $19::boolean or p.verified_at is not null)
      and ($20::timestamptz is null or p.published_at >= $20)
      %s
    order by %s
    limit %s
  $q$, v_keyset, v_order, p_limit);

  return query execute v_sql using
    nullif(p_filters ->> 'q', ''),                                        -- $1
    (p_filters ->> 'category')::public.property_category,                 -- $2
    (p_filters ->> 'transaction_type')::public.transaction_type,          -- $3
    case when p_filters ? 'subtypes'
         then (select array_agg(value::text::public.property_subtype)
                 from jsonb_array_elements_text(p_filters -> 'subtypes')) end,  -- $4
    (p_filters ->> 'price_min')::bigint,                                  -- $5
    (p_filters ->> 'price_max')::bigint,                                  -- $6
    (p_filters ->> 'bedrooms_min')::smallint,                             -- $7
    (p_filters ->> 'bathrooms_min')::smallint,                            -- $8
    v_point,                                                              -- $9
    (p_cursor ->> 'price')::bigint,                                       -- $10
    (p_cursor ->> 'id')::uuid,                                            -- $11
    (p_cursor ->> 'published_at')::timestamptz,                           -- $12
    (p_cursor ->> 'distance')::double precision,                          -- $13
    nullif(v_radius, 0),                                                  -- $14
    case when p_filters ? 'features'
         then (select array_agg((value #>> '{}')::uuid)
                 from jsonb_array_elements(p_filters -> 'features')) end,  -- $15
    nullif(p_filters ->> 'location_path', ''),                            -- $16
    (p_filters ->> 'area_min_sqm')::numeric,                              -- $17
    (p_filters ->> 'area_max_sqm')::numeric,                              -- $18
    coalesce((p_filters ->> 'verified_only')::boolean, false),            -- $19
    (p_filters ->> 'listed_after')::timestamptz,                          -- $20
    (p_cursor ->> 'verified')::boolean;                                   -- $21
end;
$$;

-- The expiry predicate is now part of the hot path, so the partial index that
-- serves it should know about it too.
create index if not exists properties_live_idx
  on public.properties (published_at desc, id desc)
  where status = 'published' and deleted_at is null;

create index if not exists properties_verified_live_idx
  on public.properties ((verified_at is not null) desc, published_at desc, id desc)
  where status = 'published' and deleted_at is null;
