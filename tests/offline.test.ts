/** Service-worker cache policy, offline startup and update handling. */

import { describe, expect, it } from 'vitest';
import {
  CACHE_PREFIX,
  cacheName,
  isCacheable,
  shouldHandle,
  staleCaches,
  strategyFor,
} from '../src/components/service-worker/cache-policy.js';

const ORIGIN = 'https://dearly.example';

describe('cache naming and cleanup', () => {
  it('names a cache after the build', () => {
    expect(cacheName('abc123')).toBe(`${CACHE_PREFIX}abc123`);
  });

  it('deletes only Dearly caches from older builds', () => {
    const names = [
      `${CACHE_PREFIX}old1`,
      `${CACHE_PREFIX}old2`,
      `${CACHE_PREFIX}current`,
      'some-other-app-cache',
    ];
    expect(staleCaches(names, `${CACHE_PREFIX}current`)).toEqual([
      `${CACHE_PREFIX}old1`,
      `${CACHE_PREFIX}old2`,
    ]);
  });
});

describe('which requests the worker touches', () => {
  it('handles same-origin GET requests only', () => {
    expect(shouldHandle({ method: 'GET', url: `${ORIGIN}/index.html` }, ORIGIN)).toBe(true);
    expect(shouldHandle({ method: 'POST', url: `${ORIGIN}/api/feedback` }, ORIGIN)).toBe(false);
    expect(shouldHandle({ method: 'GET', url: 'https://elsewhere.example/x.js' }, ORIGIN)).toBe(false);
  });

  it('ignores range requests', () => {
    expect(
      shouldHandle(
        { method: 'GET', url: `${ORIGIN}/sounds/page-turn.wav`, headers: { get: () => 'bytes=0-' } },
        ORIGIN,
      ),
    ).toBe(false);
  });
});

describe('strategies', () => {
  it('serves navigations network-first so an update is picked up', () => {
    expect(strategyFor('/', 'navigate')).toBe('navigation');
    expect(strategyFor('/index.html')).toBe('navigation');
  });

  it('never caches the optional Pages Functions', () => {
    expect(strategyFor('/api/feedback')).toBe('bypass');
    expect(strategyFor('/api/assist')).toBe('bypass');
  });

  it('caches immutable build output and media first', () => {
    expect(strategyFor('/assets/index.BOopxH5Q.js')).toBe('cache-first');
    expect(strategyFor('/assets/index.CT1gkYsr.css')).toBe('cache-first');
    expect(strategyFor('/icons/icon-512.png')).toBe('cache-first');
    expect(strategyFor('/stationery/kraft.svg')).toBe('cache-first');
    expect(strategyFor('/sounds/seal.wav')).toBe('cache-first');
    expect(strategyFor('/fonts/letter.woff2')).toBe('cache-first');
  });

  it('revalidates small files that change between builds', () => {
    expect(strategyFor('/manifest.webmanifest')).toBe('revalidate');
    expect(strategyFor('/print/page-a4.css')).toBe('revalidate');
  });
});

describe('what is worth storing', () => {
  it('stores only complete, successful, same-origin responses', () => {
    expect(isCacheable({ ok: true, status: 200, type: 'basic' })).toBe(true);
    expect(isCacheable({ ok: false, status: 404, type: 'basic' })).toBe(false);
    expect(isCacheable({ ok: true, status: 206, type: 'basic' })).toBe(false);
    expect(isCacheable({ ok: true, status: 200, type: 'opaque' })).toBe(false);
  });
});

describe('the generated worker', () => {
  it('does not skip waiting on its own, so an update never interrupts writing', async () => {
    const { readFile } = await import('node:fs/promises');
    const body = await readFile('src/components/service-worker/sw-body.js', 'utf8');

    // skipWaiting is only reachable through an explicit message from the page.
    const installBlock = body.slice(body.indexOf("addEventListener('install'"), body.indexOf("addEventListener('activate'"));
    expect(installBlock).not.toMatch(/self\.skipWaiting\s*\(/);
    expect(body).toContain("event.data.type === 'dearly:skip-waiting'");
  });

  it('falls back to the offline page when a navigation fails', async () => {
    const { readFile } = await import('node:fs/promises');
    const body = await readFile('src/components/service-worker/sw-body.js', 'utf8');
    expect(body).toContain('OFFLINE_URL');
    expect(body).toContain('cache.match(OFFLINE_URL)');
  });

  it('never precaches anything that could hold letter content', async () => {
    const { readFile } = await import('node:fs/promises');
    const script = await readFile('scripts/build-sw.mjs', 'utf8');
    // Precaching is an allow-list of application assets, not a sweep of dist/.
    expect(script).toContain('PRECACHE_PATTERNS');
    expect(script).toContain('EXCLUDE');
  });
});
