/**
 * Model → DOM.
 *
 * Every node is created with `document.createElement` and every piece of text
 * is set with `textContent`. There is no string of markup anywhere in this
 * file, so a letter cannot carry anything executable into the page no matter
 * where it came from.
 *
 * The nodes produced here are the editable surface, the preview and the print
 * layout — one rendering, used for all three.
 */

import type {
  Block,
  Decoration,
  Inline,
  LetterDocument,
  ListBlock,
  NoteDecoration,
  PhotoBlock,
  StickerDecoration,
  TextBlock,
} from './model';
import { PLACEHOLDERS } from './model';
import { el } from '../utilities/dom';
import { renderSticker } from '../stickers/render';
import { getFont } from '../stationery/typography';

export interface RenderContext {
  /** Object URLs for photographs, by attachment id. */
  photoUrls: Map<string, string>;
  /** Object URLs for uploaded custom stickers, by attachment id. */
  stickerUrls: Map<string, string>;
  /** True while editing: adds contenteditable and placeholders. */
  editable: boolean;
  /** Hide decorations, for distraction-free writing. */
  hideDecorations?: boolean;
}

const MARK_TAGS: Record<string, keyof HTMLElementTagNameMap> = {
  bold: 'strong',
  italic: 'em',
  underline: 'u',
  strike: 's',
  highlight: 'mark',
};

/** Renders one run of text with its marks nested inside each other. */
export function renderInline(inline: Inline): Node {
  let node: Node = document.createTextNode(inline.text);

  for (const mark of inline.marks ?? []) {
    const tag = MARK_TAGS[mark];
    if (!tag) continue;
    const wrapper = document.createElement(tag);
    wrapper.append(node);
    node = wrapper;
  }

  if (inline.colour) {
    const span = el('span', { class: 'ink' });
    span.style.setProperty('color', inline.colour);
    span.append(node);
    node = span;
  }

  if (inline.href) {
    // Links are validated in the model; `rel` still closes the opener hole.
    const anchor = el('a', { href: inline.href, rel: 'noopener noreferrer', target: '_blank' });
    anchor.append(node);
    node = anchor;
  }

  return node;
}

export function renderInlines(inlines: Inline[]): DocumentFragment {
  const fragment = document.createDocumentFragment();
  for (const inline of inlines) fragment.append(renderInline(inline));
  return fragment;
}

const BLOCK_TAGS: Record<string, keyof HTMLElementTagNameMap> = {
  meta: 'p',
  greeting: 'p',
  paragraph: 'p',
  heading: 'h2',
  quote: 'blockquote',
  closing: 'p',
  signature: 'p',
  postscript: 'p',
  secret: 'p',
};

function renderTextBlock(block: TextBlock, context: RenderContext): HTMLElement {
  const node = el(BLOCK_TAGS[block.type] ?? 'p', {
    class: `lb lb--${block.type}`,
    'data-block': block.id,
    'data-block-type': block.type,
  });
  if (block.align) node.dataset.align = block.align;

  if (block.inlines.length === 0) {
    // An empty block still needs a line box, and a placeholder while editing.
    const placeholder = PLACEHOLDERS[block.type];
    if (context.editable && placeholder) node.dataset.placeholder = placeholder;
    node.append(document.createElement('br'));
  } else {
    node.append(renderInlines(block.inlines));
  }
  return node;
}

function renderListBlock(block: ListBlock): HTMLElement {
  const list = el(block.ordered ? 'ol' : 'ul', {
    class: 'lb lb--list',
    'data-block': block.id,
    'data-block-type': 'list',
  });
  for (const item of block.items) {
    const li = el('li');
    li.append(renderInlines(item));
    list.append(li);
  }
  if (block.items.length === 0) list.append(el('li', {}, [document.createElement('br')]));
  return list;
}

function renderPhotoBlock(block: PhotoBlock, context: RenderContext): HTMLElement {
  const figure = el('figure', {
    class: `lb lb--photo photo photo--${block.frame} photo--${block.float}`,
    'data-block': block.id,
    'data-block-type': 'photo',
    contenteditable: context.editable ? 'false' : undefined,
  });
  figure.style.setProperty('--photo-width', `${Math.round(block.width * 100)}%`);
  if (block.rotation !== 0) figure.style.setProperty('--photo-rotation', `${block.rotation}deg`);
  if (block.tape) figure.classList.add('photo--taped');

  const url = context.photoUrls.get(block.attachmentId);
  const frame = el('div', { class: 'photo__frame' });
  if (url) {
    const image = el('img', {
      class: 'photo__image',
      src: url,
      alt: block.caption.length > 0 ? block.caption : 'A photograph in this letter',
      loading: 'lazy',
      decoding: 'async',
    });
    if (block.monochrome) image.classList.add('photo__image--mono');
    if (block.printBrightness !== 0) {
      image.style.setProperty('--photo-brightness', String(1 + block.printBrightness));
    }
    frame.append(image);
  } else {
    frame.append(el('div', { class: 'photo__missing', text: 'Photograph not on this device' }));
  }
  figure.append(frame);

  if (block.caption.length > 0 || block.note.length > 0) {
    const caption = el('figcaption', { class: 'photo__caption' });
    if (block.caption.length > 0) caption.append(el('span', { class: 'photo__caption-text', text: block.caption }));
    if (block.note.length > 0) caption.append(el('span', { class: 'photo__note', text: block.note }));
    figure.append(caption);
  }
  return figure;
}

export function renderBlock(block: Block, context: RenderContext): HTMLElement {
  switch (block.type) {
    case 'list':
      return renderListBlock(block);
    case 'photo':
      return renderPhotoBlock(block, context);
    case 'divider': {
      const rule = el('div', {
        class: 'lb lb--divider',
        'data-block': block.id,
        'data-block-type': 'divider',
        contenteditable: context.editable ? 'false' : undefined,
      });
      rule.append(el('span', { class: 'divider__mark', 'aria-hidden': 'true', text: '✦ ✦ ✦' }));
      return rule;
    }
    case 'page-break': {
      const brk = el('div', {
        class: 'lb lb--page-break',
        'data-block': block.id,
        'data-block-type': 'page-break',
        contenteditable: context.editable ? 'false' : undefined,
        'aria-label': 'Page break',
      });
      brk.append(el('span', { class: 'page-break__label', text: 'New page' }));
      return brk;
    }
    default:
      return renderTextBlock(block, context);
  }
}

/** The flowing part of the letter: everything that reflows across pages. */
export function renderFlow(doc: LetterDocument, context: RenderContext): DocumentFragment {
  const fragment = document.createDocumentFragment();
  for (const block of doc.blocks) fragment.append(renderBlock(block, context));
  return fragment;
}

/* -------------------------------------------------------------------------- */
/* Decorations                                                                 */
/* -------------------------------------------------------------------------- */

function mm(value: number): string {
  return `${value.toFixed(2)}mm`;
}

function renderStickerDecoration(
  decoration: StickerDecoration,
  context: RenderContext,
): HTMLElement {
  const holder = el('div', { class: 'deco deco--sticker' });
  if (decoration.stickerId.startsWith('custom:')) {
    const url = context.stickerUrls.get(decoration.stickerId.slice('custom:'.length));
    if (url) {
      holder.append(el('img', { class: 'deco__image', src: url, alt: '', draggable: 'false' }));
    }
  } else {
    const svg = renderSticker(decoration.stickerId, decoration.colours);
    if (svg) holder.append(svg);
  }
  return holder;
}

function renderNoteDecoration(decoration: NoteDecoration): HTMLElement {
  const note = el('div', { class: `deco deco--note deco--${decoration.style}` });
  note.style.setProperty('--note-background', decoration.background);
  note.style.setProperty('color', decoration.colour);
  note.style.setProperty('font-family', getFont(decoration.fontId).stack);
  note.style.setProperty('font-size', `${decoration.sizePt}pt`);
  const text = el('div', { class: 'deco__text' });
  text.append(renderInlines(decoration.inlines));
  note.append(text);
  return note;
}

/**
 * Writes a decoration's place on the paper onto an existing element.
 *
 * Kept separate from building the element so a drag can move the node that is
 * already under the finger. Replacing it mid-drag would cancel the touch.
 */
export function placeDecoration(wrapper: HTMLElement, decoration: Decoration): void {
  wrapper.style.setProperty('left', mm(decoration.xMm));
  wrapper.style.setProperty('top', mm(decoration.yMm));
  wrapper.style.setProperty('width', mm(decoration.widthMm));
  wrapper.style.setProperty('height', mm(decoration.heightMm));
  wrapper.style.setProperty('opacity', String(decoration.opacity));
  wrapper.style.setProperty('z-index', String(decoration.layer));
  wrapper.style.setProperty(
    'transform',
    `translate(-50%, -50%) rotate(${decoration.rotation}deg)${decoration.flipped ? ' scaleX(-1)' : ''}`,
  );
  wrapper.dataset.layer = String(decoration.layer);
  if (decoration.locked) wrapper.dataset.locked = 'true';
  else delete wrapper.dataset.locked;
  wrapper.classList.toggle('deco-wrap--behind', decoration.layer < 0);
}

export function renderDecoration(decoration: Decoration, context: RenderContext): HTMLElement {
  const wrapper = el('div', {
    class: `deco-wrap deco-wrap--${decoration.kind}`,
    'data-decoration': decoration.id,
    contenteditable: context.editable ? 'false' : undefined,
    'aria-hidden': 'true',
  });

  placeDecoration(wrapper, decoration);

  wrapper.append(
    decoration.kind === 'sticker'
      ? renderStickerDecoration(decoration, context)
      : renderNoteDecoration(decoration),
  );
  return wrapper;
}
