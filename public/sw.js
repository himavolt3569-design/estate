/*
 * Kitta service worker.
 *
 * Hand-written rather than generated: next-pwa is abandoned at the Next 12 era,
 * and 200 lines we understand beats a Workbox bundle we do not.
 *
 * The rule that matters most is the last one. Anything authenticated, anything
 * that mutates, and anything to do with money is NETWORK ONLY and is never
 * queued for replay. A payment that silently retries when a phone comes back
 * online is a payment nobody authorised.
 */

const VERSION = 'v1';
const SHELL_CACHE = `kitta-shell-${VERSION}`;
const IMAGE_CACHE = `kitta-images-${VERSION}`;
const DATA_CACHE = `kitta-data-${VERSION}`;

const SHELL_ASSETS = ['/', '/search', '/offline', '/manifest.webmanifest'];

/** Never cached, never queued, never replayed. */
const NEVER_CACHE = [
  '/auth/',
  '/login',
  '/register',
  '/dashboard/',
  '/api/',
  '/rest/v1/rpc/reveal_contact',
  '/rest/v1/payments',
  '/rest/v1/payment_methods',
  '/rest/v1/profiles',
  '/rest/v1/audit_logs',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !key.endsWith(VERSION))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Mutations always go to the network. No offline queue, by design.
  if (request.method !== 'GET') return;

  if (NEVER_CACHE.some((path) => url.pathname.includes(path))) return;

  // Cross-origin: only map tiles are worth caching, and only briefly.
  if (url.origin !== self.location.origin) {
    if (url.hostname.endsWith('tile.openstreetmap.org')) {
      event.respondWith(cacheFirst(request, IMAGE_CACHE));
    }
    return;
  }

  // Property media: immutable once written, so cache-first is safe.
  if (url.pathname.includes('/storage/v1/object/public/property-media/')) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE));
    return;
  }

  // Navigations: network first so a published price change is never stale,
  // falling back to the shell when the connection drops.
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  // Public listing reads: stale-while-revalidate keeps recently viewed
  // properties readable offline.
  if (url.pathname.startsWith('/rest/v1/rpc/get_property_public') ||
      url.pathname.startsWith('/rest/v1/rpc/search_properties')) {
    event.respondWith(staleWhileRevalidate(request, DATA_CACHE));
    return;
  }

  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request, SHELL_CACHE));
  }
});

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('', { status: 504, statusText: 'Offline' });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);

  return cached ?? network;
}

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached ?? (await caches.match('/offline')) ?? new Response('Offline', { status: 503 });
  }
}

/* --------------------------------------------------------------------------
 * Push notifications for enquiries and saved-search hits (Phase 9).
 * The payload carries no personal data: it is a signal to open the app, and the
 * real content is fetched through RLS once the user taps it.
 * -------------------------------------------------------------------------- */
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    return;
  }

  event.waitUntil(
    self.registration.showNotification(payload.title ?? 'Kitta', {
      body: payload.body ?? '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: payload.tag ?? 'kitta',
      data: { href: payload.href ?? '/dashboard' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const href = event.notification.data?.href ?? '/dashboard';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => client.url.includes(self.location.origin));
      if (existing) return existing.focus().then((c) => c.navigate(href));
      return self.clients.openWindow(href);
    }),
  );
});
