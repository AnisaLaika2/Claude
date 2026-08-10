// Service worker: rende l'app utilizzabile offline dopo la prima apertura.
// Strategia: network-first per la navigazione (per avere gli aggiornamenti),
// cache-first per gli asset statici (js/css/immagini/font).

const CACHE = 'gestione-spese-v1';

self.addEventListener('install', () => {
  // Attiva subito la nuova versione del service worker.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Richieste di navigazione (apertura pagina): prova la rete, poi la cache.
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const net = await fetch(req);
          const cache = await caches.open(CACHE);
          cache.put(req, net.clone());
          return net;
        } catch {
          const cache = await caches.open(CACHE);
          return (
            (await cache.match(req)) ||
            (await cache.match('./')) ||
            (await cache.match('index.html')) ||
            Response.error()
          );
        }
      })(),
    );
    return;
  }

  // Asset statici: usa la cache, aggiornandola in background.
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(req);
      if (cached) return cached;
      try {
        const net = await fetch(req);
        if (net && net.status === 200) cache.put(req, net.clone());
        return net;
      } catch {
        return cached || Response.error();
      }
    })(),
  );
});
