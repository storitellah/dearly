/**
 * Attachment storage.
 *
 * Image bytes are kept apart from letter records so listing a large memory box
 * never pulls full-resolution photographs into memory. Two representations are
 * stored per photograph: a compressed preview for the screen, and the print
 * original at a sensible ceiling.
 *
 * On disk the bytes are stored as `ArrayBuffer`, not `Blob`. Blobs in IndexedDB
 * have a long history of engine-specific bugs (older WebKit in particular), and
 * an ArrayBuffer round-trips identically everywhere. The public API still deals
 * in Blobs, so callers never see the difference.
 */

import { STORE_ATTACHMENTS, requestToPromise, withTransaction } from './db';
import type { AttachmentMeta } from './schema';

export interface StoredAttachment extends AttachmentMeta {
  /** Print-quality image. */
  original: Blob;
  /** Small image used for on-screen previews. */
  preview: Blob;
}

interface AttachmentRow extends AttachmentMeta {
  originalData: ArrayBuffer;
  previewData: ArrayBuffer;
  mimeType: string;
}

async function toRow(attachment: StoredAttachment): Promise<AttachmentRow> {
  const { original, preview, ...meta } = attachment;
  return {
    ...meta,
    originalData: await original.arrayBuffer(),
    previewData: await preview.arrayBuffer(),
    mimeType: original.type || attachment.type,
  };
}

function fromRow(row: AttachmentRow): StoredAttachment {
  const { originalData, previewData, mimeType, ...meta } = row;
  const type = mimeType || meta.type;
  return {
    ...meta,
    original: new Blob([originalData], { type }),
    preview: new Blob([previewData], { type }),
  };
}

export async function putAttachment(attachment: StoredAttachment): Promise<void> {
  const row = await toRow(attachment);
  await withTransaction(STORE_ATTACHMENTS, 'readwrite', async (tx) => {
    await requestToPromise(tx.objectStore(STORE_ATTACHMENTS).put(row));
  });
}

export async function getAttachment(id: string): Promise<StoredAttachment | null> {
  const row = await withTransaction(STORE_ATTACHMENTS, 'readonly', async (tx) =>
    requestToPromise(
      tx.objectStore(STORE_ATTACHMENTS).get(id) as IDBRequest<AttachmentRow | undefined>,
    ),
  );
  return row ? fromRow(row) : null;
}

export async function getAttachmentsForLetter(letterId: string): Promise<StoredAttachment[]> {
  const rows = await withTransaction(STORE_ATTACHMENTS, 'readonly', async (tx) =>
    requestToPromise(
      tx.objectStore(STORE_ATTACHMENTS).index('letterId').getAll(letterId) as IDBRequest<
        AttachmentRow[]
      >,
    ),
  );
  return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map(fromRow);
}

export async function deleteAttachment(id: string): Promise<void> {
  await withTransaction(STORE_ATTACHMENTS, 'readwrite', async (tx) => {
    await requestToPromise(tx.objectStore(STORE_ATTACHMENTS).delete(id));
  });
}

export async function deleteAttachmentsForLetter(letterId: string): Promise<void> {
  const ids = await withTransaction(STORE_ATTACHMENTS, 'readonly', async (tx) =>
    requestToPromise(
      tx.objectStore(STORE_ATTACHMENTS).index('letterId').getAllKeys(letterId) as IDBRequest<
        IDBValidKey[]
      >,
    ),
  );
  if (ids.length === 0) return;
  await withTransaction(STORE_ATTACHMENTS, 'readwrite', async (tx) => {
    const store = tx.objectStore(STORE_ATTACHMENTS);
    for (const id of ids) await requestToPromise(store.delete(id));
  });
}

export function toMeta(attachment: StoredAttachment): AttachmentMeta {
  const { original: _original, preview: _preview, ...meta } = attachment;
  return meta;
}
