/**
 * The `.dearly` backup format.
 *
 * A backup is a single JSON text file, which means it can be inspected, diffed,
 * stored anywhere and read by a future version of this code — or by hand, if
 * Dearly ever disappears. Images travel base64-encoded inside it.
 *
 * Structure:
 *   {
 *     "format": "dearly-archive",
 *     "version": 1,
 *     "appVersion": "1.0.0",
 *     "schemaVersion": 2,
 *     "kind": "letter" | "library",
 *     "exportedAt": "2026-01-01T12:00:00.000Z",
 *     "encrypted": false,
 *     "letterCount": 3,
 *     "checksum": { "algorithm": "SHA-256", "value": "…" },
 *     "payload": { "letters": [...], "attachments": [...], "stationery": [...] }
 *   }
 *
 * When encrypted, `payload` is absent and `envelope` holds the AES-GCM envelope
 * described in `src/components/security/crypto.ts`; the checksum is computed over
 * the plaintext payload before encryption, and verified after decryption.
 */

import { sha256Hex } from '../utilities/bytes';
import { blobToBase64 } from '../utilities/bytes';
import { encryptString, decryptString } from '../security/crypto';
import {
  ARCHIVE_FORMAT,
  ARCHIVE_VERSION,
  ImportError,
  validateArchiveText,
  type ArchiveAttachmentPayload,
  type ValidatedImport,
} from '../security/validate-import';
import { CURRENT_SCHEMA_VERSION, type LetterRecord } from '../storage/schema';
import type { StoredAttachment } from '../storage/attachments-repo';
import { appVersion } from '../utilities/assets';

export interface BuildArchiveInput {
  letters: LetterRecord[];
  attachments: StoredAttachment[];
  kind: 'letter' | 'library';
  /** When set, the payload is encrypted with this password. */
  password?: string;
}

export interface BuiltArchive {
  blob: Blob;
  json: string;
  letterCount: number;
  encrypted: boolean;
  checksum: string;
}

async function encodeAttachments(
  attachments: StoredAttachment[],
): Promise<ArchiveAttachmentPayload[]> {
  const out: ArchiveAttachmentPayload[] = [];
  for (const attachment of attachments) {
    out.push({
      id: attachment.id,
      letterId: attachment.letterId,
      name: attachment.name,
      type: attachment.type,
      bytes: attachment.bytes,
      width: attachment.width,
      height: attachment.height,
      caption: attachment.caption,
      role: attachment.role,
      createdAt: attachment.createdAt,
      originalBase64: await blobToBase64(attachment.original),
      previewBase64: await blobToBase64(attachment.preview),
    });
  }
  return out;
}

export async function buildArchive(input: BuildArchiveInput): Promise<BuiltArchive> {
  const payload = {
    letters: input.letters,
    attachments: await encodeAttachments(input.attachments),
    stationery: [...new Set(input.letters.map((letter) => letter.stationeryId))],
  };
  const payloadJson = JSON.stringify(payload);
  const checksum = await sha256Hex(payloadJson);

  const header = {
    format: ARCHIVE_FORMAT,
    version: ARCHIVE_VERSION,
    appVersion,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    kind: input.kind,
    exportedAt: new Date().toISOString(),
    letterCount: input.letters.length,
    checksum: { algorithm: 'SHA-256' as const, value: checksum },
  };

  const file =
    input.password && input.password.length > 0
      ? {
          ...header,
          encrypted: true as const,
          envelope: await encryptString(payloadJson, input.password),
        }
      : { ...header, encrypted: false as const, payload };

  const json = `${JSON.stringify(file, null, 2)}\n`;
  return {
    blob: new Blob([json], { type: 'application/json' }),
    json,
    letterCount: input.letters.length,
    encrypted: Boolean(input.password && input.password.length > 0),
    checksum,
  };
}

export interface OpenArchiveResult extends ValidatedImport {
  /** True when the archive was encrypted and has now been decrypted. */
  wasEncrypted: boolean;
}

/**
 * Reads archive text, decrypting it when a password is supplied. Validation runs
 * on the decrypted payload too, so an encrypted archive gets exactly the same
 * scrutiny as a plain one.
 */
export async function openArchive(
  text: string,
  password?: string,
): Promise<OpenArchiveResult> {
  const first = await validateArchiveText(text);
  if (!first.archive.encrypted) return { ...first, wasEncrypted: false };

  if (!password || password.length === 0) {
    throw new ImportError(
      'This backup is encrypted. Enter its password to continue.',
      'malformed',
    );
  }

  const payloadJson = await decryptString(first.archive.envelope, password);

  const expected = first.archive.checksum?.value;
  if (expected) {
    const actual = await sha256Hex(payloadJson);
    if (actual !== expected) {
      throw new ImportError(
        'This backup decrypted, but its checksum does not match, so the file is damaged. Nothing has been imported.',
        'checksum-mismatch',
      );
    }
  }

  // Re-wrap the decrypted payload and run it through the same validator.
  const rewrapped = JSON.stringify({
    format: ARCHIVE_FORMAT,
    version: first.archive.version,
    appVersion: first.archive.appVersion,
    schemaVersion: first.archive.schemaVersion,
    kind: first.archive.kind,
    exportedAt: first.archive.exportedAt,
    encrypted: false,
    letterCount: first.archive.letterCount,
    checksum: first.archive.checksum,
    payload: JSON.parse(payloadJson),
  });

  const second = await validateArchiveText(rewrapped);
  return { ...second, wasEncrypted: true };
}

export function archiveFileName(kind: 'letter' | 'library', label: string): string {
  const date = new Date().toISOString().slice(0, 10);
  return kind === 'letter' ? `${label}-${date}.dearly` : `dearly-library-${date}.dearly`;
}
