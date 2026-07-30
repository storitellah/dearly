/**
 * Builds the printable DOM from a computed layout.
 *
 * Everything is positioned in millimetres, so what the printer produces matches
 * the measurements shown in the print dialog. Application chrome is not hidden
 * with `visibility` tricks — the print tree is a separate subtree that only
 * exists while printing, and `src/styles/print.css` hides everything else.
 */

import type { ImageBox, LetterLayout, TextLine } from './layout';
import { foldGuides } from './paper';
import { getFont } from '../stationery/typography';
import { el } from '../utilities/dom';
import { assetUrl } from '../utilities/assets';

export interface PrintAssets {
  /** Object URL per attachment id, at print resolution. */
  imageUrls: Map<string, string>;
}

function mm(value: number): string {
  return `${value.toFixed(2)}mm`;
}

function renderTextLine(line: TextLine, layout: LetterLayout): HTMLElement {
  const node = el('div', { class: `print-line print-line--${line.role}` });
  node.style.setProperty('left', mm(line.xMm));
  node.style.setProperty('top', mm(line.yMm));
  node.style.setProperty('width', mm(line.widthMm));
  node.style.setProperty('font-size', `${line.sizePt}pt`);
  node.style.setProperty('font-family', getFont(layout.fontId).stack);
  node.style.setProperty('color', layout.inkColour);
  if (line.italic) node.style.setProperty('font-style', 'italic');
  if (line.weight !== 400) node.style.setProperty('font-weight', String(line.weight));

  if (line.align === 'right') node.style.setProperty('text-align', 'right');
  else if (line.align === 'centre') node.style.setProperty('text-align', 'center');
  else if (line.align === 'justify') node.style.setProperty('text-align', 'justify');

  node.textContent = line.text;

  if (line.align === 'justify' && !line.lastOfParagraph) {
    // A single-line block will not stretch on its own; a zero-height filler
    // makes the browser justify it exactly as it would a wrapped line.
    node.append(el('span', { class: 'print-line__filler', 'aria-hidden': 'true' }));
  }
  return node;
}

function renderImage(box: ImageBox, assets: PrintAssets): HTMLElement {
  const frame = el('div', { class: 'print-image' });
  frame.style.setProperty('left', mm(box.xMm));
  frame.style.setProperty('top', mm(box.yMm));
  frame.style.setProperty('width', mm(box.widthMm));
  frame.style.setProperty('height', mm(box.heightMm));

  const url = assets.imageUrls.get(box.attachmentId);
  if (url) {
    const image = el('img', { src: url, alt: '', decoding: 'sync' });
    frame.append(image);
  }
  return frame;
}

/** Builds one sheet. */
export function renderPage(
  layout: LetterLayout,
  pageIndex: number,
  assets: PrintAssets,
  envelopeId: string,
): HTMLElement {
  const page = layout.pages[pageIndex]!;
  const sheet = el('section', {
    class: `print-page print-page--${layout.stationery.ruling} print-page--border-${layout.stationery.border}`,
    'data-page': String(pageIndex + 1),
    'aria-label': `Page ${pageIndex + 1} of ${layout.pages.length}`,
  });
  sheet.style.setProperty('width', mm(layout.paper.widthMm));
  sheet.style.setProperty('height', mm(layout.paper.heightMm));
  sheet.style.setProperty('--paper-colour', layout.stationery.paper);
  sheet.style.setProperty('--ruling-colour', layout.stationery.rulingColour);
  sheet.style.setProperty('--border-colour', layout.stationery.borderColour);
  sheet.style.setProperty('--ink-colour', layout.inkColour);
  sheet.style.setProperty('--ruling-step', mm(layout.lineHeightMm));
  sheet.style.setProperty('--margin-top', mm(layout.margins.top));
  sheet.style.setProperty('--margin-left', mm(layout.margins.left));
  sheet.style.setProperty('--margin-right', mm(layout.margins.right));
  sheet.style.setProperty('--margin-bottom', mm(layout.margins.bottom));
  if (layout.stationery.texture) {
    sheet.style.setProperty('--paper-texture', `url("${assetUrl(layout.stationery.texture)}")`);
    sheet.style.setProperty('--texture-tile', mm(layout.stationery.textureTileMm));
    sheet.classList.add('print-page--textured');
  }

  const paper = el('div', { class: 'print-page__paper', 'aria-hidden': 'true' });
  sheet.append(paper);

  const content = el('div', { class: 'print-page__content' });
  for (const item of page.items) {
    content.append(
      item.kind === 'text' ? renderTextLine(item, layout) : renderImage(item, assets),
    );
  }
  sheet.append(content);

  if (layout.showPageNumbers && layout.pages.length > 0) {
    const number = el('div', {
      class: 'print-page__number',
      text: `${pageIndex + 1} / ${layout.pages.length}`,
    });
    number.style.setProperty('bottom', mm(Math.max(6, layout.margins.bottom / 2)));
    sheet.append(number);
  }

  if (layout.showFoldGuides) {
    for (const fraction of foldGuides(layout.paper.id, envelopeId)) {
      const guide = el('div', { class: 'print-guide print-guide--fold', 'aria-hidden': 'true' });
      guide.style.setProperty('top', mm(layout.paper.heightMm * fraction));
      sheet.append(guide);
    }
  }

  if (layout.showCutGuides) {
    for (const corner of ['tl', 'tr', 'bl', 'br'] as const) {
      sheet.append(
        el('div', {
          class: `print-guide print-guide--cut print-guide--cut-${corner}`,
          'aria-hidden': 'true',
        }),
      );
    }
  }

  return sheet;
}

export function renderLetterPages(
  layout: LetterLayout,
  assets: PrintAssets,
  envelopeId: string,
): DocumentFragment {
  const fragment = document.createDocumentFragment();
  for (let index = 0; index < layout.pages.length; index += 1) {
    fragment.append(renderPage(layout, index, assets, envelopeId));
  }
  return fragment;
}
