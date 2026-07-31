/**
 * The local data model.
 *
 * Every letter carries the schema version it was written with. Reading a record
 * always goes through `migrateLetter`, so letters written by older versions of
 * Dearly stay usable, and records this build does not understand are preserved
 * untouched rather than deleted.
 */

import { createId } from '../utilities/id';
import { isoDate } from '../utilities/format';
import { emptyDocument, normaliseDocument, type LetterDocument } from '../document/model';

/** Bump when the shape of a stored letter changes, and add a migration step. */
export const CURRENT_SCHEMA_VERSION = 3;

export const LETTER_CATEGORIES = [
  'love',
  'family',
  'friendship',
  'gratitude',
  'apology',
  'milestone',
  'future-self',
  'farewell',
  'everyday',
  'other',
] as const;
export type LetterCategory = (typeof LETTER_CATEGORIES)[number];

export const LETTER_STATUSES = ['draft', 'ready', 'printed', 'sent', 'kept', 'archived'] as const;
export type LetterStatus = (typeof LETTER_STATUSES)[number];

export const PAPER_SIZES = ['a4', 'letter', 'a5'] as const;
export type PaperSize = (typeof PAPER_SIZES)[number];

export interface TypographySettings {
  /** Font family key from src/components/stationery/typography.ts. */
  family: string;
  /** Body size in points, so print output is predictable. */
  sizePt: number;
  lineHeight: number;
  /** Paragraph indent in millimetres. */
  indentMm: number;
  align: 'left' | 'justify';
  colour: string;
}

export interface EnvelopeSettings {
  enabled: boolean;
  size: 'dl' | 'c5' | 'c6' | 'us-10';
  recipientName: string;
  recipientAddress: string;
  senderName: string;
  senderAddress: string;
  stampNote: string;
  sealStyle: 'none' | 'wax' | 'sticker' | 'ribbon';
  sealColour: string;
}

export interface SignatureSettings {
  name: string;
  style: 'typed' | 'script' | 'drawn';
  /** Attachment id of a drawn signature, when `style` is `drawn`. */
  attachmentId: string | null;
  closing: string;
}

export interface AttachmentMeta {
  id: string;
  letterId: string;
  /** Original file name, already reduced to a safe form. */
  name: string;
  type: 'image/png' | 'image/jpeg' | 'image/webp';
  bytes: number;
  width: number;
  height: number;
  caption: string;
  /** `photo` prints inside the letter, `signature` is drawn near the closing. */
  role: 'photo' | 'signature';
  createdAt: string;
}

export interface LockedPayload {
  /** Envelope format version, independent of the letter schema version. */
  version: 1;
  algorithm: 'AES-GCM';
  keyDerivation: 'PBKDF2-SHA256';
  iterations: number;
  saltBase64: string;
  ivBase64: string;
  cipherTextBase64: string;
  /** Set when the letter also had photographs locked away with it. */
  attachmentCount: number;
}

export interface LetterRecord {
  id: string;
  schemaVersion: number;
  title: string;
  recipient: string;
  sender: string;
  senderLocation: string;
  dateWritten: string;
  sendingDate: string | null;
  openingDate: string | null;
  category: LetterCategory;
  status: LetterStatus;
  body: string;
  /**
   * The structured letter, introduced in schema 3. `body` is kept in step with
   * it as plain text so search, previews and plain-text export stay cheap.
   */
  doc: LetterDocument;
  /** Template, theme and paper the letter is designed with. */
  templateId: string;
  themeId: string;
  paperSize: string;
  stationeryId: string;
  typography: TypographySettings;
  envelope: EnvelopeSettings;
  /** Metadata only. Image bytes live in the `attachments` store. */
  attachments: AttachmentMeta[];
  tags: string[];
  signature: SignatureSettings;
  createdAt: string;
  updatedAt: string;
  printedAt: string | null;
  printCount: number;
  sealed: boolean;
  /**
   * Present when the letter is locked. While locked, `body`, `recipient`,
   * `sender`, `senderLocation`, `tags` and the envelope addresses are cleared
   * from the record and live only inside `locked.cipherTextBase64`.
   */
  locked: LockedPayload | null;
  /** Free-form future fields from a newer build are preserved here. */
  unknownFields?: Record<string, unknown>;
}

export interface LetterSnapshot {
  id: string;
  letterId: string;
  createdAt: string;
  reason: 'autosave' | 'manual' | 'pre-import' | 'pre-lock' | 'crash-recovery';
  wordCount: number;
  /** The letter as it was, minus attachment bytes. */
  letter: LetterRecord;
}

export const DEFAULT_TYPOGRAPHY: TypographySettings = {
  family: 'literata',
  sizePt: 11.5,
  lineHeight: 1.65,
  indentMm: 0,
  align: 'left',
  colour: '#2b2118',
};

export const DEFAULT_ENVELOPE: EnvelopeSettings = {
  enabled: false,
  size: 'dl',
  recipientName: '',
  recipientAddress: '',
  senderName: '',
  senderAddress: '',
  stampNote: '',
  sealStyle: 'none',
  sealColour: '#8c2f39',
};

export const DEFAULT_SIGNATURE: SignatureSettings = {
  name: '',
  style: 'typed',
  attachmentId: null,
  closing: 'With love,',
};

export function createLetter(partial: Partial<LetterRecord> = {}): LetterRecord {
  const now = new Date().toISOString();
  return {
    id: partial.id ?? createId('ltr'),
    schemaVersion: CURRENT_SCHEMA_VERSION,
    title: partial.title ?? '',
    recipient: partial.recipient ?? '',
    sender: partial.sender ?? '',
    senderLocation: partial.senderLocation ?? '',
    dateWritten: partial.dateWritten ?? isoDate(),
    sendingDate: partial.sendingDate ?? null,
    openingDate: partial.openingDate ?? null,
    category: partial.category ?? 'everyday',
    status: partial.status ?? 'draft',
    body: partial.body ?? '',
    doc: partial.doc ?? emptyDocument(),
    templateId: partial.templateId ?? 'love-notes',
    themeId: partial.themeId ?? 'bubblegum-pink',
    paperSize: partial.paperSize ?? 'a4',
    stationeryId: partial.stationeryId ?? 'ivory-laid',
    typography: { ...DEFAULT_TYPOGRAPHY, ...partial.typography },
    envelope: { ...DEFAULT_ENVELOPE, ...partial.envelope },
    attachments: partial.attachments ? [...partial.attachments] : [],
    tags: partial.tags ? [...partial.tags] : [],
    signature: { ...DEFAULT_SIGNATURE, ...partial.signature },
    createdAt: partial.createdAt ?? now,
    updatedAt: partial.updatedAt ?? now,
    printedAt: partial.printedAt ?? null,
    printCount: partial.printCount ?? 0,
    sealed: partial.sealed ?? false,
    locked: partial.locked ?? null,
  };
}

export function isLetterLocked(letter: LetterRecord): boolean {
  return letter.locked !== null && typeof letter.locked === 'object';
}

/* -------------------------------------------------------------------------- */
/* Validation                                                                 */
/* -------------------------------------------------------------------------- */

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function asStringArray(value: unknown, maxItems = 32, maxLength = 48): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim().slice(0, maxLength))
    .filter((item) => item.length > 0)
    .slice(0, maxItems);
}

/**
 * Prototype-pollution guard: keys that can reach `Object.prototype` are dropped
 * before any imported object is merged into application state.
 */
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export function stripDangerousKeys<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripDangerousKeys(item)) as unknown as T;
  }
  if (value === null || typeof value !== 'object') return value;
  const source = value as Record<string, unknown>;
  const result: Record<string, unknown> = Object.create(null);
  for (const key of Object.keys(source)) {
    if (FORBIDDEN_KEYS.has(key)) continue;
    result[key] = stripDangerousKeys(source[key]);
  }
  return { ...result } as T;
}

function normaliseLocked(value: unknown): LockedPayload | null {
  if (value === null || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const salt = asString(raw.saltBase64);
  const iv = asString(raw.ivBase64);
  const cipher = asString(raw.cipherTextBase64);
  if (salt.length === 0 || iv.length === 0 || cipher.length === 0) return null;
  return {
    version: 1,
    algorithm: 'AES-GCM',
    keyDerivation: 'PBKDF2-SHA256',
    iterations: Math.max(1, Math.trunc(asNumber(raw.iterations, 250_000))),
    saltBase64: salt,
    ivBase64: iv,
    cipherTextBase64: cipher,
    attachmentCount: Math.max(0, Math.trunc(asNumber(raw.attachmentCount, 0))),
  };
}

function normaliseAttachment(value: unknown, letterId: string): AttachmentMeta | null {
  if (value === null || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const id = asString(raw.id);
  if (id.length === 0) return null;
  return {
    id,
    letterId: asString(raw.letterId, letterId) || letterId,
    name: asString(raw.name, 'photograph').slice(0, 120),
    type: asEnum(raw.type, ['image/png', 'image/jpeg', 'image/webp'] as const, 'image/jpeg'),
    bytes: Math.max(0, Math.trunc(asNumber(raw.bytes, 0))),
    width: Math.max(0, Math.trunc(asNumber(raw.width, 0))),
    height: Math.max(0, Math.trunc(asNumber(raw.height, 0))),
    caption: asString(raw.caption).slice(0, 400),
    role: asEnum(raw.role, ['photo', 'signature'] as const, 'photo'),
    createdAt: asString(raw.createdAt, new Date().toISOString()),
  };
}

/**
 * Coerces arbitrary parsed data into a valid letter. Unknown properties from a
 * newer schema are kept in `unknownFields` so a round trip through an older
 * build does not destroy them.
 */
export function normaliseLetter(input: unknown): LetterRecord {
  const raw = stripDangerousKeys(
    input !== null && typeof input === 'object' ? (input as Record<string, unknown>) : {},
  );
  const base = createLetter({ id: asString(raw.id) || undefined });
  const id = base.id;

  const known = new Set([
    'id',
    'schemaVersion',
    'title',
    'recipient',
    'sender',
    'senderLocation',
    'dateWritten',
    'sendingDate',
    'openingDate',
    'category',
    'status',
    'body',
    'doc',
    'templateId',
    'themeId',
    'paperSize',
    'stationeryId',
    'typography',
    'envelope',
    'attachments',
    'tags',
    'signature',
    'createdAt',
    'updatedAt',
    'printedAt',
    'printCount',
    'sealed',
    'locked',
    'unknownFields',
  ]);

  const unknownFields: Record<string, unknown> = {};
  for (const key of Object.keys(raw)) {
    if (!known.has(key)) unknownFields[key] = raw[key];
  }

  const typography = (raw.typography ?? {}) as Record<string, unknown>;
  const envelope = (raw.envelope ?? {}) as Record<string, unknown>;
  const signature = (raw.signature ?? {}) as Record<string, unknown>;

  const letter: LetterRecord = {
    id,
    schemaVersion: Math.max(1, Math.trunc(asNumber(raw.schemaVersion, CURRENT_SCHEMA_VERSION))),
    title: asString(raw.title).slice(0, 200),
    recipient: asString(raw.recipient).slice(0, 200),
    sender: asString(raw.sender).slice(0, 200),
    senderLocation: asString(raw.senderLocation).slice(0, 200),
    dateWritten: asString(raw.dateWritten, base.dateWritten),
    sendingDate: typeof raw.sendingDate === 'string' ? raw.sendingDate : null,
    openingDate: typeof raw.openingDate === 'string' ? raw.openingDate : null,
    category: asEnum(raw.category, LETTER_CATEGORIES, 'everyday'),
    status: asEnum(raw.status, LETTER_STATUSES, 'draft'),
    body: asString(raw.body),
    doc: normaliseDocument(raw.doc),
    templateId: asString(raw.templateId, 'love-notes').slice(0, 60),
    themeId: asString(raw.themeId, 'bubblegum-pink').slice(0, 40),
    paperSize: asEnum(
      raw.paperSize,
      ['a4', 'letter', 'a5', 'a6', 'square', 'postcard'] as const,
      'a4',
    ),
    stationeryId: asString(raw.stationeryId, 'ivory-laid'),
    typography: {
      family: asString(typography.family, DEFAULT_TYPOGRAPHY.family),
      sizePt: clamp(asNumber(typography.sizePt, DEFAULT_TYPOGRAPHY.sizePt), 8, 24),
      lineHeight: clamp(asNumber(typography.lineHeight, DEFAULT_TYPOGRAPHY.lineHeight), 1.1, 2.4),
      indentMm: clamp(asNumber(typography.indentMm, DEFAULT_TYPOGRAPHY.indentMm), 0, 30),
      align: asEnum(typography.align, ['left', 'justify'] as const, 'left'),
      colour: safeColour(asString(typography.colour, DEFAULT_TYPOGRAPHY.colour)),
    },
    envelope: {
      enabled: asBoolean(envelope.enabled, false),
      size: asEnum(envelope.size, ['dl', 'c5', 'c6', 'us-10'] as const, 'dl'),
      recipientName: asString(envelope.recipientName).slice(0, 200),
      recipientAddress: asString(envelope.recipientAddress).slice(0, 600),
      senderName: asString(envelope.senderName).slice(0, 200),
      senderAddress: asString(envelope.senderAddress).slice(0, 600),
      stampNote: asString(envelope.stampNote).slice(0, 120),
      sealStyle: asEnum(
        envelope.sealStyle,
        ['none', 'wax', 'sticker', 'ribbon'] as const,
        'none',
      ),
      sealColour: safeColour(asString(envelope.sealColour, DEFAULT_ENVELOPE.sealColour)),
    },
    attachments: Array.isArray(raw.attachments)
      ? raw.attachments
          .map((item) => normaliseAttachment(item, id))
          .filter((item): item is AttachmentMeta => item !== null)
          .slice(0, 60)
      : [],
    tags: asStringArray(raw.tags),
    signature: {
      name: asString(signature.name).slice(0, 120),
      style: asEnum(signature.style, ['typed', 'script', 'drawn'] as const, 'typed'),
      attachmentId: typeof signature.attachmentId === 'string' ? signature.attachmentId : null,
      closing: asString(signature.closing, DEFAULT_SIGNATURE.closing).slice(0, 120),
    },
    createdAt: asString(raw.createdAt, base.createdAt),
    updatedAt: asString(raw.updatedAt, base.updatedAt),
    printedAt: typeof raw.printedAt === 'string' ? raw.printedAt : null,
    printCount: Math.max(0, Math.trunc(asNumber(raw.printCount, 0))),
    sealed: asBoolean(raw.sealed, false),
    locked: normaliseLocked(raw.locked),
  };

  if (Object.keys(unknownFields).length > 0) letter.unknownFields = unknownFields;
  return letter;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Colours are only ever stored as `#rgb`/`#rrggbb`, so they cannot carry CSS. */
export function safeColour(value: string, fallback = '#2b2118'): string {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim()) ? value.trim().toLowerCase() : fallback;
}
