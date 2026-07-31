/** Pagination, print rendering and the exported page geometry. */

import { describe, expect, it, beforeAll } from 'vitest';
import {
  layoutLetter,
  splitParagraphs,
  wrapParagraph,
  fitImage,
  type LayoutPage,
  type TextLine,
} from '../src/components/printing/layout';
import { estimateWidth, useEstimatedMeasurement } from '../src/components/printing/measure';
import { renderLetterPages, renderPage } from '../src/components/printing/print-render';
import { getPaper, foldGuides, mmToPt } from '../src/components/printing/paper';
import { layoutEnvelope } from '../src/components/envelope/envelope-layout';
import { renderEnvelopePage } from '../src/components/envelope/envelope-render';
import { buildCalibrationPage } from '../src/components/printing/calibration';
import { getStationery } from '../src/components/stationery/stationery';
import { paginateFlow } from '../src/components/editor/wysiwyg/pagination';
import { renderDocumentPages } from '../src/components/printing/document-print';
import { textBlock } from '../src/components/document/model';
import { sampleLetter } from './helpers';

beforeAll(() => {
  // jsdom cannot measure text; use the deterministic estimator everywhere.
  useEstimatedMeasurement();
});

const measure = estimateWidth;

function textLines(page: LayoutPage): TextLine[] {
  return page.items.filter((item): item is TextLine => item.kind === 'text');
}

describe('wrapping', () => {
  it('splits paragraphs on blank lines', () => {
    expect(splitParagraphs('One\n\nTwo\n\n\nThree')).toEqual(['One', 'Two', 'Three']);
    expect(splitParagraphs('   ')).toEqual([]);
  });

  it('never produces a line wider than the column', () => {
    const style = { fontId: 'literata', sizePx: 15 };
    const widthMm = 170;
    const lines = wrapParagraph('word '.repeat(120), widthMm, style, measure);

    for (const line of lines) {
      const widthOfLine = (measure(line, style) / 96) * 25.4;
      expect(widthOfLine).toBeLessThanOrEqual(widthMm);
    }
    expect(lines.length).toBeGreaterThan(1);
  });

  it('breaks a single unbreakable word rather than letting it run off the paper', () => {
    const style = { fontId: 'literata', sizePx: 15 };
    const lines = wrapParagraph('x'.repeat(400), 60, style, measure);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect((measure(line, style) / 96) * 25.4).toBeLessThanOrEqual(60);
    }
  });

  it('returns one empty line for empty input', () => {
    expect(wrapParagraph('   ', 100, { fontId: 'literata', sizePx: 15 }, measure)).toEqual(['']);
  });
});

describe('page layout', () => {
  it('lays a short letter out on a single page', () => {
    const layout = layoutLetter(sampleLetter(), {
      paperId: 'a4',
      showPageNumbers: true,
      showFoldGuides: false,
      showCutGuides: false,
      includePhotographs: true,
      measure,
    });

    expect(layout.pages).toHaveLength(1);
    expect(layout.paper.id).toBe('a4');
    expect(layout.columnWidthMm).toBeCloseTo(
      210 - layout.margins.left - layout.margins.right,
      5,
    );
  });

  it('flows a long letter across several pages without dropping words', () => {
    const body = Array.from({ length: 60 }, (_, index) => `Paragraph ${index}. ${'word '.repeat(40)}`).join(
      '\n\n',
    );
    const layout = layoutLetter(sampleLetter({ body }), {
      paperId: 'a4',
      showPageNumbers: true,
      showFoldGuides: false,
      showCutGuides: false,
      includePhotographs: false,
      measure,
    });

    expect(layout.pages.length).toBeGreaterThan(3);

    const rendered = layout.pages
      .flatMap(textLines)
      .filter((line) => line.role === 'body')
      .map((line) => line.text)
      .join(' ');
    for (let index = 0; index < 60; index += 1) {
      expect(rendered).toContain(`Paragraph ${index}.`);
    }
  });

  it('keeps every line inside the printable area', () => {
    const paper = getPaper('a5');
    const layout = layoutLetter(sampleLetter({ body: 'word '.repeat(2000) }), {
      paperId: 'a5',
      showPageNumbers: true,
      showFoldGuides: false,
      showCutGuides: false,
      includePhotographs: false,
      measure,
    });

    for (const page of layout.pages) {
      for (const line of textLines(page)) {
        expect(line.yMm).toBeGreaterThanOrEqual(layout.margins.top - 0.01);
        expect(line.yMm + layout.lineHeightMm).toBeLessThanOrEqual(
          paper.heightMm - layout.margins.bottom + 0.5,
        );
        expect(line.xMm).toBeGreaterThanOrEqual(layout.margins.left - 0.01);
        expect(line.xMm + line.widthMm).toBeLessThanOrEqual(
          paper.widthMm - layout.margins.right + 0.01,
        );
      }
    }
  });

  it('adds a greeting only when the writer has not written one', () => {
    const withGreeting = layoutLetter(sampleLetter({ body: 'Dear Nan, hello.' }), {
      paperId: 'a4',
      showPageNumbers: false,
      showFoldGuides: false,
      showCutGuides: false,
      includePhotographs: false,
      measure,
    });
    expect(textLines(withGreeting.pages[0]!).some((line) => line.role === 'greeting')).toBe(false);

    const withoutGreeting = layoutLetter(sampleLetter({ body: 'The garden is fine.' }), {
      paperId: 'a4',
      showPageNumbers: false,
      showFoldGuides: false,
      showCutGuides: false,
      includePhotographs: false,
      measure,
    });
    expect(textLines(withoutGreeting.pages[0]!).some((line) => line.role === 'greeting')).toBe(true);
  });

  it('places the closing and signature after the body', () => {
    const layout = layoutLetter(
      sampleLetter({ signature: { name: 'Bee', style: 'script', attachmentId: null, closing: 'With love,' } }),
      {
        paperId: 'a4',
        showPageNumbers: false,
        showFoldGuides: false,
        showCutGuides: false,
        includePhotographs: false,
        measure,
      },
    );

    const lines = layout.pages.flatMap(textLines);
    const lastBody = lines.reduce((last, line, index) => (line.role === 'body' ? index : last), -1);
    const closing = lines.findIndex((line) => line.role === 'closing');
    const signature = lines.findIndex((line) => line.role === 'signature');

    expect(closing).toBeGreaterThan(lastBody);
    expect(signature).toBeGreaterThan(closing);
    expect(lines[signature]?.italic).toBe(true);
  });

  it('places photographs with their captions, scaled to fit', () => {
    const letter = sampleLetter({
      attachments: [
        {
          id: 'img_1111aaaa2222',
          letterId: 'ltr_x',
          name: 'photo',
          type: 'image/jpeg',
          bytes: 1000,
          width: 4000,
          height: 3000,
          caption: 'The greenhouse',
          role: 'photo',
          createdAt: new Date().toISOString(),
        },
      ],
    });

    const layout = layoutLetter(letter, {
      paperId: 'a4',
      showPageNumbers: false,
      showFoldGuides: false,
      showCutGuides: false,
      includePhotographs: true,
      measure,
    });

    const image = layout.pages.flatMap((page) => page.items).find((item) => item.kind === 'image');
    expect(image).toBeDefined();
    if (image && image.kind === 'image') {
      expect(image.widthMm).toBeLessThanOrEqual(layout.columnWidthMm + 0.01);
      expect(image.heightMm / image.widthMm).toBeCloseTo(3000 / 4000, 2);
    }

    const caption = layout.pages.flatMap(textLines).find((line) => line.role === 'caption');
    expect(caption?.text).toBe('The greenhouse');
  });

  it('omits photographs when asked to', () => {
    const letter = sampleLetter({
      attachments: [
        {
          id: 'img_2222bbbb3333',
          letterId: 'ltr_x',
          name: 'photo',
          type: 'image/jpeg',
          bytes: 10,
          width: 100,
          height: 100,
          caption: '',
          role: 'photo',
          createdAt: new Date().toISOString(),
        },
      ],
    });
    const layout = layoutLetter(letter, {
      paperId: 'a4',
      showPageNumbers: false,
      showFoldGuides: false,
      showCutGuides: false,
      includePhotographs: false,
      measure,
    });
    expect(layout.pages.flatMap((page) => page.items).some((item) => item.kind === 'image')).toBe(false);
  });

  it('justifies every line of a paragraph except the last', () => {
    const layout = layoutLetter(
      sampleLetter({
        body: 'word '.repeat(200),
        typography: { ...sampleLetter().typography, align: 'justify' },
      }),
      {
        paperId: 'a4',
        showPageNumbers: false,
        showFoldGuides: false,
        showCutGuides: false,
        includePhotographs: false,
        measure,
      },
    );

    const body = layout.pages.flatMap(textLines).filter((line) => line.role === 'body');
    expect(body.filter((line) => line.align === 'justify').length).toBeGreaterThan(0);
    expect(body.at(-1)?.align).toBe('left');
    expect(body.at(-1)?.lastOfParagraph).toBe(true);
  });

  it('respects margin overrides', () => {
    const layout = layoutLetter(sampleLetter(), {
      paperId: 'letter',
      margins: { top: 30, right: 30, bottom: 30, left: 30 },
      showPageNumbers: false,
      showFoldGuides: false,
      showCutGuides: false,
      includePhotographs: false,
      measure,
    });
    expect(layout.margins.top).toBe(30);
    expect(layout.columnWidthMm).toBeCloseTo(215.9 - 60, 5);
  });

  it('scales an image into a box without distortion', () => {
    expect(fitImage({ width: 100, height: 50 }, 100, 100)).toEqual({ widthMm: 100, heightMm: 50 });
    expect(fitImage({ width: 100, height: 400 }, 100, 100)).toEqual({ widthMm: 25, heightMm: 100 });
  });
});

describe('printed markup', () => {
  it('renders one section per page, sized in millimetres', () => {
    const letter = sampleLetter({ body: 'word '.repeat(1200) });
    const layout = layoutLetter(letter, {
      paperId: 'a4',
      showPageNumbers: true,
      showFoldGuides: true,
      showCutGuides: true,
      includePhotographs: false,
      measure,
    });

    const fragment = renderLetterPages(layout, { imageUrls: new Map() }, 'dl');
    const host = document.createElement('div');
    host.append(fragment);

    const pages = host.querySelectorAll('.print-page');
    expect(pages).toHaveLength(layout.pages.length);

    const first = pages[0] as HTMLElement;
    expect(parseFloat(first.style.width)).toBeCloseTo(210, 2);
    expect(parseFloat(first.style.height)).toBeCloseTo(297, 2);
    expect(first.querySelector('.print-page__number')?.textContent).toBe(`1 / ${layout.pages.length}`);
    expect(first.querySelectorAll('.print-guide--fold').length).toBe(foldGuides('a4', 'dl').length);
    expect(first.querySelectorAll('.print-guide--cut').length).toBe(4);
  });

  it('writes letter text as text, never as markup', () => {
    const letter = sampleLetter({ body: '<script>alert(1)</script> and <b>bold</b>' });
    const layout = layoutLetter(letter, {
      paperId: 'a4',
      showPageNumbers: false,
      showFoldGuides: false,
      showCutGuides: false,
      includePhotographs: false,
      measure,
    });

    const page = renderPage(layout, 0, { imageUrls: new Map() }, 'dl');
    expect(page.querySelector('script')).toBeNull();
    expect(page.querySelector('b')).toBeNull();
    expect(page.textContent).toContain('alert(1)');
  });

  it('carries the stationery colours onto the page', () => {
    const letter = sampleLetter({ stationeryId: 'kraft' });
    const stationery = getStationery('kraft');
    const layout = layoutLetter(letter, {
      paperId: 'a4',
      showPageNumbers: false,
      showFoldGuides: false,
      showCutGuides: false,
      includePhotographs: false,
      measure,
    });

    const page = renderPage(layout, 0, { imageUrls: new Map() }, 'dl');
    expect(page.style.getPropertyValue('--paper-colour')).toBe(stationery.paper);
    expect(page.classList.contains('print-page--textured')).toBe(true);
  });

  it('renders a calibration sheet with both rules and four corner marks', () => {
    const page = buildCalibrationPage('a4');
    expect(parseFloat(page.style.width)).toBeCloseTo(210, 2);
    expect(page.querySelector('.calibration__rule--metric')?.getAttribute('style')).toContain('100');
    expect(page.querySelector('.calibration__rule--imperial')?.getAttribute('style')).toContain('4in');
    expect(page.querySelectorAll('.calibration__corner')).toHaveLength(4);
  });
});

describe('envelopes', () => {
  it('places the recipient in the lower middle third', () => {
    const letter = sampleLetter({
      envelope: {
        ...sampleLetter().envelope,
        enabled: true,
        size: 'dl',
        recipientName: 'Nan',
        recipientAddress: '14 Willow Lane\nLeeds\nLS1 4AB',
        senderName: 'Bee',
        senderAddress: '2 Cross Street\nYork',
      },
    });

    const layout = layoutEnvelope(letter, { target: 'envelope', measure });
    const recipient = layout.blocks.find((block) => block.role === 'recipient');
    expect(recipient).toBeDefined();
    expect(recipient!.yMm).toBeGreaterThan(layout.envelope.heightMm * 0.4);
    expect(recipient!.xMm).toBeGreaterThan(layout.envelope.widthMm * 0.3);
    expect(recipient!.lines.join(' ')).toContain('Willow Lane');

    const sender = layout.blocks.find((block) => block.role === 'sender');
    expect(sender!.yMm).toBeLessThan(layout.envelope.heightMm * 0.3);
  });

  it('centres the envelope on a sheet when printing onto paper', () => {
    const letter = sampleLetter({
      envelope: { ...sampleLetter().envelope, enabled: true, size: 'c6', recipientName: 'Nan' },
    });
    const layout = layoutEnvelope(letter, { target: 'sheet', sheetId: 'a4', measure });

    expect(layout.sheet?.id).toBe('a4');
    expect(layout.offsetXMm).toBeCloseTo((210 - 162) / 2, 3);
    expect(layout.showGuides).toBe(true);

    const page = renderEnvelopePage(layout);
    expect(parseFloat(page.style.width)).toBeCloseTo(210, 2);
    expect(page.querySelectorAll('.envelope-cut')).toHaveLength(4);
  });

  it('converts millimetres to points for PDF geometry', () => {
    expect(mmToPt(210)).toBeCloseTo(595.28, 1);
    expect(mmToPt(297)).toBeCloseTo(841.89, 1);
  });
});

describe('printing the page itself', () => {
  it('keeps every page inside one usable band', () => {
    // jsdom has no layout, so this exercises the shape of the result rather
    // than real measurements: a flow it cannot measure must still be one page,
    // never zero and never an infinite loop.
    const flow = document.createElement('article');
    for (let index = 0; index < 3; index += 1) {
      flow.append(document.createElement('p'));
    }

    const pagination = paginateFlow(flow, 900);
    expect(pagination.starts).toHaveLength(pagination.heights.length);
    expect(pagination.starts.length).toBeGreaterThanOrEqual(1);
    expect(Math.max(...pagination.heights)).toBeLessThanOrEqual(900);
  });

  it('refuses to produce pages from an unusable band', () => {
    const flow = document.createElement('article');
    flow.append(document.createElement('p'));
    expect(paginateFlow(flow, 0).starts).toEqual([0]);
    expect(paginateFlow(flow, -10).starts).toEqual([0]);
  });

  it('treats an empty flow as a single page', () => {
    expect(paginateFlow(document.createElement('article'), 900).starts).toEqual([0]);
  });

  it('renders the document, not the plain-text mirror', () => {
    const letter = {
      ...sampleLetter(),
      doc: {
        version: 1,
        blocks: [
          textBlock('heading', 'The shed roof'),
          textBlock('paragraph', 'It survived the storm.'),
        ],
        decorations: [
          {
            id: 'dec_1',
            kind: 'sticker' as const,
            stickerId: 'heart',
            colours: [],
            page: 0,
            xMm: 100,
            yMm: 120,
            widthMm: 20,
            heightMm: 20,
            rotation: 0,
            opacity: 1,
            flipped: false,
            locked: false,
            layer: 5,
          },
        ],
      },
    };

    const result = renderDocumentPages(letter, letter.doc, {
      photoUrls: new Map(),
      stickerUrls: new Map(),
      showPageNumbers: true,
      paperWidthMm: 210,
      paperHeightMm: 297,
    });

    expect(result.pages.length).toBeGreaterThanOrEqual(1);
    const first = result.pages[0]!;

    // Structure the plain-text mirror could not carry.
    expect(first.querySelector('.lb--heading')?.textContent).toBe('The shed roof');
    expect(first.textContent).toContain('It survived the storm.');
    // Real text, never a picture of it.
    expect(first.querySelector('canvas')).toBeNull();
    // Nothing on paper may still look editable.
    expect(first.querySelector('[contenteditable="true"]')).toBeNull();
    // The sticker travels with the letter.
    expect(first.querySelector('[data-decoration]')).not.toBeNull();
    // And the measuring sheet is never left behind in the document.
    expect(document.querySelectorAll('.print-measure')).toHaveLength(0);
  });
});
