'use client';

import { createBrowserClient } from '@supabase/ssr';

import type { Database } from './database.types';

let cached: ReturnType<typeof createBrowserClient<Database>> | undefined;

/**
 * Browser client. Carries the user's JWT; RLS applies exactly as it does on the
 * server. Memoised so realtime channels are not torn down and rebuilt on every
 * render.
 */
export function createClient() {
  cached ??= createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  return cached;
}
