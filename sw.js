// Service worker destruidor: remove qualquer SW antigo que esteja prendendo cache do site.
const CFF_BUILD_VERSION = '20260520-auto-cache-v2';

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    if (self.registration && self.registration.unregister) {
      await self.registration.unregister();
    }
    const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clientsList) {
      client.navigate(client.url);
    }
  })());
});

self.addEventListener('fetch', event => {
  event.respondWith(fetch(event.request, { cache: 'no-store' }));
});
