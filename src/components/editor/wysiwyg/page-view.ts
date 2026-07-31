/**
 * The letter page: one surface that is the writing area, the design, the
 * preview and the print layout at the same time.
 *
 * There is no textarea behind this and no separate preview beside it. The paper
 * is drawn at its true millimetre size with the real typography and margins, and
 * the writer types straight onto it. What is on screen is what comes out of the
 * printer.
 *
 * Pagination is measured, not guessed: after each change the flow is measured
 * and spacers are inserted so a block never straddles a page boundary. The same
 * measurements drive PDF export, so the page breaks agree everywhere.
 */

import { el, clear } from '../../utilities/dom';
import { renderDecoration, renderFlow, type RenderContext } from '../../document/render';
import { parseDocument } from '../../document/parse';
import { blocksFromClipboard, blocksToInlines } from '../../document/paste';
import {
  cloneDocument,
  textBlock,
  type Block,
  type LetterDocument,
} from '../../document/model';
import { getPaper as getPaperDesign } from '../../templates/papers';
import { getTemplate } from '../../templates/templates';
import { getFont } from '../../stationery/typography';
import { getTheme } from '../../theme/themes';
import { paginateFlow } from './pagination';
import { debounce } from '../../utilities/debounce';
import { Disposables } from '../../utilities/events';

export interface PageGeometry {
  widthMm: number;
  heightMm: number;
  margins: { top: number; right: number; bottom: number; left: number };
}

export const PAGE_SIZES: Record<string, { widthMm: number; heightMm: number; name: string }> = {
  a4: { widthMm: 210, heightMm: 297, name: 'A4' },
  letter: { widthMm: 215.9, heightMm: 279.4, name: 'US Letter' },
  a5: { widthMm: 148, heightMm: 210, name: 'A5' },
  a6: { widthMm: 105, heightMm: 148, name: 'A6' },
  square: { widthMm: 210, heightMm: 210, name: 'Square' },
  postcard: { widthMm: 148, heightMm: 105, name: 'Postcard' },
};

export interface PageViewOptions {
  getDocument: () => LetterDocument;
  /** Called whenever the writer changes the text. */
  onChange: (doc: LetterDocument, tag: string) => void;
  /** Called when the page count changes. */
  onPages?: (count: number) => void;
  /** Called when the selection moves, with the caret rectangle if there is one. */
  onSelection?: (rect: DOMRect | null) => void;
  photoUrls: Map<string, string>;
  stickerUrls: Map<string, string>;
  readOnly?: boolean;
}

export class PageView {
  readonly element: HTMLElement;
  private readonly sheet: HTMLElement;
  private readonly flow: HTMLElement;
  private readonly decorationLayer: HTMLElement;
  private readonly boundaryLayer: HTMLElement;
  private readonly disposables = new Disposables();
  private geometry: PageGeometry = { widthMm: 210, heightMm: 297, margins: { top: 24, right: 22, bottom: 24, left: 22 } };
  private pageCount = 1;
  private zoom = 1;
  private hideDecorations = false;
  private readOnly = false;
  private readonly repaginate = debounce(() => this.measurePages(), 120);
  private readonly readBack = debounce(() => this.commit('typing'), 250);
  private plainPasteWanted = false;

  constructor(private readonly options: PageViewOptions) {
    this.element = el('div', { class: 'desk__paper-holder' });
    this.sheet = el('div', { class: 'sheet', 'data-sheet': 'true' });
    this.boundaryLayer = el('div', { class: 'sheet__boundaries', 'aria-hidden': 'true' });
    this.decorationLayer = el('div', { class: 'sheet__decorations' });

    this.flow = el('article', {
      class: 'sheet__flow',
      role: 'textbox',
      'aria-multiline': 'true',
      'aria-label': 'Your letter. Type directly on the page.',
      spellcheck: 'true',
    });
    this.readOnly = options.readOnly === true;
    if (!this.readOnly) {
      this.flow.contentEditable = 'true';
      this.flow.tabIndex = 0;
    }

    this.sheet.append(this.boundaryLayer, this.decorationLayer, this.flow);
    this.element.append(this.sheet);

    this.wire();
  }

  private wire(): void {
    const d = this.disposables;

    d.listen(this.flow, 'input', () => {
      this.readBack();
      this.repaginate();
    });

    d.listen(this.flow, 'keydown', (event) => {
      const keyboard = event as KeyboardEvent;
      this.plainPasteWanted = keyboard.shiftKey;
      // Enter creates a real new block rather than a <div> soup.
      if (keyboard.key === 'Enter' && !keyboard.shiftKey) {
        const handled = this.insertParagraphAtCaret();
        if (handled) keyboard.preventDefault();
      }
    });

    d.listen(this.flow, 'paste', (event) => {
      const clipboard = event as ClipboardEvent;
      clipboard.preventDefault();
      // Shift+paste means "plain text", tracked from the keyboard because a
      // ClipboardEvent does not carry modifier state.
      const plainOnly = this.plainPasteWanted;
      const result = blocksFromClipboard(clipboard.clipboardData, { plainOnly });
      if (result.blocks.length === 0) return;
      this.insertBlocksAtCaret(result.blocks);
    });

    d.listen(document, 'selectionchange', () => {
      if (!this.options.onSelection) return;
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0 || !this.containsSelection()) {
        this.options.onSelection(null);
        return;
      }
      const range = selection.getRangeAt(0);
      this.options.onSelection(range.collapsed ? null : range.getBoundingClientRect());
    });

    const onResize = (): void => this.repaginate();
    window.addEventListener('resize', onResize);
    d.add(() => window.removeEventListener('resize', onResize));
  }

  private containsSelection(): boolean {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return false;
    return this.flow.contains(selection.getRangeAt(0).commonAncestorContainer);
  }

  /** Applies the paper, palette, typography and margins of a letter. */
  setDesign(letter: {
    templateId: string;
    themeId: string;
    paperSize: string;
    typography: { family: string; sizePt: number; lineHeight: number; align: string; colour: string };
  }): void {
    const template = getTemplate(letter.templateId);
    const theme = getTheme(letter.themeId);
    const size = PAGE_SIZES[letter.paperSize] ?? PAGE_SIZES.a4!;
    const margins = template?.margins ?? this.geometry.margins;
    this.geometry = { widthMm: size.widthMm, heightMm: size.heightMm, margins };

    const style = this.sheet.style;
    style.setProperty('--page-width', `${size.widthMm}mm`);
    style.setProperty('--page-height', `${size.heightMm}mm`);
    style.setProperty('--margin-top', `${margins.top}mm`);
    style.setProperty('--margin-right', `${margins.right}mm`);
    style.setProperty('--margin-bottom', `${margins.bottom}mm`);
    style.setProperty('--margin-left', `${margins.left}mm`);
    style.setProperty('--paper-colour', theme.palette.paper);
    style.setProperty('--paper-ink', letter.typography.colour || theme.palette.paperInk);
    style.setProperty('--body-font', getFont(letter.typography.family).stack);
    style.setProperty(
      '--heading-font',
      getFont(template?.typography.headingFont ?? letter.typography.family).stack,
    );
    style.setProperty('--body-size', `${letter.typography.sizePt}pt`);
    style.setProperty('--body-leading', String(letter.typography.lineHeight));
    style.setProperty('--body-align', letter.typography.align === 'justify' ? 'justify' : 'left');

    const paper = getPaperDesign(template?.paper ?? 'plain');
    const step = template?.patternStepMm ?? 6;
    style.setProperty(
      '--paper-pattern',
      paper.background(theme.palette.stickers[3] ?? theme.palette.line, theme.palette.accent),
    );
    style.setProperty('--paper-pattern-size', paper.size(step));
    style.setProperty('--paper-pattern-opacity', String(template?.patternOpacity ?? paper.defaultOpacity));
    style.setProperty('--border-colour', theme.palette.primary);

    this.sheet.dataset.border = template?.border ?? 'none';
    this.sheet.dataset.paper = template?.paper ?? 'plain';
    this.repaginate();
  }

  /** Draws the document. Only called when the model changes from outside. */
  render(doc: LetterDocument): void {
    const context: RenderContext = {
      photoUrls: this.options.photoUrls,
      stickerUrls: this.options.stickerUrls,
      editable: !this.readOnly,
      hideDecorations: this.hideDecorations,
    };

    clear(this.flow);
    this.flow.append(renderFlow(doc, context));

    clear(this.decorationLayer);
    if (!this.hideDecorations) {
      for (const decoration of doc.decorations) {
        this.decorationLayer.append(renderDecoration(decoration, context));
      }
    }
    this.measurePages();
  }

  /** Reads the page back into the model and reports the change. */
  commit(tag: string): void {
    if (this.readOnly) return;
    const doc = parseDocument(this.flow, this.options.getDocument());
    this.options.onChange(doc, tag);
  }

  /* ------------------------------------------------------------------ */
  /* Pagination                                                          */
  /* ------------------------------------------------------------------ */

  /**
   * Measures the flow and pushes any block that would straddle a page boundary
   * onto the next page. The result is what the writer sees *and* what prints.
   */
  measurePages(): void {
    const pxPerMm = this.pixelsPerMm();
    if (pxPerMm <= 0) return;

    const usableHeight =
      (this.geometry.heightMm - this.geometry.margins.top - this.geometry.margins.bottom) * pxPerMm;
    if (usableHeight <= 0) return;

    const { starts } = paginateFlow(this.flow, usableHeight);
    this.setPageCount(starts);
  }

  /**
   * Pixels per millimetre *inside* the sheet's own coordinate space.
   *
   * The sheet is scaled with a CSS transform, so its bounding rectangle is
   * already multiplied by the zoom while `offsetTop` and `offsetHeight` are
   * not. Anything measured with layout geometry — pagination, page boundary
   * lines — must use this untransformed figure.
   */
  private pixelsPerMm(): number {
    const width = this.sheet.getBoundingClientRect().width;
    return width > 0 ? width / this.geometry.widthMm / this.zoom : 0;
  }

  /**
   * Pixels per millimetre as the pointer sees them, zoom included.
   *
   * Pointer events arrive in client coordinates, which the transform has
   * already scaled, so dragging a sticker must divide by this figure or the
   * sticker outruns the finger.
   */
  private screenPixelsPerMm(): number {
    const width = this.sheet.getBoundingClientRect().width;
    return width > 0 ? width / this.geometry.widthMm : 0;
  }

  private setPageCount(starts: number[]): void {
    const count = starts.length;
    this.sheet.style.setProperty('--page-count', String(count));
    clear(this.boundaryLayer);

    for (let index = 1; index < count; index += 1) {
      // Drawn exactly where the printer breaks, because it is the same figure.
      const boundary = el('div', { class: 'sheet__boundary' });
      boundary.style.setProperty('top', `${starts[index]!}px`);
      boundary.append(el('span', { class: 'sheet__boundary-label', text: `Page ${index + 1}` }));
      this.boundaryLayer.append(boundary);
    }

    if (count !== this.pageCount) {
      this.pageCount = count;
      this.options.onPages?.(count);
    }
    this.syncHolder();
  }

  get pages(): number {
    return this.pageCount;
  }

  /* ------------------------------------------------------------------ */
  /* Editing helpers                                                     */
  /* ------------------------------------------------------------------ */

  private blockAtCaret(): HTMLElement | null {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;
    let node: Node | null = selection.getRangeAt(0).startContainer;
    while (node && node !== this.flow) {
      if (node instanceof HTMLElement && node.parentElement === this.flow) return node;
      node = node.parentNode;
    }
    return null;
  }

  /** Enter starts a new paragraph block of the right type. */
  private insertParagraphAtCaret(): boolean {
    const current = this.blockAtCaret();
    if (!current) return false;

    const doc = this.options.getDocument();
    const index = doc.blocks.findIndex((block) => block.id === current.dataset.block);
    if (index < 0) return false;

    const next = cloneDocument(doc);
    // A new line after the closing or signature stays in that voice; everywhere
    // else it becomes an ordinary paragraph.
    const currentType = next.blocks[index]?.type;
    const type = currentType === 'signature' || currentType === 'closing' ? currentType : 'paragraph';
    next.blocks.splice(index + 1, 0, textBlock(type as 'paragraph', ''));
    this.options.onChange(next, 'new-paragraph');
    this.render(next);
    this.focusBlock(index + 1);
    return true;
  }

  insertBlocksAtCaret(blocks: Block[]): void {
    const doc = this.options.getDocument();
    const current = this.blockAtCaret();
    const index = current ? doc.blocks.findIndex((block) => block.id === current.dataset.block) : -1;

    const next = cloneDocument(doc);
    const at = index >= 0 ? index + 1 : next.blocks.length;

    // A single pasted paragraph merges into the current one; several become
    // their own blocks, so structure survives.
    if (blocks.length === 1 && index >= 0) {
      const target = next.blocks[index];
      if (target && 'inlines' in target) {
        target.inlines = [...target.inlines, ...blocksToInlines(blocks)];
        this.options.onChange(next, 'paste');
        this.render(next);
        this.focusBlock(index, true);
        return;
      }
    }

    next.blocks.splice(at, 0, ...blocks);
    this.options.onChange(next, 'paste');
    this.render(next);
    this.focusBlock(Math.min(at + blocks.length - 1, next.blocks.length - 1), true);
  }

  /** Puts the caret in a block, at the end when `atEnd`. */
  focusBlock(index: number, atEnd = false): void {
    const child = this.flow.children[index];
    if (!(child instanceof HTMLElement)) return;
    const range = document.createRange();
    const selection = window.getSelection();
    if (!selection) return;

    if (atEnd) {
      range.selectNodeContents(child);
      range.collapse(false);
    } else {
      range.setStart(child, 0);
      range.collapse(true);
    }
    selection.removeAllRanges();
    selection.addRange(range);
    this.flow.focus({ preventScroll: true });
    this.scrollCaretIntoView();
  }

  /** Keeps the caret visible when the on-screen keyboard appears. */
  scrollCaretIntoView(): void {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const rect = selection.getRangeAt(0).getBoundingClientRect();
    if (rect.height === 0 && rect.width === 0) return;
    const viewport = window.visualViewport;
    const bottom = viewport ? viewport.height + viewport.offsetTop : window.innerHeight;
    if (rect.bottom > bottom - 24 || rect.top < 72) {
      this.element.scrollIntoView({ block: 'nearest', behavior: 'auto' });
      const target = window.scrollY + rect.top - bottom / 2;
      window.scrollTo({ top: Math.max(0, target), behavior: 'auto' });
    }
  }

  setZoom(zoom: number): void {
    this.zoom = zoom;
    this.sheet.style.setProperty('--zoom', String(zoom));
    this.syncHolder();
    this.repaginate();
  }

  /**
   * Reserves the *scaled* size of the sheet on its holder.
   *
   * `transform: scale()` paints smaller but still lays out at full size, so
   * without this a 210mm page overflows a phone and gets clipped at both edges.
   */
  private syncHolder(): void {
    this.element.style.setProperty('width', `${this.geometry.widthMm * this.zoom}mm`);
    const height = this.sheet.offsetHeight;
    if (height > 0) this.element.style.setProperty('height', `${height * this.zoom}px`);
  }

  get currentZoom(): number {
    return this.zoom;
  }

  /**
   * Locks or unlocks the writing surface.
   *
   * A locked letter's words are encrypted and not in memory, so the page must
   * not accept typing that would be read back over the ciphertext.
   */
  setReadOnly(readOnly: boolean): void {
    if (readOnly === this.readOnly) return;
    this.readOnly = readOnly;
    if (readOnly) {
      this.flow.contentEditable = 'false';
      this.flow.removeAttribute('tabindex');
    } else {
      this.flow.contentEditable = 'true';
      this.flow.tabIndex = 0;
    }
    this.render(this.options.getDocument());
  }

  get isReadOnly(): boolean {
    return this.readOnly;
  }

  setDecorationsHidden(hidden: boolean): void {
    this.hideDecorations = hidden;
    this.sheet.dataset.decorations = hidden ? 'hidden' : 'shown';
    this.render(this.options.getDocument());
  }

  get decorationsHidden(): boolean {
    return this.hideDecorations;
  }

  get sheetElement(): HTMLElement {
    return this.sheet;
  }

  get flowElement(): HTMLElement {
    return this.flow;
  }

  get decorationsElement(): HTMLElement {
    return this.decorationLayer;
  }

  get pageGeometry(): PageGeometry {
    return this.geometry;
  }

  /** CSS pixels per millimetre on screen, including the current zoom. */
  get scale(): number {
    return this.screenPixelsPerMm();
  }

  /**
   * The point, in millimetres, at the middle of whatever part of the paper is
   * currently on screen. New stickers and photographs land here so they never
   * appear three pages above the writer with no hint of where they went.
   */
  visibleCentreMm(): { xMm: number; yMm: number } {
    const rect = this.sheet.getBoundingClientRect();
    const pxPerMm = this.screenPixelsPerMm();
    if (pxPerMm <= 0) {
      return { xMm: this.geometry.widthMm / 2, yMm: this.geometry.heightMm / 2 };
    }

    const viewWidth = window.visualViewport?.width ?? window.innerWidth;
    const viewHeight = window.visualViewport?.height ?? window.innerHeight;
    const left = Math.max(rect.left, 0);
    const right = Math.min(rect.right, viewWidth);
    const top = Math.max(rect.top, 0);
    const bottom = Math.min(rect.bottom, viewHeight);

    const centreX = right > left ? (left + right) / 2 : rect.left + rect.width / 2;
    const centreY = bottom > top ? (top + bottom) / 2 : rect.top + rect.height / 2;

    return {
      xMm: (centreX - rect.left) / pxPerMm,
      yMm: (centreY - rect.top) / pxPerMm,
    };
  }

  /** Total paper height in millimetres, all pages included. */
  get totalHeightMm(): number {
    return this.geometry.heightMm * this.pageCount;
  }

  flush(): void {
    this.readBack.flush();
  }

  dispose(): void {
    this.readBack.cancel();
    this.repaginate.cancel();
    this.disposables.dispose();
  }
}
