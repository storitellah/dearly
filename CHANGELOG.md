# Changelog

All notable changes to Dearly are recorded here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- A deployment that served the project source instead of `dist/` produced a
  blank, unstyled page with no explanation: `index.html` loads `/src/main.ts`,
  which a browser cannot execute, so neither the application nor its styles ever
  arrived. The page now explains the cause and the fix on the page itself, in a
  linked stylesheet that applies even when the bundle fails to load, revealed
  only if start-up has not completed after eight seconds.
- Hardened `public/_redirects` so the single-page fallback can never shadow a
  real file. Every directory holding assets, plus the service worker and the
  optional Function routes, is now mapped to itself ahead of the catch-all.
- The build workflow now fails if the built HTML still references the TypeScript
  source, so a broken deployment is caught in CI rather than in production.
- The boot stylesheet is precached, so a cold offline start is styled.

## [1.0.0] — 2026-07-30

The first release. A complete, offline-capable letter-writing studio that keeps
everything on your device.

### Added

**Writing**

- Writing view with title, recipient, sender, place, date written, planned
  sending date, opening date, occasion, status, tags and a sealed marker
- Word count, reading time and a live page count that matches the printed result
- Eight stationery designs, five typefaces, adjustable size, line spacing,
  alignment and ink colour
- Writing prompts by occasion
- Photographs, validated by content, downscaled for the screen and kept at print
  quality separately, with captions
- Signatures: typed, italic, or drawn on a canvas with finger, stylus or mouse
- Envelope details with a live preview at true proportions, four envelope sizes
  and four seal styles

**Keeping**

- Local storage in IndexedDB, with a versioned schema and safe migrations
- Autosave with honest status reporting: saving, saved, unsaved, storage almost
  full, unable to save, recovered draft
- Recovery snapshots, rate-limited and pruned, with a draft history panel
- Crash recovery when a newer draft is found on reopening
- Searchable, filterable, paginated memory box
- Per-letter locking with AES-GCM, including photographs

**Printing**

- Millimetre-accurate pagination shared by print, PNG, JPEG and PDF output
- A4, US Letter and A5; letter only, envelope only, or both
- Envelopes printed directly, or on a sheet with cut and fold guides
- Page numbers, folding guides, cutting guides, configurable margins, duplex
  support
- A print calibration sheet with metric and imperial rules, type samples, a grey
  ramp and corner marks

**Export and backup**

- Print-ready PDF, produced by a small built-in writer with no dependencies
- PNG and JPEG pages, plain text, and a self-contained HTML letter
- `.dearly` archives for one letter or the whole library, encrypted or plain,
  with SHA-256 checksums and version metadata
- Import with full validation, warnings, and a snapshot before anything is replaced

**Offline and installation**

- Installable PWA with a manifest, maskable icons and app shortcuts
- Hand-written service worker: precaches application assets only, never letters
- Content-hashed cache names, safe cleanup of old caches, offline fallback page
- Update detection with a notice that never interrupts unsaved work

**Privacy, security and accessibility**

- No account, no analytics, no tracking, no remote fonts, no advertising
- Strict Content-Security-Policy with no `unsafe-eval` and no inline scripts
- Content-based image validation; SVG uploads refused
- Archive validation against script injection, path traversal, oversized files,
  prototype pollution and unsupported future versions
- Privacy screen inside the app, mirroring `PRIVACY.md`
- WCAG 2.2 AA targets: keyboard operation, focus management, live regions,
  accessible dialogs and form errors, reduced motion, high contrast, text scaling
- Four themes, adjustable text size, optional interface sounds that are never the
  only signal

**Optional, off by default**

- Private feedback form, backed by a Cloudflare Pages Function
- AI writing assistant, proxied server-side so the provider key never reaches the
  browser, with per-request consent, redaction of names, addresses, email
  addresses, telephone numbers and postcodes, and no photographs ever sent

**Project**

- Vite 6 + TypeScript 5, zero runtime dependencies
- 139 automated tests covering storage, autosave, recovery, encryption, archives,
  printing, export, offline strategy and accessibility
- GitHub Actions for tests and production builds, Dependabot, CodeQL, issue and
  pull-request templates
- Cloudflare Pages configuration: `_headers`, `_redirects`, preview-safe
  deployments marked `noindex`

[Unreleased]: https://github.com/storitellah/dearly/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/storitellah/dearly/releases/tag/v1.0.0
