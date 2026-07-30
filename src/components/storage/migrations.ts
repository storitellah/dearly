/**
 * Schema migrations.
 *
 * Rules that must not be broken:
 *  - A record is never deleted because it looks unfamiliar.
 *  - A record from a *newer* schema is returned untouched and flagged, so this
 *    build can display it read-only instead of corrupting it.
 *  - Every migration step is pure and independently testable.
 */

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

const STEPS: Record<number, Step> = {
  1: stepV1toV2,
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
