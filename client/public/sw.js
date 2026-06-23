// Lazy Nail POS — light service worker for installable PWA support.
// Caches the app shell only. NEVER caches /api/ requests so payment /
// financial data is always served fresh from the network.

// v2: navigations are network-first so a new deploy is picked up automatically
// on the next open/refresh (the old v1 cache-first navigation pinned a stale
// index.html and never updated). Bumping the cache name also evicts the stale
// v1 shell for anyone who already installed (the activate handler deletes any
// cache != CACHE).
const CACHE = 'lazypos-shell-v2';
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

  // App-shell navigations: NETWORK-FIRST so a fresh deploy is served on the next
  // open/refresh (the new index.html points at the new hashed assets). Cache the
  // latest index.html as we go, and fall back to it only when offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put('/index.html', copy));
          }
          return res;
        })
        .catch(() => caches.match('/index.html').then((c) => c || caches.match('/')))
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
