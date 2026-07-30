/**
 * Cache policy for the Dearly service worker.
 *
 * Plain JavaScript with no reference to `self`, for two reasons: the build
 * concatenates it into `dist/sw.js`, and the unit tests import it directly. There
 * is therefore exactly one copy of these decisions.
 */

export const CACHE_PREFIX = 'dearly-assets-';

/** @param {string} version */
export function cacheName(version) {
  return `${CACHE_PREFIX}${version}`;
}

/**
 * Caches from older builds, safe to delete. Anything not created by Dearly is
 * left alone.
 * @param {string[]} names
 * @param {string} current
 */
export function staleCaches(names, current) {
  return names.filter((name) => name.startsWith(CACHE_PREFIX) && name !== current);
}

/**
 * Requests the worker will touch at all. Anything else — a POST, a cross-origin
 * request, a range request for media — goes straight to the network.
 * @param {{method: string, url: string, headers?: {get: (name: string) => string | null}, mode?: string}} request
 * @param {string} origin
 */
export function shouldHandle(request, origin) {
  if (request.method !== 'GET') return false;
  if (!request.url.startsWith(origin)) return false;
  if (request.headers && request.headers.get('range')) return false;
  return true;
}

/**
 * Which strategy applies to a same-origin path.
 *
 *  - `bypass`        never cached: optional Pages Functions, and anything under
 *                    /api/. Letter content never travels over HTTP at all, but
 *                    this makes the intent explicit.
 *  - `cache-first`   immutable build assets and media.
 *  - `revalidate`    small files that may change between builds.
 *  - `navigation`    HTML documents: network first, cache fallback, then the
 *                    offline page.
 *
 * @param {string} pathname
 * @param {string} [mode]
 */
export function strategyFor(pathname, mode) {
  if (mode === 'navigate') return 'navigation';
  if (/^\/(api|functions)\//.test(pathname)) return 'bypass';
  if (/\.(html)$/.test(pathname)) return 'navigation';
  // Everything under /assets/ is hashed build output, so it never changes
  // under the same name.
  if (/\/assets\//.test(pathname)) return 'cache-first';
  if (/\.(woff2?|ttf|otf)$/.test(pathname)) return 'cache-first';
  if (/\.(png|jpe?g|webp|svg|ico|avif)$/.test(pathname)) return 'cache-first';
  if (/\.(wav|mp3|ogg)$/.test(pathname)) return 'cache-first';
  if (/\.(css|js|mjs)$/.test(pathname)) return 'revalidate';
  if (/\.(webmanifest|json|txt)$/.test(pathname)) return 'revalidate';
  return 'revalidate';
}

/**
 * Responses worth storing. Opaque and partial responses are not, because a
 * cached error would outlive the problem that caused it.
 * @param {{ok: boolean, status: number, type: string}} response
 */
export function isCacheable(response) {
  if (!response) return false;
  if (response.type === 'opaque' || response.type === 'opaqueredirect') return false;
  return response.ok && response.status === 200;
}
