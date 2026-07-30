/**
 * On-screen page preview.
 *
 * The preview is the same DOM the printer receives, drawn at true millimetre
 * dimensions and scaled down with a transform. What you see here is what comes
 * out of the printer, including where pages break.
 */

import { el, clear } from '../utilities/dom';
import { layoutLetter } from '../printing/layout';
import { renderLetterPages } from '../printing/print-render';
import { getPaper } from '../printing/paper';
import { getPreferences } from '../storage/preferences';
import { debounce } from '../utilities/debounce';
import { Disposables } from '../utilities/events';
import type { EditorContext } from './context';

export interface PreviewPanel {
  element: HTMLElement;
  refresh(): void;
  dispose(): void;
  /** Number of pages in the current preview. */
  pages(): number;
}

export function createPreviewPanel(context: EditorContext): PreviewPanel {
  const urls = new Disposables();
  const panel = el('section', { class: 'preview', 'aria-labelledby': 'preview-heading' });

  const heading = el('h2', { class: 'preview__heading', id: 'preview-heading', text: 'Preview' });
  const count = el('p', { class: 'preview__count', role: 'status' });

  const paperSelect = el('select', { class: 'input input--small', id: 'preview-paper' }) as HTMLSelectElement;
  for (const paper of [getPaper('a4'), getPaper('letter'), getPaper('a5')]) {
    paperSelect.append(el('option', { value: paper.id, text: paper.name }));
  }
  paperSelect.value = getPreferences().paperSize;

  const stage = el('div', { class: 'preview__stage' });

  panel.append(
    el('div', { class: 'preview__bar' }, [
      heading,
      el('div', { class: 'field field--inline' }, [
        el('label', { class: 'label label--inline', for: 'preview-paper', text: 'Paper' }),
        paperSelect,
      ]),
      count,
    ]),
    stage,
  );

  let pageTotal = 0;

  const render = (): void => {
    urls.dispose();
    clear(stage);

    const paperId = paperSelect.value;
    const layout = layoutLetter(context.letter, {
      paperId,
      showPageNumbers: true,
      showFoldGuides: false,
      showCutGuides: false,
      includePhotographs: true,
    });
    pageTotal = layout.pages.length;

    const imageUrls = new Map<string, string>();
    for (const attachment of context.attachments) {
      imageUrls.set(attachment.id, urls.objectUrl(attachment.preview));
    }

    const pages = renderLetterPages(layout, { imageUrls }, context.letter.envelope.size);
    const holder = el('div', { class: 'preview__pages' });
    holder.append(pages);
    stage.append(holder);

    // Fit the true-size pages to the available width.
    const available = stage.clientWidth || 640;
    const scale = Math.min(1, (available - 8) / ((layout.paper.widthMm / 25.4) * 96));
    holder.style.setProperty('transform', `scale(${scale.toFixed(4)})`);
    holder.style.setProperty('transform-origin', 'top left');
    // The pages are drawn at true size and scaled with a transform, which does
    // not affect layout, so the holder is told the height the result occupies.
    const pageHeightPx = (layout.paper.heightMm / 25.4) * 96 * scale;
    const gap = 12;
    holder.style.setProperty(
      'height',
      `${(pageHeightPx * layout.pages.length + gap * (layout.pages.length - 1)).toFixed(0)}px`,
    );

    count.textContent =
      pageTotal === 1
        ? '1 page as it will print.'
        : `${pageTotal} pages as they will print.`;
  };

  const scheduleRender = debounce(render, 260);

  paperSelect.addEventListener('change', () => {
    render();
  });

  context.events.on('change', () => scheduleRender());
  context.events.on('attachments', () => scheduleRender());

  const onResize = (): void => scheduleRender();
  window.addEventListener('resize', onResize);

  render();

  return {
    element: panel,
    refresh: render,
    pages: () => pageTotal,
    dispose(): void {
      scheduleRender.cancel();
      window.removeEventListener('resize', onResize);
      urls.dispose();
    },
  };
}
