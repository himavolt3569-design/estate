-- =============================================================================
-- Smoke test: schema invariants and the RLS boundary, against live data.
--
-- Run: docker exec -i supabase_db_kitta psql -U postgres -d postgres -f -
-- Each section prints PASS/FAIL. Any FAIL is a real defect.
--
-- NOTE: every role switch is wrapped in an explicit BEGIN/COMMIT. psql runs in
-- autocommit, where `set local` applies only to the single statement that
-- follows it and is then discarded — which would silently run the whole suite as
-- superuser with RLS bypassed, and pass tests that prove nothing.
-- =============================================================================
\set ON_ERROR_STOP off
set search_path = public, extensions;

-- The suite writes fixtures and asserts on absolute counts, so it needs a clean
-- database. Running it twice would produce collisions that look like security
-- failures but are not, so stop early and say so.
do $$
begin
  if exists (select 1 from public.properties) then
    raise exception
      'smoke.sql needs a fresh database. Run `npm run db:reset` first.'
      using errcode = 'object_not_in_prerequisite_state';
  end if;
end;
$$;

\echo '=== 1. Reference data ==='
select
  case when count(*) = 77 then 'PASS' else 'FAIL' end as result,
  count(*) as districts, '(expected 77)' as expected
from public.locations where level = 'district';

select
  case when count(*) = 7 then 'PASS' else 'FAIL' end as result,
  count(*) as provinces, '(expected 7)' as expected
from public.locations where level = 'province';

select
  case when count(*) = 16 then 'PASS' else 'FAIL' end as result,
  count(*) as permissions, '(expected 16)' as expected
from public.permissions;

-- Admin must hold every permission; customer must hold very few.
select
  case when (select count(*) from public.role_permissions where role = 'platform_admin') = 16
        and (select count(*) from public.role_permissions where role = 'customer') = 2
       then 'PASS' else 'FAIL' end as result,
  'role/permission matrix' as check;

-- ltree ancestry must resolve, since every /properties/[province]/... URL uses it.
select
  case when count(*) = 13 then 'PASS' else 'FAIL' end as result,
  count(*) as bagmati_districts, '(expected 13)' as expected
from public.locations
where path <@ 'nepal.bagmati' and level = 'district';

\echo ''
\echo '=== 2. Area conversion (ropani / bigha) ==='
select
  case when round(public.area_to_sqm(1, 'ropani')::numeric, 2) = 508.72
        and round(public.area_to_sqm(16, 'aana')::numeric, 2) = 508.72
        and round(public.area_to_sqm(1, 'bigha')::numeric, 2) = 6772.63
        and round(public.area_to_sqm(20, 'kattha')::numeric, 2) = 6772.63
       then 'PASS' else 'FAIL' end as result,
  'ropani=16 aana, bigha=20 kattha' as check;

\echo ''
\echo '=== 3. Fixtures ==='
-- Two unrelated vendors and one admin, to test horizontal isolation.
insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                        created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000','11111111-1111-1111-1111-111111111111',
   'authenticated','authenticated','vendor.a@test.local','x', now(),
   '{"provider":"email"}','{"full_name":"Vendor A","role":"property_owner"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000','22222222-2222-2222-2222-222222222222',
   'authenticated','authenticated','vendor.b@test.local','x', now(),
   '{"provider":"email"}','{"full_name":"Vendor B","role":"property_owner"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000','33333333-3333-3333-3333-333333333333',
   'authenticated','authenticated','admin@test.local','x', now(),
   '{"provider":"email"}','{"full_name":"Admin","role":"platform_admin"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000','44444444-4444-4444-4444-444444444444',
   'authenticated','authenticated','customer@test.local','x', now(),
   '{"provider":"email"}','{"full_name":"Customer"}', now(), now())
on conflict (id) do nothing;

-- The signup trigger must have created profiles, and must have IGNORED the
-- forged platform_admin role in user metadata.
select
  case when (select role from public.profiles where id = '33333333-3333-3333-3333-333333333333')
            = 'customer'
       then 'PASS' else 'FAIL' end as result,
  'signup metadata cannot self-grant platform_admin' as check,
  (select role::text from public.profiles where id = '33333333-3333-3333-3333-333333333333') as actual_role;

select
  case when count(*) = 4 then 'PASS' else 'FAIL' end as result,
  count(*) as profiles_created, '(expected 4)' as expected
from public.profiles
where id in ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222',
             '33333333-3333-3333-3333-333333333333','44444444-4444-4444-4444-444444444444');

-- Email was confirmed at insert, so status should be active.
select
  case when count(*) = 4 then 'PASS' else 'FAIL' end as result,
  'accounts active after email confirmation' as check
from public.profiles
where id in ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222',
             '33333333-3333-3333-3333-333333333333','44444444-4444-4444-4444-444444444444')
  and status = 'active';

-- A real phone number, so §10 can prove it never leaks into the public payload.
update public.profiles set phone = '+9779841000001'
 where id = '11111111-1111-1111-1111-111111111111';

-- Promote the real admin through the sanctioned path (bypasses the escalation
-- guard via app.privileged_operation, exactly as admin_set_user_role does).
select set_config('app.privileged_operation', 'on', false);
update public.profiles set role = 'platform_admin' where id = '33333333-3333-3333-3333-333333333333';
select set_config('app.privileged_operation', 'off', false);

select
  case when role = 'platform_admin' then 'PASS' else 'FAIL' end as result,
  role, 'admin promoted via the sanctioned path' as check
from public.profiles where id = '33333333-3333-3333-3333-333333333333';

\echo ''
\echo '=== 4. Privilege escalation is blocked ==='
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","aal":"aal1"}';

-- Sanity: the role switch actually took effect. Without this, every isolation
-- test below would run as superuser and pass vacuously.
select
  case when auth.uid() = '11111111-1111-1111-1111-111111111111'
            and current_user = 'authenticated'
       then 'PASS' else 'FAIL' end as result,
  current_user, auth.uid() as acting_as, 'role switch is in effect' as check;

-- Vendor A tries to make themselves an admin.
do $$
declare v_count integer;
begin
  update public.profiles set role = 'platform_admin' where id = auth.uid();
  get diagnostics v_count = row_count;
  raise notice 'FAIL  self-promotion succeeded on % row(s)', v_count;
exception
  when others then
    raise notice 'PASS  self-promotion blocked: %', left(sqlerrm, 70);
end;
$$;

-- ...and to suspend a rival.
do $$
declare v_count integer;
begin
  update public.profiles set status = 'suspended'
   where id = '22222222-2222-2222-2222-222222222222';
  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise notice 'PASS  suspending another user affected 0 rows';
  else
    raise notice 'FAIL  suspended another user (% rows)', v_count;
  end if;
exception when others then
  raise notice 'PASS  suspending another user blocked: %', left(sqlerrm, 60);
end;
$$;
commit;

\echo ''
\echo '=== 5. Listing lifecycle ==='
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","aal":"aal1"}';

insert into public.properties (
  slug, title, description, category, subtype, transaction_type, price,
  owner_id, listed_by_role, location_id, address_line, geom, area_raw, area_unit_entered
)
values (
  'modern-villa-in-budhanilkantha',
  'Modern villa in Budhanilkantha with mountain views',
  'A four-bedroom villa on 8 aana, finished in 2021, with covered parking, a garden and uninterrupted views toward Shivapuri. Municipal water plus a borewell. Ten minutes from Narayanthan.',
  'residential', 'villa', 'sale',
  245000000000,  -- Rs 2.45 crore in paisa... deliberately wrong, corrected below
  '11111111-1111-1111-1111-111111111111', 'property_owner',
  (select id from public.locations where slug = 'budhanilkantha'),
  'Narayanthan Marg, Ward 11',
  st_setsrid(st_makepoint(85.3620, 27.7783), 4326)::geography,
  '{"aana": 8}'::jsonb, 'aana'
);

-- The area trigger must have canonicalised 8 aana to ~254.36 m².
select
  case when round(area_sqm, 2) = 254.36 then 'PASS' else 'FAIL' end as result,
  area_sqm, '(8 aana = 254.36 m2)' as expected
from public.properties where slug = 'modern-villa-in-budhanilkantha';

-- reference_code generated from the district.
select
  case when reference_code like 'GB-KAT-%' then 'PASS' else 'FAIL' end as result,
  reference_code, 'derived from district' as check
from public.properties where slug = 'modern-villa-in-budhanilkantha';

-- Fix the price to a real 2.45 crore (Rs 24,500,000 = 2,450,000,000 paisa).
update public.properties set price = 2450000000 where slug = 'modern-villa-in-budhanilkantha';

\echo '--- 5a. Minimum 5 images is enforced at the database ---'
do $$
begin
  update public.properties set status = 'pending_review'
   where slug = 'modern-villa-in-budhanilkantha';
  raise notice 'FAIL  submitted for review with 0 images';
exception when others then
  raise notice 'PASS  blocked: %', left(sqlerrm, 70);
end;
$$;

insert into public.property_images (property_id, storage_path, rendition_paths, position, is_cover)
select p.id, format('%s/img-%s/full.webp', p.id, g), '{"thumb":"t.webp","card":"c.webp","full":"f.webp"}'::jsonb,
       g, g = 1
from public.properties p, generate_series(1,5) g
where p.slug = 'modern-villa-in-budhanilkantha';

update public.properties set status = 'pending_review'
 where slug = 'modern-villa-in-budhanilkantha';

select
  case when status = 'pending_review' then 'PASS' else 'FAIL' end as result,
  status, 'submitted once 5 images + cover exist' as check
from public.properties where slug = 'modern-villa-in-budhanilkantha';

\echo '--- 5b. A vendor cannot publish their own listing ---'
do $$
begin
  update public.properties set status = 'published'
   where slug = 'modern-villa-in-budhanilkantha';
  raise notice 'FAIL  vendor self-published';
exception when others then
  raise notice 'PASS  blocked: %', left(sqlerrm, 70);
end;
$$;
commit;

-- Captured as superuser so §6 can attempt a genuine cross-vendor write with a
-- known id. Without this, vendor B's SELECT returns nothing, the INSERT ... SELECT
-- writes zero rows, and the test would pass without proving anything.
--
-- Held in a session setting rather than a psql variable: psql does not
-- interpolate :'name' inside dollar-quoted blocks, which is where the attempts
-- have to happen (they need an exception handler).
select set_config('test.prop_id', id::text, false)
  from public.properties where slug = 'modern-villa-in-budhanilkantha';

\echo ''
\echo '=== 6. Horizontal isolation (threat #1) ==='
-- Vendor B must not see or touch Vendor A's unpublished listing.
--
-- NOTE ON ASSERTIONS: an RLS denial on UPDATE does not raise — it filters the
-- row out, so the statement succeeds having affected zero rows. Zero rows IS the
-- denial. INSERT is different: a failing WITH CHECK does raise. The assertions
-- below match that difference, and application code must do the same (check the
-- affected count, never assume success means the row changed).
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated","aal":"aal1"}';

select
  case when count(*) = 0 then 'PASS' else 'FAIL' end as result,
  count(*) as rows_visible, 'vendor B sees vendor A draft' as check
from public.properties where slug = 'modern-villa-in-budhanilkantha';

do $$
declare v_count integer;
begin
  update public.properties set price = 1
   where slug = 'modern-villa-in-budhanilkantha';
  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise notice 'PASS  vendor B updated 0 rows of vendor A''s listing';
  else
    raise notice 'FAIL  vendor B updated % row(s)', v_count;
  end if;
end;
$$;

-- Vendor B must not be able to attach media to vendor A's listing either.
-- A known id is used, so this is a real attempt rather than a no-op.
do $$
begin
  insert into public.property_images (property_id, storage_path, position)
  values (current_setting('test.prop_id')::uuid, 'hijack.webp', 99);
  raise notice 'FAIL  vendor B attached media to vendor A''s listing';
exception when others then
  raise notice 'PASS  cross-vendor media write blocked: %', left(sqlerrm, 60);
end;
$$;

-- ...nor read its images, which belong to a listing that is not yet published.
select
  case when count(*) = 0 then 'PASS' else 'FAIL' end as result,
  count(*) as images_visible, 'vendor B reads vendor A unpublished media' as check
from public.property_images
where property_id = current_setting('test.prop_id')::uuid;
commit;

\echo ''
\echo '=== 7. Admin publish requires aal2 (2FA enforced in the DB) ==='
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated","aal":"aal1"}';

select
  case when public.auth_role() = 'platform_admin' and not public.is_admin()
       then 'PASS' else 'FAIL' end as result,
  public.auth_role() as role, public.is_admin() as is_admin,
  'admin role held, but is_admin() false at aal1' as check;

-- Two independent gates must hold at aal1: the RLS policy (is_admin() is false,
-- so zero rows match) and the status-transition trigger (raises outright).
do $$
declare v_count integer;
begin
  update public.properties set status = 'published'
   where id = current_setting('test.prop_id')::uuid;
  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise notice 'PASS  aal1 admin affected 0 rows (policy denied)';
  else
    raise notice 'FAIL  aal1 admin published % row(s)', v_count;
  end if;
exception when others then
  raise notice 'PASS  aal1 admin blocked by trigger: %', left(sqlerrm, 70);
end;
$$;
commit;

-- Same admin, now with a satisfied second factor.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated","aal":"aal2"}';

update public.properties set status = 'published', verified_at = now(),
       verified_by = '33333333-3333-3333-3333-333333333333'
 where slug = 'modern-villa-in-budhanilkantha';

select
  case when status = 'published' and published_at is not null and expires_at is not null
       then 'PASS' else 'FAIL' end as result,
  status, published_at is not null as has_published_at, expires_at is not null as has_expiry
from public.properties where slug = 'modern-villa-in-budhanilkantha';
commit;

\echo ''
\echo '=== 8. Trust ledger was written automatically ==='
select
  case when count(*) >= 3 then 'PASS' else 'FAIL' end as result,
  count(*) as events,
  string_agg(te.event::text, ', ' order by te.created_at) as ledger
from public.trust_events te
join public.properties p on p.id = te.property_id
where p.slug = 'modern-villa-in-budhanilkantha';

-- The ledger must be immutable even for the table owner.
do $$
begin
  update public.trust_events set event = 'identity_verified'
   where id = (select min(id) from public.trust_events);
  raise notice 'FAIL  trust ledger was editable';
exception when others then
  raise notice 'PASS  ledger is append-only: %', left(sqlerrm, 60);
end;
$$;

\echo ''
\echo '=== 9. Anonymous visibility (Pattern B) ==='
begin;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select
  case when current_user = 'anon' then 'PASS' else 'FAIL' end as result,
  current_user, 'acting as anon' as check;

select
  case when count(*) = 1 then 'PASS' else 'FAIL' end as result,
  count(*) as visible, 'anon sees the published listing' as check
from public.properties;

-- Threat 3: anonymous traffic must get nothing from profiles.
do $$
declare v_count integer;
begin
  select count(*) into v_count from public.profiles;
  raise notice 'FAIL  anon read % profile row(s)', v_count;
exception when insufficient_privilege then
  raise notice 'PASS  anon has no access to profiles';
when others then
  raise notice 'PASS  anon blocked from profiles: %', left(sqlerrm, 60);
end;
$$;

do $$
declare v_count integer;
begin
  select count(*) into v_count from public.payment_methods;
  raise notice 'FAIL  anon read % payment_method row(s)', v_count;
exception when others then
  raise notice 'PASS  anon blocked from payment_methods';
end;
$$;

\echo ''
\echo '=== 10. Search ==='
select
  case when count(*) = 1 then 'PASS' else 'FAIL' end as result,
  count(*) as hits, 'unfiltered search' as check
from public.search_properties('{}'::jsonb, null, 24);

select
  case when count(*) = 1 then 'PASS' else 'FAIL' end as result,
  count(*) as hits, 'geo radius 5km from Budhanilkantha' as check
from public.search_properties(
  '{"lat":27.7783,"lng":85.3620,"radius_m":5000,"sort":"distance"}'::jsonb, null, 24);

select
  case when count(*) = 0 then 'PASS' else 'FAIL' end as result,
  count(*) as hits, 'geo radius 2km from Pokhara (should miss)' as check
from public.search_properties(
  '{"lat":28.2096,"lng":83.9856,"radius_m":2000}'::jsonb, null, 24);

select
  case when count(*) = 1 then 'PASS' else 'FAIL' end as result,
  count(*) as hits, 'full text: villa' as check
from public.search_properties('{"q":"villa"}'::jsonb, null, 24);

select
  case when count(*) = 0 then 'PASS' else 'FAIL' end as result,
  count(*) as hits, 'price filter excludes (max 1 lakh)' as check
from public.search_properties('{"price_max":10000000}'::jsonb, null, 24);

select
  case when count(*) = 1 then 'PASS' else 'FAIL' end as result,
  count(*) as hits, 'ltree scope: everything under Bagmati' as check
from public.search_properties('{"location_path":"nepal.bagmati"}'::jsonb, null, 24);

select
  case when count(*) = 0 then 'PASS' else 'FAIL' end as result,
  count(*) as hits, 'ltree scope: Gandaki (should miss)' as check
from public.search_properties('{"location_path":"nepal.gandaki"}'::jsonb, null, 24);

select
  case when province_slug = 'bagmati' and location_slug = 'budhanilkantha'
            and distance_m is null and cover is not null and verified
       then 'PASS' else 'FAIL' end as result,
  province_slug, location_slug, verified, (cover is not null) as has_cover
from public.search_properties('{}'::jsonb, null, 24);

\echo '--- 10a. Sorting whitelist and keyset pagination ---'
select
  case when count(*) = 1 then 'PASS' else 'FAIL' end as result,
  'price_asc sort' as check
from public.search_properties('{"sort":"price_asc"}'::jsonb, null, 24);

select
  case when count(*) = 1 then 'PASS' else 'FAIL' end as result,
  'unknown sort falls back to newest' as check
from public.search_properties('{"sort":"; drop table properties --"}'::jsonb, null, 24);

select
  case when count(*) = 0 then 'PASS' else 'FAIL' end as result,
  'keyset cursor advances past the only row' as check
from public.search_properties(
  '{}'::jsonb,
  (select jsonb_build_object('id', id, 'published_at', published_at)
     from public.properties where slug = 'modern-villa-in-budhanilkantha'),
  24);

\echo '--- 10b. Public projection and map clustering ---'
select
  case when public.get_property_public('modern-villa-in-budhanilkantha') -> 'vendor' ->> 'name' = 'Vendor A'
        and jsonb_array_length(public.get_property_public('modern-villa-in-budhanilkantha') -> 'images') = 5
        and jsonb_array_length(public.get_property_public('modern-villa-in-budhanilkantha') -> 'trustLedger') >= 3
        and public.get_property_public('modern-villa-in-budhanilkantha') -> 'contact' ? 'phone'
       then 'PASS' else 'FAIL' end as result,
  'get_property_public shape' as check;

-- The public projection must expose availability flags, never a phone number.
select
  case when public.get_property_public('modern-villa-in-budhanilkantha')::text not like '%+977%'
       then 'PASS' else 'FAIL' end as result,
  'no contact value in the public payload' as check;

select
  case when jsonb_array_length(public.cluster_markers(85.0, 27.5, 85.8, 28.0, 14, '{}'::jsonb)) = 1
       then 'PASS' else 'FAIL' end as result,
  'cluster_markers returns markers at zoom 14' as check;

select
  case when public.cluster_markers(80.0, 26.0, 89.0, 30.0, 7, '{}'::jsonb) -> 0 ->> 'type' = 'cluster'
       then 'PASS' else 'FAIL' end as result,
  'cluster_markers aggregates at zoom 7' as check;
commit;

\echo ''
\echo '=== 11. Enquiry: vendor is derived, not supplied ==='
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated","aal":"aal1"}';

-- The client deliberately lies about vendor_id; the trigger must overwrite it.
insert into public.enquiries (property_id, vendor_id, contact_name, contact_phone, message)
select p.id, '22222222-2222-2222-2222-222222222222', 'Customer', '+9779800000000',
       'Is this still available? I would like to view it this weekend.'
from public.properties p where p.slug = 'modern-villa-in-budhanilkantha';

select
  case when vendor_id = '11111111-1111-1111-1111-111111111111'
            and customer_id = '44444444-4444-4444-4444-444444444444'
       then 'PASS' else 'FAIL' end as result,
  vendor_id, 'forged vendor_id overwritten with the real owner' as check
from public.enquiries limit 1;

-- The enquiry text is evidence; it must be immutable. The customer has no
-- UPDATE policy on enquiries at all, so this is denied twice over.
do $$
declare v_count integer;
begin
  update public.enquiries set message = 'edited';
  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise notice 'PASS  enquiry edit affected 0 rows (no update policy for customer)';
  else
    raise notice 'FAIL  customer edited % enquiry row(s)', v_count;
  end if;
exception when others then
  raise notice 'PASS  enquiry immutable: %', left(sqlerrm, 60);
end;
$$;

\echo '--- 11a. Contact reveal is gated and rate limited ---'
select
  case when public.reveal_contact(
         (select id from public.properties where slug = 'modern-villa-in-budhanilkantha'), 'phone'
       ) = '+9779841000001' then 'PASS' else 'FAIL' end as result,
  'reveal_contact returns the number for an enabled channel' as check;

do $$
declare v uuid;
begin
  select id into v from public.properties where slug = 'modern-villa-in-budhanilkantha';
  perform public.reveal_contact(v, 'email');   -- show_email defaults to false
  raise notice 'FAIL  revealed a channel the vendor disabled';
exception when others then
  raise notice 'PASS  disabled channel blocked: %', left(sqlerrm, 60);
end;
$$;

select
  case when count(*) >= 1 then 'PASS' else 'FAIL' end as result,
  count(*) as reveals, 'reveal recorded in the ledger' as check
from public.contact_reveals;
commit;

\echo ''
\echo '=== 12. Payment state machine ==='
-- Run as owner: this section tests the transition trigger, which fires for every
-- role including service_role, not the RLS policies (covered in §6).
insert into public.payment_methods (owner_id, provider, account_name, account_number)
values ('11111111-1111-1111-1111-111111111111','esewa','Vendor A','9800000000');

insert into public.payments (property_id, payer_id, payee_id, amount, proof_path)
select p.id, '44444444-4444-4444-4444-444444444444','11111111-1111-1111-1111-111111111111',
       50000000, '44444444-4444-4444-4444-444444444444/p1/proof.webp'
from public.properties p where p.slug = 'modern-villa-in-budhanilkantha';

update public.payments set status = 'approved';

select
  case when status = 'approved' and reviewed_at is not null then 'PASS' else 'FAIL' end as result,
  status, 'pending -> approved sets reviewed_at' as check
from public.payments limit 1;

do $$
begin
  update public.payments set status = 'rejected', rejection_reason = 'changed my mind';
  raise notice 'FAIL  approved payment was re-decided';
exception when others then
  raise notice 'PASS  terminal state is final: %', left(sqlerrm, 60);
end;
$$;

do $$
begin
  update public.payments set proof_path = 'different/proof.webp';
  raise notice 'FAIL  payment proof was swapped after review';
exception when others then
  raise notice 'PASS  proof immutable: %', left(sqlerrm, 60);
end;
$$;

\echo ''
\echo '=== 13. Audit trail ==='
select
  case when count(*) >= 4 then 'PASS' else 'FAIL' end as result,
  count(*) as entries,
  count(*) filter (where action = 'status_change') as status_changes
from public.audit_logs;

-- Sensitive keys must be redacted before storage.
select
  case when count(*) = 0 then 'PASS' else 'FAIL' end as result,
  'account_number never stored in plain text in the audit log' as check
from public.audit_logs
where new_value::text like '%9800000000%' or previous_value::text like '%9800000000%';

do $$
begin
  delete from public.audit_logs;
  raise notice 'FAIL  audit log was deletable';
exception when others then
  raise notice 'PASS  audit log is append-only: %', left(sqlerrm, 60);
end;
$$;

\echo ''
\echo '=== 14. RLS coverage meta-check ==='
select
  case when count(*) = 0 then 'PASS' else 'FAIL' end as result,
  count(*) as tables_without_rls,
  coalesce(string_agg(c.relname, ', '), 'none') as offenders
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r','p') and not c.relrowsecurity;

-- Every UPDATE policy must carry a WITH CHECK. Without it, a caller can rewrite
-- a row they legitimately own into one they do not.
select
  case when count(*) = 0 then 'PASS' else 'FAIL' end as result,
  count(*) as update_policies_missing_with_check,
  coalesce(string_agg(format('%s.%s', tablename, policyname), '; '), 'none') as offenders
from pg_policies
where schemaname = 'public' and cmd = 'UPDATE' and with_check is null;

\echo ''
\echo '=== Done ==='
