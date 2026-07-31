# Changelog

All notable changes to Dearly are recorded here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **A true WYSIWYG letter desk.** The separate text editor is gone. There is no
  text box beside a preview, because there is no preview: the page you type on
  is drawn at true millimetre size and is the same arrangement that prints. The
  body is real, selectable, flowing text — not a canvas and not a raster image.
- Automatic pagination on the writing surface. A block that would be cut in half
  by a page boundary is pushed to the next page, and the boundary is drawn and
  labelled where it falls.
- A formatting toolbar that floats beside the selection on a desktop and rises
  from the bottom of the screen on a phone.
- Sixteen slash commands for inserting headings, quotes, lists, rules, photos,
  stickers, postscripts, signatures and page breaks.
- Stickers and photographs on the writing surface: drag, resize, rotate, flip,
  layer in front of or behind the text, lock, duplicate and nudge with the arrow
  keys, all working with a finger as well as a mouse.
- One undo history shared by typing, formatting, decorations and template
  changes, with consecutive typing coalesced.
- A validated letter document model (blocks, inlines and decorations) rendered
  by components that only ever use `createElement` and `textContent`. Pasted
  markup is reduced to an allow-list of bold, italic, underline, strike, code and
  safe links; Shift+paste is always plain text.
- Twelve colour themes, each with primary, secondary, accent, background, paper,
  text, button, sticker and envelope colours, applied through CSS custom
  properties so a switch repaints instantly without reloading a stylesheet. The
  test suite asserts WCAG 2.2 AA contrast for every text pair in every theme.
- Fifty-four letter templates in seven categories, each with paper, typography,
  margins, palette, sticker suggestions, envelope and photo placement, and every
  part of it editable the moment writing starts.
- Fifteen paper designs drawn entirely with CSS gradients, so they add nothing to
  download and print sharply at any size.
- Over a hundred vector stickers in thirty-two categories, including
  Kenyan-inspired, African-inspired and 1990s/2000s/2010s sets, with search,
  favourites, a sticker maker that exports a transparent PNG at 300 DPI, and
  uploads validated by file signature and converted to a safe bitmap.
- A home screen with an animated mailbox, rotating greetings, six large actions
  and a **Surprise me** button that picks a template, palette, sticker pack and
  writing prompt together.
- A template gallery with true miniature previews — the same paper, palette and
  margins as the real thing, not stock images — plus filters and favourites.
- **Printing the page itself.** Print now renders the document with the same
  renderer and the same pagination routine the writing surface uses, so the
  sheet that leaves the printer is the sheet that was on the screen: headings,
  quotes, inline formatting, photographs, stickers, the paper design and the
  page breaks. The text stays real text, so the printer's own "Save as PDF"
  produces selectable, searchable words rather than a picture of them.
- Pagination breaks between lines. A paragraph that fits on a page is never
  split; a paragraph too long for any page is split between two of its own
  lines rather than through the middle of one.

### Changed

- Schema version 3. Letters gain a structured `doc`, a `templateId`, a `themeId`
  and a `paperSize`. Version 1 and 2 letters migrate on read, keeping their
  words; letters written by a newer version are preserved untouched and shown
  read-only rather than being rewritten.
- The default route is now the home screen rather than the memory box.
- The JavaScript budget was raised from 60 kB to 80 kB gzipped to pay for the
  themes, templates, stickers and document model. There are still no runtime
  dependencies.

### Fixed

- Dragging a sticker moved it further than the pointer whenever the page was
  zoomed. The page reported millimetres-per-pixel with the zoom divided out —
  correct for measuring pagination, wrong for pointer arithmetic, which arrives
  in already-scaled client coordinates. The two figures are now separate.
- Dragging a sticker with a finger did nothing. Each move rebuilt the page,
  which replaced the element the touch was captured by and cancelled the
  gesture. A drag now moves the existing element and the page is rebuilt once,
  when the gesture ends.
- A new sticker was placed near the top of the first page even when the writer
  was looking at page two, so it appeared to vanish. Stickers and uploaded
  images now land in the part of the paper that is actually on screen.
- The letter page overflowed a phone screen and was clipped at both edges. A CSS
  transform scales what is painted but not the space reserved for it, so the
  holder is now given the scaled size, and the page re-fits when the window
  changes or the phone is turned.
- Responsive grids used `minmax(15rem, 1fr)`, which cannot fall below its floor:
  on a 390px screen the home actions laid out six 15rem columns and pushed the
  whole page sideways. Every such grid now wraps its floor in `min(…, 100%)`, and
  a test asserts it.
- The home screen printed the tagline, the Storitellah credit and the contact
  links a second time, directly above the identical application footer.
- The resize and rotate handles were 32×32, below the 44×44 minimum. The footer
  links and the brand were below it too. All are now at least 44×44, except the
  Storitellah link inside the "Made with love by" sentence, where WCAG 2.2's
  inline exception applies and a 44px box would break the line.
- A phone header spent four rows on navigation. It is one row now, scrolling
  sideways, and the "Online" indicator only takes space when it has something
  worth saying.
- Template miniatures spilled over the cards that framed them.
- The page counter said "2 pages" for a one-line letter. It measured
  `scrollHeight`, which the sheet's minimum height had already inflated to a
  full page, so every letter was one page longer than it was.
- A slash command left the `/heading` the writer typed sitting in the letter,
  because the page turned Enter into a new paragraph before the insert menu saw
  it. The menu now sees the key first, and the command text is removed.

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
