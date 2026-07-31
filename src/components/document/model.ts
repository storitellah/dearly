/**
 * The letter document model.
 *
 * A letter is stored as validated, structured data — never as raw HTML. The
 * editor renders this model into the page, and reads the page back into it.
 * Nothing that arrives from a paste, an import or an older save is ever handed
 * to the DOM as markup, which removes the entire injection surface by
 * construction rather than by sanitising after the fact.
 *
 * Text carries marks (bold, italic, and so on) as data. Decorations — stickers,
 * photographs, movable notes — are positioned in millimetres on a numbered
 * page, so the editing surface, the print layout and the PDF all agree.
 */

import { createId } from '../utilities/id';

export const DOC_VERSION = 1;

export type Mark = 'bold' | 'italic' | 'underline' | 'highlight' | 'strike';

export interface Inline {
  text: string;
  marks?: Mark[];
  /** Hex colour, validated. */
  colour?: string;
  /** Absolute https/mailto link, validated. */
  href?: string;
}

export type BlockType =
  | 'meta'
  | 'greeting'
  | 'paragraph'
  | 'heading'
  | 'quote'
  | 'list'
  | 'divider'
  | 'page-break'
  | 'photo'
  | 'closing'
  | 'signature'
  | 'postscript'
  | 'secret';

export type Align = 'left' | 'centre' | 'right' | 'justify';

export interface BaseBlock {
  id: string;
  type: BlockType;
  align?: Align;
}

export interface TextBlock extends BaseBlock {
  type: 'meta' | 'greeting' | 'paragraph' | 'heading' | 'quote' | 'closing' | 'signature' | 'postscript' | 'secret';
  inlines: Inline[];
}

export interface ListBlock extends BaseBlock {
  type: 'list';
  ordered: boolean;
  items: Inline[][];
}

export interface RuleBlock extends BaseBlock {
  type: 'divider' | 'page-break';
}

export type PhotoFrame = 'plain' | 'polaroid' | 'scrapbook' | 'torn' | 'circle' | 'postcard';
export type PhotoFloat = 'full' | 'left' | 'right' | 'centre';

export interface PhotoBlock extends BaseBlock {
  type: 'photo';
  attachmentId: string;
  frame: PhotoFrame;
  float: PhotoFloat;
  /** Width as a fraction of the text column, 0.2–1. */
  width: number;
  caption: string;
  /** Optional date and place printed under the photograph. */
  note: string;
  monochrome: boolean;
  /** Extra brightness for printing, -0.3 to 0.3. */
  printBrightness: number;
  rotation: number;
  tape: boolean;
}

export type Block = TextBlock | ListBlock | RuleBlock | PhotoBlock;

/* -------------------------------------------------------------------------- */
/* Decorations — stickers and movable notes                                    */
/* -------------------------------------------------------------------------- */

export interface DecorationBase {
  id: string;
  /** Zero-based page this decoration belongs to. */
  page: number;
  /** Position of the centre, in millimetres from the top-left of the page. */
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  rotation: number;
  opacity: number;
  flipped: boolean;
  locked: boolean;
  /** Higher draws on top. Negative values sit behind the letter text. */
  layer: number;
}

export interface StickerDecoration extends DecorationBase {
  kind: 'sticker';
  /** Id from the built-in library, or `custom:<attachmentId>` for an upload. */
  stickerId: string;
  /** Overrides the sticker's own colours; index matches the sticker's slots. */
  colours: string[];
}

export interface NoteDecoration extends DecorationBase {
  kind: 'note';
  inlines: Inline[];
  style: 'margin-note' | 'speech-bubble' | 'label' | 'sticky' | 'pull-quote';
  background: string;
  colour: string;
  fontId: string;
  sizePt: number;
}

export type Decoration = StickerDecoration | NoteDecoration;

/* -------------------------------------------------------------------------- */
/* The document                                                                */
/* -------------------------------------------------------------------------- */

export interface LetterDocument {
  version: number;
  blocks: Block[];
  decorations: Decoration[];
}

export const PLACEHOLDERS: Partial<Record<BlockType, string>> = {
  meta: 'Where you are · today’s date',
  greeting: 'Dear …',
  paragraph: 'Write your letter here…',
  heading: 'A heading',
  quote: 'Something worth quoting',
  closing: 'With love,',
  signature: 'Your name',
  postscript: 'PS. one more thing…',
  secret: 'A note just for them',
};

export function emptyDocument(): LetterDocument {
  return {
    version: DOC_VERSION,
    blocks: [
      textBlock('meta', ''),
      textBlock('greeting', ''),
      textBlock('paragraph', ''),
      textBlock('closing', ''),
      textBlock('signature', ''),
    ],
    decorations: [],
  };
}

export function textBlock(type: TextBlock['type'], text: string, align?: Align): TextBlock {
  const block: TextBlock = {
    id: createId('blk'),
    type,
    inlines: text.length > 0 ? [{ text }] : [],
  };
  if (align) block.align = align;
  return block;
}

export function blockText(block: Block): string {
  if (block.type === 'list') return block.items.map((item) => inlineText(item)).join('\n');
  if (block.type === 'photo') return block.caption;
  if (!('inlines' in block)) return '';
  return inlineText(block.inlines);
}

export function inlineText(inlines: Inline[]): string {
  return inlines.map((inline) => inline.text).join('');
}

export function documentText(doc: LetterDocument): string {
  return doc.blocks
    .map((block) => blockText(block))
    .filter((text) => text.length > 0)
    .join('\n\n');
}

export function documentWordCount(doc: LetterDocument): number {
  const text = documentText(doc).trim();
  return text.length === 0 ? 0 : text.split(/\s+/).length;
}

export function isEmptyDocument(doc: LetterDocument): boolean {
  return documentText(doc).trim().length === 0 && doc.decorations.length === 0;
}

/* -------------------------------------------------------------------------- */
/* Validation                                                                  */
/* -------------------------------------------------------------------------- */

const MARKS = new Set<Mark>(['bold', 'italic', 'underline', 'highlight', 'strike']);
const BLOCK_TYPES = new Set<BlockType>([
  'meta',
  'greeting',
  'paragraph',
  'heading',
  'quote',
  'list',
  'divider',
  'page-break',
  'photo',
  'closing',
  'signature',
  'postscript',
  'secret',
]);
const ALIGNS = new Set<Align>(['left', 'centre', 'right', 'justify']);
const FRAMES = new Set<PhotoFrame>(['plain', 'polaroid', 'scrapbook', 'torn', 'circle', 'postcard']);
const FLOATS = new Set<PhotoFloat>(['full', 'left', 'right', 'centre']);
const NOTE_STYLES = new Set(['margin-note', 'speech-bubble', 'label', 'sticky', 'pull-quote']);

export const MAX_BLOCKS = 4000;
export const MAX_DECORATIONS = 500;
export const MAX_TEXT_LENGTH = 40_000;

/** Control characters that can hide or reorder text are never stored. */
export function cleanText(value: string): string {
  return value
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, '')
    .slice(0, MAX_TEXT_LENGTH);
}

export function safeColour(value: unknown, fallback = ''): string {
  return typeof value === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim())
    ? value.trim().toLowerCase()
    : fallback;
}

/** Only absolute http(s) and mailto links survive. */
export function safeHref(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!/^(https?:\/\/|mailto:)/i.test(trimmed)) return undefined;
  if (trimmed.length > 2000) return undefined;
  try {
    const url = new URL(trimmed);
    if (url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'mailto:') {
      return url.toString();
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const number = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, number));
}

export function normaliseInlines(value: unknown): Inline[] {
  if (!Array.isArray(value)) return [];
  const out: Inline[] = [];
  for (const item of value.slice(0, 500)) {
    if (item === null || typeof item !== 'object') continue;
    const raw = item as Record<string, unknown>;
    const text = cleanText(typeof raw.text === 'string' ? raw.text : '');
    if (text.length === 0) continue;

    const inline: Inline = { text };
    if (Array.isArray(raw.marks)) {
      const marks = raw.marks.filter((mark): mark is Mark => MARKS.has(mark as Mark));
      if (marks.length > 0) inline.marks = [...new Set(marks)];
    }
    const colour = safeColour(raw.colour);
    if (colour) inline.colour = colour;
    const href = safeHref(raw.href);
    if (href) inline.href = href;
    out.push(inline);
  }
  return out;
}

function normaliseBlock(value: unknown): Block | null {
  if (value === null || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const type = BLOCK_TYPES.has(raw.type as BlockType) ? (raw.type as BlockType) : 'paragraph';
  const id = typeof raw.id === 'string' && raw.id.length > 0 && raw.id.length < 64 ? raw.id : createId('blk');
  const align = ALIGNS.has(raw.align as Align) ? (raw.align as Align) : undefined;

  if (type === 'divider' || type === 'page-break') {
    return { id, type } as RuleBlock;
  }

  if (type === 'list') {
    const items = Array.isArray(raw.items)
      ? raw.items.map((item) => normaliseInlines(item)).filter((item) => item.length > 0).slice(0, 200)
      : [];
    const block: ListBlock = { id, type: 'list', ordered: raw.ordered === true, items };
    if (align) block.align = align;
    return block;
  }

  if (type === 'photo') {
    const attachmentId = typeof raw.attachmentId === 'string' ? raw.attachmentId.slice(0, 64) : '';
    if (attachmentId.length === 0) return null;
    const block: PhotoBlock = {
      id,
      type: 'photo',
      attachmentId,
      frame: FRAMES.has(raw.frame as PhotoFrame) ? (raw.frame as PhotoFrame) : 'plain',
      float: FLOATS.has(raw.float as PhotoFloat) ? (raw.float as PhotoFloat) : 'full',
      width: clamp(raw.width, 0.2, 1, 1),
      caption: cleanText(typeof raw.caption === 'string' ? raw.caption : '').slice(0, 400),
      note: cleanText(typeof raw.note === 'string' ? raw.note : '').slice(0, 200),
      monochrome: raw.monochrome === true,
      printBrightness: clamp(raw.printBrightness, -0.3, 0.3, 0),
      rotation: clamp(raw.rotation, -15, 15, 0),
      tape: raw.tape === true,
    };
    if (align) block.align = align;
    return block;
  }

  const block: TextBlock = {
    id,
    type: type as TextBlock['type'],
    inlines: normaliseInlines(raw.inlines),
  };
  if (align) block.align = align;
  return block;
}

function normaliseDecoration(value: unknown): Decoration | null {
  if (value === null || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const base: DecorationBase = {
    id: typeof raw.id === 'string' && raw.id.length < 64 ? raw.id : createId('dec'),
    page: Math.max(0, Math.trunc(clamp(raw.page, 0, 999, 0))),
    xMm: clamp(raw.xMm, -50, 500, 50),
    yMm: clamp(raw.yMm, -50, 500, 50),
    widthMm: clamp(raw.widthMm, 4, 300, 25),
    heightMm: clamp(raw.heightMm, 4, 300, 25),
    rotation: clamp(raw.rotation, -180, 180, 0),
    opacity: clamp(raw.opacity, 0.05, 1, 1),
    flipped: raw.flipped === true,
    locked: raw.locked === true,
    layer: Math.trunc(clamp(raw.layer, -50, 50, 1)),
  };

  if (raw.kind === 'note') {
    return {
      ...base,
      kind: 'note',
      inlines: normaliseInlines(raw.inlines),
      style: NOTE_STYLES.has(raw.style as string)
        ? (raw.style as NoteDecoration['style'])
        : 'margin-note',
      background: safeColour(raw.background, '#ffffff'),
      colour: safeColour(raw.colour, '#2b2118'),
      fontId: typeof raw.fontId === 'string' ? raw.fontId.slice(0, 32) : 'marker',
      sizePt: clamp(raw.sizePt, 6, 48, 11),
    };
  }

  const stickerId = typeof raw.stickerId === 'string' ? raw.stickerId.slice(0, 80) : '';
  if (stickerId.length === 0) return null;
  return {
    ...base,
    kind: 'sticker',
    stickerId,
    colours: Array.isArray(raw.colours)
      ? raw.colours.map((colour) => safeColour(colour, '')).filter((colour) => colour.length > 0).slice(0, 6)
      : [],
  };
}

/**
 * Coerces anything into a valid document. Used on load, on import, and after
 * reading the editor's DOM back — the model is never trusted from any source.
 */
export function normaliseDocument(value: unknown): LetterDocument {
  const raw = value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {};

  const blocks = Array.isArray(raw.blocks)
    ? raw.blocks
        .slice(0, MAX_BLOCKS)
        .map((block) => normaliseBlock(block))
        .filter((block): block is Block => block !== null)
    : [];

  const decorations = Array.isArray(raw.decorations)
    ? raw.decorations
        .slice(0, MAX_DECORATIONS)
        .map((decoration) => normaliseDecoration(decoration))
        .filter((decoration): decoration is Decoration => decoration !== null)
    : [];

  return {
    version: DOC_VERSION,
    blocks: blocks.length > 0 ? blocks : emptyDocument().blocks,
    decorations,
  };
}

/** Builds a document from a plain-text letter — used when migrating v2 letters. */
export function documentFromPlainText(body: string, options: {
  recipient?: string;
  closing?: string;
  signature?: string;
  meta?: string;
} = {}): LetterDocument {
  const blocks: Block[] = [];
  blocks.push(textBlock('meta', options.meta ?? ''));
  blocks.push(textBlock('greeting', options.recipient ? `Dear ${options.recipient},` : ''));

  const paragraphs = body
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);

  if (paragraphs.length === 0) blocks.push(textBlock('paragraph', ''));
  for (const paragraph of paragraphs) blocks.push(textBlock('paragraph', paragraph));

  blocks.push(textBlock('closing', options.closing ?? ''));
  blocks.push(textBlock('signature', options.signature ?? ''));

  return { version: DOC_VERSION, blocks, decorations: [] };
}

export function cloneDocument(doc: LetterDocument): LetterDocument {
  return {
    version: doc.version,
    blocks: doc.blocks.map((block) => ({ ...block })) as Block[],
    decorations: doc.decorations.map((decoration) => ({ ...decoration })) as Decoration[],
  };
}

export function findDecoration(doc: LetterDocument, id: string): Decoration | undefined {
  return doc.decorations.find((decoration) => decoration.id === id);
}
