/** Renders an envelope layout as printable DOM, and as an on-screen preview. */

import type { EnvelopeLayout } from './envelope-layout';
import { getFont } from '../stationery/typography';
import { el } from '../utilities/dom';

function mm(value: number): string {
  return `${value.toFixed(2)}mm`;
}

export function renderEnvelopePage(layout: EnvelopeLayout): HTMLElement {
  const width = layout.sheet ? layout.sheet.widthMm : layout.envelope.widthMm;
  const height = layout.sheet ? layout.sheet.heightMm : layout.envelope.heightMm;

  const page = el('section', {
    class: 'print-page print-page--envelope',
    'aria-label': `Envelope, ${layout.envelope.name}`,
  });
  page.style.setProperty('width', mm(width));
  page.style.setProperty('height', mm(height));
  page.style.setProperty('--ink-colour', layout.inkColour);

  const outline = el('div', { class: 'envelope-outline', 'aria-hidden': 'true' });
  outline.style.setProperty('left', mm(layout.offsetXMm));
  outline.style.setProperty('top', mm(layout.offsetYMm));
  outline.style.setProperty('width', mm(layout.envelope.widthMm));
  outline.style.setProperty('height', mm(layout.envelope.heightMm));
  if (!layout.showGuides) outline.classList.add('envelope-outline--hidden');
  page.append(outline);

  for (const block of layout.blocks) {
    const node = el('div', { class: `envelope-block envelope-block--${block.role}` });
    node.style.setProperty('left', mm(block.xMm));
    node.style.setProperty('top', mm(block.yMm));
    node.style.setProperty('width', mm(block.widthMm));
    node.style.setProperty('font-size', `${block.sizePt}pt`);
    node.style.setProperty('font-family', getFont(layout.fontId).stack);
    node.style.setProperty('color', layout.inkColour);
    if (block.align === 'right') node.style.setProperty('text-align', 'right');

    for (const line of block.lines) {
      const lineNode = el('div', { class: 'envelope-block__line', text: line });
      lineNode.style.setProperty('height', mm(block.lineHeightMm));
      node.append(lineNode);
    }
    page.append(node);
  }

  if (layout.seal) {
    const seal = el('div', {
      class: `envelope-seal envelope-seal--${layout.seal.style}`,
      'aria-hidden': 'true',
    });
    seal.style.setProperty(
      'left',
      mm(layout.offsetXMm + layout.envelope.widthMm / 2 - 11),
    );
    seal.style.setProperty('top', mm(layout.offsetYMm + layout.envelope.heightMm - 26));
    seal.style.setProperty('--seal-colour', layout.seal.colour);
    page.append(seal);
  }

  if (layout.showGuides && layout.sheet) {
    for (const corner of ['tl', 'tr', 'bl', 'br'] as const) {
      const mark = el('div', {
        class: `envelope-cut envelope-cut--${corner}`,
        'aria-hidden': 'true',
      });
      const isLeft = corner === 'tl' || corner === 'bl';
      const isTop = corner === 'tl' || corner === 'tr';
      mark.style.setProperty(
        'left',
        mm(isLeft ? layout.offsetXMm : layout.offsetXMm + layout.envelope.widthMm),
      );
      mark.style.setProperty(
        'top',
        mm(isTop ? layout.offsetYMm : layout.offsetYMm + layout.envelope.heightMm),
      );
      page.append(mark);
    }
  }

  return page;
}
