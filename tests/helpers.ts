/** Shared helpers: a clean database per test, and small fixtures. */

import { deleteDatabase, resetDatabaseHandle } from '../src/components/storage/db';
import { createLetter, type LetterRecord } from '../src/components/storage/schema';
import type { StoredAttachment } from '../src/components/storage/attachments-repo';

export async function freshDatabase(): Promise<void> {
  resetDatabaseHandle();
  await deleteDatabase();
  resetDatabaseHandle();
}

export function sampleLetter(overrides: Partial<LetterRecord> = {}): LetterRecord {
  return createLetter({
    title: 'For Nan',
    recipient: 'Nan',
    sender: 'Bee',
    senderLocation: 'Leeds',
    category: 'family',
    body: 'The garden is doing what you said it would.\n\nI thought you should know.',
    tags: ['garden', 'family'],
    ...overrides,
  });
}

/** A one-pixel PNG, byte-for-byte valid, for attachment tests. */
export const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
  0x42, 0x60, 0x82,
]);

export const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);

export function pngBlob(): Blob {
  return new Blob([PNG_BYTES as unknown as BlobPart], { type: 'image/png' });
}

export function sampleAttachment(letterId: string, overrides: Partial<StoredAttachment> = {}): StoredAttachment {
  const blob = pngBlob();
  return {
    id: `img_${Math.random().toString(16).slice(2, 12)}`,
    letterId,
    name: 'photograph',
    type: 'image/png',
    bytes: blob.size,
    width: 1200,
    height: 900,
    caption: 'The greenhouse, still standing',
    role: 'photo',
    createdAt: new Date().toISOString(),
    original: blob,
    preview: blob,
    ...overrides,
  };
}

/** Waits for the microtask/timer queue, for debounce-driven code. */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
