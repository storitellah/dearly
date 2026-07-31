/**
 * DOM → model.
 *
 * The editable page is read back into structured data through a strict
 * allow-list: only the elements and marks Dearly itself renders are recognised,
 * and everything else is reduced to its text. A `<script>`, an `onclick`, an
 * `<iframe>` or a tracking pixel that reaches the editable surface — from a
 * paste, a browser extension, or a bug — cannot survive this walk into storage.
 *
 * This is also what makes the editor's undo/redo, autosave and export operate on
 * data rather than on markup.
 */

import {
  cleanText,
  normaliseDocument,
  safeColour,
  safeHref,
  type Align,
  type Block,
  type BlockType,
  type Inline,
  type LetterDocument,
  type Mark,
  type TextBlock,
} from './model';
import { createId } from '../utilities/id';

const MARK_BY_TAG: Record<string, Mark> = {
  STRONG: 'bold',
  B: 'bold',
  EM: 'italic',
  I: 'italic',
  U: 'underline',
  INS: 'underline',
  S: 'strike',
  STRIKE: 'strike',
  DEL: 'strike',
  MARK: 'highlight',
};

/** Elements whose contents are dropped entirely, not merely unwrapped. */
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
]);

const BLOCK_TYPE_BY_ATTRIBUTE = new Set<BlockType>([
  'meta',
  'greeting',
  'paragraph',
  'heading',
  'quote',
  'closing',
  'signature',
  'postscript',
  'secret',
]);

interface InlineState {
  marks: Mark[];
  colour?: string;
  href?: string;
}

function pushInline(out: Inline[], text: string, state: InlineState): void {
  const clean = cleanText(text);
  if (clean.length === 0) return;

  const previous = out[out.length - 1];
  const sameMarks =
    previous &&
    (previous.marks ?? []).join(',') === state.marks.join(',') &&
    previous.colour === state.colour &&
    previous.href === state.href;

  if (sameMarks && previous) {
    previous.text += clean;
    return;
  }

  const inline: Inline = { text: clean };
  if (state.marks.length > 0) inline.marks = [...state.marks];
  if (state.colour) inline.colour = state.colour;
  if (state.href) inline.href = state.href;
  out.push(inline);
}

/** Reads the inline content of one block element. */
export function parseInlines(root: Node): Inline[] {
  const out: Inline[] = [];

  const walk = (node: Node, state: InlineState): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      pushInline(out, node.nodeValue ?? '', state);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const element = node as HTMLElement;
    const tag = element.tagName.toUpperCase();
    if (DROP.has(tag)) return;

    if (tag === 'BR') {
      // A line break inside a paragraph becomes a space; real paragraph breaks
      // are separate blocks.
      pushInline(out, ' ', state);
      return;
    }

    const next: InlineState = { marks: [...state.marks] };
    if (state.colour) next.colour = state.colour;
    if (state.href) next.href = state.href;

    const mark = MARK_BY_TAG[tag];
    if (mark && !next.marks.includes(mark)) next.marks.push(mark);

    if (tag === 'A') {
      const href = safeHref(element.getAttribute('href'));
      if (href) next.href = href;
    }

    // Only a colour is read back from the style attribute, and only as a hex
    // value. No other inline style is ever carried into the model.
    const colour = safeColour(rgbToHex(element.style.color), '');
    if (colour) next.colour = colour;

    for (const child of Array.from(element.childNodes)) walk(child, next);
  };

  for (const child of Array.from(root.childNodes)) walk(child, { marks: [] });
  return out;
}

/** `rgb(1, 2, 3)` → `#010203`. Anything else is refused by `safeColour`. */
export function rgbToHex(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('#')) return trimmed;
  const match = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(trimmed);
  if (!match) return '';
  const hex = match
    .slice(1, 4)
    .map((part) => Math.min(255, Number(part)).toString(16).padStart(2, '0'))
    .join('');
  return `#${hex}`;
}

function blockTypeOf(element: HTMLElement): BlockType {
  const declared = element.dataset.blockType as BlockType | undefined;
  if (declared && BLOCK_TYPE_BY_ATTRIBUTE.has(declared)) return declared;
  if (declared === 'list' || declared === 'photo' || declared === 'divider' || declared === 'page-break') {
    return declared;
  }
  switch (element.tagName.toUpperCase()) {
    case 'H1':
    case 'H2':
    case 'H3':
      return 'heading';
    case 'BLOCKQUOTE':
      return 'quote';
    case 'UL':
    case 'OL':
      return 'list';
    default:
      return 'paragraph';
  }
}

function alignOf(element: HTMLElement): Align | undefined {
  const value = element.dataset.align;
  return value === 'left' || value === 'centre' || value === 'right' || value === 'justify'
    ? value
    : undefined;
}

/**
 * Reads the editable surface back into a document. `previous` supplies the
 * details the DOM does not carry — photograph settings and decorations — so
 * typing never discards them.
 */
export function parseDocument(root: HTMLElement, previous: LetterDocument): LetterDocument {
  const blocks: Block[] = [];
  const previousById = new Map(previous.blocks.map((block) => [block.id, block]));

  for (const child of Array.from(root.children)) {
    if (!(child instanceof HTMLElement)) continue;
    if (DROP.has(child.tagName.toUpperCase())) continue;

    const id = child.dataset.block ?? createId('blk');
    const type = blockTypeOf(child);
    const align = alignOf(child);

    if (type === 'photo') {
      const existing = previousById.get(id);
      if (existing && existing.type === 'photo') blocks.push(existing);
      continue;
    }

    if (type === 'divider' || type === 'page-break') {
      blocks.push({ id, type });
      continue;
    }

    if (type === 'list') {
      const items = Array.from(child.querySelectorAll(':scope > li')).map((item) => parseInlines(item));
      blocks.push({
        id,
        type: 'list',
        ordered: child.tagName.toUpperCase() === 'OL',
        items: items.filter((item) => item.length > 0),
        ...(align ? { align } : {}),
      });
      continue;
    }

    const block: TextBlock = {
      id,
      type: type as TextBlock['type'],
      inlines: parseInlines(child),
      ...(align ? { align } : {}),
    };
    blocks.push(block);
  }

  // Decorations are managed separately from the text flow, so they come through
  // unchanged rather than being re-read from the DOM.
  return normaliseDocument({
    version: previous.version,
    blocks: blocks.length > 0 ? blocks : previous.blocks,
    decorations: previous.decorations,
  });
}
