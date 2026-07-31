/**
 * Paste handling.
 *
 * Pasted HTML is parsed in an inert document, walked through the same
 * allow-list as the editor's own content, and inserted as model blocks. The
 * clipboard's markup never touches the live page, so a paste from a webmail
 * client, a document editor or a hostile page cannot bring anything with it.
 */

import { cleanText, textBlock, type Block, type Inline, type TextBlock } from './model';
import { parseInlines } from './parse';
import { createId } from '../utilities/id';

/** Generous, but bounded: a paste cannot exhaust memory or the storage quota. */
export const MAX_PASTE_LENGTH = 200_000;
export const MAX_PASTE_BLOCKS = 1000;

const BLOCK_TAGS = new Set([
  'P',
  'DIV',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'BLOCKQUOTE',
  'LI',
  'PRE',
  'SECTION',
  'ARTICLE',
  'TR',
]);

const DROP = new Set([
  'SCRIPT',
  'STYLE',
  'IFRAME',
  'OBJECT',
  'EMBED',
  'NOSCRIPT',
  'TEMPLATE',
  'FORM',
  'INPUT',
  'BUTTON',
  'SELECT',
  'TEXTAREA',
  'SVG',
  'MATH',
  'LINK',
  'META',
  'BASE',
  'AUDIO',
  'VIDEO',
  'CANVAS',
  'IMG',
  'PICTURE',
  'SOURCE',
]);

export interface PasteResult {
  blocks: Block[];
  /** True when something had to be removed, so the user can be told. */
  cleaned: boolean;
}

/** Splits plain text into paragraph blocks. */
export function pasteAsPlainText(text: string): PasteResult {
  const trimmed = cleanText(text.slice(0, MAX_PASTE_LENGTH));
  const paragraphs = trimmed
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\n/g, ' ').trim())
    .filter((paragraph) => paragraph.length > 0)
    .slice(0, MAX_PASTE_BLOCKS);

  return {
    blocks: paragraphs.map((paragraph) => textBlock('paragraph', paragraph)),
    cleaned: trimmed.length !== text.length,
  };
}

/**
 * Converts pasted HTML into blocks. Parsing happens through `DOMParser`, which
 * produces an inert document: no script runs, no image loads, no request is
 * made. Only the resulting structure and text are kept.
 */
export function pasteAsRichText(html: string, fallbackText = ''): PasteResult {
  if (typeof DOMParser === 'undefined') return pasteAsPlainText(fallbackText || html);

  const source = html.slice(0, MAX_PASTE_LENGTH);
  let cleaned = source.length !== html.length;

  const doc = new DOMParser().parseFromString(source, 'text/html');

  for (const node of Array.from(doc.querySelectorAll('*'))) {
    const tag = node.tagName.toUpperCase();
    if (DROP.has(tag)) {
      node.remove();
      cleaned = true;
      continue;
    }
    for (const attribute of Array.from(node.attributes)) {
      const name = attribute.name.toLowerCase();
      // Keep only what the model can use; drop event handlers, data attributes,
      // tracking parameters and anything else that came along.
      const keep = name === 'href' || (name === 'style' && node instanceof HTMLElement);
      if (!keep) {
        node.removeAttribute(attribute.name);
        if (name.startsWith('on') || name === 'srcdoc' || name.startsWith('data-')) cleaned = true;
      }
    }
  }

  const blocks: Block[] = [];

  const emit = (element: Element, type: TextBlock['type']): void => {
    if (blocks.length >= MAX_PASTE_BLOCKS) return;
    const inlines = parseInlines(element);
    if (inlines.length === 0) return;
    blocks.push({ id: createId('blk'), type, inlines } as TextBlock);
  };

  const walk = (node: Node): void => {
    if (blocks.length >= MAX_PASTE_BLOCKS) return;
    if (node.nodeType === Node.TEXT_NODE) {
      const text = cleanText(node.nodeValue ?? '').trim();
      if (text.length > 0) blocks.push(textBlock('paragraph', text));
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const element = node as Element;
    const tag = element.tagName.toUpperCase();
    if (DROP.has(tag)) return;

    const hasBlockChildren = Array.from(element.children).some((child) =>
      BLOCK_TAGS.has(child.tagName.toUpperCase()),
    );

    if (BLOCK_TAGS.has(tag) && !hasBlockChildren) {
      const type: TextBlock['type'] =
        tag.startsWith('H') && tag.length === 2 ? 'heading' : tag === 'BLOCKQUOTE' ? 'quote' : 'paragraph';
      emit(element, type);
      return;
    }

    for (const child of Array.from(element.childNodes)) walk(child);
  };

  for (const child of Array.from(doc.body.childNodes)) walk(child);

  if (blocks.length === 0) return pasteAsPlainText(fallbackText || doc.body.textContent || '');

  return { blocks, cleaned };
}

/** Chooses the right path for a clipboard event. */
export function blocksFromClipboard(
  data: DataTransfer | null,
  options: { plainOnly?: boolean } = {},
): PasteResult {
  if (!data) return { blocks: [], cleaned: false };

  const text = data.getData('text/plain') ?? '';
  if (options.plainOnly) return pasteAsPlainText(text);

  const html = data.getData('text/html') ?? '';
  if (html.trim().length > 0) return pasteAsRichText(html, text);
  return pasteAsPlainText(text);
}

/** Flattens blocks to inline runs, for pasting inside an existing paragraph. */
export function blocksToInlines(blocks: Block[]): Inline[] {
  const out: Inline[] = [];
  blocks.forEach((block, index) => {
    if (block.type === 'list') {
      if (index > 0 && out.length > 0) out.push({ text: ' ' });
      out.push(...block.items.flat());
      return;
    }
    if (!('inlines' in block)) return;
    const inlines = block.inlines;
    if (index > 0 && out.length > 0) out.push({ text: ' ' });
    out.push(...inlines);
  });
  return out;
}
