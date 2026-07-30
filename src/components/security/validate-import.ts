/**
 * Archive validation.
 *
 * An imported `.dearly` file is untrusted input. It is parsed as data, checked
 * against this module's rules, and only then turned into letters. Nothing inside
 * an archive is ever executed, rendered as markup, or written to disk under a
 * name the archive chose.
 */

import { fromBase64, sha256Hex, timingSafeEqual } from '../utilities/bytes';
import { safeFileName } from '../utilities/format';
import { htmlToPlainText, looksExecutable, stripControlCharacters } from './sanitise';
import { detectImageType, MAX_IMAGE_BYTES } from './image-validate';
import {
  CURRENT_SCHEMA_VERSION,
  normaliseLetter,
  stripDangerousKeys,
  type AttachmentMeta,
  type LetterRecord,
} from '../storage/schema';
import { migrateLetter } from '../storage/migrations';

export const ARCHIVE_FORMAT = 'dearly-archive';
export const ARCHIVE_VERSION = 1;
export const ARCHIVE_EXTENSION = '.dearly';
/** Largest archive Dearly will read. Guards against decompression-style abuse. */
export const MAX_ARCHIVE_BYTES = 250 * 1024 * 1024;
/** Largest number of letters accepted in one archive. */
export const MAX_ARCHIVE_LETTERS = 5000;
/** Largest number of images accepted in one archive. */
export const MAX_ARCHIVE_IMAGES = 20_000;

export type RejectionKind =
  | 'too-large'
  | 'empty'
  | 'not-json'
  | 'not-an-archive'
  | 'unsupported-version'
  | 'checksum-mismatch'
  | 'malformed'
  | 'too-many-letters'
  | 'too-many-images'
  | 'executable-content'
  | 'unsafe-mime'
  | 'truncated';

export class ImportError extends Error {
  constructor(
    message: string,
    readonly kind: RejectionKind,
  ) {
    super(message);
    this.name = 'ImportError';
  }
}

export interface ArchiveAttachmentPayload extends AttachmentMeta {
  originalBase64: string;
  previewBase64?: string;
}

export interface ArchivePayload {
  letters: LetterRecord[];
  attachments: ArchiveAttachmentPayload[];
  stationery: string[];
}

export interface ArchiveFile {
  format: typeof ARCHIVE_FORMAT;
  version: number;
  appVersion: string;
  schemaVersion: number;
  kind: 'letter' | 'library';
  exportedAt: string;
  encrypted: boolean;
  checksum?: { algorithm: 'SHA-256'; value: string };
  payload?: ArchivePayload;
  /** Present when `encrypted` is true. */
  envelope?: unknown;
  letterCount: number;
}

export interface ValidatedImport {
  archive: ArchiveFile;
  letters: LetterRecord[];
  attachments: ArchiveAttachmentPayload[];
  /** Non-fatal notes shown to the user, e.g. content that had to be cleaned. */
  warnings: string[];
}

/** File-level checks that do not require parsing. */
export function assertAcceptableArchiveFile(file: { name?: string; size: number; type?: string }): void {
  if (file.size === 0) {
    throw new ImportError('That file is empty.', 'empty');
  }
  if (file.size > MAX_ARCHIVE_BYTES) {
    throw new ImportError(
      `That file is larger than ${Math.round(MAX_ARCHIVE_BYTES / (1024 * 1024))} MB, so Dearly will not open it.`,
      'too-large',
    );
  }
  const name = (file.name ?? '').toLowerCase();
  const allowedExtension =
    name.endsWith(ARCHIVE_EXTENSION) || name.endsWith('.json') || name === '';
  const executableExtension =
    /\.(exe|dll|so|dylib|bat|cmd|com|sh|ps1|scr|msi|apk|jar|app|zip|gz|tar|7z|rar|html?|htm|js|mjs|svg|xml|php)$/i.test(
      name,
    );
  if (executableExtension || !allowedExtension) {
    throw new ImportError(
      `Dearly only opens ${ARCHIVE_EXTENSION} backup files. That file type is refused.`,
      'unsafe-mime',
    );
  }
  const type = (file.type ?? '').toLowerCase();
  const allowedTypes = ['', 'application/json', 'text/plain', 'application/octet-stream'];
  if (!allowedTypes.includes(type)) {
    throw new ImportError(
      `That file claims to be "${type}", which is not a Dearly backup.`,
      'unsafe-mime',
    );
  }
}

/** Parses and validates archive text. Returns letters ready to be stored. */
export async function validateArchiveText(text: string): Promise<ValidatedImport> {
  if (text.trim().length === 0) throw new ImportError('That file is empty.', 'empty');

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ImportError(
      'That file is not a readable Dearly backup — its contents are not valid JSON.',
      'not-json',
    );
  }

  const raw = stripDangerousKeys(parsed);
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new ImportError('That file is not a Dearly backup.', 'not-an-archive');
  }
  const record = raw as Record<string, unknown>;

  if (record.format !== ARCHIVE_FORMAT) {
    throw new ImportError(
      'That file is not a Dearly backup. Look for a file ending in .dearly.',
      'not-an-archive',
    );
  }
  const version = typeof record.version === 'number' ? Math.trunc(record.version) : 0;
  if (version < 1) throw new ImportError('That backup has no version number.', 'malformed');
  if (version > ARCHIVE_VERSION) {
    throw new ImportError(
      `That backup was made by a newer version of Dearly (backup format ${version}). ` +
        'Update Dearly and try again — nothing has been changed.',
      'unsupported-version',
    );
  }

  const archive: ArchiveFile = {
    format: ARCHIVE_FORMAT,
    version,
    appVersion: typeof record.appVersion === 'string' ? record.appVersion.slice(0, 32) : 'unknown',
    schemaVersion:
      typeof record.schemaVersion === 'number'
        ? Math.trunc(record.schemaVersion)
        : CURRENT_SCHEMA_VERSION,
    kind: record.kind === 'letter' ? 'letter' : 'library',
    exportedAt: typeof record.exportedAt === 'string' ? record.exportedAt : '',
    encrypted: record.encrypted === true,
    letterCount: typeof record.letterCount === 'number' ? Math.trunc(record.letterCount) : 0,
  };

  if (archive.encrypted) {
    if (record.envelope === null || typeof record.envelope !== 'object') {
      throw new ImportError('That encrypted backup is missing its encrypted payload.', 'truncated');
    }
    archive.envelope = record.envelope;
    return { archive, letters: [], attachments: [], warnings: [] };
  }

  if (record.payload === null || typeof record.payload !== 'object') {
    throw new ImportError('That backup contains no letters.', 'truncated');
  }

  // Checksum is computed over the canonical JSON of `payload`.
  const payloadJson = JSON.stringify(record.payload);
  const checksum = record.checksum as { algorithm?: unknown; value?: unknown } | undefined;
  if (checksum && typeof checksum.value === 'string') {
    if (checksum.algorithm !== 'SHA-256') {
      throw new ImportError('That backup uses a checksum Dearly cannot verify.', 'malformed');
    }
    const actual = await sha256Hex(payloadJson);
    if (!timingSafeEqual(actual, checksum.value.toLowerCase())) {
      throw new ImportError(
        'That backup failed its checksum, which means the file is damaged or was changed after export. Nothing has been imported.',
        'checksum-mismatch',
      );
    }
    archive.checksum = { algorithm: 'SHA-256', value: checksum.value.toLowerCase() };
  }

  const payload = record.payload as Record<string, unknown>;
  const rawLetters = Array.isArray(payload.letters) ? payload.letters : null;
  if (!rawLetters) throw new ImportError('That backup contains no letters.', 'truncated');
  if (rawLetters.length > MAX_ARCHIVE_LETTERS) {
    throw new ImportError(
      `That backup declares ${rawLetters.length} letters, which is beyond what Dearly will import at once.`,
      'too-many-letters',
    );
  }

  const rawAttachments = Array.isArray(payload.attachments) ? payload.attachments : [];
  if (rawAttachments.length > MAX_ARCHIVE_IMAGES) {
    throw new ImportError(
      'That backup declares more images than Dearly will import at once.',
      'too-many-images',
    );
  }

  const warnings: string[] = [];
  const letters: LetterRecord[] = [];

  for (const item of rawLetters) {
    const migrated = migrateLetter(item);
    const letter = migrated.letter;

    // Letter text is stored and rendered as plain text. If the archive smuggled
    // markup into it, the markup is removed rather than trusted.
    if (looksExecutable(letter.body)) {
      letter.body = htmlToPlainText(letter.body);
      warnings.push(`HTML was removed from “${letter.title || 'an untitled letter'}”.`);
    }
    letter.body = stripControlCharacters(letter.body);
    letter.title = stripControlCharacters(letter.title);

    for (const field of ['recipient', 'sender', 'senderLocation'] as const) {
      if (looksExecutable(letter[field])) {
        letter[field] = htmlToPlainText(letter[field]);
        warnings.push('Markup was removed from an address field.');
      }
    }

    if (migrated.fromFuture) {
      warnings.push(
        `“${letter.title || 'An untitled letter'}” was written by a newer version of Dearly and has been imported unchanged.`,
      );
    }
    letters.push(normaliseLetter(letter));
  }

  const letterIds = new Set(letters.map((letter) => letter.id));
  const attachments: ArchiveAttachmentPayload[] = [];

  for (const item of rawAttachments) {
    if (item === null || typeof item !== 'object') continue;
    const entry = item as Record<string, unknown>;
    const letterId = typeof entry.letterId === 'string' ? entry.letterId : '';
    if (!letterIds.has(letterId)) {
      warnings.push('An image referring to a letter that is not in this backup was skipped.');
      continue;
    }
    const originalBase64 = typeof entry.originalBase64 === 'string' ? entry.originalBase64 : '';
    if (originalBase64.length === 0) continue;

    let bytes: Uint8Array;
    try {
      bytes = fromBase64(originalBase64.slice(0, 4096));
    } catch {
      warnings.push('An image in the backup was not valid base64 data and was skipped.');
      continue;
    }
    const detected = detectImageType(bytes);
    if (detected === null || detected === 'image/svg+xml') {
      warnings.push(
        detected === 'image/svg+xml'
          ? 'An SVG image in the backup was refused, because SVG files can contain scripts.'
          : 'A file in the backup was not a PNG, JPEG or WebP image and was skipped.',
      );
      continue;
    }
    // Approximate decoded size from the base64 length: 4 characters → 3 bytes.
    const approximateBytes = Math.floor((originalBase64.length * 3) / 4);
    if (approximateBytes > MAX_IMAGE_BYTES) {
      warnings.push('An oversized image in the backup was skipped.');
      continue;
    }

    attachments.push({
      id: typeof entry.id === 'string' && entry.id.length > 0 ? entry.id : `img_${letterId}`,
      letterId,
      // Path traversal, absolute paths and control characters cannot survive this.
      name: safeFileName(typeof entry.name === 'string' ? entry.name : 'photograph', 'photograph'),
      type: detected,
      bytes: approximateBytes,
      width: toPositiveInt(entry.width),
      height: toPositiveInt(entry.height),
      caption: stripControlCharacters(
        typeof entry.caption === 'string' ? entry.caption.slice(0, 400) : '',
      ),
      role: entry.role === 'signature' ? 'signature' : 'photo',
      createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : new Date().toISOString(),
      originalBase64,
      previewBase64: typeof entry.previewBase64 === 'string' ? entry.previewBase64 : undefined,
    });
  }

  archive.payload = {
    letters,
    attachments,
    stationery: Array.isArray(payload.stationery)
      ? payload.stationery.filter((id): id is string => typeof id === 'string').slice(0, 64)
      : [],
  };
  archive.letterCount = letters.length;

  return { archive, letters, attachments, warnings };
}

function toPositiveInt(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.min(20000, Math.trunc(value))
    : 0;
}
