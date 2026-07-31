/**
 * Deployment configuration.
 *
 * These guard the two ways a perfectly good build can still show a blank page
 * once it is deployed: the host serving the project source instead of `dist/`,
 * and the single-page fallback shadowing the real asset files.
 */

import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

const read = (path: string): Promise<string> => readFile(path, 'utf8');

describe('the page shell', () => {
  it('styles the boot state from a linked stylesheet, not from the bundle', async () => {
    const html = await read('index.html');
    // If boot styling arrived through the bundle, a failed bundle would leave an
    // unstyled page with no explanation — which is exactly the failure this
    // guards against.
    expect(html).toContain('href="./boot.css"');
    expect(html).toMatch(/<link rel="stylesheet" href="\.\/boot\.css"/);
  });

  it('explains itself when the application never starts', async () => {
    const html = await read('index.html');
    expect(html).toContain('boot__diagnostic');
    expect(html).toContain('Dearly has not started');
    // The two real causes must both be named, with the fix for each.
    expect(html).toContain('npm run build');
    expect(html).toContain('dist');
    expect(html).toContain('npm run dev');
    // And it must reassure: a failed page load is not lost letters.
    expect(html).toMatch(/Letters are stored in this browser/i);
  });

  it('keeps the diagnostic out of the way of a healthy start-up', async () => {
    const css = await read('public/boot.css');
    // Hidden, then revealed on a long delay — a healthy boot clears #app first.
    expect(css).toMatch(/\.boot__diagnostic\s*\{[^}]*opacity:\s*0/s);
    const delay = /animation:\s*boot-diagnostic[^;]*?(\d+)s\s+forwards/.exec(css);
    expect(delay).not.toBeNull();
    expect(Number(delay?.[1])).toBeGreaterThanOrEqual(4);
  });

  it('uses no inline script or style, so the strict CSP holds', async () => {
    const html = await read('index.html');
    expect(html).not.toMatch(/<style[\s>]/i);
    expect(html).not.toMatch(/<script(?![^>]*\bsrc=)/i);
    expect(html).not.toMatch(/\son[a-z]+=/i);
  });
});

describe('the Cloudflare redirects file', () => {
  it('maps every directory of real files to itself before the catch-all', async () => {
    const redirects = await read('public/_redirects');
    const lines = redirects
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('#'));

    const catchAllIndex = lines.findIndex((line) => line.startsWith('/*'));
    expect(catchAllIndex).toBeGreaterThan(0);

    // Everything that holds real files must be protected ahead of the catch-all.
    for (const directory of ['/assets/', '/icons/', '/stationery/', '/sounds/', '/print/', '/api/']) {
      const index = lines.findIndex((line) => line.startsWith(`${directory}*`));
      expect(index, `${directory} must have a rule`).toBeGreaterThanOrEqual(0);
      expect(index, `${directory} must come before the catch-all`).toBeLessThan(catchAllIndex);
    }
  });

  it('has exactly one catch-all, and it is last', async () => {
    const redirects = await read('public/_redirects');
    const lines = redirects
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('#'));

    const catchAlls = lines.filter((line) => line.startsWith('/*'));
    expect(catchAlls).toHaveLength(1);
    expect(lines.at(-1)).toBe(catchAlls[0]);
    expect(catchAlls[0]).toMatch(/\/index\.html\s+200$/);
  });

  it('never rewrites an asset path to the app shell', async () => {
    const redirects = await read('public/_redirects');
    for (const line of redirects.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.length === 0 || trimmed.startsWith('#') || trimmed.startsWith('/*')) continue;
      const [from, to] = trimmed.split(/\s+/);
      if (from?.startsWith('/assets/') || from?.startsWith('/api/')) {
        expect(to).not.toContain('index.html');
      }
    }
  });
});

describe('the service worker precache list', () => {
  it('includes the boot stylesheet, so a cold offline start is styled', async () => {
    const script = await read('scripts/build-sw.mjs');
    expect(script).toMatch(/\^boot\\\.css\$/);
  });
});

describe('narrow screens', () => {
  const sheets = [
    'src/styles/joy.css',
    'src/styles/desk.css',
    'src/styles/editor.css',
    'src/styles/library.css',
    'src/styles/components.css',
  ];

  it('never lets a responsive grid grow wider than the phone it is on', async () => {
    // `repeat(auto-fit, minmax(15rem, 1fr))` cannot fall below its floor, so on
    // a 390px screen six 15rem columns push the whole page sideways. Wrapping
    // the floor in `min(..., 100%)` collapses it to one full-width column.
    for (const sheet of sheets) {
      const css = await read(sheet);
      const tracks = css.match(/repeat\((?:auto-fit|auto-fill),\s*minmax\([^)]*\)[^)]*\)/g) ?? [];
      for (const track of tracks) {
        expect.soft(track, `${sheet}: ${track}`).toContain('min(');
        expect.soft(track, `${sheet}: ${track}`).toContain('100%');
      }
    }
  });

  it('constrains the home column so a wide child cannot stretch it', async () => {
    const css = await read('src/styles/joy.css');
    const home = /\.home\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(home).toContain('grid-template-columns: minmax(0, 1fr)');
  });
});
