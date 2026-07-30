# Contributing to Dearly

Thank you for wanting to help. Dearly holds letters people care about, so the
bar for changes is: **never lose someone's words, and never leak them.**

## Before you start

- Bugs and ideas: open an issue using the templates in `.github/ISSUE_TEMPLATE/`.
- Security problems: do **not** open an issue. See [SECURITY.md](SECURITY.md).
- Larger changes: open an issue first, so the design can be agreed before you
  spend an evening on it.

## Setting up

```bash
git clone REPOSITORY_URL
cd dearly
npm install
npm run dev
```

Node 20 or newer. There are no runtime dependencies, and adding one needs a good
reason in the pull request — bundle size and offline reliability are features.

## Before opening a pull request

```bash
npm run verify   # typecheck + lint + test + build
```

CI runs the same thing. A pull request that fails it will not be merged.

## Working agreements

**Never lose data.**

- A save is reported only after the storage operation has actually resolved.
- A destructive action is confirmed, and takes a snapshot first where it can.
- A record that this build does not understand is preserved, never deleted.
- Every schema change ships with a migration and a test for it.

**Never leak data.**

- No letter text in the console, in an error message, or in a URL.
- No new network request without an explicit, informed opt-in.
- No new third-party script, font or style. Ever.
- `innerHTML` is forbidden and enforced by lint. Use `textContent` or the
  helpers in `src/components/utilities/dom.ts`.

**Keep it usable by everyone.**

- Keyboard operation, visible focus, labelled controls, announced state changes.
- Nothing communicated by colour, texture, motion or sound alone.
- Touch targets of at least 44 px.
- Respect reduced-motion, high-contrast and text-scaling settings.

**Keep it fast.**

- New heavy code goes behind a dynamic `import()`.
- New images and sounds are lazily fetched, and compressed.
- Release object URLs and canvases when a view is disposed.

## Code style

- TypeScript, strict mode, no `any`.
- Small modules with one responsibility, matching the existing folders.
- Comments explain *why*, not *what*. Prefer a clear name over a comment.
- British English in user-facing text, to match the existing copy.
- Error messages address the person, say what happened, and say what is safe:
  "Your text is still on screen" beats "Error: 23".

## Tests

Add tests with behaviour changes. The suite runs in Node with `jsdom` and
`fake-indexeddb`, so tests must not need a real browser.

Things that genuinely need a browser or a printer are covered by the manual
checklists in `docs/browser-testing.md` and `docs/print-testing.md`. If your
change affects printing, work through the print checklist and say so in the pull
request.

## Commit messages

Short imperative subject, then a body explaining why:

```text
Keep the print tree out of the accessibility tree

The print subtree was reachable by screen readers while printing, which
announced the whole letter twice. It is now aria-hidden and removed as soon
as the dialog closes.
```

## Pull requests

Fill in `.github/pull_request_template.md`. In particular:

- describe the user-visible change;
- say how you tested it, including print testing if relevant;
- confirm no new dependency, no new network request, and no new inline style or
  script — or explain why one is needed.

Pull requests get a Cloudflare preview deployment automatically. Use test
letters in it, never real ones.

## Releases

- `CHANGELOG.md` follows [Keep a Changelog](https://keepachangelog.com/).
- Versions follow [Semantic Versioning](https://semver.org/).
- A schema change is at least a minor version, and must never be silently
  breaking for stored letters.

## Code of conduct

Be kind and be direct. Assume the other person is doing their best. Disagree
about the work, not the person. Anything else, and you will be asked to leave.
