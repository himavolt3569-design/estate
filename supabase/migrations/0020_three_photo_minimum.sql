-- =============================================================================
-- 0020 — Three photos, not five
--
-- 0009 required five images before a listing could move to pending_review. In
-- practice that is where sellers stopped: a phone photo session produces two or
-- three usable pictures, the fourth and fifth are filler, and until all five
-- existed there was no way to send anything at all. The draft sat there and the
-- seller did not come back.
--
-- Three still shows a buyer the outside, the inside and the road, and photos
-- can be added to a listing at any time afterwards — the check only runs on the
-- transition into review or publication, so adding a fourth later never
-- re-triggers anything.
--
-- The cover-image rule is unchanged: a listing with photos must have one marked
-- as the main photo.
--
-- Keep in step with MIN_IMAGES in src/modules/listings/schema.ts.
-- =============================================================================
set search_path = public, extensions;

create or replace function public.tg_properties_require_media()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_count integer;
  v_minimum constant integer := 3;
begin
  if new.status in ('pending_review','published')
     and (tg_op = 'INSERT' or old.status is distinct from new.status) then

    select count(*) into v_count from public.property_images where property_id = new.id;

    if v_count < v_minimum then
      raise exception 'a listing needs at least % photos before review (currently %)', v_minimum, v_count
        using errcode = 'check_violation',
              hint = 'Add more photos on the Photos step.';
    end if;

    if not exists (select 1 from public.property_images where property_id = new.id and is_cover) then
      raise exception 'a listing needs a cover image before review'
        using errcode = 'check_violation';
    end if;
  end if;

  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
    new.expires_at   := now() + interval '90 days';
  end if;

  return new;
end;
$$;

-- The trigger itself is unchanged and still points at this function; replacing
-- the body is enough.
