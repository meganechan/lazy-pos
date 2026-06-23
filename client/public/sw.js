// Lazy Nail POS — light service worker for installable PWA support.
// Caches the app shell only. NEVER caches /api/ requests so payment /
// financial data is always served fresh from the network.

const CACHE = 'lazypos-shell-v1';
const SHELL = ['/', '/index.html'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle GET. Anything else (POST/PUT/etc.) goes straight to network.
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Never cache API calls — always hit the network, no caching at all.
  // Bypass the SW cache entirely for /api/ so financial data is never stale.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(req));
    return;
  }

  // App-shell navigations: cache-first, fall back to network, then index.html.
  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req).catch(() => caches.match('/index.html'))
      )
    );
    return;
  }

  // Same-origin static assets: cache-first, then network (and cache the result).
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req)
          .then((res) => {
            if (res && res.ok && res.type === 'basic') {
              const copy = res.clone();
              caches.open(CACHE).then((cache) => cache.put(req, copy));
            }
            return res;
          })
          .catch(() => cached);
      })
    );
  }
});
