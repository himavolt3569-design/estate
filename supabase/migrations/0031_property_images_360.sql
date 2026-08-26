-- Add 360 photo support to property_images
ALTER TABLE property_images ADD COLUMN is_360 boolean NOT NULL DEFAULT false;
ALTER TABLE property_images ADD COLUMN hotspots jsonb NOT NULL DEFAULT '[]'::jsonb;

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
               'width', i.width, 'height', i.height, 'alt', i.alt_text, 'isCover', i.is_cover,
               'is360', i.is_360, 'hotspots', i.hotspots
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
