/** Stationery and typography controls. */

import { el } from '../utilities/dom';
import { STATIONERY, getStationery, preloadTexture } from '../stationery/stationery';
import { FONTS, LINE_HEIGHTS, TEXT_SIZES } from '../stationery/typography';
import { basePath } from '../utilities/assets';
import { setPreferences } from '../storage/preferences';
import { safeColour } from '../storage/schema';
import type { EditorContext } from './context';

export function createPaperPanel(context: EditorContext): HTMLElement {
  const panel = el('details', { class: 'panel', open: true });
  panel.append(el('summary', { class: 'panel__summary', text: 'Paper and type' }));

  const body = el('div', { class: 'panel__body' });

  /* Stationery -------------------------------------------------------------- */

  const stationeryList = el('div', {
    class: 'stationery-list',
    role: 'radiogroup',
    'aria-label': 'Stationery',
  });

  const inputs: HTMLInputElement[] = [];
  for (const stationery of STATIONERY) {
    const id = `stationery-${stationery.id}`;
    const input = el('input', {
      type: 'radio',
      name: 'stationery',
      id,
      value: stationery.id,
      class: 'stationery-option__input',
    }) as HTMLInputElement;
    inputs.push(input);

    const label = el('label', { class: 'stationery-option', for: id });
    const swatch = el('span', { class: 'stationery-option__swatch', 'aria-hidden': 'true' });
    swatch.style.setProperty('background-color', stationery.paper);
    swatch.style.setProperty('border-color', stationery.borderColour);
    if (stationery.texture) {
      swatch.style.setProperty('background-image', `url("${basePath()}${stationery.texture}")`);
    }
    label.append(
      swatch,
      el('span', { class: 'stationery-option__name', text: stationery.name }),
      el('span', { class: 'stationery-option__description', text: stationery.description }),
    );

    input.addEventListener('change', () => {
      if (!input.checked) return;
      const chosen = getStationery(stationery.id);
      preloadTexture(chosen, basePath());
      setPreferences({ lastStationeryId: chosen.id });
      context.update(
        {
          stationeryId: chosen.id,
          typography: { ...context.letter.typography, colour: chosen.ink },
        },
        'stationery',
      );
    });

    stationeryList.append(el('div', { class: 'stationery-option__wrap' }, [input, label]));
  }

  body.append(stationeryList);

  /* Typography -------------------------------------------------------------- */

  const grid = el('div', { class: 'field-grid' });

  const fontSelect = el('select', { class: 'input', id: 'typography-font' }) as HTMLSelectElement;
  for (const font of FONTS) {
    fontSelect.append(el('option', { value: font.id, text: `${font.name} — ${font.description}` }));
  }
  fontSelect.addEventListener('change', () => {
    context.update(
      { typography: { ...context.letter.typography, family: fontSelect.value } },
      'typography',
    );
  });

  const sizeSelect = el('select', { class: 'input', id: 'typography-size' }) as HTMLSelectElement;
  for (const size of TEXT_SIZES) {
    sizeSelect.append(el('option', { value: String(size), text: `${size} pt` }));
  }
  sizeSelect.addEventListener('change', () => {
    context.update(
      { typography: { ...context.letter.typography, sizePt: Number(sizeSelect.value) } },
      'typography',
    );
  });

  const lineSelect = el('select', { class: 'input', id: 'typography-line' }) as HTMLSelectElement;
  for (const height of LINE_HEIGHTS) {
    lineSelect.append(el('option', { value: String(height), text: `${height}× line spacing` }));
  }
  lineSelect.addEventListener('change', () => {
    context.update(
      { typography: { ...context.letter.typography, lineHeight: Number(lineSelect.value) } },
      'typography',
    );
  });

  const alignSelect = el('select', { class: 'input', id: 'typography-align' }) as HTMLSelectElement;
  alignSelect.append(
    el('option', { value: 'left', text: 'Ragged right (recommended)' }),
    el('option', { value: 'justify', text: 'Justified' }),
  );
  alignSelect.addEventListener('change', () => {
    context.update(
      {
        typography: {
          ...context.letter.typography,
          align: alignSelect.value === 'justify' ? 'justify' : 'left',
        },
      },
      'typography',
    );
  });

  const inkInput = el('input', {
    type: 'color',
    class: 'input input--colour',
    id: 'typography-ink',
  }) as HTMLInputElement;
  inkInput.addEventListener('input', () => {
    context.update(
      { typography: { ...context.letter.typography, colour: safeColour(inkInput.value) } },
      'typography',
    );
  });

  grid.append(
    field('typography-font', 'Typeface', fontSelect),
    field('typography-size', 'Text size', sizeSelect),
    field('typography-line', 'Line spacing', lineSelect),
    field('typography-align', 'Alignment', alignSelect),
    field('typography-ink', 'Ink colour', inkInput),
  );
  body.append(grid);
  panel.append(body);

  const sync = (): void => {
    const letter = context.letter;
    for (const input of inputs) input.checked = input.value === letter.stationeryId;
    fontSelect.value = letter.typography.family;
    sizeSelect.value = String(letter.typography.sizePt);
    lineSelect.value = String(letter.typography.lineHeight);
    alignSelect.value = letter.typography.align;
    inkInput.value = safeColour(letter.typography.colour);
    const disabled = context.locked;
    for (const control of [fontSelect, sizeSelect, lineSelect, alignSelect, inkInput, ...inputs]) {
      control.disabled = disabled;
    }
  };

  sync();
  context.events.on('change', (event) => {
    if (event.source === 'typography') return;
    sync();
  });

  return panel;
}

function field(id: string, label: string, control: HTMLElement): HTMLElement {
  return el('div', { class: 'field' }, [el('label', { class: 'label', for: id, text: label }), control]);
}
