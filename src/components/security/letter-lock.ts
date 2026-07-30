/**
 * Locking and unlocking individual letters.
 *
 * A locked letter keeps only what the library needs to show a card: its id,
 * title, category, status, timestamps and print counters. Everything else — body,
 * recipient, sender, location, tags, signature and the photographs themselves —
 * is moved inside an AES-GCM envelope, and the plaintext copies are removed from
 * IndexedDB in the same operation.
 */

import { decryptString, encryptString, type CryptoEnvelope } from './crypto';
import type { AttachmentMeta, LetterRecord, LockedPayload } from '../storage/schema';
import { normaliseLetter } from '../storage/schema';
import {
  deleteAttachmentsForLetter,
  getAttachmentsForLetter,
  putAttachment,
  type StoredAttachment,
} from '../storage/attachments-repo';
import { base64ToBlob, blobToBase64 } from '../utilities/bytes';

interface LockedContents {
  version: 1;
  body: string;
  recipient: string;
  sender: string;
  senderLocation: string;
  tags: string[];
  signature: LetterRecord['signature'];
  envelope: LetterRecord['envelope'];
  attachments: Array<
    AttachmentMeta & { originalBase64: string; previewBase64: string }
  >;
}

function toPayload(envelope: CryptoEnvelope, attachmentCount: number): LockedPayload {
  return {
    version: 1,
    algorithm: 'AES-GCM',
    keyDerivation: 'PBKDF2-SHA256',
    iterations: envelope.iterations,
    saltBase64: envelope.saltBase64,
    ivBase64: envelope.ivBase64,
    cipherTextBase64: envelope.cipherTextBase64,
    attachmentCount,
  };
}

function toEnvelope(payload: LockedPayload): CryptoEnvelope {
  return {
    version: payload.version,
    algorithm: payload.algorithm,
    keyDerivation: payload.keyDerivation,
    iterations: payload.iterations,
    saltBase64: payload.saltBase64,
    ivBase64: payload.ivBase64,
    cipherTextBase64: payload.cipherTextBase64,
  };
}

/**
 * Returns the locked letter record. The caller persists it; attachments are
 * removed from storage here, after the ciphertext has been produced.
 */
export async function lockLetter(
  letter: LetterRecord,
  password: string,
  attachments?: StoredAttachment[],
): Promise<LetterRecord> {
  if (letter.locked) return letter;
  const stored = attachments ?? (await getAttachmentsForLetter(letter.id));

  const contents: LockedContents = {
    version: 1,
    body: letter.body,
    recipient: letter.recipient,
    sender: letter.sender,
    senderLocation: letter.senderLocation,
    tags: letter.tags,
    signature: letter.signature,
    envelope: letter.envelope,
    attachments: await Promise.all(
      stored.map(async (item) => ({
        id: item.id,
        letterId: item.letterId,
        name: item.name,
        type: item.type,
        bytes: item.bytes,
        width: item.width,
        height: item.height,
        caption: item.caption,
        role: item.role,
        createdAt: item.createdAt,
        originalBase64: await blobToBase64(item.original),
        previewBase64: await blobToBase64(item.preview),
      })),
    ),
  };

  const envelope = await encryptString(JSON.stringify(contents), password);

  // Only once the ciphertext exists do we drop the plaintext copies.
  await deleteAttachmentsForLetter(letter.id);

  return {
    ...letter,
    body: '',
    recipient: '',
    sender: '',
    senderLocation: '',
    tags: [],
    attachments: [],
    signature: { name: '', style: 'typed', attachmentId: null, closing: '' },
    envelope: {
      ...letter.envelope,
      recipientName: '',
      recipientAddress: '',
      senderName: '',
      senderAddress: '',
      stampNote: '',
    },
    locked: toPayload(envelope, stored.length),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Decrypts a locked letter and restores its photographs to the attachment store.
 * Throws `CryptoError` with kind `wrong-password` when the password is wrong.
 */
export async function unlockLetter(
  letter: LetterRecord,
  password: string,
): Promise<LetterRecord> {
  if (!letter.locked) return letter;
  const json = await decryptString(toEnvelope(letter.locked), password);

  let contents: LockedContents;
  try {
    contents = JSON.parse(json) as LockedContents;
  } catch {
    throw new Error('The letter was decrypted but its contents are damaged.');
  }

  const attachments: AttachmentMeta[] = [];
  for (const item of contents.attachments ?? []) {
    const meta: AttachmentMeta = {
      id: item.id,
      letterId: letter.id,
      name: item.name,
      type: item.type,
      bytes: item.bytes,
      width: item.width,
      height: item.height,
      caption: item.caption,
      role: item.role,
      createdAt: item.createdAt,
    };
    await putAttachment({
      ...meta,
      original: base64ToBlob(item.originalBase64, item.type),
      preview: base64ToBlob(item.previewBase64, item.type),
    });
    attachments.push(meta);
  }

  return normaliseLetter({
    ...letter,
    body: contents.body ?? '',
    recipient: contents.recipient ?? '',
    sender: contents.sender ?? '',
    senderLocation: contents.senderLocation ?? '',
    tags: contents.tags ?? [],
    signature: contents.signature ?? letter.signature,
    envelope: contents.envelope ?? letter.envelope,
    attachments,
    locked: null,
    updatedAt: new Date().toISOString(),
  });
}

/** Verifies a password without changing anything. */
export async function canUnlock(letter: LetterRecord, password: string): Promise<boolean> {
  if (!letter.locked) return true;
  try {
    await decryptString(toEnvelope(letter.locked), password);
    return true;
  } catch {
    return false;
  }
}
