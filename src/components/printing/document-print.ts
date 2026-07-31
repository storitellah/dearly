/**
 * Printing the page the writer actually sees.
 *
 * The desk draws the letter as a document — headings, quotes, lists, inline
 * formatting, photographs and stickers, on paper drawn at true millimetre size.
 * Printing uses the very same renderer and the very same pagination rule, so
 * the sheet that comes out of the printer is the sheet that was on the screen,
 * with the page breaks in the same places.
 *
 * Each printed page is a window onto one continuous flow: the flow is repeated
 * inside every page and shifted up by one page's worth of usable height, with
 * the page clipping what falls outside. That keeps the text as real text — the
 * browser's own PDF export gets selectable, searchable words, not a picture of
 * them — while guaranteeing the breaks match what was measured on screen.
 */

import { el } from '../utilities/dom';
import { renderDecoration, renderFlow, type RenderContext } from '../document/render';
import type { Decoration, LetterDocument } from '../document/model';
import { getPaper as getPaperDesign } from '../templates/papers';
import { getTemplate } from '../templates/templates';
import { getFont } from '../stationery/typography';
import { getTheme } from '../theme/themes';
import { PAGE_SIZES } from '../editor/wysiwyg/page-view';
import { paginateFlow } from '../editor/wysiwyg/pagination';
import type { LetterRecord } from '../storage/schema';

export interface DocumentPrintOptions {
  /** Object URL per attachment id, at print resolution. */
  photoUrls: Map<string, string>;
  stickerUrls: Map<string, string>;
  showPageNumbers: boolean;
  /** Physical paper the job is going onto, which may be larger than the design. */
  paperWidthMm: number;
  paperHeightMm: number;
}

export interface DocumentPrintResult {
  /** The pages, ready to be appended to the print root. */
  pages: HTMLElement[];
  /** Millimetre size of the letter's own design, before it is centred on the paper. */
  designWidthMm: number;
  designHeightMm: number;
}

function mm(value: number): string {
  return `${value.toFixed(2)}mm`;
}

/**
 * Writes a letter's paper, palette, typography and margins onto an element.
 * Shared with the on-screen sheet through the same custom property names.
 */
function applyDesign(sheet: HTMLElement, letter: LetterRecord, widthMm: number, heightMm: number): {
  margins: { top: number; right: number; bottom: number; left: number };
} {
  const template = getTemplate(letter.templateId);
  const theme = getTheme(letter.themeId);
  const margins = template?.margins ?? { top: 24, right: 22, bottom: 24, left: 22 };

  const style = sheet.style;
  style.setProperty('--page-width', `${widthMm}mm`);
  style.setProperty('--page-height', `${heightMm}mm`);
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

  // Identical to the on-screen sheet, so the paper prints as it was written on.
  const paper = getPaperDesign(template?.paper ?? 'plain');
  const step = template?.patternStepMm ?? 6;
  style.setProperty(
    '--paper-pattern',
    paper.background(theme.palette.stickers[3] ?? theme.palette.line, theme.palette.accent),
  );
  style.setProperty('--paper-pattern-size', paper.size(step));
  style.setProperty('--paper-pattern-opacity', String(template?.patternOpacity ?? paper.defaultOpacity));
  style.setProperty('--border-colour', theme.palette.primary);
  sheet.dataset.border = template?.border ?? 'none';
  sheet.dataset.paper = template?.paper ?? 'plain';

  return { margins };
}

/** Which page a decoration belongs to, given where the pages fall. */
function pageOfDecoration(
  decoration: Decoration,
  usableHeightMm: number,
  marginTopMm: number,
  pageCount: number,
): number {
  const offset = decoration.yMm - marginTopMm;
  if (offset < 0) return 0;
  return Math.min(pageCount - 1, Math.floor(offset / usableHeightMm));
}

/**
 * Builds the printable pages for a letter from its document.
 *
 * The caller appends the pages to the print root and is responsible for the
 * object URLs it passed in.
 */
export function renderDocumentPages(
  letter: LetterRecord,
  doc: LetterDocument,
  options: DocumentPrintOptions,
): DocumentPrintResult {
  const size = PAGE_SIZES[letter.paperSize] ?? PAGE_SIZES.a4!;
  const designWidthMm = size.widthMm;
  const designHeightMm = size.heightMm;

  const context: RenderContext = {
    photoUrls: options.photoUrls,
    stickerUrls: options.stickerUrls,
    editable: false,
    hideDecorations: false,
  };

  // A measuring sheet, laid out for real but kept out of sight and out of the
  // accessibility tree, so the pagination is measured rather than guessed.
  const measurer = el('div', { class: 'print-measure', 'aria-hidden': 'true' });
  const measureSheet = el('div', { class: 'sheet sheet--print' });
  const { margins } = applyDesign(measureSheet, letter, designWidthMm, designHeightMm);
  const measureFlow = el('article', { class: 'sheet__flow' });
  measureFlow.append(renderFlow(doc, context));
  measureSheet.append(measureFlow);
  measurer.append(measureSheet);
  document.body.append(measurer);

  let starts: number[] = [0];
  let heights: number[] = [0];
  try {
    const pxPerMm = measureSheet.getBoundingClientRect().width / designWidthMm;
    const usableHeightPx = (designHeightMm - margins.top - margins.bottom) * pxPerMm;
    // The same routine the writing surface uses, so the breaks are the same.
    const measured = paginateFlow(measureFlow, usableHeightPx);
    starts = measured.starts;
    heights = measured.heights;
  } finally {
    measurer.remove();
  }

  const usableHeightMm = designHeightMm - margins.top - margins.bottom;
  const pageCount = Math.max(1, starts.length);
  const pages: HTMLElement[] = [];

  for (let index = 0; index < pageCount; index += 1) {
    const page = el('section', { class: 'print-page print-page--document' });
    page.style.setProperty('width', mm(options.paperWidthMm));
    page.style.setProperty('height', mm(options.paperHeightMm));

    const sheet = el('div', { class: 'sheet sheet--print' });
    applyDesign(sheet, letter, designWidthMm, designHeightMm);
    sheet.style.setProperty('height', mm(designHeightMm));

    // The window onto the flow: the same content every time, shifted up by the
    // pages already printed, with everything outside the sheet clipped away.
    const window_ = el('div', { class: 'sheet__window' });
    const height = heights[index] ?? 0;
    if (height > 0) window_.style.setProperty('height', `${height}px`);
    const flow = el('article', { class: 'sheet__flow' });
    flow.append(renderFlow(doc, context));
    for (const [position, child] of Array.from(flow.children).entries()) {
      // Re-apply the spacers measured above so the breaks are identical.
      const measured = measureFlow.children[position];
      if (child instanceof HTMLElement && measured instanceof HTMLElement) {
        const spacer = measured.style.marginTop;
        if (spacer) child.style.setProperty('margin-top', spacer);
      }
    }
    // The window starts at the top margin, so the flow is pulled up past its
    // own padding as well as past the pages already printed.
    flow.style.setProperty('margin-top', `${-(starts[index] ?? 0)}px`);
    window_.append(flow);
    sheet.append(window_);

    const decorations = doc.decorations.filter(
      (decoration) => pageOfDecoration(decoration, usableHeightMm, margins.top, pageCount) === index,
    );
    if (decorations.length > 0) {
      const layer = el('div', { class: 'sheet__decorations' });
      for (const decoration of decorations) {
        const node = renderDecoration(decoration, context);
        // Positions are absolute on the whole letter; bring them onto this page.
        node.style.setProperty('top', mm(decoration.yMm - index * usableHeightMm));
        layer.append(node);
      }
      sheet.append(layer);
    }

    page.append(sheet);

    if (options.showPageNumbers && pageCount > 1) {
      page.append(
        el('div', {
          class: 'print-page__number',
          text: `${index + 1} of ${pageCount}`,
        }),
      );
    }

    pages.push(page);
  }

  return { pages, designWidthMm, designHeightMm };
}
