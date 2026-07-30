/**
 * Print calibration sheet.
 *
 * Printers lie about scale, and print dialogs default to "fit to page", which
 * quietly shrinks a letter by a few per cent. This sheet lets a user measure
 * what their printer actually produced: a 100 mm rule, a 4 inch rule, margin
 * markers at known distances from each edge, and text at the sizes Dearly uses.
 */

import { getPaper } from './paper';
import { el } from '../utilities/dom';
import { getFont } from '../stationery/typography';

function mm(value: number): string {
  return `${value.toFixed(2)}mm`;
}

export function buildCalibrationPage(paperId: string): HTMLElement {
  const paper = getPaper(paperId);
  const page = el('section', {
    class: 'print-page print-page--calibration',
    'aria-label': `Calibration sheet for ${paper.name}`,
  });
  page.style.setProperty('width', mm(paper.widthMm));
  page.style.setProperty('height', mm(paper.heightMm));

  const content = el('div', { class: 'calibration' });

  content.append(
    el('h1', { class: 'calibration__title', text: 'Dearly print calibration' }),
    el('p', {
      class: 'calibration__intro',
      text:
        `Paper: ${paper.name}. Print this at 100% scale with "fit to page" or ` +
        '"shrink to fit" switched off, then measure the rules below with a ruler.',
    }),
  );

  /* 100 mm rule with 10 mm ticks and 1 mm minor ticks. */
  const metric = el('div', { class: 'calibration__rule calibration__rule--metric' });
  metric.style.setProperty('width', mm(100));
  for (let i = 0; i <= 100; i += 1) {
    const tick = el('span', {
      class: `calibration__tick${i % 10 === 0 ? ' calibration__tick--major' : ''}`,
    });
    tick.style.setProperty('left', mm(i));
    metric.append(tick);
    if (i % 10 === 0) {
      const label = el('span', { class: 'calibration__label', text: String(i) });
      label.style.setProperty('left', mm(i));
      metric.append(label);
    }
  }
  content.append(
    el('h2', { class: 'calibration__heading', text: 'This rule is exactly 100 mm' }),
    metric,
  );

  /* 4 inch rule with quarter-inch ticks. */
  const imperial = el('div', { class: 'calibration__rule calibration__rule--imperial' });
  imperial.style.setProperty('width', '4in');
  for (let quarter = 0; quarter <= 16; quarter += 1) {
    const tick = el('span', {
      class: `calibration__tick${quarter % 4 === 0 ? ' calibration__tick--major' : ''}`,
    });
    tick.style.setProperty('left', `${quarter * 0.25}in`);
    imperial.append(tick);
    if (quarter % 4 === 0) {
      const label = el('span', { class: 'calibration__label', text: String(quarter / 4) });
      label.style.setProperty('left', `${quarter * 0.25}in`);
      imperial.append(label);
    }
  }
  content.append(
    el('h2', { class: 'calibration__heading', text: 'This rule is exactly 4 inches' }),
    imperial,
  );

  /* Type sizes actually used by the letter layout. */
  const samples = el('div', { class: 'calibration__samples' });
  for (const size of [9, 10, 10.5, 11, 11.5, 12, 14]) {
    const row = el('p', { class: 'calibration__sample' });
    row.style.setProperty('font-size', `${size}pt`);
    row.style.setProperty('font-family', getFont('literata').stack);
    row.textContent = `${size} pt — Write what deserves to be kept. 0123456789`;
    samples.append(row);
  }
  content.append(
    el('h2', { class: 'calibration__heading', text: 'Type sizes' }),
    samples,
  );

  content.append(
    el('h2', { class: 'calibration__heading', text: 'Grey levels' }),
    (() => {
      const ramp = el('div', { class: 'calibration__ramp' });
      for (const level of [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]) {
        const swatch = el('span', { class: 'calibration__swatch', title: `${level}%` });
        const value = Math.round(255 - (level / 100) * 255);
        swatch.style.setProperty('background', `rgb(${value},${value},${value})`);
        ramp.append(swatch);
      }
      return ramp;
    })(),
  );

  content.append(
    el('h2', { class: 'calibration__heading', text: 'Unprintable margins' }),
    el('p', {
      class: 'calibration__note',
      text:
        'The four corner marks sit exactly 10 mm from the edges of the paper. If a mark ' +
        'is missing, your printer cannot reach that edge; increase the matching margin ' +
        'in Print settings by the amount that is cut off.',
    }),
  );

  page.append(content);

  for (const corner of ['tl', 'tr', 'bl', 'br'] as const) {
    const mark = el('div', {
      class: `calibration__corner calibration__corner--${corner}`,
      'aria-hidden': 'true',
    });
    page.append(mark);
  }

  const footer = el('div', {
    class: 'calibration__footer',
    text: 'Dearly by Storitellah — print calibration sheet',
  });
  page.append(footer);

  return page;
}
