## What this changes

<!-- One or two sentences on the user-visible change. -->

## Why

<!-- The problem behind it. Link an issue if there is one. -->

## How it was tested

<!-- Be specific: which browsers, which flows, which printer if relevant. -->

- [ ] `npm run verify` passes (type-check, lint, tests, build)
- [ ] Tested manually in at least one browser
- [ ] Printing checked against `docs/print-testing.md` (if printing is affected)
- [ ] Keyboard-only pass, and focus order still makes sense
- [ ] Checked at 320 px width and at 200% zoom

## The promises this project makes

- [ ] No letter content is logged, put in a URL, or sent anywhere new
- [ ] No new runtime dependency (or the pull request explains why one is needed)
- [ ] No new third-party script, font or stylesheet
- [ ] No `innerHTML`, no `eval`, no inline `<style>` element
- [ ] Nothing new is required for the app to work offline
- [ ] A save is still reported only after storage confirms it

## Data safety

- [ ] No stored record can be lost or silently rewritten by this change
- [ ] If the schema changed: version bumped, migration added, migration tested
- [ ] Destructive actions still confirm, and snapshot first where they can

## Accessibility

- [ ] New controls are labelled and reachable by keyboard
- [ ] State changes are announced, not only shown
- [ ] Nothing is conveyed by colour, motion or sound alone

## Screenshots

<!-- For visual changes. Use test letters only — never a real one. -->

## Anything reviewers should look at closely

<!-- Trade-offs, things you are unsure about, follow-up work. -->
