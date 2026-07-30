import 'server-only';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

import type { Database } from './database.types';

/**
 * SERVICE ROLE CLIENT. RLS IS BYPASSED.
 *
 * Permitted uses, and no others (docs/01-architecture.md §4):
 *
 *   1. Writing audit logs (a user must not be able to suppress their own trail).
 *   2. Scheduled jobs: expiring stale listings, running saved-search digests.
 *   3. Storage cleanup of orphaned media after a listing is removed.
 *   4. Reading the auth schema for session/device management.
 *
 * It is NOT for "making a query work". If a legitimate user action fails under
 * RLS, the policy is wrong, so fix the policy. Every reach for this client is a
 * decision to step outside the security model, so each call site states its
 * reason and writes an audit entry.
 */
export function createAdminClient(reason: string) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured');
  }

  if (!reason || reason.trim().length < 8) {
    throw new Error('createAdminClient requires a reason describing why RLS is being bypassed');
  }

  return createSupabaseClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: { headers: { 'x-bypass-reason': reason } },
  });
}
