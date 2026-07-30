import 'server-only';

import { headers } from 'next/headers';

import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Fixed-window rate limiting for the endpoints that exist before a session does
 * (login, signup, password reset).
 *
 * Goes through the service-role client because rate_limit_buckets is revoked
 * from anon and authenticated by design: a caller who could read it would know
 * exactly how close they are to a limit, and one who could write it could reset
 * it. Keeping the table server-only is the point.
 */
export async function consumeRateLimit(
  bucket: string,
  subject: string,
  limit: number,
  windowInterval: string,
): Promise<boolean> {
  try {
    const supabase = createAdminClient('rate limiting a pre-session auth endpoint');
    const { data, error } = await supabase.rpc('consume_rate_limit', {
      p_bucket: bucket,
      p_subject: subject,
      p_limit: limit,
      p_window: windowInterval,
    });

    if (error) {
      // Fail open on infrastructure trouble. A rate limiter that locks everyone
      // out when it breaks is a self-inflicted outage; the auth provider has its
      // own limits underneath this one.
      console.error('[rate-limit]', error.message);
      return true;
    }

    return data as unknown as boolean;
  } catch (error) {
    console.error('[rate-limit]', error);
    return true;
  }
}

/** Best-effort client IP. Used only as a rate-limit subject, never for authorization. */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]!.trim();
  return h.get('x-real-ip') ?? 'unknown';
}

export async function getUserAgent(): Promise<string> {
  const h = await headers();
  return h.get('user-agent') ?? 'unknown';
}

/**
 * Records a sign-in attempt. The email is stored as a SHA-256 hash, never in
 * plain text, so a leak of auth_events does not hand anyone an address list.
 */
export async function recordAuthEvent(
  event:
    | 'login_success'
    | 'login_failed'
    | 'logout'
    | 'password_reset_requested'
    | 'password_reset_completed'
    | 'mfa_enrolled'
    | 'mfa_verified'
    | 'mfa_failed'
    | 'mfa_recovery_used'
    | 'email_verified'
    | 'session_revoked',
  options: {
    userId?: string | null;
    email?: string | null;
    /** Stored as jsonb, so values must be JSON-serialisable scalars. */
    detail?: Record<string, string | number | boolean | null>;
  } = {},
): Promise<void> {
  try {
    const supabase = createAdminClient('writing an append-only auth event');
    const [ip, userAgent] = await Promise.all([getClientIp(), getUserAgent()]);

    let emailHash: string | null = null;
    if (options.email) {
      const bytes = new TextEncoder().encode(options.email.trim().toLowerCase());
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      emailHash = Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }

    await supabase.from('auth_events').insert({
      user_id: options.userId ?? null,
      email_hash: emailHash,
      event,
      ip: ip === 'unknown' ? null : ip,
      user_agent: userAgent,
      detail: options.detail ?? {},
    });
  } catch (error) {
    // Never let logging break the flow it is observing.
    console.error('[auth-event]', error);
  }
}
