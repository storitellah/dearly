/** Envelope details, with a live preview at true proportions. */

import { el, clear } from '../utilities/dom';
import { ENVELOPES } from '../printing/paper';
import { layoutEnvelope } from '../envelope/envelope-layout';
import { renderEnvelopePage } from '../envelope/envelope-render';
import { safeColour, type EnvelopeSettings } from '../storage/schema';
import type { EditorContext } from './context';

export function createEnvelopePanel(context: EditorContext): HTMLElement {
  const panel = el('details', { class: 'panel' });
  panel.append(el('summary', { class: 'panel__summary', text: 'Envelope' }));
  const body = el('div', { class: 'panel__body' });

  const enabled = el('input', { type: 'checkbox', id: 'envelope-enabled', class: 'checkbox' }) as HTMLInputElement;
  const enabledRow = el('div', { class: 'field field--checkbox' }, [
    enabled,
    el('label', { class: 'label', for: 'envelope-enabled', text: 'Prepare an envelope for this letter' }),
  ]);

  const sizeSelect = el('select', { class: 'input', id: 'envelope-size' }) as HTMLSelectElement;
  for (const envelope of ENVELOPES) {
    sizeSelect.append(el('option', { value: envelope.id, text: envelope.name }));
  }

  const recipientName = textInput('envelope-recipient-name', 'Recipient name');
  const recipientAddress = textArea('envelope-recipient-address', 'Recipient address', 4);
  const senderName = textInput('envelope-sender-name', 'Sender name');
  const senderAddress = textArea('envelope-sender-address', 'Sender address', 3);
  const stampNote = textInput('envelope-stamp-note', 'Note near the stamp');

  const sealSelect = el('select', { class: 'input', id: 'envelope-seal' }) as HTMLSelectElement;
  for (const [value, label] of [
    ['none', 'No seal'],
    ['wax', 'Wax seal'],
    ['sticker', 'Paper sticker'],
    ['ribbon', 'Ribbon'],
  ] as const) {
    sealSelect.append(el('option', { value, text: label }));
  }

  const sealColour = el('input', {
    type: 'color',
    class: 'input input--colour',
    id: 'envelope-seal-colour',
  }) as HTMLInputElement;

  const preview = el('div', { class: 'envelope-preview', 'aria-label': 'Envelope preview', role: 'img' });

  body.append(
    enabledRow,
    el('div', { class: 'field-grid' }, [
      wrap('envelope-size', 'Envelope size', sizeSelect),
      recipientName.field,
      senderName.field,
      stampNote.field,
      wrap('envelope-seal', 'Seal', sealSelect),
      wrap('envelope-seal-colour', 'Seal colour', sealColour),
    ]),
    recipientAddress.field,
    senderAddress.field,
    el('p', {
      class: 'field-hint',
      text:
        'Addresses are stored on this device with the letter. They are never sent anywhere, ' +
        'and they are hidden inside the encrypted payload when a letter is locked.',
    }),
    preview,
  );
  panel.append(body);

  const collect = (): EnvelopeSettings => ({
    enabled: enabled.checked,
    size: sizeSelect.value as EnvelopeSettings['size'],
    recipientName: recipientName.input.value,
    recipientAddress: recipientAddress.input.value,
    senderName: senderName.input.value,
    senderAddress: senderAddress.input.value,
    stampNote: stampNote.input.value,
    sealStyle: sealSelect.value as EnvelopeSettings['sealStyle'],
    sealColour: safeColour(sealColour.value, '#8c2f39'),
  });

  const push = (): void => {
    context.update({ envelope: collect() }, 'envelope');
    drawPreview();
  };

  for (const control of [
    enabled,
    sizeSelect,
    sealSelect,
    sealColour,
    recipientName.input,
    recipientAddress.input,
    senderName.input,
    senderAddress.input,
    stampNote.input,
  ]) {
    control.addEventListener(control instanceof HTMLSelectElement ? 'change' : 'input', push);
    if (control instanceof HTMLInputElement && control.type === 'checkbox') {
      control.addEventListener('change', push);
    }
  }

  function drawPreview(): void {
    clear(preview);
    const layout = layoutEnvelope(context.letter, { target: 'envelope', showGuides: false });
    const page = renderEnvelopePage(layout);
    page.classList.add('envelope-preview__page');
    // Scale the true-size envelope down to the panel width.
    const scale = Math.min(1, 320 / layout.envelope.widthMm);
    page.style.setProperty('transform', `scale(${scale.toFixed(3)})`);
    page.style.setProperty('transform-origin', 'top left');
    const holder = el('div', { class: 'envelope-preview__holder' });
    holder.style.setProperty('height', `${(layout.envelope.heightMm * scale).toFixed(1)}mm`);
    holder.append(page);
    preview.append(holder);
    preview.setAttribute(
      'aria-label',
      `Envelope preview, ${layout.envelope.name}, addressed to ${
        context.letter.envelope.recipientName || 'nobody yet'
      }`,
    );
  }

  const sync = (): void => {
    const settings = context.letter.envelope;
    enabled.checked = settings.enabled;
    sizeSelect.value = settings.size;
    recipientName.input.value = settings.recipientName;
    recipientAddress.input.value = settings.recipientAddress;
    senderName.input.value = settings.senderName;
    senderAddress.input.value = settings.senderAddress;
    stampNote.input.value = settings.stampNote;
    sealSelect.value = settings.sealStyle;
    sealColour.value = safeColour(settings.sealColour, '#8c2f39');

    const disabled = context.locked;
    for (const control of [
      enabled,
      sizeSelect,
      sealSelect,
      sealColour,
      recipientName.input,
      recipientAddress.input,
      senderName.input,
      senderAddress.input,
      stampNote.input,
    ]) {
      control.disabled = disabled;
    }
    drawPreview();
  };

  sync();
  context.events.on('change', (event) => {
    if (event.source === 'envelope') return;
    sync();
  });

  return panel;
}

function wrap(id: string, label: string, control: HTMLElement): HTMLElement {
  return el('div', { class: 'field' }, [
    el('label', { class: 'label', for: id, text: label }),
    control,
  ]);
}

function textInput(id: string, label: string): { field: HTMLElement; input: HTMLInputElement } {
  const input = el('input', { type: 'text', class: 'input', id, autocomplete: 'off' }) as HTMLInputElement;
  return { field: wrap(id, label, input), input };
}

function textArea(
  id: string,
  label: string,
  rows: number,
): { field: HTMLElement; input: HTMLTextAreaElement } {
  const input = el('textarea', { class: 'input input--multiline', id, rows: String(rows) }) as HTMLTextAreaElement;
  return { field: wrap(id, label, input), input };
}
