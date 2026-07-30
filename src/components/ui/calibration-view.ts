/**
 * Print check: calibration sheet plus a manual testing checklist.
 */

import { el, clear } from '../utilities/dom';
import { buildCalibrationPage } from '../printing/calibration';
import { PAPERS } from '../printing/paper';
import { getPreferences, setPreferences } from '../storage/preferences';
import { assetUrl } from '../utilities/assets';
import { focusHeading } from '../accessibility/focus';
import { toast } from './toast';
import { describe } from '../utilities/events';

export interface CalibrationView {
  element: HTMLElement;
}

const CHECKS: string[] = [
  'Print at 100% scale, with “fit to page” or “shrink to fit” switched off.',
  'Measure the 100 mm rule with a ruler. If it is short, your printer is scaling; correct it in the print dialog rather than in Dearly.',
  'Check that all four corner marks printed. A missing mark means your printer cannot reach that edge — increase that margin in Print settings.',
  'Hold the sheet up to the light: text should sit inside the corner marks with an even margin.',
  'Print a two-page letter and confirm no line is cut in half across the page break.',
  'If you print envelopes directly, feed one envelope first and check the address lands in the lower middle third.',
];

export function createCalibrationView(): CalibrationView {
  const element = el('section', { class: 'view view--calibration', 'aria-labelledby': 'calibration-title' });

  const paperSelect = el('select', { class: 'input', id: 'calibration-paper' }) as HTMLSelectElement;
  for (const paper of PAPERS) paperSelect.append(el('option', { value: paper.id, text: paper.name }));
  paperSelect.value = getPreferences().paperSize;
  paperSelect.addEventListener('change', () => {
    setPreferences({ paperSize: paperSelect.value as 'a4' | 'letter' | 'a5' });
    renderPreview();
  });

  const printButton = el('button', {
    type: 'button',
    class: 'button button--primary',
    text: 'Print the calibration sheet',
  });
  printButton.addEventListener('click', () => void printSheet());

  const preview = el('div', { class: 'calibration-preview' });

  element.append(
    el('h1', { class: 'view__title', id: 'calibration-title', text: 'Print check' }),
    el('p', {
      class: 'view__intro',
      text:
        'Printers rarely print at exactly the size they claim. This sheet lets you measure what yours ' +
        'actually does, so your letters come out at the size you designed them.',
    }),
    el('div', { class: 'field-row' }, [
      el('div', { class: 'field' }, [
        el('label', { class: 'label', for: 'calibration-paper', text: 'Paper' }),
        paperSelect,
      ]),
      el('div', { class: 'field' }, [printButton]),
    ]),
    preview,
  );

  const checklist = el('section', { class: 'prose' });
  checklist.append(el('h2', { text: 'What to check' }));
  const list = el('ol');
  for (const check of CHECKS) list.append(el('li', { text: check }));
  checklist.append(
    list,
    el('p', {
      text:
        'A printer-by-printer checklist, including the common home printers and their unprintable ' +
        'margins, is in docs/print-testing.md in the repository.',
    }),
  );
  element.append(checklist);

  function renderPreview(): void {
    clear(preview);
    const page = buildCalibrationPage(paperSelect.value);
    page.classList.add('calibration-preview__page');
    const holder = el('div', { class: 'calibration-preview__holder' });
    holder.append(page);
    preview.append(holder);
  }

  async function printSheet(): Promise<void> {
    const root = el('div', { class: 'print-root', id: 'dearly-print-root', 'aria-hidden': 'true' });
    root.append(buildCalibrationPage(paperSelect.value));
    document.body.append(root);

    let link = document.getElementById('dearly-page-size') as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.id = 'dearly-page-size';
      link.rel = 'stylesheet';
      link.media = 'print';
      document.head.append(link);
    }
    link.href = assetUrl(`print/page-${paperSelect.value}.css`);

    document.body.classList.add('is-printing');
    document.body.setAttribute('data-print-scope', 'calibration');
    try {
      window.print();
    } catch (error) {
      toast(`The print dialog could not be opened: ${describe(error)}`, 'error');
    } finally {
      window.setTimeout(() => {
        document.body.classList.remove('is-printing');
        document.body.removeAttribute('data-print-scope');
        root.remove();
      }, 1200);
    }
  }

  renderPreview();
  setPreferences({ lastSection: 'print-check' });
  focusHeading(element);

  return { element };
}
