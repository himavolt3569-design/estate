import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Next 16 renamed the `middleware` convention to `proxy`. Same execution model,
 * same edge runtime. The name now reflects that this layer sits in front of the
 * app rather than inside the request handler.
 *
 * Runs on every request that is not a static asset. Three jobs:
 *
 *   1. Refresh the Supabase session and write the rotated cookies onto the
 *      response. Server Components cannot set cookies, so if this does not
 *      happen here, sessions silently expire mid-visit.
 *   2. Issue a per-request CSP nonce. Next picks the nonce out of the header we
 *      set and stamps it onto its own inline bootstrap scripts.
 *   3. Gate the authenticated route groups before a page renders.
 *
 * This is a convenience boundary, not the security boundary. Every one of these
 * checks is repeated in RLS and in authedAction(); middleware only saves a
 * wasted render and gives the user a sensible redirect.
 */
export default async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');

  const csp = [
    `default-src 'self'`,
    // strict-dynamic: scripts loaded by a nonced script inherit trust, so we
    // need no host allowlist and no 'unsafe-inline'.
    //
    // 'unsafe-eval' is added in development only. React's dev build uses eval()
    // to reconstruct component stacks across the server/client boundary; the
    // production build never does. Gating it on NODE_ENV keeps the shipped
    // policy strict while leaving the dev overlay working.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${
      process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''
    }`,
    // Leaflet writes style attributes on tiles and markers at runtime. Element
    // style attributes cannot be nonced or hashed. This permits style
    // injection, not script execution.
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' blob: data: https://*.supabase.co https://*.tile.openstreetmap.org http://127.0.0.1:54321`,
    `font-src 'self' data:`,
    `connect-src 'self' https://*.supabase.co wss://*.supabase.co http://127.0.0.1:54321 ws://127.0.0.1:54321`,
    // Virtual tours and video are the only embeds, and only from vetted hosts.
    `frame-src 'self' https://www.youtube-nocookie.com https://player.vimeo.com https://my.matterport.com https://kuula.co`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `upgrade-insecure-requests`,
  ].join('; ');

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('content-security-policy', csp);

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request: { headers: requestHeaders } });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser() revalidates against the auth server. getSession() would only read
  // the cookie, which on the server means trusting a client-controlled value.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isDashboard = pathname.startsWith('/dashboard');
  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/register');

  /*
   * Redirecting MUST carry the cookies `setAll` just wrote.
   *
   * getUser() above can rotate the refresh token. Those rotated cookies land on
   * `response`, and a bare NextResponse.redirect() is a different object that
   * does not have them. Losing them is not a silent no-op: refresh-token reuse
   * detection has already burned the old token, so the next request arrives
   * with a dead session, gets bounced back to /login, and the user sits in a
   * loop that looks exactly like "my password did not work".
   */
  const redirectTo = (url: URL) => {
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    redirect.headers.set('content-security-policy', csp);
    return redirect;
  };

  if (isDashboard && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return redirectTo(url);
  }

  if (user && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    url.search = '';
    return redirectTo(url);
  }

  response.headers.set('content-security-policy', csp);
  response.headers.set('x-nonce', nonce);
  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except static assets, the service worker and the icons it
     * precaches. Running auth on those would add a round trip to every image.
     */
    {
      source:
        '/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icons/.*|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff2?)$).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
