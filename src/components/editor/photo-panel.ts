/**
 * Photographs.
 *
 * Images are validated by content, re-encoded locally, stored in IndexedDB and
 * previewed from a small compressed copy. Object URLs are revoked whenever the
 * list is rebuilt, so editing an image-heavy letter does not leak memory.
 */

import { el, clear } from '../utilities/dom';
import { processImage, ImageError, MAX_IMAGE_BYTES } from '../security/image-validate';
import {
  deleteAttachment,
  getAttachmentsForLetter,
  putAttachment,
  toMeta,
} from '../storage/attachments-repo';
import { readQuota, hasHeadroom } from '../storage/quota';
import { formatBytes } from '../utilities/bytes';
import { confirmDialog } from '../accessibility/dialog';
import { announce } from '../accessibility/announce';
import { toast } from '../ui/toast';
import { Disposables, describe } from '../utilities/events';
import type { EditorContext } from './context';

export interface PhotoPanel {
  element: HTMLElement;
  dispose(): void;
}

export function createPhotoPanel(context: EditorContext): PhotoPanel {
  const urls = new Disposables();
  const panel = el('details', { class: 'panel' });
  panel.append(el('summary', { class: 'panel__summary', text: 'Photographs' }));
  const body = el('div', { class: 'panel__body' });

  const input = el('input', {
    type: 'file',
    id: 'photo-input',
    class: 'input input--file',
    accept: 'image/png,image/jpeg,image/webp',
    multiple: true,
  }) as HTMLInputElement;

  const status = el('p', { class: 'field-hint', role: 'status' });
  const list = el('ul', { class: 'photo-list' });

  body.append(
    el('div', { class: 'field' }, [
      el('label', { class: 'label', for: 'photo-input', text: 'Add photographs' }),
      input,
      el('p', {
        class: 'field-hint',
        text:
          `PNG, JPEG or WebP, up to ${Math.round(MAX_IMAGE_BYTES / (1024 * 1024))} MB each. ` +
          'Files are checked by their contents, not their name. SVG files are refused because ' +
          'they can contain scripts. Images stay on this device.',
      }),
    ]),
    status,
    list,
  );
  panel.append(body);

  input.addEventListener('change', () => {
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (files.length > 0) void addFiles(files);
  });

  async function addFiles(files: File[]): Promise<void> {
    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
    const quota = await readQuota();
    if (!hasHeadroom(quota, totalBytes * 1.5)) {
      toast(
        'There is not enough space left on this device for those photographs. Export a backup and free some space first.',
        'error',
      );
      return;
    }

    let added = 0;
    for (const file of files) {
      status.textContent = `Processing ${file.name}…`;
      try {
        const attachment = await processImage(file, {
          letterId: context.letter.id,
          fileName: file.name,
          role: 'photo',
        });
        await putAttachment(attachment);
        added += 1;
      } catch (error) {
        const message =
          error instanceof ImageError
            ? error.message
            : `That image could not be added: ${describe(error)}`;
        toast(message, 'error');
      }
    }

    if (added > 0) {
      await reload();
      announce(`${added} ${added === 1 ? 'photograph' : 'photographs'} added.`);
      toast(`${added} ${added === 1 ? 'photograph' : 'photographs'} added.`, 'success');
    }
    status.textContent = '';
  }

  async function reload(): Promise<void> {
    const attachments = await getAttachmentsForLetter(context.letter.id);
    context.setAttachments(attachments);
    context.update({ attachments: attachments.map(toMeta) }, 'attachments');
    render();
  }

  async function removePhoto(id: string, name: string): Promise<void> {
    const confirmed = await confirmDialog({
      title: 'Remove this photograph?',
      body: [`“${name}” will be removed from this letter and deleted from this device.`],
      confirmLabel: 'Remove',
      danger: true,
    });
    if (!confirmed) return;
    try {
      await deleteAttachment(id);
      await reload();
      toast('The photograph was removed.', 'success');
    } catch (error) {
      toast(`The photograph could not be removed: ${describe(error)}`, 'error');
    }
  }

  function render(): void {
    urls.dispose();
    clear(list);

    const photos = context.attachments.filter((item) => item.role === 'photo');
    if (photos.length === 0) {
      list.append(
        el('li', { class: 'photo-list__empty', text: 'No photographs enclosed with this letter.' }),
      );
      return;
    }

    for (const [index, photo] of photos.entries()) {
      const item = el('li', { class: 'photo-item' });
      const image = el('img', {
        class: 'photo-item__image',
        src: urls.objectUrl(photo.preview),
        alt: photo.caption.trim().length > 0 ? photo.caption : `Photograph ${index + 1}`,
        width: String(photo.width),
        height: String(photo.height),
        loading: 'lazy',
        decoding: 'async',
      });

      const captionId = `caption-${photo.id}`;
      const caption = el('input', {
        type: 'text',
        class: 'input',
        id: captionId,
        value: photo.caption,
        placeholder: 'Caption (printed under the photograph)',
      }) as HTMLInputElement;

      caption.addEventListener('change', () => {
        void (async () => {
          try {
            await putAttachment({ ...photo, caption: caption.value.slice(0, 400) });
            await reload();
          } catch (error) {
            toast(`The caption could not be saved: ${describe(error)}`, 'error');
          }
        })();
      });

      const remove = el('button', {
        type: 'button',
        class: 'button button--danger button--small',
        text: 'Remove',
      });
      remove.addEventListener('click', () => void removePhoto(photo.id, photo.name));

      item.append(
        image,
        el('div', { class: 'photo-item__details' }, [
          el('label', { class: 'label', for: captionId, text: `Caption for photograph ${index + 1}` }),
          caption,
          el('p', {
            class: 'field-hint',
            text: `${photo.width}×${photo.height} · ${formatBytes(photo.bytes)} · print copy kept at full quality`,
          }),
          remove,
        ]),
      );
      list.append(item);
    }
  }

  const syncDisabled = (): void => {
    input.disabled = context.locked;
    if (context.locked) {
      status.textContent = 'This letter is locked. Unlock it to change its photographs.';
    }
  };

  render();
  syncDisabled();
  context.events.on('attachments', () => render());
  context.events.on('change', (event) => {
    if (event.source === 'attachments') return;
    syncDisabled();
  });

  return {
    element: panel,
    dispose(): void {
      urls.dispose();
    },
  };
}
