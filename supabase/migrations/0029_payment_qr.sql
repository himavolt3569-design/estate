-- =============================================================================
-- 0029 — Payment QR codes, and a way for a buyer to actually pay
--
-- payment_methods.qr_image_path has existed since 0006 and nothing could write
-- it: the form registered the field and never rendered an input for it. In
-- Nepal that is the wrong field to leave out — eSewa, Khalti and IME Pay are
-- scanned far more often than they are typed, and a bank QR is standard on a
-- printed invoice. So the QR belongs on every provider, not just the wallets.
--
-- The larger gap behind it: get_payment_methods_public() has existed just as
-- long and had no caller anywhere in the application. A buyer had no way to see
-- how to pay, and no way to submit a receipt, even though the payments table,
-- the payment-proofs bucket and the admin review queue were all built and
-- working. This wires that path end to end.
-- =============================================================================
set search_path = public, extensions;

-- -----------------------------------------------------------------------------
-- Bucket for QR images.
--
-- Private, not public. A payment QR encodes the account it pays into, so it is
-- the same class of secret as account_number — which 0010 already withholds
-- from anon. Serving it needs the same disclosure check, so it is read through
-- short-lived signed URLs minted server-side, never by public URL.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-qr', 'payment-qr', false, 2097152,
        array['image/webp','image/jpeg','image/png'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Path convention: {owner_id}/{uuid}.webp — the same shape as avatars, so the
-- policy is the same one-line ownership test.
create policy "payment-qr: owner reads own"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'payment-qr'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

create policy "payment-qr: owner writes own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'payment-qr'
    and public.is_active_user()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "payment-qr: owner replaces own"
  on storage.objects for update to authenticated
  using (bucket_id = 'payment-qr' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'payment-qr' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "payment-qr: owner deletes own"
  on storage.objects for delete to authenticated
  using (bucket_id = 'payment-qr' and (storage.foldername(name))[1] = auth.uid()::text);

-- -----------------------------------------------------------------------------
-- The buyer's view of how to pay.
--
-- 0011's get_payment_methods_public() returned every active method belonging to
-- the owner and nothing about the listing itself. This adds what the panel needs
-- to render — the payee, the reference to quote, whether a QR exists — while
-- keeping the two gates that version had: the vendor's per-listing opt-in, and
-- never to anonymous traffic.
-- -----------------------------------------------------------------------------
create or replace function public.get_property_payment_options(p_property_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_owner uuid;
  v_show  boolean;
  v_ref   text;
  v_title text;
begin
  if auth.uid() is null then
    raise exception 'sign in to see payment details'
      using errcode = 'insufficient_privilege';
  end if;

  select p.owner_id, p.show_payment_info, p.reference_code, p.title
    into v_owner, v_show, v_ref, v_title
    from public.properties p
   where p.id = p_property_id
     and p.status = 'published'
     and p.deleted_at is null;

  if v_owner is null then
    raise exception 'listing not found';
  end if;

  if not v_show then
    return jsonb_build_object('enabled', false, 'methods', '[]'::jsonb);
  end if;

  return jsonb_build_object(
    'enabled', true,
    'payeeId', v_owner,
    'referenceCode', v_ref,
    'propertyTitle', v_title,
    -- The buyer paying is the point; the owner viewing their own listing is not
    -- a disclosure, and neither is an admin checking a dispute.
    'isOwner', v_owner = auth.uid(),
    'methods', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', pm.id,
               'provider', pm.provider,
               'accountName', pm.account_name,
               'accountNumber', pm.account_number,
               'bankName', pm.bank_name,
               'branch', pm.branch,
               'qrImagePath', pm.qr_image_path,
               'instructions', pm.instructions,
               'isDefault', pm.is_default
             ) order by pm.is_default desc, pm.created_at), '[]'::jsonb)
        from public.payment_methods pm
       where pm.owner_id = v_owner
         and pm.is_active
         and pm.deleted_at is null
    )
  );
end;
$$;

comment on function public.get_property_payment_options is
  'How to pay for a listing. Gated on the vendor''s per-listing opt-in and never '
  'returned to anonymous traffic. QR paths are returned as paths; the caller '
  'mints a short-lived signed URL after this check has passed.';

grant execute on function public.get_property_payment_options(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- A buyer's own payments, so "I already sent this" is answerable without
-- asking the seller.
-- -----------------------------------------------------------------------------
create or replace function public.my_property_payments(p_property_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', pay.id,
           'amount', pay.amount,
           'purpose', pay.purpose,
           'reference', pay.reference,
           'status', pay.status,
           'rejectionReason', pay.rejection_reason,
           'createdAt', pay.created_at,
           'reviewedAt', pay.reviewed_at
         ) order by pay.created_at desc), '[]'::jsonb)
    from public.payments pay
   where pay.property_id = p_property_id
     and pay.payer_id = auth.uid();
$$;

grant execute on function public.my_property_payments(uuid) to authenticated;
