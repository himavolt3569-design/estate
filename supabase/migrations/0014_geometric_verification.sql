-- =============================================================================
-- 0014 — Automated location verification by Intersection over Union
-- =============================================================================
-- The most common listing fraud is not a fake photograph, it is a real plot
-- advertised at the wrong location: a Budhanilkantha price on a plot that is
-- actually two districts away, or a boundary drawn to include a neighbour's
-- frontage.
--
-- IoU answers that geometrically and for free. We compare the boundary the
-- lister claims against a reference polygon (an OpenStreetMap building or
-- landuse footprint at those coordinates, fetched by the app from Overpass) and
-- score the overlap:
--
--     IoU = area(A ∩ B) / area(A ∪ B)
--
-- 1.0 is a perfect match, 0.0 is no overlap at all. This is the standard
-- object-detection metric, applied to parcels rather than bounding boxes.
--
-- Nothing here calls an external service and no user data leaves the database.
-- Areas are computed in EPSG:32645 (UTM 45N), which covers Nepal, so the result
-- is in real square metres rather than degrees.
-- =============================================================================
set search_path = public, extensions;

-- The boundary the lister draws, if they draw one. A point is still required
-- (properties.geom); this is the optional polygon that makes IoU possible.
alter table public.properties
  add column claimed_boundary geography(Polygon, 4326);

create index properties_claimed_boundary_gix
  on public.properties using gist (claimed_boundary)
  where claimed_boundary is not null;

comment on column public.properties.claimed_boundary is
  'Optional plot boundary drawn by the lister. Scored against a reference '
  'footprint by verify_property_location().';

-- -----------------------------------------------------------------------------
-- The metric
-- -----------------------------------------------------------------------------
create or replace function public.parcel_iou(
  a geography(Polygon, 4326),
  b geography(Polygon, 4326)
)
returns numeric
language sql
immutable
parallel safe
as $$
  with projected as (
    select
      ST_Transform(a::geometry, 32645) as ga,
      ST_Transform(b::geometry, 32645) as gb
  ),
  parts as (
    select
      ST_Area(ST_Intersection(ga, gb)) as intersection_m2,
      ST_Area(ST_Union(ga, gb))        as union_m2
    from projected
  )
  select case
           when union_m2 is null or union_m2 <= 0 then 0::numeric
           else round((intersection_m2 / union_m2)::numeric, 4)
         end
  from parts;
$$;

comment on function public.parcel_iou is
  'Intersection over Union of two parcel polygons, 0..1. Areas in EPSG:32645 '
  '(UTM 45N) so the ratio is computed on real metres, not degrees.';

-- -----------------------------------------------------------------------------
-- Automated check results
-- -----------------------------------------------------------------------------
create type public.check_kind as enum (
  'location_iou',
  'point_in_boundary',
  'area_consistency',
  'image_duplicate'
);

create table public.verification_checks (
  id            uuid primary key default gen_random_uuid(),
  property_id   uuid not null references public.properties(id) on delete cascade,
  kind          public.check_kind not null,
  score         numeric(6,4),
  passed        boolean not null,
  threshold     numeric(6,4),
  detail        jsonb not null default '{}'::jsonb,
  -- Where the reference geometry came from, so a score can be argued with.
  source        text,
  created_at    timestamptz not null default now()
);

create index verification_checks_property_idx
  on public.verification_checks (property_id, created_at desc);
create index verification_checks_failed_idx
  on public.verification_checks (kind, created_at desc) where not passed;

comment on table public.verification_checks is
  'Results of automated checks. Advisory only: a failed check routes a listing '
  'to human review, it never rejects one on its own.';

-- -----------------------------------------------------------------------------
-- Scoring a listing
-- -----------------------------------------------------------------------------
-- Thresholds are deliberately forgiving. Hand-drawn boundaries are imprecise
-- and OSM footprints trace roofs rather than plots, so 0.5 means "these are
-- plainly the same place" rather than "these are identical". The cost of a
-- false accept is a human glance; the cost of a false reject is a legitimate
-- lister being told their own address is wrong.
create or replace function public.verify_property_location(
  p_property_id uuid,
  p_reference   geography(Polygon, 4326),
  p_source      text default 'openstreetmap',
  p_threshold   numeric default 0.5
)
returns TABLE (score numeric, passed boolean)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_claimed  geography(Polygon, 4326);
  v_point    geography(Point, 4326);
  v_score    numeric;
  v_passed   boolean;
  v_inside   boolean;
begin
  if not public.has_permission('property.verify') then
    raise exception 'permission denied: property.verify'
      using errcode = 'insufficient_privilege';
  end if;

  select p.claimed_boundary, p.geom
    into v_claimed, v_point
    from public.properties p
   where p.id = p_property_id and p.deleted_at is null;

  if not found then
    raise exception 'property % not found', p_property_id;
  end if;

  -- A listing with no drawn boundary still gets a weaker but useful check:
  -- does the single point it does have fall inside the reference footprint?
  if v_claimed is null then
    v_inside := ST_Covers(p_reference::geometry, v_point::geometry);

    insert into public.verification_checks
      (property_id, kind, score, passed, threshold, source, detail)
    values (
      p_property_id, 'point_in_boundary', null, v_inside, null, p_source,
      jsonb_build_object('reason', 'no claimed boundary; fell back to point containment')
    );

    return query select null::numeric, v_inside;
  end if;

  v_score := public.parcel_iou(v_claimed, p_reference);
  v_passed := v_score >= p_threshold;

  insert into public.verification_checks
    (property_id, kind, score, passed, threshold, source, detail)
  values (
    p_property_id, 'location_iou', v_score, v_passed, p_threshold, p_source,
    jsonb_build_object(
      'claimed_m2',   round(ST_Area(v_claimed)::numeric, 1),
      'reference_m2', round(ST_Area(p_reference)::numeric, 1)
    )
  );

  -- A pass is written to the public ledger. A fail is not: an automated score
  -- is not evidence of dishonesty, and publishing one would let a mapping gap
  -- brand an honest lister.
  if v_passed then
    insert into public.trust_events (property_id, event, actor_id, actor_role, detail)
    values (
      p_property_id, 'gps_confirmed', auth.uid(), 'platform_admin',
      jsonb_build_object('method', 'iou', 'score', v_score, 'source', p_source)
    );
  end if;

  return query select v_score, v_passed;
end;
$$;

comment on function public.verify_property_location is
  'Scores a listing''s claimed boundary against a reference footprint and '
  'records the result. Requires property.verify. Advisory: it routes to review '
  'rather than deciding.';

-- -----------------------------------------------------------------------------
-- Area consistency: does the drawn boundary match the stated area?
-- -----------------------------------------------------------------------------
-- Catches the transcription error behind a surprising share of bad listings:
-- a plot entered as 4 ropani that is drawn as 4 aana, a factor of sixteen.
create or replace function public.check_area_consistency(p_property_id uuid)
returns numeric
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_claimed_m2 numeric;
  v_stated_m2  numeric;
  v_ratio      numeric;
begin
  select ST_Area(p.claimed_boundary)::numeric, p.area_sqm
    into v_claimed_m2, v_stated_m2
    from public.properties p
   where p.id = p_property_id;

  if v_claimed_m2 is null or v_stated_m2 is null or v_stated_m2 <= 0 then
    return null;
  end if;

  v_ratio := round(v_claimed_m2 / v_stated_m2, 4);

  insert into public.verification_checks
    (property_id, kind, score, passed, threshold, source, detail)
  values (
    p_property_id, 'area_consistency', v_ratio,
    v_ratio between 0.75 and 1.35, 1.0, 'geometry',
    jsonb_build_object('drawn_m2', round(v_claimed_m2, 1), 'stated_m2', round(v_stated_m2, 1))
  );

  return v_ratio;
end;
$$;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.verification_checks enable row level security;

-- A lister can see the checks run against their own listing. Being told why a
-- listing is held is the difference between a review queue and a black box.
create policy "owners read own checks"
  on public.verification_checks for select
  using ( public.owns_property(property_id) or public.is_admin() );

-- Written only by the SECURITY DEFINER functions above, never by a client.
create policy "no direct writes"
  on public.verification_checks for insert
  with check ( false );

grant select on public.verification_checks to authenticated;
