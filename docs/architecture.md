# Architecture

A map of how Dearly is put together, for whoever maintains it next.

## The shape of the thing

```text
index.html
  └── src/main.ts            imports styles, boots the app, catches boot failures
        └── src/app.ts       shell + hash router + view lifecycle
              ├── ui/shell.ts          header, nav, banners, footer
              ├── ui/home-view.ts      the mailbox, the six big actions
              ├── ui/library-view.ts   the memory box
              ├── ui/templates-view.ts the template gallery
              ├── ui/sticker-studio-view.ts  browse, favourite and make stickers
              ├── editor/desk-view.ts  the letter desk: the page and its trays
              ├── ui/settings-view.ts  preferences, storage, backups
              ├── ui/privacy-view.ts   the privacy screen
              └── ui/calibration-view.ts print check
```

The desk is built from four pieces that do not know about each other:

```text
editor/desk-view.ts            owns the letter, the trays and the dock
  ├── editor/wysiwyg/page-view.ts        the paper you type on; pagination
  ├── editor/wysiwyg/toolbar.ts          the floating formatting bar
  ├── editor/wysiwyg/slash-menu.ts       "/" commands
  └── editor/wysiwyg/decoration-layer.ts dragging, resizing, rotating stickers
```

All four speak the same language: a `LetterDocument` in, a `LetterDocument` out.
None of them mutate the document in place — they hand a new one to `apply`,
which commits it to the single undo history and queues an autosave.

There is no framework and no global store. Each view is a function that returns
`{ element, dispose? }`. `app.ts` creates one at a time and disposes the previous
one, which is what keeps object URLs, listeners and canvases from accumulating.

The desk owns the letter being written. `setLetter` is the only place its copy
changes, and it always queues an autosave, so a save cannot be skipped by
accident. The three panels that predate the desk — locking, draft history and
signatures — reach the same letter through `EditorContext`
(`src/components/editor/context.ts`), which the desk keeps in step in both
directions: `replace` pushes the desk's changes in, and the `change` event
brings a panel's changes back out.

## Data flow when you type

There is no textarea. The keystroke lands on the page itself, and the page is
read back into the model:

```text
input on the contenteditable page
  → parseDocument(flow, previous)     DOM → LetterDocument, allow-list only
      → applyDoc(doc)
          → DocumentHistory.commit()  one stack; consecutive typing coalesces
          → Autosave.queue(letter)    debounced, 800 ms
              → putLetter(letter)     IndexedDB transaction
                  → status: "Saved locally"  only after the transaction commits
              → saveSnapshot(letter)  rate-limited recovery snapshot
  → measurePages()                    debounced; pushes straddling blocks over
```

Note the direction. The page is not re-rendered from the model on every
keystroke — that would fight the caret. The model is read *from* the page, and
the page is only rebuilt when something other than typing changes it: a
formatting command, a sticker, a template, an undo.

One exception is written down deliberately in `decoration-layer.ts`: while a
finger is still down, the model is updated but the page is **not** rebuilt, and
the dragged element is moved directly. Replacing the element mid-gesture
cancels the touch that is holding it.

The status is derived from the storage operation, never from the intention to
save. If the transaction fails, the status becomes *Unable to save*, the letter
stays queued, and the text remains on screen.

## Storage

Three object stores plus a small metadata store:

| Store | Key | Indexes | Holds |
| --- | --- | --- | --- |
| `letters` | `id` | `updatedAt`, `status`, `category` | One record per letter |
| `attachments` | `id` | `letterId` | Image bytes, print original + preview |
| `snapshots` | `id` | `letterId`, `createdAt` | Draft history |
| `meta` | `key` | — | Small internal values |

Attachments are separate on purpose: listing the memory box must never pull
image bytes into memory. They are stored as `ArrayBuffer` rather than `Blob`,
because Blob-in-IndexedDB has a long history of engine-specific bugs; the
repository converts at the boundary so callers still see Blobs.

See [data-model.md](data-model.md) for the record shapes and migrations.

## Printing and export share one layout engine

```text
LetterRecord
  → printing/layout.ts   layoutLetter()   pure; millimetres; no DOM
      ├── printing/print-render.ts   → DOM  → window.print()  and the preview
      └── export/canvas-pages.ts     → canvas
            ├── canvasToBlob()       → PNG / JPEG files
            └── export/pdf.ts        → PDF (JPEG pages, DCTDecode, real xref)
```

Because all three consume the same `LetterLayout`, a printed page, an exported
PNG and a PDF page break in the same places. `printing/measure.ts` supplies text
measurement: the browser's canvas metrics when available, and a deterministic
estimate otherwise, which is what lets pagination be unit-tested.

`@page { size }` cannot be driven by a custom property, so each physical size has
a tiny stylesheet in `public/print/`, linked at print time. That keeps
`style-src 'self'` intact — no inline `<style>` anywhere in the application.

## Printing shares the page, not a copy of it

`printing/document-print.ts` builds the print tree from `document/render.ts` —
the same renderer the writing surface uses — and paginates it with
`editor/wysiwyg/pagination.ts`, the same routine the writing surface uses. There
is no second layout engine to drift out of step.

Each printed page is a clipped window onto one continuous flow, shifted up by
the pages already printed:

```text
.print-page                 physical sheet
  └── .sheet--print         the letter's own paper, at true millimetre size
        └── .sheet__window  the usable band; clips
              └── .sheet__flow   the whole letter, margin-top: -(page start)
```

Two consequences worth knowing. The text stays real text, so the browser's
"Save as PDF" produces selectable words. And the page breaks cannot disagree
with the screen, because both come from the same numbers.

`printing/layout.ts` — the older measured line layout — is still there and still
used for a record with no document, which is what a letter imported from an
older archive looks like before it is opened.

## Security boundaries

There are exactly three places where untrusted data enters:

1. **An imported `.dearly` archive** → `security/validate-import.ts`.
   Parsed as data, checksummed, size- and count-limited, markup stripped, image
   bytes identified by signature, names sanitised, prototype keys removed.
2. **An image file** → `security/image-validate.ts`.
   Identified by content, capped by bytes and pixels, re-encoded locally so
   metadata and any appended payload are discarded. SVG is refused.
3. **A response from the optional AI proxy** → treated as text, inserted only
   through `textContent`, and only when the user clicks to insert it.

Everything else is generated by the application itself. Letter text reaches the
DOM only through `textContent`; `innerHTML` is forbidden by lint.

## The service worker

`scripts/build-sw.mjs` reads the built `dist/`, selects an allow-list of
application assets, hashes their contents to make the cache name, and writes
`dist/sw.js` from two sources:

- `src/components/service-worker/cache-policy.js` — pure decisions, imported
  directly by the tests, so the policy is tested rather than assumed;
- `src/components/service-worker/sw-body.js` — the event handlers.

The worker never calls `skipWaiting()` by itself. The page decides, and refuses
while there is unsaved work.

## Adding things

**A new stationery design:** add an entry to `STATIONERY` in
`src/components/stationery/stationery.ts`, and a texture in `public/stationery/`
if it needs one. Everything else — preview, print, PDF, export — follows.

**A new export format:** add a module under `src/components/export/`, and wire a
button into `buildExportTray` in `editor/desk-view.ts` behind a dynamic
`import()`.

**A new letter field:** add it to `LetterRecord` and `normaliseLetter` in
`storage/schema.ts`, bump `CURRENT_SCHEMA_VERSION`, add a migration step in
`storage/migrations.ts`, add a test for the migration, then use it in the editor
and, if it prints, in `printing/layout.ts`.

**A new server-side feature:** add a route under `functions/api/`, keep secrets in
Cloudflare's environment, validate every field, rate-limit it, and make sure the
application still works with the whole `functions/` directory deleted.
