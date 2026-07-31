/**
 * The formatting toolbar.
 *
 * It appears next to the selection on a pointer device and as a bottom sheet on
 * a phone, so it never covers the words being formatted. There is no permanent
 * ribbon across the top: the tools arrive when they are wanted and leave when
 * they are not.
 *
 * Formatting is applied to the model, not by asking the browser to mangle the
 * DOM — so bold means `{ marks: ['bold'] }` in stored data, and the same result
 * appears on screen, in print and in the PDF.
 */

import { el } from '../../utilities/dom';
import { FONTS } from '../../stationery/typography';
import type { Align, Block, LetterDocument, Mark, TextBlock } from '../../document/model';
import { cloneDocument, safeColour } from '../../document/model';

export interface ToolbarContext {
  getDocument: () => LetterDocument;
  apply: (doc: LetterDocument, label: string) => void;
  /** The block the caret is in, if any. */
  activeBlockId: () => string | null;
  /** Ids of every block touched by the selection. */
  selectedBlockIds: () => string[];
  isMobile: () => boolean;
}

const MARK_BUTTONS: Array<{ mark: Mark; label: string; symbol: string }> = [
  { mark: 'bold', label: 'Bold', symbol: 'B' },
  { mark: 'italic', label: 'Italic', symbol: 'I' },
  { mark: 'underline', label: 'Underline', symbol: 'U' },
  { mark: 'highlight', label: 'Highlight', symbol: '▨' },
  { mark: 'strike', label: 'Strikethrough', symbol: 'S' },
];

const BLOCK_STYLES: Array<{ type: TextBlock['type']; label: string }> = [
  { type: 'paragraph', label: 'Paragraph' },
  { type: 'heading', label: 'Heading' },
  { type: 'quote', label: 'Quote' },
  { type: 'closing', label: 'Closing' },
  { type: 'signature', label: 'Signature' },
  { type: 'postscript', label: 'Postscript' },
  { type: 'secret', label: 'Secret note' },
];

const ALIGNS: Array<{ align: Align; label: string; symbol: string }> = [
  { align: 'left', label: 'Align left', symbol: '⇤' },
  { align: 'centre', label: 'Centre', symbol: '↔' },
  { align: 'right', label: 'Align right', symbol: '⇥' },
  { align: 'justify', label: 'Justify', symbol: '≡' },
];

export class FormattingToolbar {
  readonly element: HTMLElement;
  private visible = false;

  constructor(private readonly context: ToolbarContext) {
    this.element = el('div', {
      class: 'format-bar',
      role: 'toolbar',
      'aria-label': 'Text formatting',
      hidden: true,
    });
    this.build();
  }

  private build(): void {
    const marks = el('div', { class: 'format-bar__group' });
    for (const button of MARK_BUTTONS) {
      const node = el('button', {
        type: 'button',
        class: `format-bar__button format-bar__button--${button.mark}`,
        'aria-label': button.label,
        title: button.label,
        text: button.symbol,
      });
      node.addEventListener('mousedown', (event) => event.preventDefault());
      node.addEventListener('click', () => this.toggleMark(button.mark));
      marks.append(node);
    }

    const styleSelect = el('select', {
      class: 'format-bar__select',
      'aria-label': 'Paragraph style',
    }) as HTMLSelectElement;
    for (const style of BLOCK_STYLES) {
      styleSelect.append(el('option', { value: style.type, text: style.label }));
    }
    styleSelect.addEventListener('change', () => this.setBlockType(styleSelect.value as TextBlock['type']));

    const fontSelect = el('select', { class: 'format-bar__select', 'aria-label': 'Typeface' }) as HTMLSelectElement;
    fontSelect.append(el('option', { value: '', text: 'Letter typeface' }));
    for (const font of FONTS) fontSelect.append(el('option', { value: font.id, text: font.name }));
    fontSelect.addEventListener('change', () => {
      this.element.dispatchEvent(
        new CustomEvent('dearly:font', { detail: fontSelect.value, bubbles: true }),
      );
    });

    const colour = el('input', {
      type: 'color',
      class: 'format-bar__colour',
      'aria-label': 'Text colour',
      value: '#2b2118',
    }) as HTMLInputElement;
    colour.addEventListener('input', () => this.setColour(colour.value));

    const alignGroup = el('div', { class: 'format-bar__group' });
    for (const item of ALIGNS) {
      const node = el('button', {
        type: 'button',
        class: 'format-bar__button',
        'aria-label': item.label,
        title: item.label,
        text: item.symbol,
      });
      node.addEventListener('mousedown', (event) => event.preventDefault());
      node.addEventListener('click', () => this.setAlign(item.align));
      alignGroup.append(node);
    }

    const clearButton = el('button', {
      type: 'button',
      class: 'format-bar__button format-bar__button--wide',
      text: 'Clear',
      'aria-label': 'Clear formatting',
      title: 'Clear formatting',
    });
    clearButton.addEventListener('mousedown', (event) => event.preventDefault());
    clearButton.addEventListener('click', () => this.clearFormatting());

    const close = el('button', {
      type: 'button',
      class: 'format-bar__button format-bar__close',
      text: '×',
      'aria-label': 'Close formatting tools',
    });
    close.addEventListener('click', () => this.hide());

    this.element.append(marks, styleSelect, fontSelect, colour, alignGroup, clearButton, close);
  }

  /* --------------------------------------------------------------- */
  /* Applying formatting to the model                                  */
  /* --------------------------------------------------------------- */

  private selectionRange(): { blockIds: string[]; start: number; end: number } | null {
    const blockIds = this.context.selectedBlockIds();
    if (blockIds.length === 0) return null;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;
    const range = selection.getRangeAt(0);
    return { blockIds, start: range.startOffset, end: range.endOffset };
  }

  /**
   * Toggling a mark rewrites the affected blocks' inline runs. When the caret
   * has no selection, the whole block is marked — which is what people expect
   * from a letter, rather than a hidden "pending format" state.
   */
  private toggleMark(mark: Mark): void {
    const selection = this.selectionRange();
    if (!selection) return;
    const doc = cloneDocument(this.context.getDocument());
    let changed = false;

    for (const block of doc.blocks) {
      if (!selection.blockIds.includes(block.id)) continue;
      if (!('inlines' in block)) continue;
      const active = block.inlines.every((inline) => (inline.marks ?? []).includes(mark));
      block.inlines = block.inlines.map((inline) => {
        const marks = new Set(inline.marks ?? []);
        if (active) marks.delete(mark);
        else marks.add(mark);
        const next = { ...inline };
        if (marks.size > 0) next.marks = [...marks];
        else delete next.marks;
        return next;
      });
      changed = true;
    }

    if (changed) this.context.apply(doc, `${mark}`);
  }

  private setColour(value: string): void {
    const colour = safeColour(value, '');
    if (!colour) return;
    const selection = this.selectionRange();
    if (!selection) return;

    const doc = cloneDocument(this.context.getDocument());
    for (const block of doc.blocks) {
      if (!selection.blockIds.includes(block.id)) continue;
      if (!('inlines' in block)) continue;
      block.inlines = block.inlines.map((inline) => ({ ...inline, colour }));
    }
    this.context.apply(doc, 'text colour');
  }

  private setAlign(align: Align): void {
    const ids = this.context.selectedBlockIds();
    const activeId = this.context.activeBlockId();
    const targets = ids.length > 0 ? ids : activeId ? [activeId] : [];
    if (targets.length === 0) return;

    const doc = cloneDocument(this.context.getDocument());
    for (const block of doc.blocks) {
      if (targets.includes(block.id)) block.align = align;
    }
    this.context.apply(doc, 'alignment');
  }

  private setBlockType(type: TextBlock['type']): void {
    const activeId = this.context.activeBlockId();
    const ids = this.context.selectedBlockIds();
    const targets = ids.length > 0 ? ids : activeId ? [activeId] : [];
    if (targets.length === 0) return;

    const doc = cloneDocument(this.context.getDocument());
    doc.blocks = doc.blocks.map((block): Block => {
      if (!targets.includes(block.id)) return block;
      if (!('inlines' in block)) return block;
      return { ...block, type } as TextBlock;
    });
    this.context.apply(doc, 'paragraph style');
  }

  private clearFormatting(): void {
    const ids = this.context.selectedBlockIds();
    if (ids.length === 0) return;
    const doc = cloneDocument(this.context.getDocument());
    for (const block of doc.blocks) {
      if (!ids.includes(block.id)) continue;
      if (!('inlines' in block)) continue;
      block.inlines = block.inlines.map((inline) => ({ text: inline.text }));
      delete block.align;
    }
    this.context.apply(doc, 'clear formatting');
  }

  /* --------------------------------------------------------------- */
  /* Placement                                                        */
  /* --------------------------------------------------------------- */

  showFor(rect: DOMRect | null): void {
    if (!rect) {
      this.hide();
      return;
    }
    this.visible = true;
    this.element.hidden = false;

    if (this.context.isMobile()) {
      // A bottom sheet, so the selection stays visible above it.
      this.element.dataset.placement = 'sheet';
      this.element.style.removeProperty('left');
      this.element.style.removeProperty('top');
      return;
    }

    this.element.dataset.placement = 'floating';
    const width = this.element.offsetWidth || 320;
    const left = Math.min(
      Math.max(12, rect.left + rect.width / 2 - width / 2),
      window.innerWidth - width - 12,
    );
    const top = rect.top - this.element.offsetHeight - 10;
    this.element.style.setProperty('left', `${Math.round(left)}px`);
    this.element.style.setProperty(
      'top',
      `${Math.round(top > 8 ? top : rect.bottom + 10)}px`,
    );
  }

  hide(): void {
    this.visible = false;
    this.element.hidden = true;
  }

  get isVisible(): boolean {
    return this.visible;
  }
}
