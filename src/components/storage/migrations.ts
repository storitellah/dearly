/**
 * Schema migrations.
 *
 * Rules that must not be broken:
 *  - A record is never deleted because it looks unfamiliar.
 *  - A record from a *newer* schema is returned untouched and flagged, so this
 *    build can display it read-only instead of corrupting it.
 *  - Every migration step is pure and independently testable.
 */

import { documentFromPlainText } from '../document/model';
import {
  CURRENT_SCHEMA_VERSION,
  normaliseLetter,
  type LetterRecord,
  DEFAULT_ENVELOPE,
  DEFAULT_SIGNATURE,
} from './schema';

export interface MigrationOutcome {
  letter: LetterRecord;
  /** True when the stored record was changed and should be written back. */
  changed: boolean;
  /**
   * True when the record was written by a newer version of Dearly. The letter is
   * preserved exactly as found; the interface treats it as read-only.
   */
  fromFuture: boolean;
}

type Step = (raw: Record<string, unknown>) => Record<string, unknown>;

/**
 * v1 → v2: the first public preview stored the letter text in `text`, had no
 * envelope or signature settings, and used `paper` for the stationery id.
 */
const stepV1toV2: Step = (raw) => {
  const next = { ...raw };
  if (typeof next.body !== 'string' && typeof next.text === 'string') {
    next.body = next.text;
  }
  delete next.text;
  if (typeof next.stationeryId !== 'string' && typeof next.paper === 'string') {
    next.stationeryId = next.paper;
  }
  delete next.paper;
  if (next.envelope === undefined) next.envelope = { ...DEFAULT_ENVELOPE };
  if (next.signature === undefined) {
    next.signature = {
      ...DEFAULT_SIGNATURE,
      name: typeof next.sender === 'string' ? next.sender : '',
    };
  }
  if (next.attachments === undefined) next.attachments = [];
  if (next.tags === undefined) next.tags = [];
  next.schemaVersion = 2;
  return next;
};

/**
 * v2 → v3: letters became structured documents. The plain-text body is turned
 * into blocks — greeting, paragraphs, closing, signature — so nothing anyone
 * wrote in an earlier version is lost or flattened, and `body` is kept in step
 * as the plain-text view of the same content.
 */
const stepV2toV3: Step = (raw) => {
  const next = { ...raw };
  if (next.doc === undefined || next.doc === null) {
    const body = typeof next.body === 'string' ? next.body : '';
    const signature = next.signature as { name?: unknown; closing?: unknown } | undefined;
    next.doc = documentFromPlainText(body, {
      recipient: typeof next.recipient === 'string' ? next.recipient : '',
      closing: typeof signature?.closing === 'string' ? signature.closing : '',
      signature: typeof signature?.name === 'string' ? signature.name : '',
      meta: [typeof next.senderLocation === 'string' ? next.senderLocation : '']
        .filter((part) => part.length > 0)
        .join(' · '),
    });
  }
  if (typeof next.templateId !== 'string') next.templateId = 'love-notes';
  if (typeof next.themeId !== 'string') next.themeId = 'bubblegum-pink';
  if (typeof next.paperSize !== 'string') next.paperSize = 'a4';
  next.schemaVersion = 3;
  return next;
};

const STEPS: Record<number, Step> = {
  1: stepV1toV2,
  2: stepV2toV3,
};

export function migrateLetter(input: unknown): MigrationOutcome {
  const raw =
    input !== null && typeof input === 'object'
      ? ({ ...(input as Record<string, unknown>) } as Record<string, unknown>)
      : {};

  const storedVersion =
    typeof raw.schemaVersion === 'number' && Number.isFinite(raw.schemaVersion)
      ? Math.trunc(raw.schemaVersion)
      : 1;

  if (storedVersion > CURRENT_SCHEMA_VERSION) {
    // Preserve, do not rewrite. `normaliseLetter` keeps unknown fields intact.
    return { letter: normaliseLetter(raw), changed: false, fromFuture: true };
  }

  let working = raw;
  let version = storedVersion;
  let changed = false;

  while (version < CURRENT_SCHEMA_VERSION) {
    const step = STEPS[version];
    if (!step) {
      // No path forward: keep the record readable rather than dropping it.
      break;
    }
    working = step(working);
    version += 1;
    changed = true;
  }

  const letter = normaliseLetter({ ...working, schemaVersion: Math.max(version, storedVersion) });
  if (letter.schemaVersion < CURRENT_SCHEMA_VERSION) {
    letter.schemaVersion = CURRENT_SCHEMA_VERSION;
    changed = true;
  }
  return { letter, changed, fromFuture: false };
}

export function needsMigration(input: unknown): boolean {
  if (input === null || typeof input !== 'object') return true;
  const version = (input as { schemaVersion?: unknown }).schemaVersion;
  return typeof version !== 'number' || version !== CURRENT_SCHEMA_VERSION;
}
