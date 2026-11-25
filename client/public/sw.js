const CACHE_NAME = 'dreamchat-v1';
const STATIC_ASSETS = ['/', '/index.html'];
const STATIC_FILE_PATTERN = /\.(?:css|ico|js|png|svg|ttf|webp|woff2?)$/i;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(STATIC_ASSETS);
      await self.skipWaiting();
    }),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('dreamchat-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match('/index.html').then((cached) =>
        cached || fetch(request).catch(() => caches.match('/index.html')),
      ),
    );
    return;
  }

  if (!url.pathname.startsWith('/assets/') && !STATIC_FILE_PATTERN.test(url.pathname)) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request).then((response) => {
        if (response.ok && response.type === 'basic') {
          const responseToCache = response.clone();
          void caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache));
        }
        return response;
      });
    }),
  );
});
