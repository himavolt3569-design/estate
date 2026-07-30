'use server';

import { z } from 'zod';

import { authedAction } from '@/lib/auth/action';

/**
 * Mints a short-lived URL for a private payment proof.
 *
 * Separate from actions.ts because this one returns a value the caller uses
 * immediately rather than performing a mutation, and because it is the only
 * place in the admin surface that hands out access to a private object.
 *
 * The path is validated to sit inside the payment-proofs namespace, so a caller
 * cannot pass `../verification-docs/...` and have Storage resolve it somewhere
 * they were never authorised to read.
 */
export const signProof = authedAction({
  permission: 'payment.verify',
  schema: z.object({
    path: z
      .string()
      .min(1)
      .max(300)
      .refine((p) => !p.includes('..') && !p.startsWith('/'), 'That path is not allowed'),
  }),
  handler: async ({ input, supabase }) => {
    const { data, error } = await supabase.storage
      .from('payment-proofs')
      .createSignedUrl(input.path, 60);

    if (error || !data?.signedUrl) {
      throw new Error('Could not open that file.');
    }

    return { url: data.signedUrl };
  },
});
