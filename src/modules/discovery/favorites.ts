'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { authedAction } from '@/lib/auth/action';

/**
 * Saving a property.
 *
 * The `favorites` table, its RLS and its counter trigger have existed since
 * 0005, and /dashboard/saved has always read them. Nothing could ever write one:
 * there was no action and no button anywhere in the product, so the saved page
 * was permanently empty and `favorite_count` was permanently zero.
 *
 * The toggle is a delete-then-insert rather than an upsert because the primary
 * key is the pair, and "is it already there" is the question being asked.
 */

export const toggleFavorite = authedAction({
  schema: z.object({ propertyId: z.string().uuid() }),
  handler: async ({ input, supabase, user }) => {
    const { data: existing } = await supabase
      .from('favorites')
      .select('property_id')
      .eq('property_id', input.propertyId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('property_id', input.propertyId)
        .eq('user_id', user.id);
      if (error) throw error;

      revalidatePath('/dashboard/saved');
      return { saved: false };
    }

    const { error } = await supabase
      .from('favorites')
      .insert({ property_id: input.propertyId, user_id: user.id });

    // Two tabs, two taps, one row. The unique primary key is the arbiter, and
    // losing that race means the property is saved, which is what was asked for.
    if (error && error.code !== '23505') throw error;

    revalidatePath('/dashboard/saved');
    return { saved: true };
  },
});
