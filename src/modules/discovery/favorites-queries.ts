import 'server-only';

import { createClient } from '@/lib/supabase/server';

/** Which of these the caller has saved. One round trip for a whole grid. */
export async function getSavedPropertyIds(propertyIds: string[]): Promise<string[]> {
  if (propertyIds.length === 0) return [];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('favorites')
    .select('property_id')
    .in('property_id', propertyIds);

  if (error) {
    console.error('[getSavedPropertyIds]', error.message);
    return [];
  }

  return (data ?? []).map((row) => row.property_id);
}
