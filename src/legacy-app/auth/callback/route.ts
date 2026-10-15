import { NextResponse, type NextRequest } from 'next/server';

import { recordAuthEvent } from '@/lib/auth/rate-limit';
import { createClient } from '@/lib/supabase/server';

/**
 * The single OAuth / email-link landing point.
 *
 * Handles the PKCE code exchange for Google sign-in, email confirmation, and
 * password-recovery links. Supabase performs the exchange; our job is to accept
 * the code, set the session cookies, and send the user somewhere safe.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  // `next` comes from the URL, so it is attacker-controlled. Only same-origin
  // relative paths are honoured. Otherwise this is an open redirect that can
  // be used to bounce users to a convincing phishing page carrying our domain
  // in the referrer.
  const requested = searchParams.get('next') ?? '/dashboard';
  const next = requested.startsWith('/') && !requested.startsWith('//') ? requested : '/dashboard';

  if (error) {
    const message =
      error === 'access_denied'
        ? 'Sign-in was cancelled.'
        : (errorDescription ?? 'Sign-in failed. Try again.');
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(message)}`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('That link is not valid.')}`);
  }

  const supabase = await createClient();
  const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent('That link has expired. Request a new one.')}`,
    );
  }

  await recordAuthEvent('login_success', {
    userId: data.user?.id,
    email: data.user?.email ?? null,
    detail: { method: data.user?.app_metadata?.['provider'] ?? 'email' },
  });

  return NextResponse.redirect(`${origin}${next}`);
}
