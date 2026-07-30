# Manual browser testing

The automated suite runs in Node with `jsdom`, which cannot install a service
worker, drive a print dialog, decode an image or speak to a screen reader. This
checklist covers what it cannot.

Run it before a release, in each browser below.

## Browsers to cover

| Browser | Versions | Notes |
| --- | --- | --- |
| Chrome (desktop) | current | Reference for install, print, storage estimates |
| Firefox (desktop) | current | Check `dialog`, `@page`, storage persistence prompts |
| Safari (macOS) | current | Check `afterprint`, `createImageBitmap` fallback, IndexedDB eviction |
| Microsoft Edge | current | Chromium, but verify install and print dialogs |
| Chrome for Android | current | Install prompt, touch targets, photograph capture |
| Safari on iPhone | current (iOS 17+) | Add to Home Screen, AirPrint, storage limits |
| Safari on iPad | current | Split view, stylus signature |

## First run

- [ ] The page loads with no console errors, in each browser
- [ ] The library shows the empty state, not an error
- [ ] "Write a new letter" creates a letter and opens it
- [ ] Typing shows *Unsaved changes*, then *Saving…*, then *Saved locally*
- [ ] Reloading keeps the text
- [ ] Closing the browser entirely and reopening keeps the text
- [ ] Restarting the device keeps the text

## Offline

- [ ] Load the app once with a connection, then switch the network off
- [ ] Reload — the app still starts
- [ ] Write, edit, change stationery, add a photograph, print preview, export a
      PDF, export a `.dearly` backup, restore a backup: all work offline
- [ ] The header shows *Offline — everything still works*
- [ ] Visiting an uncached URL shows `offline.html`, not a browser error page
- [ ] Reconnecting clears the offline indicator without a reload

## Installation (PWA)

- [ ] Chrome/Edge: the install icon appears; installing opens a standalone window
- [ ] Android: "Add to Home screen" uses the maskable icon, correctly cropped
- [ ] iOS: "Add to Home Screen" uses the apple-touch icon; the app opens without
      browser chrome
- [ ] The installed app works offline
- [ ] Letters written in the browser are visible in the installed app on the same
      device and origin

## Updates

- [ ] Deploy a new build while the old one is open
- [ ] Returning to the tab shows *A new version of Dearly is ready*
- [ ] With unsaved work, "Update now" refuses and explains why
- [ ] After saving, "Update now" reloads into the new version
- [ ] "Later" dismisses the notice without applying the update
- [ ] Old caches are gone afterwards (DevTools → Application → Cache Storage)

## Photographs

- [ ] JPEG, PNG and WebP are accepted
- [ ] An SVG renamed to `.png` is refused, with a clear reason
- [ ] A text file renamed to `.jpg` is refused
- [ ] A very large photograph (20 MP+) is downscaled without freezing the tab
- [ ] Captions save and appear in the preview and printed output
- [ ] Removing a photograph removes it from the preview and from storage
- [ ] iOS: taking a photograph directly from the camera works
- [ ] Memory does not climb after adding and removing images repeatedly

## Signatures

- [ ] Drawing with a mouse works
- [ ] Drawing with a finger works on Android and iOS
- [ ] Drawing with a stylus works on iPad
- [ ] "Clear" empties the pad; "Use this signature" saves it
- [ ] The saved signature appears in the preview and prints near the closing
- [ ] Typed and italic styles work without a drawn signature

## Encryption

- [ ] Locking a letter hides its text, addresses and photographs
- [ ] The library card shows it as locked
- [ ] The correct password unlocks it and restores photographs
- [ ] A wrong password fails and changes nothing
- [ ] An encrypted backup cannot be read without its password
- [ ] The wrong password on an encrypted backup imports nothing

## Backups

- [ ] Exporting a letter and the whole library both download
- [ ] Re-importing restores everything, including images
- [ ] Importing with "Keep letters already on this device" skips duplicates
- [ ] Importing with "Replace" replaces them, and the previous version appears in
      draft history
- [ ] A truncated or edited `.dearly` file is refused with a checksum error
- [ ] A `.zip`, `.exe` or `.svg` file is refused before parsing

## Storage

- [ ] Settings shows letter count, space used and eviction protection
- [ ] "Ask the browser to keep this data" reports honestly whether it was granted
- [ ] Filling storage produces *Storage almost full*, not a silent failure
- [ ] Private-browsing windows either work or explain clearly why they cannot

## Keyboard and screen readers

- [ ] Tab reaches everything; nothing is mouse-only
- [ ] Focus is always visible
- [ ] The skip link appears on first Tab and works
- [ ] Dialogs trap focus, close on Escape, and return focus afterwards
- [ ] `Ctrl/Cmd+S` saves; `Ctrl/Cmd+P` prints through Dearly's layout
- [ ] VoiceOver (macOS/iOS), NVDA (Windows) and TalkBack (Android):
  - [ ] headings describe the view
  - [ ] save state is announced as it changes
  - [ ] errors are announced immediately
  - [ ] photograph previews have meaningful alternative text
  - [ ] the signature pad is described, with the typed alternative offered

## Appearance

- [ ] Light, dark, high-contrast and system themes all render correctly
- [ ] Text scaling from 85% to 160% never clips or overlaps
- [ ] Reduced motion removes transitions, in both system and in-app settings
- [ ] Browser zoom to 200% keeps everything usable
- [ ] No horizontal scrolling at 320 px width
- [ ] Touch targets are at least 44 px on phones

## Print

See [print-testing.md](print-testing.md).
