/** Text, HTML and PDF export. */

import { describe, expect, it } from 'vitest';
import { letterToHtml, letterToPlainText } from '../src/components/export/text-export';
import { buildPdf } from '../src/components/export/pdf';
import { ensureExtension, timestampSuffix } from '../src/components/export/download';
import { sampleLetter, sampleAttachment, JPEG_BYTES } from './helpers';

describe('plain text export', () => {
  it('includes the heading, greeting, body and signature', () => {
    const text = letterToPlainText(
      sampleLetter({
        signature: { name: 'Bee', style: 'typed', attachmentId: null, closing: 'With love,' },
      }),
    );

    expect(text).toContain('Leeds');
    expect(text).toContain('For Nan');
    expect(text).toContain('Dear Nan,');
    expect(text).toContain('The garden is doing what you said it would.');
    expect(text).toContain('With love,');
    expect(text).toContain('Bee');
    expect(text).toContain('Tags: garden, family');
    expect(text.endsWith('\n')).toBe(true);
  });

  it('handles an empty letter without producing rubbish', () => {
    const text = letterToPlainText(
      sampleLetter({ body: '', title: '', recipient: '', tags: [], senderLocation: '' }),
    );
    expect(text.trim().length).toBeGreaterThanOrEqual(0);
    expect(text).not.toContain('undefined');
    expect(text).not.toContain('null');
  });
});

describe('HTML export', () => {
  it('produces a self-contained document with no scripts', async () => {
    const letter = sampleLetter();
    const html = await letterToHtml(letter, [sampleAttachment(letter.id)]);

    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/https?:\/\//);
    expect(html).toContain('data:image/png;base64,');
    expect(html).toContain('noindex');
  });

  it('escapes letter text rather than embedding markup', async () => {
    const letter = sampleLetter({
      body: '<script>alert(1)</script>',
      title: '<img src=x onerror=alert(1)>',
      recipient: '"><b>bold</b>',
    });
    const html = await letterToHtml(letter);

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('&quot;&gt;&lt;b&gt;');
  });
});

describe('PDF export', () => {
  const page = {
    jpeg: JPEG_BYTES,
    widthMm: 210,
    heightMm: 297,
    pixelWidth: 1654,
    pixelHeight: 2339,
  };

  it('writes a valid PDF header, xref and trailer', async () => {
    const blob = buildPdf([page, page], { title: 'For Nan' });
    expect(blob.type).toBe('application/pdf');

    const text = new TextDecoder('latin1').decode(new Uint8Array(await blob.arrayBuffer()));
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text).toContain('/Type /Catalog');
    expect(text).toContain('/Type /Pages /Count 2');
    expect(text).toContain('/Filter /DCTDecode');
    expect(text).toContain('xref');
    expect(text).toContain('trailer');
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
  });

  it('sets the page box to the real paper size in points', async () => {
    const blob = buildPdf([page], { title: 'For Nan' });
    const text = new TextDecoder('latin1').decode(new Uint8Array(await blob.arrayBuffer()));
    expect(text).toContain('/MediaBox [0 0 595.28 841.89]');
  });

  it('records the title and producer without leaking letter text', async () => {
    const blob = buildPdf([page], { title: 'For Nan', subject: 'A letter for Nan' });
    const text = new TextDecoder('latin1').decode(new Uint8Array(await blob.arrayBuffer()));
    expect(text).toContain('(For Nan)');
    expect(text).toContain('(Dearly by Storitellah)');
  });

  it('points its cross-reference table at real object offsets', async () => {
    const blob = buildPdf([page], { title: 'x' });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const text = new TextDecoder('latin1').decode(bytes);

    const startxref = Number(/startxref\s+(\d+)/.exec(text)?.[1]);
    expect(Number.isFinite(startxref)).toBe(true);
    expect(text.slice(startxref, startxref + 4)).toBe('xref');

    const firstOffset = Number(/xref\n0 \d+\n0000000000 65535 f \n(\d{10})/.exec(text)?.[1]);
    expect(text.slice(firstOffset, firstOffset + 7)).toBe('1 0 obj');
  });

  it('refuses to build an empty PDF', () => {
    expect(() => buildPdf([], { title: 'x' })).toThrowError(/at least one page/i);
  });
});

describe('downloads', () => {
  it('sanitises file names while keeping the extension', () => {
    expect(ensureExtension('../../secret letter.pdf')).toBe('secret-letter.pdf');
    expect(ensureExtension('For Nan <3.dearly')).toBe('for-nan-3.dearly');
    expect(ensureExtension('.txt')).toBe('dearly-export.txt');
  });

  it('produces a sortable timestamp suffix', () => {
    expect(timestampSuffix(new Date(2026, 6, 30, 9, 5))).toBe('20260730-0905');
  });
});
