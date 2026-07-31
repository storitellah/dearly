/** Sanitising, image validation, migrations and route safety. */

import { describe, expect, it } from 'vitest';
import {
  escapeHtml,
  htmlToPlainText,
  looksExecutable,
  stripControlCharacters,
} from '../src/components/security/sanitise';
import {
  detectImageType,
  assertAcceptableImage,
  fitWithin,
  MAX_IMAGE_BYTES,
} from '../src/components/security/image-validate';
import { migrateLetter, needsMigration } from '../src/components/storage/migrations';
import {
  CURRENT_SCHEMA_VERSION,
  normaliseLetter,
  stripDangerousKeys,
  safeColour,
} from '../src/components/storage/schema';
import { parseRoute, routeToHash } from '../src/components/ui/router';
import { isSafeHref } from '../src/components/utilities/dom';
import { safeFileName } from '../src/components/utilities/format';
import { redactForAssistant } from '../src/components/editor/ai-assist';
import { PNG_BYTES, JPEG_BYTES } from './helpers';

describe('escaping and sanitising', () => {
  it('escapes every character that matters in HTML', () => {
    expect(escapeHtml('<script>"x" & \'y\'</script>')).toBe(
      '&lt;script&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/script&gt;',
    );
  });

  it('reduces hostile HTML to text without executing anything', () => {
    const output = htmlToPlainText(
      '<p>Hello</p><script>window.stolen = true</script><img src=x onerror="window.stolen = true">',
    );
    expect(output).toContain('Hello');
    expect(output).not.toContain('script');
    expect((window as unknown as { stolen?: boolean }).stolen).toBeUndefined();
  });

  it('keeps paragraph breaks when converting HTML to text', () => {
    expect(htmlToPlainText('<p>One</p><p>Two</p>')).toBe('One\n\nTwo');
  });

  it('spots executable-looking content', () => {
    expect(looksExecutable('<script src="x">')).toBe(true);
    expect(looksExecutable('javascript:alert(1)')).toBe(true);
    expect(looksExecutable('<div onclick="x">')).toBe(true);
    expect(looksExecutable('Dear Nan, the garden is fine.')).toBe(false);
  });

  it('strips control characters but keeps real punctuation and newlines', () => {
    const input = 'Dear Nan,\n\nAll well.\u0000 \u202eevil\u202c';
    const output = stripControlCharacters(input);
    expect(output).toContain('Dear Nan,\n\nAll well.');
    expect(output).not.toContain('\u0000');
    expect(output).not.toContain('\u202e');
  });
});

describe('image validation', () => {
  it('identifies real images by their bytes', () => {
    expect(detectImageType(PNG_BYTES)).toBe('image/png');
    expect(detectImageType(JPEG_BYTES)).toBe('image/jpeg');
    expect(detectImageType(new TextEncoder().encode('<svg xmlns="..."></svg>'))).toBe(
      'image/svg+xml',
    );
    expect(detectImageType(new TextEncoder().encode('just text'))).toBeNull();
  });

  it('refuses SVG even when it is named .png', async () => {
    const svg = new Blob([new TextEncoder().encode('<svg onload="alert(1)"></svg>')], {
      type: 'image/png',
    });
    await expect(assertAcceptableImage(svg)).rejects.toMatchObject({ kind: 'svg-refused' });
  });

  it('refuses a file that is not an image at all', async () => {
    const text = new Blob([new TextEncoder().encode('MZ this is an executable')], {
      type: 'image/png',
    });
    await expect(assertAcceptableImage(text)).rejects.toMatchObject({ kind: 'unsupported-type' });
  });

  it('refuses an oversized file before decoding it', async () => {
    const huge = { size: MAX_IMAGE_BYTES + 1, slice: () => new Blob() } as unknown as Blob;
    await expect(assertAcceptableImage(huge)).rejects.toMatchObject({ kind: 'too-large' });
  });

  it('accepts a real PNG', async () => {
    const png = new Blob([PNG_BYTES as unknown as BlobPart], { type: 'image/png' });
    await expect(assertAcceptableImage(png)).resolves.toBe('image/png');
  });

  it('scales images down without distorting them', () => {
    expect(fitWithin(4000, 3000, 2400)).toEqual({ width: 2400, height: 1800 });
    expect(fitWithin(300, 200, 2400)).toEqual({ width: 300, height: 200 });
    expect(fitWithin(0, 0, 100)).toEqual({ width: 1, height: 1 });
  });
});

describe('schema migration', () => {
  it('brings a version 1 letter forward without losing its words', () => {
    const legacy = {
      id: 'ltr_1111aaaa2222',
      schemaVersion: 1,
      title: 'An old draft',
      text: 'Words written in the first version of Dearly.',
      paper: 'kraft',
      sender: 'Bee',
      createdAt: '2024-05-01T10:00:00.000Z',
      updatedAt: '2024-05-01T10:00:00.000Z',
    };

    const outcome = migrateLetter(legacy);
    expect(outcome.changed).toBe(true);
    expect(outcome.fromFuture).toBe(false);
    expect(outcome.letter.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(outcome.letter.body).toBe('Words written in the first version of Dearly.');
    expect(outcome.letter.stationeryId).toBe('kraft');
    expect(outcome.letter.signature.name).toBe('Bee');
    expect(outcome.letter.envelope).toBeDefined();
  });

  it('preserves a letter from a newer version instead of destroying it', () => {
    const future = {
      id: 'ltr_3333cccc4444',
      schemaVersion: 99,
      title: 'From the future',
      body: 'Written by a later version.',
      somethingNew: { nested: true },
    };

    const outcome = migrateLetter(future);
    expect(outcome.fromFuture).toBe(true);
    expect(outcome.changed).toBe(false);
    expect(outcome.letter.body).toBe('Written by a later version.');
    expect(outcome.letter.unknownFields?.somethingNew).toEqual({ nested: true });
  });

  it('copes with rubbish input rather than throwing', () => {
    expect(() => migrateLetter(null)).not.toThrow();
    expect(() => migrateLetter('not an object')).not.toThrow();
    expect(migrateLetter({}).letter.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(needsMigration({ schemaVersion: CURRENT_SCHEMA_VERSION })).toBe(false);
    expect(needsMigration({ schemaVersion: 1 })).toBe(true);
  });

  it('clamps and cleans hostile field values', () => {
    const letter = normaliseLetter({
      id: 'ltr_5555dddd6666',
      title: 'x'.repeat(1000),
      category: 'not-a-category',
      status: 'nonsense',
      typography: { sizePt: 9999, lineHeight: -3, colour: 'url(javascript:alert(1))' },
      tags: ['ok', 42, 'a'.repeat(200)],
      printCount: -5,
    });

    expect(letter.title.length).toBe(200);
    expect(letter.category).toBe('everyday');
    expect(letter.status).toBe('draft');
    expect(letter.typography.sizePt).toBeLessThanOrEqual(24);
    expect(letter.typography.lineHeight).toBeGreaterThanOrEqual(1.1);
    expect(letter.typography.colour).toBe('#2b2118');
    expect(letter.tags).toHaveLength(2);
    expect(letter.printCount).toBe(0);
  });

  it('removes prototype-polluting keys', () => {
    const cleaned = stripDangerousKeys(
      JSON.parse('{"a":1,"__proto__":{"polluted":true},"nested":{"constructor":{"x":1}}}'),
    ) as Record<string, unknown>;

    expect(cleaned.a).toBe(1);
    expect(Object.keys(cleaned)).not.toContain('__proto__');
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('only accepts hex colours', () => {
    expect(safeColour('#abc')).toBe('#abc');
    expect(safeColour('#AABBCC')).toBe('#aabbcc');
    expect(safeColour('red')).toBe('#2b2118');
    expect(safeColour('expression(alert(1))')).toBe('#2b2118');
  });
});

describe('routes and links', () => {
  it('never accepts an arbitrary letter id from the address bar', () => {
    expect(parseRoute('#/write/ltr_00aa11bb22cc')).toEqual({
      name: 'write',
      id: 'ltr_00aa11bb22cc',
    });
    expect(parseRoute('#/write/<script>')).toEqual({ name: 'write', id: null });
    expect(parseRoute('#/nonsense')).toEqual({ name: 'home', id: null });
    expect(parseRoute('')).toEqual({ name: 'home', id: null });
    expect(routeToHash({ name: 'settings', id: null })).toBe('#/settings');
  });

  it('carries no personal data in a route', () => {
    const hash = routeToHash({ name: 'write', id: 'ltr_00aa11bb22cc' });
    expect(hash).not.toMatch(/[A-Z]/);
    expect(hash).toBe('#/write/ltr_00aa11bb22cc');
  });

  it('refuses unsafe link protocols', () => {
    expect(isSafeHref('https://storitellah.com')).toBe(true);
    expect(isSafeHref('mailto:hello@storitellah.com')).toBe(true);
    expect(isSafeHref('javascript:alert(1)')).toBe(false);
    expect(isSafeHref('data:text/html,<script>alert(1)</script>')).toBe(false);
  });

  it('produces safe file names from any title', () => {
    expect(safeFileName('../../etc/passwd')).toBe('etc-passwd');
    expect(safeFileName('For Nan <3')).toBe('for-nan-3');
    expect(safeFileName('')).toBe('letter');
    expect(safeFileName('.....')).toBe('letter');
  });
});

describe('assistant redaction', () => {
  it('removes names, addresses and contact details before anything is sent', () => {
    const text =
      'Dear Nan, write to me at 14 Willow Lane, Leeds, LS1 4AB, or bee@example.com, or ring +44 7700 900123.';
    const output = redactForAssistant(text, ['Nan', 'Bee'], ['14 Willow Lane\nLeeds\nLS1 4AB']);

    expect(output).not.toContain('Nan');
    expect(output).not.toContain('14 Willow Lane');
    expect(output).not.toContain('bee@example.com');
    expect(output).not.toContain('7700 900123');
    expect(output).toContain('[name removed]');
    expect(output).toContain('[email removed]');
  });

  it('leaves ordinary prose alone', () => {
    const text = 'The greenhouse survived the storm and the tomatoes are ridiculous.';
    expect(redactForAssistant(text)).toBe(text);
  });
});
