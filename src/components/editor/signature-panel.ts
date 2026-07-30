/**
 * Signature: typed, script, or drawn with a finger, stylus or mouse.
 *
 * A drawn signature is captured on a canvas and stored as a PNG attachment on
 * this device. It is treated as personal data throughout: it is included in the
 * encrypted payload when a letter is locked, and never uploaded.
 */

import { el, clear } from '../utilities/dom';
import { createId } from '../utilities/id';
import {
  deleteAttachment,
  getAttachmentsForLetter,
  putAttachment,
  toMeta,
} from '../storage/attachments-repo';
import { announce } from '../accessibility/announce';
import { toast } from '../ui/toast';
import { Disposables, describe } from '../utilities/events';
import type { EditorContext } from './context';

export interface SignaturePanel {
  element: HTMLElement;
  dispose(): void;
}

const PAD_WIDTH = 560;
const PAD_HEIGHT = 180;

export function createSignaturePanel(context: EditorContext): SignaturePanel {
  const disposables = new Disposables();
  const urls = new Disposables();

  const panel = el('details', { class: 'panel' });
  panel.append(el('summary', { class: 'panel__summary', text: 'Signature and closing' }));
  const body = el('div', { class: 'panel__body' });

  const closing = el('input', {
    type: 'text',
    class: 'input',
    id: 'signature-closing',
    placeholder: 'With love,',
  }) as HTMLInputElement;

  const name = el('input', {
    type: 'text',
    class: 'input',
    id: 'signature-name',
    autocomplete: 'name',
  }) as HTMLInputElement;

  const style = el('select', { class: 'input', id: 'signature-style' }) as HTMLSelectElement;
  style.append(
    el('option', { value: 'typed', text: 'Typed' }),
    el('option', { value: 'script', text: 'Typed, italic' }),
    el('option', { value: 'drawn', text: 'Drawn by hand' }),
  );

  const padWrap = el('div', { class: 'signature-pad', hidden: true });
  const canvas = el('canvas', {
    class: 'signature-pad__canvas',
    width: String(PAD_WIDTH),
    height: String(PAD_HEIGHT),
    'aria-label': 'Signature drawing area. Draw with a finger, stylus or mouse.',
    role: 'img',
    tabindex: '0',
  }) as HTMLCanvasElement;

  const padActions = el('div', { class: 'signature-pad__actions' });
  const clearButton = el('button', { type: 'button', class: 'button button--quiet button--small', text: 'Clear' });
  const saveButton = el('button', { type: 'button', class: 'button button--primary button--small', text: 'Use this signature' });
  const removeButton = el('button', { type: 'button', class: 'button button--danger button--small', text: 'Remove drawn signature' });
  padActions.append(clearButton, saveButton, removeButton);

  const existing = el('div', { class: 'signature-existing' });

  padWrap.append(
    canvas,
    el('p', {
      class: 'field-hint',
      text:
        'Drawn signatures are stored on this device as an image. If you cannot draw comfortably, ' +
        'choose Typed or Typed, italic instead — the printed letter reads the same.',
    }),
    padActions,
    existing,
  );

  body.append(
    el('div', { class: 'field-grid' }, [
      el('div', { class: 'field' }, [
        el('label', { class: 'label', for: 'signature-closing', text: 'Closing line' }),
        closing,
      ]),
      el('div', { class: 'field' }, [
        el('label', { class: 'label', for: 'signature-name', text: 'Signed' }),
        name,
      ]),
      el('div', { class: 'field' }, [
        el('label', { class: 'label', for: 'signature-style', text: 'Signature style' }),
        style,
      ]),
    ]),
    padWrap,
  );
  panel.append(body);

  /* Drawing --------------------------------------------------------------- */

  const context2d = canvas.getContext('2d');
  let drawing = false;
  let hasInk = false;

  const resetPad = (): void => {
    if (!context2d) return;
    context2d.fillStyle = '#ffffff';
    context2d.fillRect(0, 0, canvas.width, canvas.height);
    context2d.strokeStyle = context.letter.typography.colour;
    context2d.lineWidth = 2.4;
    context2d.lineCap = 'round';
    context2d.lineJoin = 'round';
    hasInk = false;
  };

  const pointFrom = (event: PointerEvent): { x: number; y: number } => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  disposables.listen(canvas, 'pointerdown', (event) => {
    if (!context2d) return;
    const pointer = event as PointerEvent;
    drawing = true;
    canvas.setPointerCapture(pointer.pointerId);
    const point = pointFrom(pointer);
    context2d.beginPath();
    context2d.moveTo(point.x, point.y);
    event.preventDefault();
  });

  disposables.listen(canvas, 'pointermove', (event) => {
    if (!drawing || !context2d) return;
    const point = pointFrom(event as PointerEvent);
    context2d.lineTo(point.x, point.y);
    context2d.stroke();
    hasInk = true;
  });

  const endStroke = (): void => {
    drawing = false;
  };
  disposables.listen(canvas, 'pointerup', endStroke);
  disposables.listen(canvas, 'pointercancel', endStroke);
  disposables.listen(canvas, 'pointerleave', endStroke);

  clearButton.addEventListener('click', () => {
    resetPad();
    announce('Signature area cleared.');
  });

  saveButton.addEventListener('click', () => {
    void saveDrawnSignature();
  });

  removeButton.addEventListener('click', () => {
    void removeDrawnSignature();
  });

  async function saveDrawnSignature(): Promise<void> {
    if (!hasInk) {
      toast('Draw your signature first.', 'warning');
      return;
    }
    try {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((value) => resolve(value), 'image/png'),
      );
      if (!blob) throw new Error('The signature could not be captured.');

      const previous = context.letter.signature.attachmentId;
      const id = createId('sig');
      await putAttachment({
        id,
        letterId: context.letter.id,
        name: 'signature',
        type: 'image/png',
        bytes: blob.size,
        width: canvas.width,
        height: canvas.height,
        caption: '',
        role: 'signature',
        createdAt: new Date().toISOString(),
        original: blob,
        preview: blob,
      });
      if (previous) await deleteAttachment(previous).catch(() => undefined);

      const attachments = await getAttachmentsForLetter(context.letter.id);
      context.setAttachments(attachments);
      context.update(
        {
          attachments: attachments.map(toMeta),
          signature: { ...context.letter.signature, style: 'drawn', attachmentId: id },
        },
        'signature',
      );
      renderExisting();
      toast('Signature saved to this device.', 'success');
    } catch (error) {
      toast(`The signature could not be saved: ${describe(error)}`, 'error');
    }
  }

  async function removeDrawnSignature(): Promise<void> {
    const id = context.letter.signature.attachmentId;
    if (!id) return;
    try {
      await deleteAttachment(id);
      const attachments = await getAttachmentsForLetter(context.letter.id);
      context.setAttachments(attachments);
      context.update(
        {
          attachments: attachments.map(toMeta),
          signature: { ...context.letter.signature, style: 'typed', attachmentId: null },
        },
        'signature',
      );
      style.value = 'typed';
      renderExisting();
      toast('Drawn signature removed.', 'success');
    } catch (error) {
      toast(`The signature could not be removed: ${describe(error)}`, 'error');
    }
  }

  function renderExisting(): void {
    urls.dispose();
    clear(existing);
    const id = context.letter.signature.attachmentId;
    const attachment = id ? context.attachments.find((item) => item.id === id) : undefined;
    removeButton.hidden = !attachment;
    if (!attachment) return;
    existing.append(
      el('p', { class: 'label', text: 'Saved signature' }),
      el('img', {
        class: 'signature-existing__image',
        src: urls.objectUrl(attachment.preview),
        alt: 'Your saved handwritten signature',
        width: String(attachment.width),
        height: String(attachment.height),
      }),
    );
  }

  /* Wiring ---------------------------------------------------------------- */

  closing.addEventListener('input', () => {
    context.update(
      { signature: { ...context.letter.signature, closing: closing.value } },
      'signature',
    );
  });
  name.addEventListener('input', () => {
    context.update({ signature: { ...context.letter.signature, name: name.value } }, 'signature');
  });
  style.addEventListener('change', () => {
    const value = style.value as 'typed' | 'script' | 'drawn';
    padWrap.hidden = value !== 'drawn';
    context.update({ signature: { ...context.letter.signature, style: value } }, 'signature');
  });

  const sync = (): void => {
    const signature = context.letter.signature;
    closing.value = signature.closing;
    name.value = signature.name;
    style.value = signature.style;
    padWrap.hidden = signature.style !== 'drawn';
    for (const control of [closing, name, style]) control.disabled = context.locked;
    for (const button of [clearButton, saveButton, removeButton]) button.disabled = context.locked;
    renderExisting();
  };

  resetPad();
  sync();
  context.events.on('change', (event) => {
    if (event.source === 'signature') return;
    sync();
  });
  context.events.on('attachments', () => renderExisting());

  return {
    element: panel,
    dispose(): void {
      disposables.dispose();
      urls.dispose();
    },
  };
}
