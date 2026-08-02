'use server';

import { createHash } from 'node:crypto';

import { createClient } from '@/lib/supabase/server';

/**
 * Presence and view recording.
 *
 * The browser holds a random session token in sessionStorage and sends it here;
 * this module hashes it with a server-only salt before it reaches a column. Two
 * consequences, both deliberate:
 *
 *   - The value stored is not the value the client holds, so a leaked row cannot
 *     be replayed as somebody's session, and rotating VIEW_HASH_SALT retires
 *     every historical hash at once.
 *   - No IP address is read, stored, or hashed anywhere in this path. The token
 *     identifies a browser tab, not a person, and is discarded when the tab
 *     closes.
 */

function hashSession(token: string): string {
  const salt = process.env.VIEW_HASH_SALT ?? '';
  return createHash('sha256').update(`${salt}:${token}`).digest('hex').slice(0, 64);
}

/** Strips the query string: search terms are not presence data. */
function safePath(path: string): string {
  const [withoutQuery] = path.split('?');
  return (withoutQuery || '/').slice(0, 300);
}

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

export async function recordPresence(input: {
  token: string;
  path: string;
  propertyId?: string | null;
}): Promise<void> {
  if (!TOKEN_PATTERN.test(input.token)) return;

  try {
    const supabase = await createClient();
    await supabase.rpc('record_presence', {
      p_session_hash: hashSession(input.token),
      p_path: safePath(input.path),
      p_property_id: input.propertyId ?? undefined,
    });
  } catch (cause) {
    // A heartbeat is best-effort. It must never surface to the visitor, and it
    // must never take a page down with it.
    console.error('[record_presence]', cause instanceof Error ? cause.message : cause);
  }
}

export async function recordPropertyView(input: {
  token: string;
  propertyId: string;
  referrer?: string | null;
}): Promise<void> {
  if (!TOKEN_PATTERN.test(input.token)) return;

  try {
    const supabase = await createClient();
    await supabase.rpc('record_property_view', {
      p_property_id: input.propertyId,
      // Same salt, different namespace, so the presence row and the view row
      // for one visitor cannot be correlated by anyone reading the tables.
      p_viewer_hash: hashSession(`view:${input.token}`),
      p_referrer: input.referrer?.slice(0, 500) ?? undefined,
    });
  } catch (cause) {
    console.error('[record_property_view]', cause instanceof Error ? cause.message : cause);
  }
}
