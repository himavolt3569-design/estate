'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { authedAction } from '@/lib/auth/action';
import { createClient } from '@/lib/supabase/server';

/**
 * The buyer's side of settlement.
 *
 * Kitta never holds money. A buyer pays the seller directly through eSewa,
 * Khalti, IME Pay, connectIPS or a bank, and then files the receipt here so
 * there is a record both sides and the platform can see. Everything below is a
 * record-keeping operation, not a transfer.
 */

/**
 * Short-lived signed URLs for the QR images in a payment panel.
 *
 * The bucket is private, so a path is not viewable on its own. The caller has
 * already passed get_property_payment_options(), which enforces the seller's
 * per-listing disclosure toggle and refuses anonymous traffic; this turns the
 * paths that returned into images the browser can actually render, for five
 * minutes.
 */
export async function signQrImages(paths: string[]): Promise<Record<string, string>> {
  const clean = paths.filter((path) => typeof path === 'string' && path.length > 0).slice(0, 10);
  if (clean.length === 0) return {};

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return {};

  const out: Record<string, string> = {};

  await Promise.all(
    clean.map(async (path) => {
      const { data } = await supabase.storage.from('payment-qr').createSignedUrl(path, 300);
      if (data?.signedUrl) out[path] = data.signedUrl;
    }),
  );

  return out;
}

export const submitPaymentProof = authedAction({
  schema: z.object({
    propertyId: z.string().uuid(),
    payeeId: z.string().uuid(),
    paymentMethodId: z.string().uuid().nullable().optional(),
    /** Rupees as typed. Stored as paisa, like every other money column. */
    amount: z
      .number({ message: 'Enter the amount you sent' })
      .positive('Enter the amount you sent')
      .max(1_000_000_000, 'That amount looks wrong'),
    purpose: z.enum(['booking', 'advance', 'rent', 'deposit', 'commission', 'other']),
    reference: z.string().trim().max(120).optional().or(z.literal('')),
    note: z.string().trim().max(500).optional().or(z.literal('')),
    /** Already uploaded to payment-proofs by the browser. */
    proofPath: z.string().trim().min(1, 'Attach the receipt').max(500),
  }),
  handler: async ({ input, supabase, user }) => {
    if (input.payeeId === user.id) {
      throw new Error('You cannot record a payment to yourself.');
    }

    // The insert policy re-checks the payer, the pending status and that the
    // listing is published, so a forged body is refused by the database rather
    // than by this line. The path is checked here because storage cannot.
    if (!input.proofPath.startsWith(`${user.id}/`)) {
      throw new Error('That receipt does not belong to this account.');
    }

    const { data, error } = await supabase
      .from('payments')
      .insert({
        property_id: input.propertyId,
        payer_id: user.id,
        payee_id: input.payeeId,
        payment_method_id: input.paymentMethodId ?? null,
        amount: Math.round(input.amount * 100),
        purpose: input.purpose,
        reference: input.reference || null,
        note: input.note || null,
        proof_path: input.proofPath,
      })
      .select('id')
      .single();

    if (error) throw error;

    revalidatePath('/dashboard/admin/payments');
    return { id: data.id };
  },
});
