-- =============================================================================
-- 0011 — Search, geo, and privileged operations
-- =============================================================================
set search_path = public, extensions;

-- -----------------------------------------------------------------------------
-- Rate limiting. Fixed window. Returns false when the caller is over budget.
-- SECURITY DEFINER because rate_limit_buckets is unreachable by clients: a user
-- who could read it would know how close they are, and one who could write it
-- could reset it.
-- -----------------------------------------------------------------------------
create or replace function public.consume_rate_limit(
  p_bucket   text,
  p_subject  text,
  p_limit    integer,
  p_window   interval default interval '1 hour'
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_window_start timestamptz := to_timestamp(
    floor(extract(epoch from now()) / extract(epoch from p_window)) * extract(epoch from p_window)
  );
  v_count integer;
begin
  insert into public.rate_limit_buckets (bucket, subject, window_start, count)
  values (p_bucket, p_subject, v_window_start, 1)
  on conflict (bucket, subject, window_start)
    do update set count = public.rate_limit_buckets.count + 1
  returning count into v_count;

  return v_count <= p_limit;
end;
$$;

-- -----------------------------------------------------------------------------
-- Deduped view recording. Not writable by clients directly (see 0010) so a
-- competitor cannot inflate or fabricate a listing's analytics.
-- -----------------------------------------------------------------------------
create or replace function public.record_property_view(
  p_property_id uuid,
  p_viewer_hash text,
  p_referrer    text default null
)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if not exists (
    select 1 from public.properties
     where id = p_property_id and status = 'published' and deleted_at is null
  ) then
    return;
  end if;

  insert into public.property_views (property_id, viewer_id, viewer_hash, referrer)
  values (p_property_id, auth.uid(), p_viewer_hash, left(p_referrer, 500))
  on conflict (property_id, viewer_hash, view_date) do nothing;
end;
$$;

-- -----------------------------------------------------------------------------
-- Contact disclosure (threat 3). Checks the vendor's per-listing toggle,
-- enforces the 30/day budget, records who revealed what, and only then returns
-- the value. The number is never in the page payload.
-- -----------------------------------------------------------------------------
create or replace function public.reveal_contact(
  p_property_id uuid,
  p_channel     public.contact_channel
)
returns text
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_subject text := coalesce(auth.uid()::text, 'anon');
  v_allowed boolean;
  v_value   text;
begin
  if auth.uid() is null then
    raise exception 'sign in to see contact details'
      using errcode = 'insufficient_privilege';
  end if;

  if not public.consume_rate_limit('contact_reveal', v_subject, 30, interval '1 day') then
    raise exception 'daily contact reveal limit reached'
      using errcode = 'too_many_connections',
            hint = 'This limit exists to stop bulk harvesting of vendor numbers.';
  end if;

  select
    case p_channel
      when 'phone'    then p.show_phone
      when 'whatsapp' then p.show_whatsapp
      when 'email'    then p.show_email
    end,
    case p_channel
      when 'phone'    then owner.phone
      when 'whatsapp' then owner.phone
      when 'email'    then (select u.email from auth.users u where u.id = owner.id)
    end
    into v_allowed, v_value
    from public.properties p
    join public.profiles owner on owner.id = p.owner_id
   where p.id = p_property_id
     and p.status = 'published'
     and p.deleted_at is null;

  if v_allowed is null then
    raise exception 'listing not found';
  end if;

  if not v_allowed then
    raise exception 'the lister has not shared this channel'
      using errcode = 'insufficient_privilege';
  end if;

  insert into public.contact_reveals (property_id, user_id, subject, channel)
  values (p_property_id, auth.uid(), v_subject, p_channel);

  perform public.write_audit(
    'contact_reveal', 'properties', p_property_id,
    format('revealed %s', p_channel), null, jsonb_build_object('channel', p_channel)
  );

  return v_value;
end;
$$;

-- -----------------------------------------------------------------------------
-- Safe public projection of a listing. Applies the vendor's visibility toggles
-- and omits every private column. /properties/[slug] reads from this, never
-- from the table (Pattern C).
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

    -- Availability flags only. The values themselves require reveal_contact().
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
               'id', i.id, 'renditions', i.rendition_paths, 'blurhash', i.blurhash,
               'width', i.width, 'height', i.height, 'alt', i.alt_text, 'isCover', i.is_cover
             ) order by i.position), '[]'::jsonb)
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

    -- The trust ledger. Public, append-only, and the reason this product exists.
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
-- Payment instructions, gated on the vendor's per-listing disclosure toggle.
-- -----------------------------------------------------------------------------
create or replace function public.get_payment_methods_public(p_property_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', pm.id, 'provider', pm.provider, 'accountName', pm.account_name,
           'accountNumber', pm.account_number, 'bankName', pm.bank_name,
           'qrImagePath', pm.qr_image_path, 'instructions', pm.instructions
         )), '[]'::jsonb)
    from public.properties p
    join public.payment_methods pm on pm.owner_id = p.owner_id
   where p.id = p_property_id
     and p.status = 'published'
     and p.deleted_at is null
     and p.show_payment_info                 -- the vendor's explicit opt-in
     and pm.is_active
     and pm.deleted_at is null
     and auth.uid() is not null;             -- never to anonymous traffic
$$;

-- =============================================================================
-- SEARCH
-- =============================================================================
-- Built with format() rather than one query with CASE branches, because a
-- CASE-driven ORDER BY defeats the composite index and turns a 40 ms keyset scan
-- into a full sort. Every value is passed through USING as a typed parameter;
-- only the ORDER BY fragment and comparison operator are interpolated, and both
-- come from a closed whitelist below. No user text reaches the SQL string.
-- =============================================================================
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
      (select jsonb_build_object('renditions', i.rendition_paths, 'blurhash', i.blurhash,
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
    (p_filters ->> 'listed_after')::timestamptz;                          -- $20
end;
$$;

-- Result counts are capped. An exact count over a large filtered set costs more
-- than the page of results itself, and "1,000+" is as useful to a user as
-- "1,247" while being an order of magnitude cheaper.
create or replace function public.count_properties(p_filters jsonb default '{}'::jsonb)
returns integer
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select count(*)::integer from (
    select 1 from public.search_properties(p_filters, null, 48) limit 1000
  ) s;
$$;

-- -----------------------------------------------------------------------------
-- Map clustering. Below zoom 13 the server returns grid-aggregated counts;
-- above it, individual markers capped at 500. Shipping 4,000 markers to a phone
-- to cluster them client-side is what makes map search feel slow.
-- -----------------------------------------------------------------------------
create or replace function public.cluster_markers(
  p_min_lng double precision,
  p_min_lat double precision,
  p_max_lng double precision,
  p_max_lat double precision,
  p_zoom    integer,
  p_filters jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_bbox geography := st_makeenvelope(p_min_lng, p_min_lat, p_max_lng, p_max_lat, 4326)::geography;
  v_grid double precision;
  v_out  jsonb;
begin
  if p_zoom >= 13 then
    select coalesce(jsonb_agg(jsonb_build_object(
             'type', 'marker', 'id', s.id, 'slug', s.slug, 'lat', s.lat, 'lng', s.lng,
             'price', s.price, 'pricePeriod', s.price_period, 'title', s.title,
             'verified', s.verified, 'cover', s.cover
           )), '[]'::jsonb)
      into v_out
      from public.search_properties(
             p_filters
             || jsonb_build_object('bbox_min_lng', p_min_lng, 'bbox_min_lat', p_min_lat,
                                   'bbox_max_lng', p_max_lng, 'bbox_max_lat', p_max_lat),
             null, 48) s
     where st_intersects(st_setsrid(st_makepoint(s.lng, s.lat), 4326)::geography, v_bbox);
    return v_out;
  end if;

  -- Grid size roughly halves per zoom level.
  v_grid := 40.0 / power(2, greatest(p_zoom, 1));

  select coalesce(jsonb_agg(jsonb_build_object(
           'type', 'cluster',
           'lat', c.lat, 'lng', c.lng, 'count', c.n,
           'minPrice', c.min_price, 'maxPrice', c.max_price
         )), '[]'::jsonb)
    into v_out
    from (
      select avg(st_y(p.geom::geometry))  as lat,
             avg(st_x(p.geom::geometry))  as lng,
             count(*)                     as n,
             min(p.price)                 as min_price,
             max(p.price)                 as max_price
        from public.properties p
       where p.status = 'published'
         and p.deleted_at is null
         and st_intersects(p.geom, v_bbox)
         and ((p_filters ->> 'category') is null
              or p.category = (p_filters ->> 'category')::public.property_category)
         and ((p_filters ->> 'transaction_type') is null
              or p.transaction_type = (p_filters ->> 'transaction_type')::public.transaction_type)
         and ((p_filters ->> 'price_min') is null or p.price >= (p_filters ->> 'price_min')::bigint)
         and ((p_filters ->> 'price_max') is null or p.price <= (p_filters ->> 'price_max')::bigint)
       group by floor(st_x(p.geom::geometry) / v_grid), floor(st_y(p.geom::geometry) / v_grid)
       limit 300
    ) c;

  return v_out;
end;
$$;

-- -----------------------------------------------------------------------------
-- Similar listings for the detail page: same district, same transaction type,
-- comparable price. Ordered by distance so "similar" also means "nearby".
-- -----------------------------------------------------------------------------
create or replace function public.similar_properties(p_property_id uuid, p_limit integer default 6)
returns setof public.properties
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  with base as (
    select p.id, p.geom, p.price, p.transaction_type, p.category, p.location_id
      from public.properties p
     where p.id = p_property_id and p.status = 'published' and p.deleted_at is null
  )
  select p.*
    from public.properties p, base b
   where p.id <> b.id
     and p.status = 'published'
     and p.deleted_at is null
     and p.transaction_type = b.transaction_type
     and p.category = b.category
     and p.price between (b.price * 0.65)::bigint and (b.price * 1.45)::bigint
     and st_dwithin(p.geom, b.geom, 15000)
   order by st_distance(p.geom, b.geom)
   limit least(greatest(p_limit, 1), 12);
$$;

-- =============================================================================
-- Privileged operations — the only sanctioned paths for role and status change
-- =============================================================================
create or replace function public.admin_set_user_role(
  p_user_id uuid,
  p_role    public.user_role,
  p_reason  text default null
)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_old public.user_role;
begin
  if not (public.is_admin() and public.has_permission('user.manage')) then
    raise exception 'user.manage with a second factor is required'
      using errcode = 'insufficient_privilege';
  end if;

  select role into v_old from public.profiles where id = p_user_id;
  if v_old is null then
    raise exception 'user % not found', p_user_id;
  end if;

  -- Locking yourself out of your own platform is not a recoverable mistake.
  if v_old = 'platform_admin' and p_role <> 'platform_admin' then
    if (select count(*) from public.profiles
         where role = 'platform_admin' and status = 'active' and deleted_at is null) <= 1 then
      raise exception 'cannot remove the last active platform admin'
        using errcode = 'check_violation';
    end if;
  end if;

  perform set_config('app.privileged_operation', 'on', true);
  update public.profiles set role = p_role where id = p_user_id;
  perform set_config('app.privileged_operation', 'off', true);

  perform public.write_audit(
    'role_change', 'profiles', p_user_id, p_reason,
    jsonb_build_object('role', v_old), jsonb_build_object('role', p_role)
  );
end;
$$;

-- Atomic suspension: status, sessions, and listings in one transaction. A
-- half-applied suspension leaves a bad actor with a working session.
create or replace function public.suspend_user(p_user_id uuid, p_reason text)
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

  if p_reason is null or char_length(trim(p_reason)) < 5 then
    raise exception 'a suspension reason is required';
  end if;

  perform set_config('app.privileged_operation', 'on', true);

  update public.profiles
     set status = 'suspended', suspended_reason = p_reason, suspended_at = now()
   where id = p_user_id;

  update public.user_sessions
     set revoked_at = now(), revoked_by = auth.uid()
   where user_id = p_user_id and revoked_at is null;

  update public.properties
     set status = 'archived'
   where owner_id = p_user_id and status = 'published';

  perform set_config('app.privileged_operation', 'off', true);

  perform public.write_audit('suspend', 'profiles', p_user_id, p_reason,
                             null, jsonb_build_object('status', 'suspended'));
end;
$$;

-- =============================================================================
-- Engagement guards
-- =============================================================================
-- vendor_id is derived from the property, never accepted from the client, so an
-- enquiry cannot be addressed to an account that does not own the listing.
create or replace function public.tg_enquiries_set_vendor()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  select p.owner_id into new.vendor_id
    from public.properties p where p.id = new.property_id;

  if new.vendor_id is null then
    raise exception 'listing % not found', new.property_id;
  end if;

  if auth.uid() is not null then
    new.customer_id := auth.uid();
  end if;

  return new;
end;
$$;

create trigger enquiries_set_vendor
  before insert on public.enquiries
  for each row execute function public.tg_enquiries_set_vendor();

-- The enquiry text is evidence in any later dispute. The vendor may move it
-- through the workflow but may not edit what was said.
create or replace function public.tg_enquiries_guard()
returns trigger
language plpgsql
as $$
begin
  if new.message is distinct from old.message
     or new.property_id is distinct from old.property_id
     or new.customer_id is distinct from old.customer_id
     or new.vendor_id  is distinct from old.vendor_id then
    raise exception 'an enquiry''s content and parties are immutable'
      using errcode = 'check_violation';
  end if;

  if new.status is distinct from old.status then
    if new.status = 'read'    and new.read_at    is null then new.read_at    := now(); end if;
    if new.status = 'replied' and new.replied_at is null then new.replied_at := now(); end if;
    if new.status = 'closed'  and new.closed_at  is null then new.closed_at  := now(); end if;
  end if;

  return new;
end;
$$;

create trigger enquiries_guard
  before update on public.enquiries
  for each row execute function public.tg_enquiries_guard();

-- Same reasoning for appointments: the vendor confirms or declines, but the
-- customer's requested slots are a record of what was asked for.
create or replace function public.tg_appointments_guard()
returns trigger
language plpgsql
as $$
begin
  if new.confirmed_slot is not null
     and new.confirmed_slot is distinct from old.confirmed_slot
     and not (new.confirmed_slot = any (new.requested_slots)) then
    raise exception 'the confirmed slot must be one the customer offered'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger appointments_guard
  before update on public.appointments
  for each row execute function public.tg_appointments_guard();

-- =============================================================================
-- Function grants — EXECUTE is not granted by default in this schema.
-- =============================================================================
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function
  public.search_properties(jsonb, jsonb, integer),
  public.count_properties(jsonb),
  public.cluster_markers(double precision, double precision, double precision, double precision, integer, jsonb),
  public.similar_properties(uuid, integer),
  public.get_property_public(text),
  public.area_to_sqm(numeric, public.area_unit),
  public.sqm_to_area(numeric, public.area_unit)
to anon, authenticated;

grant execute on function
  public.reveal_contact(uuid, public.contact_channel),
  public.get_payment_methods_public(uuid),
  public.record_property_view(uuid, text, text)
to authenticated;

grant execute on function
  public.admin_set_user_role(uuid, public.user_role, text),
  public.suspend_user(uuid, text)
to authenticated;   -- the functions themselves assert is_admin() + permission

-- -----------------------------------------------------------------------------
-- Policy helper functions.
--
-- An RLS policy expression is evaluated as the QUERYING role, not as the table
-- owner. So every function named inside a policy must be executable by that
-- role, or the query fails with "permission denied for function ..." — which
-- looks like a policy denial but is actually a missing grant, and denies access
-- to legitimate users rather than attackers.
-- -----------------------------------------------------------------------------
grant execute on function
  public.auth_role(),
  public.current_aal(),
  public.is_admin(),
  public.is_active_user(),
  public.has_permission(text),
  public.owns_property(uuid),
  public.owns_property_row(uuid, uuid),
  public.is_thread_participant(uuid),
  public.shares_thread_with(uuid)
to authenticated;

-- Fails the migration if any policy helper is not executable by `authenticated`.
-- This is the guard for the failure mode above: it is easy to add a helper to a
-- policy and forget the grant, and the resulting breakage is silent until a real
-- user hits it.
do $$
declare
  fn text;
  missing text[] := '{}';
begin
  foreach fn in array array[
    'public.auth_role()',
    'public.current_aal()',
    'public.is_admin()',
    'public.is_active_user()',
    'public.has_permission(text)',
    'public.owns_property(uuid)',
    'public.owns_property_row(uuid, uuid)',
    'public.is_thread_participant(uuid)',
    'public.shares_thread_with(uuid)'
  ]
  loop
    if not has_function_privilege('authenticated', fn, 'execute') then
      missing := missing || fn;
    end if;
  end loop;

  if array_length(missing, 1) > 0 then
    raise exception 'policy helpers not executable by authenticated: %',
      array_to_string(missing, ', ');
  end if;
end;
$$;
