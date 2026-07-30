-- =============================================================================
-- 0003 — Location hierarchy (Nepal) and area-unit conversion
-- =============================================================================
set search_path = public, extensions;

-- One adjacency-list table rather than four, because the depth is uniform and
-- every query is either "ancestors of X" or "everything under X". ltree answers
-- both with a single indexed operator instead of a recursive CTE.
create table public.locations (
  id          uuid primary key default gen_random_uuid(),
  parent_id   uuid references public.locations(id) on delete restrict,
  level       public.location_level not null,
  name_en     text not null check (char_length(trim(name_en)) between 1 and 120),
  name_ne     text,
  slug        text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  path        ltree not null,
  centroid    geography(Point, 4326),
  bounds      geography(Polygon, 4326),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- Only a country may be rootless.
  constraint locations_root_is_country check (
    (parent_id is null and level = 'country') or (parent_id is not null and level <> 'country')
  )
);

create unique index locations_slug_in_parent_key
  on public.locations (coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), slug);
create unique index locations_path_key   on public.locations (path);
create index locations_path_gist         on public.locations using gist (path);
create index locations_parent_idx        on public.locations (parent_id);
create index locations_level_idx         on public.locations (level) where is_active;
create index locations_centroid_gix      on public.locations using gist (centroid);
-- Trigram index powers the location autocomplete in both scripts.
create index locations_name_en_trgm      on public.locations using gin (name_en gin_trgm_ops);
create index locations_name_ne_trgm      on public.locations using gin (name_ne gin_trgm_ops)
  where name_ne is not null;

comment on table public.locations is
  'Nepal administrative hierarchy: country > province > district > municipality > ward. '
  'path is an ltree such as nepal.bagmati.kathmandu.kathmandu_metro.ward_16.';
comment on column public.locations.path is
  'Materialised ancestry. "Everything under Bagmati" is path <@ ''nepal.bagmati''.';

create trigger set_updated_at before update on public.locations
  for each row execute function public.tg_set_updated_at();

-- Keeps `path` consistent with `parent_id` automatically, so callers only ever
-- set the parent. Slugs contain hyphens, which ltree labels disallow, so they
-- are normalised to underscores.
create or replace function public.tg_locations_set_path()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  parent_path ltree;
  label       text;
begin
  label := replace(new.slug, '-', '_');

  if new.parent_id is null then
    new.path := label::ltree;
  else
    select l.path into parent_path from public.locations l where l.id = new.parent_id;
    if parent_path is null then
      raise exception 'parent location % not found', new.parent_id;
    end if;
    new.path := parent_path || label::ltree;
  end if;

  return new;
end;
$$;

create trigger locations_set_path
  before insert or update of parent_id, slug on public.locations
  for each row execute function public.tg_locations_set_path();

-- -----------------------------------------------------------------------------
-- Area unit conversion
-- -----------------------------------------------------------------------------
-- Nepal runs two traditional systems in parallel and both appear in listings:
--   hills/valley : 1 ropani = 16 aana = 64 paisa = 256 daam = 508.72 m²
--   terai        : 1 bigha  = 20 kattha = 400 dhur = 6772.63 m²
-- We store square metres canonically so that "between 4 and 8 aana" is a plain
-- indexed range query, and keep the entered unit for display fidelity.

create or replace function public.area_to_sqm(value numeric, unit public.area_unit)
returns numeric
language sql
immutable
strict
parallel safe
as $$
  select value * case unit
    when 'sqm'    then 1
    when 'sqft'   then 0.09290304
    when 'ropani' then 508.72
    when 'aana'   then 31.795
    when 'paisa'  then 7.94875
    when 'daam'   then 1.9871875
    when 'bigha'  then 6772.63
    when 'kattha' then 338.6315
    when 'dhur'   then 16.931575
  end;
$$;

create or replace function public.sqm_to_area(value numeric, unit public.area_unit)
returns numeric
language sql
immutable
strict
parallel safe
as $$
  select value / case unit
    when 'sqm'    then 1
    when 'sqft'   then 0.09290304
    when 'ropani' then 508.72
    when 'aana'   then 31.795
    when 'paisa'  then 7.94875
    when 'daam'   then 1.9871875
    when 'bigha'  then 6772.63
    when 'kattha' then 338.6315
    when 'dhur'   then 16.931575
  end;
$$;

comment on function public.area_to_sqm is
  'Canonicalises any supported area unit to square metres. Immutable, so it may be '
  'used in generated columns and index expressions.';
