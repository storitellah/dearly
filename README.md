# Dearly by Storitellah

**Write what deserves to be kept.**

Dearly is a letter-writing studio that runs entirely in your browser. You write,
illustrate, print and keep letters that matter — and nothing you write ever
leaves your device.

It is a static Progressive Web App: no server, no account, no database, no
tracking. Install it, go offline, keep writing.

---

## Contents

- [Overview](#overview)
- [Features](#features)
- [Screenshots](#screenshots)
- [Technology](#technology)
- [Install and run locally](#install-and-run-locally)
- [Development commands](#development-commands)
- [Production build](#production-build)
- [Push to GitHub](#push-to-github)
- [Deploy to Cloudflare Pages](#deploy-to-cloudflare-pages)
- [Troubleshooting a deployment](#troubleshooting-a-deployment)
- [Custom domain](#custom-domain)
- [Environment variables](#environment-variables)
- [Offline architecture](#offline-architecture)
- [Where your letters are stored](#where-your-letters-are-stored)
- [Encryption](#encryption)
- [Backup and recovery](#backup-and-recovery)
- [Printing and print testing](#printing-and-print-testing)
- [Accessibility](#accessibility)
- [Privacy](#privacy)
- [Security reporting](#security-reporting)
- [Optional Cloudflare Functions](#optional-cloudflare-functions)
- [Project structure](#project-structure)
- [Testing](#testing)
- [Performance](#performance)
- [Known limitations](#known-limitations)
- [Roadmap](#roadmap)
- [Credits](#credits)
- [Licence](#licence)

---

## Overview

Most writing tools assume your words belong somewhere else: an account, a cloud,
a sync service, a company. Dearly assumes the opposite. A letter is a private
thing between two people, and it should stay that way.

So Dearly is deliberately small and self-contained:

- **Local-first.** Letters live in your browser's own database (IndexedDB) on
  the device you wrote them on.
- **Offline.** After the first load, every core feature works with the network
  switched off — writing, editing, stationery, photographs, printing, PDF and
  image export, backups, locking and unlocking.
- **Printable.** The on-screen preview is the same markup the printer receives,
  measured in millimetres, so what you see is what comes out.
- **Yours to keep.** One `.dearly` file holds your whole library, optionally
  encrypted, and it is plain JSON you could read by hand in twenty years.

## Features

**Writing**

- A distraction-light writing view with word count, reading time and live page count
- Eight stationery designs: laid, ruled, linen, airmail, botanical, grid, kraft, midnight
- Typeface, size, line spacing, alignment and ink colour, all measured for print
- Writing prompts by occasion, for when the first line will not come
- Recipient, sender, place, date written, planned sending date, opening date,
  occasion, status and tags

**Keeping**

- A searchable, filterable, paginated memory box
- Autosave with an honest status: *Saving…*, *Saved locally*, *Unsaved changes*,
  *Storage almost full*, *Unable to save*, *Recovered draft*
- Up to twelve recent versions of every letter, and crash recovery on reopening
- Photographs, validated by content and processed on-device, with captions
- Signatures: typed, italic, or drawn with a finger, stylus or mouse

**Sending and printing**

- Print letters, envelopes, or both, on A4, US Letter or A5
- Envelopes on DL, C5, C6 or US #10 — printed directly onto the envelope, or
  onto a sheet with cut and fold guides
- Page numbers, folding guides, cutting guides, configurable margins, duplex support
- A print calibration sheet, so you can measure what your printer actually does

**Getting your letters out**

- Print-ready PDF, PNG pages, JPEG pages, plain text, self-contained HTML
- `.dearly` backups of one letter or the whole library, encrypted or plain
- Import with validation, checksums, and a snapshot taken before anything is replaced

**Privacy and safety**

- No account, no analytics, no tracking, no remote fonts, no advertising
- AES-GCM encryption for individual letters and for backups
- A strict Content-Security-Policy with no `unsafe-eval` and no inline scripts
- Optional features (feedback form, AI assistant) are off unless you turn them on

## Screenshots

Screenshots live in `docs/screenshots/` and are referenced here. To regenerate
them, run the app locally and capture:

| View | File | What it shows |
| --- | --- | --- |
| Memory box | `docs/screenshots/library.png` | The searchable list of letters |
| Writing view | `docs/screenshots/editor.png` | The editor with the live page preview |
| Print check | `docs/screenshots/print-check.png` | The calibration sheet |
| Settings | `docs/screenshots/settings.png` | Storage, backups and preferences |

> The repository ships without screenshots so that no personal letter is ever
> committed by accident. Add your own from test letters only.

## Technology

| Layer | Choice | Why |
| --- | --- | --- |
| Build | [Vite](https://vite.dev) 6 | Fast, static output, no framework lock-in |
| Language | TypeScript 5 (strict) | Catches the mistakes that cost data |
| UI | Modular vanilla TypeScript components | No framework needed for this shape of app; the whole bundle is ~43 kB gzipped |
| Storage | IndexedDB | The only browser store suitable for letters and images |
| Preferences | localStorage | Small, non-sensitive values only |
| Crypto | Web Crypto API (PBKDF2-SHA256 + AES-GCM) | Reviewed primitives, no dependencies |
| Images | Canvas 2D | Local validation, downscaling and re-encoding |
| PDF | A small built-in writer (~200 lines) | No dependency, works offline |
| Offline | A hand-written service worker | Precisely scoped: assets only, never letters |
| Tests | Vitest, jsdom, fake-indexeddb | Fast, runs in CI without a browser |

React is not used. The application is a handful of independent views with no
shared mutable state beyond one editor context object, so a framework would add
weight without removing complexity. There are **no runtime dependencies at all**.

## Install and run locally

Requires Node.js 20 or newer (declared in `package.json` under `engines`).

```bash
npm install
npm run dev       # http://localhost:5173
```

## Development commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server with hot reloading |
| `npm run build` | Type-check, build to `dist/`, then generate the service worker |
| `npm run preview` | Serve the production build locally |
| `npm test` | Run the test suite once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run typecheck` | TypeScript, no emit |
| `npm run lint` | ESLint |
| `npm run verify` | Type-check, lint, test and build — what CI runs |
| `npm run generate:assets` | Regenerate icons and interface sounds from `scripts/generate-assets.mjs` |

## Production build

```bash
npm run build
npm run preview
```

`npm run build` does three things, in order:

1. `tsc --noEmit` — the build fails rather than shipping a type error;
2. `vite build` — writes hashed assets into `dist/`, copying `public/` verbatim
   (including `_headers`, `_redirects`, the manifest, icons, stationery and sounds);
3. `node scripts/build-sw.mjs` — reads the built output and writes `dist/sw.js`
   with an exact precache list and a cache name derived from the content hash.

Nothing needs editing by hand after a deployment.

## Push to GitHub

```bash
git init
git add .
git commit -m "Initial release of Dearly"
git branch -M main
git remote add origin REPOSITORY_URL
git push -u origin main
```

Replace `REPOSITORY_URL` with your own repository's URL. Nothing in this project
hardcodes a repository, username or hostname.

## Deploy to Cloudflare Pages

1. Sign in to the Cloudflare dashboard → **Workers & Pages** → **Create** →
   **Pages** → **Connect to Git**.
2. Choose your repository and authorise access.
3. Enter these settings exactly:

| Setting | Value |
| --- | --- |
| Framework preset | `Vite` |
| Production branch | `main` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | `/` |
| Node.js version | 20 or newer (from `engines` in `package.json`) |

4. Save and deploy. The first build takes a minute or two.

From then on:

- every push to `main` deploys to production;
- every pull request and every non-production branch gets its own preview
  deployment at a `*.pages.dev` URL.

**Preview deployments are safe to use.** They carry no secrets, they are marked
`noindex` by `functions/_middleware.ts`, they display a *Preview build* banner,
and they write only to the browser's own storage for that hostname — production
data is never touched, because there is no shared storage to touch. Printing,
exporting and offline use all work in a preview exactly as they do in production.

Production never depends on a preview deployment.

## Troubleshooting a deployment

### The page shows "Dearly is starting…" and nothing else

The application never started. After a few seconds the page explains this
itself, on the page, with the fix — but here is the same information.

**Almost always: the host is serving the project source instead of the build
output.** `index.html` in the repository root loads `/src/main.ts`, which is
TypeScript. A browser cannot run it, so nothing starts and no stylesheet is ever
applied — which is why the page is also completely unstyled.

Check the Pages project settings match exactly:

| Setting | Value |
| --- | --- |
| Framework preset | `Vite` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | `/` |

If the build command is empty, or the output directory is `/` rather than
`dist`, Cloudflare publishes the repository as-is and you get this symptom.
Correct the settings and redeploy — **Deployments → the latest deployment →
Retry deployment** picks up the new configuration.

To confirm which one you are serving, open the deployed page's source. A correct
deployment references a hashed bundle:

```html
<script type="module" crossorigin src="/assets/index.<hash>.js"></script>
<link rel="stylesheet" crossorigin href="/assets/index.<hash>.css">
```

A source deployment references `/src/main.ts` instead. CI checks this on every
build, so a green `build` workflow means the output itself is correct.

### It works locally but not when deployed

- Open the browser console. A 404 for a file under `/assets/` means the deployed
  output is incomplete — trigger a fresh deployment rather than a retry.
- Check the deployment log for a failed `npm ci` or `npm run build`. Pages will
  happily publish an empty or partial directory after a failed build.
- Confirm Node 20 or newer is being used; `engines` in `package.json` declares it.

### Opening `index.html` from the file system does nothing

That is expected — it is a source file, not a built page. Run `npm run dev` for
development, or `npm run build && npm run preview` to try the production build.

### The old version keeps coming back

The service worker serves the previous build until you accept the update. Reload
once and accept the *A new version of Dearly is ready* notice, or clear the site
data. Deployment does not force an update on someone mid-letter, by design.

### Letters have disappeared

Letters are stored per site address. Moving from `*.pages.dev` to a custom
domain, or between browsers or devices, starts a fresh local library — the old
letters are still under the old address. Export a `.dearly` backup there and
import it on the new one. Clearing site data deletes them permanently; only a
backup file can bring them back.


## Custom domain

After the `pages.dev` deployment succeeds:

1. In the Pages project, open **Custom domains** → **Set up a custom domain**.
2. Enter your root domain (`example.com`) or a subdomain (`dearly.example.com`).
3. If the domain is on Cloudflare, the DNS record is created for you. If it is
   elsewhere, add the `CNAME` Cloudflare shows you at your DNS provider.
4. Wait for the certificate to be issued — usually a few minutes.

Nothing needs rebuilding. The manifest, service worker, icons, routes and social
preview metadata all use relative paths, and canonical URLs are generated at
runtime from `VITE_SITE_URL` when set, or the browser's own origin when not.

Letters are stored per site address, so moving from `*.pages.dev` to a custom
domain starts a fresh local library on the new address. Export a backup on the
old address and import it on the new one — that is exactly what backups are for.

## Environment variables

Every variable is optional. With an empty environment, Dearly builds and every
core feature works.

| Variable | Where | Purpose |
| --- | --- | --- |
| `VITE_SITE_URL` | Build | Canonical/social URLs. Blank derives them from the browser. |
| `VITE_BASE_PATH` | Build | Base path. `/` for a domain or subdomain; `/dearly/` for a subdirectory. |
| `VITE_DEPLOY_ENV` | Build | Label shown in the preview banner and About panel. |
| `VITE_ENABLE_FEEDBACK` | Build | `true` shows the private feedback form. Default off. |
| `VITE_ENABLE_AI_ASSIST` | Build | `true` makes the AI assistant available. Still off until the user enables it. |
| `FEEDBACK_WEBHOOK_URL` | Cloudflare secret | Where feedback is forwarded. Server-side only. |
| `AI_API_KEY` | Cloudflare secret | AI provider key. **Never** a `VITE_` variable. |
| `AI_API_URL` | Cloudflare secret | AI provider endpoint. |
| `AI_MODEL` | Cloudflare secret | Model identifier. |

Anything prefixed `VITE_` is inlined into the client bundle and is therefore
public. Secrets belong in the Pages dashboard under **Settings → Environment
variables**, as encrypted values. See `.env.example`.

## Offline architecture

```text
first visit          service worker installs, precaches the application shell
                     ↓
every later visit    HTML: network first, cache fallback, then offline.html
                     hashed assets: cache first
                     manifest, print CSS: cache, revalidated in the background
                     /api/*: never cached
                     ↓
your letters         never touch the network at all — they are read straight
                     from IndexedDB on the device
```

- The precache list is generated from the real build output, so hashed file
  names are always right.
- The cache name contains a hash of that output. A new build gets a new cache;
  old Dearly caches are deleted on activation, and caches belonging to anything
  else are left alone.
- A new version **never** activates on its own. The page is told an update is
  waiting, shows a notice, and applies it only when you choose — and it refuses
  to apply while you have unsaved work.
- `public/offline.html` is the fallback for a navigation that fails before the
  app has been cached.

## Where your letters are stored

| Data | Where | Notes |
| --- | --- | --- |
| Letters | IndexedDB, store `letters` | One record per letter, versioned |
| Photographs and signatures | IndexedDB, store `attachments` | Print original and small preview, stored as `ArrayBuffer` |
| Draft history | IndexedDB, store `snapshots` | Up to 12 per letter, rate-limited |
| Preferences | localStorage | Theme, text size, sounds, reduced motion, last section, paper size |

Letters, images, signatures and archives are **never** put in localStorage, never
placed in a URL, never written to the console, and never cached by the service
worker.

Every letter carries the schema version it was written with. Reading always goes
through `migrateLetter`, which brings older records forward and — importantly —
returns records from a *newer* version untouched, marked read-only, rather than
destroying data it does not understand.

## Encryption

Locking a letter, or encrypting a backup, uses the Web Crypto API:

- **Key derivation:** PBKDF2-SHA256, 250,000 iterations, fresh 16-byte random salt
- **Encryption:** AES-GCM, 256-bit key, fresh 12-byte random IV per operation
- **Authentication:** GCM's tag, so tampering is detected on decryption

Your password derives the key and is then discarded: never stored, never logged,
never transmitted. **A forgotten password cannot be recovered** — not by you, not
by Storitellah, not by anyone. The interface says so plainly instead of implying
otherwise.

A locked letter keeps only what the memory box needs to list it — title, dates,
occasion, status, counters. Body, recipient, sender, location, tags, signature
and photographs move inside the encrypted payload, and the plaintext copies are
deleted from storage as part of locking. Draft history is cleared at the same
time, because an unencrypted snapshot would defeat the point.

## Backup and recovery

A `.dearly` file is plain JSON:

```jsonc
{
  "format": "dearly-archive",
  "version": 1,
  "appVersion": "1.0.0",
  "schemaVersion": 2,
  "kind": "library",
  "exportedAt": "2026-07-30T12:00:00.000Z",
  "encrypted": false,
  "letterCount": 12,
  "checksum": { "algorithm": "SHA-256", "value": "…" },
  "payload": { "letters": [...], "attachments": [...], "stationery": [...] }
}
```

Encrypted backups replace `payload` with `envelope`, holding the AES-GCM
envelope. The checksum is computed over the plaintext payload and verified
after decryption, so a damaged file is caught either way.

Importing validates before it writes:

- the file extension and MIME type must be plausible, and executables are refused;
- the archive format and version must be understood — a newer version is refused
  with an explanation, never partially imported;
- the checksum must match;
- letter text containing markup is reduced to plain text, with a warning;
- images are identified by their **contents**; SVG is refused outright;
- attachment names are reduced to a safe form, so `../../etc/passwd` cannot escape;
- prototype-polluting keys are stripped;
- existing letters are snapshotted before being replaced.

Nothing inside an archive is ever executed.

## Printing and print testing

Print output is generated by Dearly's own layout engine, not by the browser's
reflow, which is why the preview matches the paper. Pages are positioned in
millimetres; `@page` size comes from a small stylesheet per paper size in
`public/print/`, so the Content-Security-Policy can stay strict.

Before printing something that matters, open **Print check** and print the
calibration sheet. It carries a 100 mm rule, a 4 inch rule, type samples, a grey
ramp and corner marks exactly 10 mm from each edge.

`docs/print-testing.md` has a full manual checklist, including common home
printers and their unprintable margins.

## Accessibility

Dearly targets WCAG 2.2 AA:

- semantic HTML, one `<h1>` per view, logical heading order, skip link
- full keyboard operation; visible focus rings that are never removed
- dialogs that are labelled, trap focus, close on Escape and restore focus
- form errors announced and tied to their field with `aria-describedby`
- live regions for save state, page counts and errors
- reduced-motion support, following the system setting or overriding it either way
- four themes including a high-contrast one; text scaling from 85% to 160%
- touch targets of at least 44 px
- nothing conveyed by colour, texture, animation or sound alone — sounds are
  decoration, off by default, and always mirrored by visible text

`docs/browser-testing.md` lists the manual checks, including screen-reader passes.

## Privacy

See [PRIVACY.md](PRIVACY.md), and the same text inside the app under **Privacy**.
In short: no account, no letter content leaving the device, no analytics, no
tracking, no AI without explicit per-request permission.

## Security reporting

See [SECURITY.md](SECURITY.md). Please report vulnerabilities privately to
[hello@storitellah.com](mailto:hello@storitellah.com) rather than opening a
public issue.

## Optional Cloudflare Functions

The core application does not need them. Delete the `functions/` directory and
everything above still works.

| Route | Purpose | Off when |
| --- | --- | --- |
| `functions/_middleware.ts` | Marks preview deployments `noindex` | Never needed in production |
| `functions/api/feedback.ts` | Private feedback and bug reports | `FEEDBACK_WEBHOOK_URL` unset → 503 |
| `functions/api/assist.ts` | AI proxy holding the provider key server-side | `AI_API_KEY` unset → 503 |

Both routes accept POST only, require JSON, cap the body size, validate every
field, rate-limit per address, return safe errors, and never log letter content.

The AI assistant, if enabled, shows you the exact text to be sent — with names,
addresses, email addresses, telephone numbers and postcodes removed — and waits
for confirmation. Photographs are never sent. It suggests openings, questions,
corrections, translations and closings; it does not write your letters.

## Project structure

```text
public/            copied verbatim into dist/
  icons/           generated PNG/SVG/ICO icons, including maskable
  fonts/           empty by default; see fonts/README.md
  stationery/      paper textures (SVG)
  sounds/          generated interface sounds (WAV)
  textures/        interface textures
  print/           one tiny stylesheet per physical page size
  manifest.webmanifest, robots.txt, _headers, _redirects, offline.html
src/
  components/
    accessibility/ focus, dialogs, announcements, motion
    editor/        the writing view, autosave, panels, AI assist
    envelope/      envelope layout and rendering
    export/        PDF, images, text, HTML, archives, downloads
    printing/      pagination, measurement, print DOM, calibration
    prompts/       writing prompts
    security/      crypto, sanitising, image and archive validation
    service-worker/cache policy and worker body
    stationery/    paper and typography definitions
    storage/       IndexedDB, repositories, migrations, quota, preferences
    ui/            shell, router, library, settings, privacy, toasts
    utilities/     DOM, bytes, dates, events, ids
  styles/          base, layout, components, editor, library, stationery, print
  app.ts, main.ts
functions/         optional Cloudflare Pages Functions
scripts/           asset generation, service-worker build
tests/             the test suite
docs/              print testing, browser testing, architecture, data model
```

## Testing

```bash
npm test
```

139 tests cover creating, editing, autosaving, recovering, deleting, locking,
encrypting, decrypting, exporting, importing, rejecting dangerous backups,
multi-page pagination, stationery, photographs, offline strategy, service-worker
updates, keyboard navigation, reduced motion, preferences and storage-quota
errors.

Browser and print checks that a test runner cannot do are written down instead:
`docs/browser-testing.md` and `docs/print-testing.md`.

## Performance

Measured on the production build:

| Metric | Budget | Actual |
| --- | --- | --- |
| Initial JS (gzipped) | ≤ 60 kB | ~43 kB |
| Initial CSS (gzipped) | ≤ 12 kB | ~6 kB |
| Runtime dependencies | 0 | 0 |
| Export/print code on first load | none | loaded on demand |

Stationery textures and sounds are fetched only when first used. Photographs are
downscaled for the screen and kept at print quality separately, so a library
listing never decodes a full-resolution image. The memory box paginates rather
than rendering everything. Object URLs are revoked and canvases released when a
view is disposed.

## Known limitations

- **Browser storage is not a safe deposit box.** Clearing site data deletes your
  letters. Export backups. Dearly asks the browser for persistent storage and
  tells you whether it was granted.
- **Letters do not sync between devices or browsers.** That is the trade for
  having no server. Move them with a `.dearly` backup.
- **A forgotten password is final.** There is no recovery path, by design.
- **PDF pages are rendered images**, not selectable text — the trade for having no
  PDF dependency and no font embedding. Use the plain-text or HTML export when you
  need selectable text.
- **Encryption needs a secure context** (`https://` or `localhost`).
- **Printer scaling varies.** Use the Print check sheet before anything important.
- **Safari does not always fire `afterprint`**, so the print tree is cleaned up on
  a short timer as well.

## Roadmap

- Letter templates and reusable openings
- Multiple named recipients, and address book entries kept locally
- Handwriting-style stationery packs
- Optional passphrase lock for the whole application on launch
- Import from plain text and Markdown files
- Printable booklet imposition for long letters
- Translations of the interface

## Credits

Made with love by [Storitellah](https://storitellah.com).

- Icons, stationery textures and interface sounds are generated by
  `scripts/generate-assets.mjs` and the SVGs in `public/`; all original.
- Typography uses the fonts already on your system — nothing is fetched from a
  font CDN. See `public/fonts/README.md` to bundle your own.
- Thanks to everyone who still writes letters.

Questions, ideas and bug reports: [hello@storitellah.com](mailto:hello@storitellah.com)

## Licence

[MIT](LICENSE).
