/*
 * Self-unregistering cleanup service worker replacing the legacy Kitta SW.
 * Removes legacy kitta-* caches and unregisters /sw.js without touching
 * /firebase-messaging-sw.js or intercepting fetch requests.
 */

self.addEventListener('install', () => {
  void self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith('kitta-'))
          .map((key) => caches.delete(key)),
      );

      await self.clients.claim();
      const clients = await self.clients.matchAll({ type: 'window' });
      await self.registration.unregister();

      await Promise.allSettled(
        clients.map((client) =>
          typeof client.navigate === 'function'
            ? client.navigate(client.url)
            : Promise.resolve(),
        ),
      );
    })(),
  );
});
