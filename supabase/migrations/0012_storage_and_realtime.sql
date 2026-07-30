-- =============================================================================
-- 0012 — Storage buckets, storage policies, realtime publication
-- =============================================================================
set search_path = public, extensions;

-- -----------------------------------------------------------------------------
-- Buckets. MIME allowlists and size caps are enforced by Storage itself, so a
-- forged Content-Type cannot get an executable into a bucket. The application
-- additionally checks magic bytes server-side before accepting an upload.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('property-media',    'property-media',    true,  5242880,
     array['image/webp','image/jpeg','image/png']),
  ('avatars',           'avatars',           true,  1048576,
     array['image/webp','image/jpeg','image/png']),
  ('payment-proofs',    'payment-proofs',    false, 5242880,
     array['image/webp','image/jpeg','image/png','application/pdf']),
  ('verification-docs', 'verification-docs', false, 10485760,
     array['image/webp','image/jpeg','image/png','application/pdf'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- -----------------------------------------------------------------------------
-- property-media
-- Path convention: {property_id}/{image_id}/{rendition}.webp
-- The first path segment is the property ID, so the policy can delegate to the
-- same owns_property() used by the table policies. Storage authorization and
-- table authorization therefore cannot drift apart.
-- -----------------------------------------------------------------------------
create policy "property-media: public read"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'property-media');

create policy "property-media: owner writes"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'property-media'
    and public.is_active_user()
    and public.owns_property((storage.foldername(name))[1]::uuid)
  );

create policy "property-media: owner updates"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'property-media'
    and public.owns_property((storage.foldername(name))[1]::uuid)
  )
  with check (
    bucket_id = 'property-media'
    and public.owns_property((storage.foldername(name))[1]::uuid)
  );

create policy "property-media: owner deletes"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'property-media'
    and public.owns_property((storage.foldername(name))[1]::uuid)
  );

-- -----------------------------------------------------------------------------
-- avatars — path convention: {user_id}/{filename}
-- -----------------------------------------------------------------------------
create policy "avatars: public read"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'avatars');

create policy "avatars: own only"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and public.is_active_user()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars: replace own"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars: delete own"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- -----------------------------------------------------------------------------
-- payment-proofs — path convention: {payer_id}/{payment_id}/{filename}
-- Private. Read requires being a party to the payment. Objects are served only
-- through 60-second signed URLs generated server-side after an auth check.
-- -----------------------------------------------------------------------------
create policy "payment-proofs: parties read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'payment-proofs'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.payments pay
         where pay.proof_path = storage.objects.name
           and (pay.payee_id = auth.uid() or public.owns_property(pay.property_id))
      )
      or public.is_admin()
    )
  );

create policy "payment-proofs: payer uploads own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'payment-proofs'
    and public.is_active_user()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- No UPDATE or DELETE policy. Payment evidence is immutable once submitted;
-- allowing the payer to swap the file after review would defeat the review.

-- -----------------------------------------------------------------------------
-- verification-docs — path convention: {user_id}/{filename}
-- The lalpurja and identity documents. Uploader and admin only, never public.
-- -----------------------------------------------------------------------------
create policy "verification-docs: uploader and admin read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'verification-docs'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

create policy "verification-docs: uploader writes"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'verification-docs'
    and public.is_active_user()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "verification-docs: uploader deletes pending"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'verification-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- =============================================================================
-- Realtime
-- =============================================================================
-- Only these tables are published. Realtime respects RLS for postgres_changes,
-- but we still keep the surface minimal: every published table is one more
-- policy that has to be right, and one more source of websocket traffic.
--
-- The client contract (docs/01-architecture.md §9) is that an event is a SIGNAL,
-- not a payload: handlers invalidate a query key and refetch through RLS. A
-- leaky broadcast therefore cannot leak data.
-- =============================================================================
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end;
$$;

alter publication supabase_realtime add table public.notifications;  -- customer + vendor
alter publication supabase_realtime add table public.enquiries;      -- vendor inbox
alter publication supabase_realtime add table public.appointments;   -- vendor calendar
alter publication supabase_realtime add table public.messages;       -- thread updates
alter publication supabase_realtime add table public.payments;       -- vendor + admin review
alter publication supabase_realtime add table public.reports;        -- admin queue
alter publication supabase_realtime add table public.properties;     -- admin activity feed

-- REPLICA IDENTITY FULL lets a subscriber filter on old values too. Restricted
-- to the tables where the admin feed needs to see what a status changed FROM.
alter table public.properties  replica identity full;
alter table public.payments    replica identity full;
alter table public.reports     replica identity full;
