/**
 * The redesign: colour contrast, the document model, stickers and templates.
 *
 * The contrast tests matter most. A vibrant palette is only worth having if the
 * words on top of it can still be read, so every theme is checked here rather
 * than eyeballed.
 */

import { describe, expect, it } from 'vitest';
import {
  THEMES,
  contrastPairs,
  contrastRatio,
  getTheme,
  meetsAA,
  parseHex,
} from '../src/components/theme/themes';
import {
  cleanText,
  documentFromPlainText,
  documentText,
  documentWordCount,
  emptyDocument,
  normaliseDocument,
  safeHref,
  textBlock,
} from '../src/components/document/model';
import { parseDocument, parseInlines, rgbToHex } from '../src/components/document/parse';
import { pasteAsPlainText, pasteAsRichText, blocksToInlines } from '../src/components/document/paste';
import { DocumentHistory } from '../src/components/document/history';
import { placeDecoration, renderFlow, renderInline } from '../src/components/document/render';
import { STICKERS, STICKER_CATEGORIES, missingShapes, searchStickers } from '../src/components/stickers/library';
import { stickerToSvgSource } from '../src/components/stickers/render';
import { TEMPLATES, TEMPLATE_CATEGORIES, filterTemplates, getTemplate } from '../src/components/templates/templates';
import { getPaper, PAPERS } from '../src/components/templates/papers';
import { migrateLetter } from '../src/components/storage/migrations';
import { CURRENT_SCHEMA_VERSION } from '../src/components/storage/schema';
import { filterCommands, SLASH_COMMANDS } from '../src/components/editor/wysiwyg/slash-menu';
import { snap } from '../src/components/editor/wysiwyg/decoration-layer';

const context = () => ({
  photoUrls: new Map<string, string>(),
  stickerUrls: new Map<string, string>(),
  editable: true,
});

describe('the colour system', () => {
  it('ships the twelve named themes', () => {
    const names = THEMES.map((theme) => theme.name);
    for (const expected of [
      'Sunshine Yellow',
      'Bubblegum Pink',
      'Sky Blue',
      'Mint Green',
      'Lavender Dream',
      'Orange Pop',
      'Cherry Red',
      'Ocean Blue',
      'Peach Glow',
      'Lime Splash',
      'Rainbow Mix',
      'Midnight Neon',
    ]) {
      expect(names).toContain(expected);
    }
    expect(THEMES).toHaveLength(12);
  });

  it('gives every theme a complete palette', () => {
    for (const theme of THEMES) {
      for (const key of [
        'primary',
        'onPrimary',
        'secondary',
        'onSecondary',
        'accent',
        'onAccent',
        'background',
        'surface',
        'paper',
        'paperInk',
        'text',
        'textSoft',
        'line',
        'envelope',
        'envelopeLining',
        'focus',
      ] as const) {
        expect(theme.palette[key], `${theme.name}.${key}`).toMatch(/^#[0-9a-f]{6}$/i);
      }
      expect(theme.palette.stickers).toHaveLength(5);
      expect(theme.print.paper).toMatch(/^#[0-9a-f]{6}$/i);
      expect(theme.print.ink).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('keeps every text pair readable at WCAG 2.2 AA', () => {
    const failures: string[] = [];
    for (const theme of THEMES) {
      for (const pair of contrastPairs(theme)) {
        const ratio = contrastRatio(pair.fg, pair.bg);
        if (ratio < 4.5) {
          failures.push(`${theme.name}: ${pair.label} is ${ratio.toFixed(2)}:1`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it('computes contrast the way the specification does', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
    expect(meetsAA('#767676', '#ffffff')).toBe(true);
    expect(meetsAA('#999999', '#ffffff')).toBe(false);
    expect(parseHex('#abc')).toEqual([170, 187, 204]);
  });

  it('flips the dark theme to paper for printing', () => {
    const midnight = getTheme('midnight-neon');
    expect(midnight.dark).toBe(true);
    expect(midnight.print.paper).toBe('#ffffff');
    expect(contrastRatio(midnight.print.ink, midnight.print.paper)).toBeGreaterThan(4.5);
  });
});

describe('the document model', () => {
  it('starts a letter with the fields people expect', () => {
    const doc = emptyDocument();
    const types = doc.blocks.map((block) => block.type);
    expect(types).toEqual(['meta', 'greeting', 'paragraph', 'closing', 'signature']);
    expect(documentText(doc)).toBe('');
  });

  it('turns a plain-text letter into blocks without losing words', () => {
    const doc = documentFromPlainText('First thing.\n\nSecond thing.', {
      recipient: 'Nan',
      closing: 'With love,',
      signature: 'Bee',
    });
    const text = documentText(doc);
    expect(text).toContain('Dear Nan,');
    expect(text).toContain('First thing.');
    expect(text).toContain('Second thing.');
    expect(text).toContain('Bee');
    expect(documentWordCount(doc)).toBeGreaterThan(4);
  });

  it('refuses anything that is not a safe link', () => {
    expect(safeHref('https://storitellah.com')).toBe('https://storitellah.com/');
    expect(safeHref('mailto:hello@storitellah.com')).toBe('mailto:hello@storitellah.com');
    expect(safeHref('javascript:alert(1)')).toBeUndefined();
    expect(safeHref('data:text/html,<script>')).toBeUndefined();
    expect(safeHref('/relative')).toBeUndefined();
  });

  it('strips characters that could hide or reorder text', () => {
    expect(cleanText('safe\u0000text\u202e')).toBe('safetext');
    expect(cleanText('keeps\nnewlines')).toBe('keeps\nnewlines');
  });

  it('coerces hostile input into a valid document', () => {
    const doc = normaliseDocument({
      blocks: [
        { type: '<script>', inlines: [{ text: 'x', marks: ['bold', 'evil'] }] },
        { type: 'photo' },
        'nonsense',
      ],
      decorations: [{ kind: 'sticker', stickerId: 'love-red-heart', opacity: 99, widthMm: -5 }],
    });

    expect(doc.blocks[0]?.type).toBe('paragraph');
    expect(doc.blocks.every((block) => block.type !== 'photo')).toBe(true);
    const sticker = doc.decorations[0];
    expect(sticker?.opacity).toBeLessThanOrEqual(1);
    expect(sticker?.widthMm).toBeGreaterThanOrEqual(4);
  });
});

describe('rendering and reading back', () => {
  it('renders text as text, never as markup', () => {
    const doc = normaliseDocument({
      blocks: [{ type: 'paragraph', inlines: [{ text: '<img src=x onerror=alert(1)>' }] }],
    });
    const host = document.createElement('div');
    host.append(renderFlow(doc, context()));

    expect(host.querySelector('img')).toBeNull();
    expect(host.textContent).toContain('<img src=x onerror=alert(1)>');
  });

  it('nests marks and keeps links safe', () => {
    const node = renderInline({
      text: 'hello',
      marks: ['bold', 'italic'],
      href: 'https://storitellah.com',
    });
    const host = document.createElement('div');
    host.append(node);
    const anchor = host.querySelector('a');
    expect(anchor?.rel).toBe('noopener noreferrer');
    expect(host.querySelector('strong')).not.toBeNull();
    expect(host.querySelector('em')).not.toBeNull();
  });

  it('survives a full round trip through the DOM', () => {
    const doc = normaliseDocument({
      blocks: [
        { id: 'blk_a', type: 'greeting', inlines: [{ text: 'Dear Nan,' }] },
        { id: 'blk_b', type: 'paragraph', inlines: [{ text: 'The garden is fine.', marks: ['bold'] }] },
      ],
    });

    const host = document.createElement('div');
    host.append(renderFlow(doc, context()));
    const back = parseDocument(host, doc);

    expect(back.blocks).toHaveLength(2);
    expect(back.blocks[0]?.type).toBe('greeting');
    const paragraph = back.blocks[1];
    expect(paragraph && 'inlines' in paragraph ? paragraph.inlines[0]?.marks : []).toContain('bold');
    expect(documentText(back)).toContain('The garden is fine.');
  });

  it('drops anything dangerous that reaches the editable surface', () => {
    const host = document.createElement('div');
    const paragraph = document.createElement('p');
    paragraph.dataset.block = 'blk_x';
    paragraph.dataset.blockType = 'paragraph';
    paragraph.append(document.createTextNode('safe words '));

    const script = document.createElement('script');
    script.textContent = 'window.stolen = true';
    paragraph.append(script);

    const iframe = document.createElement('iframe');
    paragraph.append(iframe);
    host.append(paragraph);

    const doc = parseDocument(host, emptyDocument());
    const text = documentText(doc);
    expect(text).toContain('safe words');
    expect(text).not.toContain('window.stolen');
    expect(JSON.stringify(doc)).not.toContain('iframe');
  });

  it('reads only hex colours back from a style attribute', () => {
    expect(rgbToHex('rgb(255, 0, 128)')).toBe('#ff0080');
    expect(rgbToHex('url(javascript:alert(1))')).toBe('');

    const span = document.createElement('span');
    span.style.color = 'rgb(16, 32, 48)';
    span.textContent = 'coloured';
    const inlines = parseInlines(span.parentElement ?? wrap(span));
    expect(inlines[0]?.colour).toBe('#102030');
  });
});

function wrap(node: Node): HTMLElement {
  const host = document.createElement('div');
  host.append(node);
  return host;
}

describe('pasting', () => {
  it('keeps paragraphs from plain text', () => {
    const result = pasteAsPlainText('One.\n\nTwo.\n\nThree.');
    expect(result.blocks).toHaveLength(3);
    expect(result.blocks.every((block) => block.type === 'paragraph')).toBe(true);
  });

  it('strips scripts, handlers and tracking from pasted HTML', () => {
    const result = pasteAsRichText(
      '<p onclick="steal()">Hello</p><script>window.x = 1</script><img src="https://tracker.example/p.gif"><p>World</p>',
    );
    const text = result.blocks.map((block) => ('inlines' in block ? block.inlines.map((i) => i.text).join('') : '')).join(' ');

    expect(text).toContain('Hello');
    expect(text).toContain('World');
    expect(text).not.toContain('steal');
    expect(JSON.stringify(result.blocks)).not.toContain('tracker.example');
    expect(result.cleaned).toBe(true);
  });

  it('keeps safe emphasis when pasting rich text', () => {
    const result = pasteAsRichText('<p>A <strong>bold</strong> idea</p>');
    const inlines = blocksToInlines(result.blocks);
    expect(inlines.some((inline) => inline.marks?.includes('bold'))).toBe(true);
  });

  it('bounds an enormous paste', () => {
    const huge = 'x'.repeat(500_000);
    const result = pasteAsPlainText(huge);
    expect(result.cleaned).toBe(true);
    expect(JSON.stringify(result.blocks).length).toBeLessThan(300_000);
  });
});

describe('undo and redo', () => {
  it('covers text and decorations in one history', () => {
    const history = new DocumentHistory(emptyDocument());
    const first = normaliseDocument({ blocks: [{ type: 'paragraph', inlines: [{ text: 'one' }] }] });
    history.commit(first, 'typing', 'typing-1');

    const second = normaliseDocument({
      blocks: [{ type: 'paragraph', inlines: [{ text: 'one' }] }],
      decorations: [{ kind: 'sticker', stickerId: 'love-red-heart' }],
    });
    history.commit(second, 'add sticker');

    expect(history.canUndo).toBe(true);
    expect(documentText(history.undo()!)).toBe('one');
    expect(history.canRedo).toBe(true);
    expect(history.redo()?.decorations).toHaveLength(1);
  });

  it('coalesces consecutive typing so undo removes a phrase', () => {
    const history = new DocumentHistory(emptyDocument());
    const before = history.size;
    for (const word of ['a', 'ab', 'abc']) {
      history.commit(normaliseDocument({ blocks: [{ type: 'paragraph', inlines: [{ text: word }] }] }), 'typing', 'typing');
    }
    expect(history.size).toBe(before + 1);
  });

  it('never grows without bound', () => {
    const history = new DocumentHistory(emptyDocument());
    for (let index = 0; index < 300; index += 1) {
      history.commit(normaliseDocument({ blocks: [{ type: 'paragraph', inlines: [{ text: `v${index}` }] }] }), `edit ${index}`);
    }
    expect(history.size).toBeLessThanOrEqual(120);
  });
});

describe('stickers', () => {
  it('covers every promised category with real artwork', () => {
    expect(STICKER_CATEGORIES.length).toBeGreaterThanOrEqual(30);
    expect(STICKERS.length).toBeGreaterThanOrEqual(100);
    expect(missingShapes()).toEqual([]);

    for (const category of STICKER_CATEGORIES) {
      const inCategory = STICKERS.filter((sticker) => sticker.category === category.id);
      expect(inCategory.length, `${category.name} has stickers`).toBeGreaterThan(0);
    }
  });

  it('includes the culturally specific packs that were asked for', () => {
    const ids = STICKER_CATEGORIES.map((category) => category.id);
    expect(ids).toContain('kenyan');
    expect(ids).toContain('african');
    expect(ids).toContain('nineties');
    expect(ids).toContain('retro-web');
  });

  it('searches by name and keyword', () => {
    expect(searchStickers('birthday').length).toBeGreaterThan(0);
    expect(searchStickers('rainbow').some((sticker) => sticker.name.toLowerCase().includes('rainbow'))).toBe(true);
    expect(searchStickers('zzzznothing')).toHaveLength(0);
  });

  it('builds SVG from validated shape data only', () => {
    const source = stickerToSvgSource('love-red-heart');
    expect(source).toContain('<svg');
    expect(source).toContain('<path');
    expect(source).not.toContain('<script');
    expect(source).not.toContain('onload');

    // A hostile colour override cannot escape into the markup.
    const injected = stickerToSvgSource('love-red-heart', ['" onload="alert(1)']);
    expect(injected).not.toContain('onload');
    expect(injected).toContain('#111827');
  });
});

describe('templates', () => {
  it('ships at least forty templates across every category', () => {
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(40);
    for (const category of TEMPLATE_CATEGORIES) {
      expect(
        TEMPLATES.filter((template) => template.category === category.id).length,
        `${category.name} has templates`,
      ).toBeGreaterThan(0);
    }
  });

  it('includes the named designs', () => {
    const names = TEMPLATES.map((template) => template.name);
    for (const expected of [
      'Confetti Party',
      'Love Notes',
      'Best Friend Forever',
      'Birthday Blast',
      '1990s School Notebook',
      'Scrapbook Page',
      'Future Self',
      'A Letter to Someone I Lost',
    ]) {
      expect(names).toContain(expected);
    }
  });

  it('gives every template a complete, usable definition', () => {
    for (const template of TEMPLATES) {
      expect(getPaper(template.paper).id, `${template.name} paper`).toBe(template.paper);
      expect(template.margins.top).toBeGreaterThan(0);
      expect(template.typography.sizePt).toBeGreaterThanOrEqual(9);
      expect(template.stickerPacks.length).toBeGreaterThan(0);
      // The palette must exist, or the preview would render as grey.
      expect(THEMES.some((theme) => theme.id === template.themeId), `${template.name} theme`).toBe(true);
    }
  });

  it('filters by category, colour, style and era', () => {
    expect(filterTemplates({ category: 'romantic' }).every((t) => t.category === 'romantic')).toBe(true);
    expect(filterTemplates({ era: 'retro' }).every((t) => t.retro)).toBe(true);
    expect(filterTemplates({ decorative: 'decorative' }).every((t) => t.decorative)).toBe(true);
    expect(filterTemplates({ search: 'confetti' }).length).toBeGreaterThan(0);
    expect(filterTemplates({ search: 'zzz' })).toHaveLength(0);
  });

  it('describes every paper design as generated CSS, not an image file', () => {
    for (const paper of PAPERS) {
      const background = paper.background('#123456', '#654321');
      expect(background).not.toContain('url(');
      expect(paper.size(6)).toBeTruthy();
    }
  });
});

describe('migrating older letters into the new editor', () => {
  it('turns a schema 2 letter into a document without losing a word', () => {
    const outcome = migrateLetter({
      id: 'ltr_1234abcd5678',
      schemaVersion: 2,
      recipient: 'Nan',
      senderLocation: 'Leeds',
      body: 'The greenhouse survived.\n\nThe tomatoes are ridiculous.',
      signature: { name: 'Bee', closing: 'With love,', style: 'typed', attachmentId: null },
    });

    expect(outcome.letter.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    const text = documentText(outcome.letter.doc);
    expect(text).toContain('Dear Nan,');
    expect(text).toContain('The greenhouse survived.');
    expect(text).toContain('The tomatoes are ridiculous.');
    expect(text).toContain('Bee');
    expect(getTemplate(outcome.letter.templateId)).toBeDefined();
  });

  it('still migrates a schema 1 letter all the way to a document', () => {
    const outcome = migrateLetter({
      id: 'ltr_aaaabbbbcccc',
      schemaVersion: 1,
      text: 'Words from the very first version.',
      paper: 'kraft',
    });
    expect(outcome.letter.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(documentText(outcome.letter.doc)).toContain('Words from the very first version.');
  });
});

describe('slash commands and snapping', () => {
  it('offers the promised insertions and filters them', () => {
    const ids = SLASH_COMMANDS.map((command) => command.id);
    for (const expected of ['heading', 'quote', 'photo', 'sticker', 'divider', 'postscript', 'signature', 'page-break']) {
      expect(ids).toContain(expected);
    }
    expect(filterCommands('photo').length).toBeGreaterThan(0);
    expect(filterCommands('zzzz')).toHaveLength(0);
  });

  it('snaps a decoration to a guide only when it is close', () => {
    expect(snap(104, [105, 20])).toBe(105);
    expect(snap(80, [105, 20])).toBe(80);
  });
});

describe('block helpers', () => {
  it('creates blocks with ids and optional alignment', () => {
    const block = textBlock('paragraph', 'hello', 'centre');
    expect(block.id).toMatch(/^blk_/);
    expect(block.align).toBe('centre');
    expect(block.inlines[0]?.text).toBe('hello');
  });
});

describe('placing decorations on the paper', () => {
  it('writes millimetre coordinates onto an element that already exists', () => {
    const node = document.createElement('div');
    node.className = 'deco-wrap deco-wrap--sticker';

    placeDecoration(node, {
      id: 'dec_1',
      kind: 'sticker',
      stickerId: 'heart',
      colours: [],
      page: 0,
      xMm: 61.5,
      yMm: 92.25,
      widthMm: 22,
      heightMm: 22,
      rotation: 5,
      opacity: 0.9,
      flipped: true,
      locked: false,
      layer: 5,
    });

    expect(Number.parseFloat(node.style.left)).toBeCloseTo(61.5, 2);
    expect(Number.parseFloat(node.style.top)).toBeCloseTo(92.25, 2);
    expect(node.style.transform).toContain('rotate(5deg)');
    expect(node.style.transform).toContain('scaleX(-1)');
    expect(node.style.opacity).toBe('0.9');
    expect(node.classList.contains('deco-wrap--behind')).toBe(false);
  });

  it('clears the locked and behind states when they no longer apply', () => {
    const node = document.createElement('div');
    const base = {
      id: 'dec_2',
      kind: 'sticker' as const,
      stickerId: 'star',
      colours: [],
      page: 0,
      xMm: 20,
      yMm: 20,
      widthMm: 20,
      heightMm: 20,
      rotation: 0,
      opacity: 1,
      flipped: false,
      locked: true,
      layer: -1,
    };

    placeDecoration(node, base);
    expect(node.dataset.locked).toBe('true');
    expect(node.classList.contains('deco-wrap--behind')).toBe(true);

    placeDecoration(node, { ...base, locked: false, layer: 3 });
    expect(node.dataset.locked).toBeUndefined();
    expect(node.classList.contains('deco-wrap--behind')).toBe(false);
  });
});
