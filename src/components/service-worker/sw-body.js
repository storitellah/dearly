/* global CACHE_VERSION, PRECACHE_URLS, OFFLINE_URL, cacheName, staleCaches, shouldHandle,
   strategyFor, isCacheable */

/**
 * Dearly service worker — body.
 *
 * `scripts/build-sw.mjs` prepends the build constants and the cache policy, then
 * writes the result to `dist/sw.js`. Nothing here caches letter content: the only
 * things stored are the application's own assets, listed at build time.
 */

const CACHE = cacheName(CACHE_VERSION);

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // Add one at a time: a single 404 must not fail the whole install.
      await Promise.all(
        PRECACHE_URLS.map(async (url) => {
          try {
            await cache.add(new Request(url, { cache: 'reload' }));
          } catch (error) {
            console.warn('Dearly service worker: could not precache', url, String(error));
          }
        }),
      );
      // Do not call skipWaiting here: the page decides when to update, so an
      // update never interrupts someone with unsaved work.
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(staleCaches(names, CACHE).map((name) => caches.delete(name)));
      if (self.registration.navigationPreload) {
        try {
          await self.registration.navigationPreload.disable();
        } catch {
          /* not supported everywhere */
        }
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'dearly:skip-waiting') {
    void self.skipWaiting();
  }
  if (event.data && event.data.type === 'dearly:cache-status') {
    event.source?.postMessage({ type: 'dearly:cache-status', version: CACHE_VERSION });
  }
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const origin = self.location.origin;
  if (!shouldHandle(request, origin)) return;

  const url = new URL(request.url);
  const strategy = strategyFor(url.pathname, request.mode);
  if (strategy === 'bypass') return;

  if (strategy === 'navigation') {
    event.respondWith(handleNavigation(request));
    return;
  }
  if (strategy === 'cache-first') {
    event.respondWith(cacheFirst(request));
    return;
  }
  event.respondWith(revalidate(request));
});

async function handleNavigation(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (isCacheable(response)) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = (await cache.match(request)) || (await cache.match(OFFLINE_URL));
    if (cached) return cached;
    return new Response(
      'Dearly is offline and this page is not in the offline cache yet.',
      { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
    );
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (isCacheable(response)) cache.put(request, response.clone());
  return response;
}

async function revalidate(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (isCacheable(response)) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  if (cached) {
    void network;
    return cached;
  }
  const response = await network;
  if (response) return response;
  return new Response('', { status: 504, statusText: 'Offline and not cached' });
}
