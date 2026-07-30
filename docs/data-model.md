# The local data model

Defined in `src/components/storage/schema.ts`. Current schema version: **2**.

## A letter

```ts
interface LetterRecord {
  id: string;                    // "ltr_" + 24 hex characters
  schemaVersion: number;         // the version this record was written with
  title: string;
  recipient: string;
  sender: string;
  senderLocation: string;
  dateWritten: string;           // YYYY-MM-DD, local
  sendingDate: string | null;
  openingDate: string | null;
  category: LetterCategory;      // love | family | friendship | gratitude |
                                 // apology | milestone | future-self |
                                 // farewell | everyday | other
  status: LetterStatus;          // draft | ready | printed | sent | kept | archived
  body: string;                  // plain text; paragraphs separated by blank lines
  stationeryId: string;
  typography: TypographySettings;
  envelope: EnvelopeSettings;
  attachments: AttachmentMeta[]; // metadata only; bytes live elsewhere
  tags: string[];
  signature: SignatureSettings;
  createdAt: string;             // ISO 8601
  updatedAt: string;             // ISO 8601
  printedAt: string | null;
  printCount: number;
  sealed: boolean;
  locked: LockedPayload | null;  // present when the letter is encrypted
  unknownFields?: Record<string, unknown>; // preserved from a newer version
}
```

Supporting shapes:

```ts
interface TypographySettings {
  family: string;      // font id from stationery/typography.ts
  sizePt: number;      // 8–24, in points, so print is predictable
  lineHeight: number;  // 1.1–2.4
  indentMm: number;    // 0–30
  align: 'left' | 'justify';
  colour: string;      // #rgb or #rrggbb only
}

interface EnvelopeSettings {
  enabled: boolean;
  size: 'dl' | 'c5' | 'c6' | 'us-10';
  recipientName: string;
  recipientAddress: string;   // newline-separated
  senderName: string;
  senderAddress: string;
  stampNote: string;
  sealStyle: 'none' | 'wax' | 'sticker' | 'ribbon';
  sealColour: string;
}

interface SignatureSettings {
  name: string;
  style: 'typed' | 'script' | 'drawn';
  attachmentId: string | null;  // set when style is 'drawn'
  closing: string;
}

interface AttachmentMeta {
  id: string;            // "img_…" or "sig_…"
  letterId: string;
  name: string;          // already reduced to a safe form
  type: 'image/png' | 'image/jpeg' | 'image/webp';
  bytes: number;
  width: number;
  height: number;
  caption: string;
  role: 'photo' | 'signature';
  createdAt: string;
}

interface LockedPayload {
  version: 1;
  algorithm: 'AES-GCM';
  keyDerivation: 'PBKDF2-SHA256';
  iterations: number;        // 250,000 at time of writing
  saltBase64: string;        // 16 random bytes
  ivBase64: string;          // 12 random bytes
  cipherTextBase64: string;
  attachmentCount: number;   // so the library can say "3 photographs, locked"
}
```

## What a locked letter still reveals

Locking encrypts the parts that carry meaning and clears them from the record.
What remains in plaintext is the minimum the memory box needs to list the letter
at all:

| Kept in plaintext | Moved into the encrypted payload |
| --- | --- |
| `id`, `schemaVersion` | `body` |
| `title` | `recipient`, `sender`, `senderLocation` |
| `dateWritten`, `sendingDate`, `openingDate` | `tags` |
| `category`, `status` | `signature` |
| `createdAt`, `updatedAt`, `printedAt`, `printCount` | envelope addresses and stamp note |
| `sealed`, `stationeryId`, `typography` | every photograph, base64-encoded |

If a title is itself sensitive, rename it before locking. This trade is stated in
the app, on the Privacy screen, and here.

## Attachments on disk

The public API deals in `Blob`. On disk each attachment is stored as:

```ts
interface AttachmentRow extends AttachmentMeta {
  originalData: ArrayBuffer;  // print quality, longest edge ≤ 2400 px
  previewData: ArrayBuffer;   // screen preview, longest edge ≤ 640 px
  mimeType: string;
}
```

`ArrayBuffer` rather than `Blob` because Blob-in-IndexedDB has been unreliable in
some WebKit versions; the repository converts at the boundary.

## Snapshots

```ts
interface LetterSnapshot {
  id: string;
  letterId: string;
  createdAt: string;
  reason: 'autosave' | 'manual' | 'pre-import' | 'pre-lock' | 'crash-recovery';
  wordCount: number;
  letter: LetterRecord;   // without attachment bytes
}
```

Rules, all in `storage/snapshots.ts` and unit-tested:

- at most **12** snapshots per letter;
- automatic snapshots at most every **90 seconds**;
- automatic snapshots only when at least **40 characters** changed;
- manual, pre-import, pre-lock and crash-recovery snapshots are always taken;
- locking a letter clears its snapshots, because plaintext history would defeat it.

## Migrations

Every read goes through `migrateLetter` (`storage/migrations.ts`).

| From | To | What changes |
| --- | --- | --- |
| 1 | 2 | `text` → `body`; `paper` → `stationeryId`; envelope, signature, attachments and tags added with defaults |

Three rules that must not be broken:

1. **Nothing is deleted for being unfamiliar.** A record that cannot be migrated
   is still returned, normalised, and remains readable.
2. **A record from a newer schema is returned untouched**, flagged `fromFuture`,
   and displayed read-only. Unknown properties survive in `unknownFields`, so a
   round trip through an older build does not destroy them.
3. **Every step is pure and tested.** Add a step, add a test.

Adding a version:

```ts
const stepV2toV3: Step = (raw) => {
  const next = { ...raw };
  next.newField = deriveFrom(next);
  next.schemaVersion = 3;
  return next;
};

const STEPS: Record<number, Step> = { 1: stepV1toV2, 2: stepV2toV3 };
```

then bump `CURRENT_SCHEMA_VERSION` in `schema.ts`.

## Preferences (localStorage)

Key: `dearly.preferences.v1`.

```ts
interface Preferences {
  theme: 'system' | 'light' | 'dark' | 'contrast';
  fontScale: number;             // 0.85–1.6
  sounds: boolean;
  reducedMotion: 'system' | 'reduce' | 'allow';
  lastSection: string;
  paperSize: 'a4' | 'letter' | 'a5';
  lastStationeryId: string;
  senderName: string;
  senderLocation: string;
  privacyAcknowledged: boolean;
  aiAssistEnabled: boolean;      // default false
  libraryPageSize: number;       // 6–48
}
```

Every value is clamped and type-checked on read, so a corrupted or hand-edited
entry can never crash the application. Letters, images, signatures and archives
must never be added here.

## The archive format

See the [Backup and recovery](../README.md#backup-and-recovery) section of the
README for the `.dearly` file structure, and
`src/components/security/validate-import.ts` for the validation rules applied to
every imported file.
