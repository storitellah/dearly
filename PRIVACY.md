# Privacy

**Dearly by Storitellah — write what deserves to be kept.**

Dearly is local-first. That is not a marketing line here; it is how the
application is built. This document explains exactly what that means, in plain
language. The same text is available inside the app under **Privacy**.

Last updated: 2026-07-30.

---

## The short version

- No account. No sign-in. No profile.
- No letter text, photograph, signature or address ever leaves your device.
- No analytics, no advertising, no tracking scripts, no third-party fonts.
- Two optional features can make a network request, and both are off unless you
  turn them on.
- Everything else works with the network switched off entirely.

---

## Where your letters live

Every letter you write is stored in your browser's own database (IndexedDB), on
the device you wrote it on. It is not uploaded, not synchronised, and not
readable by Storitellah or by whoever hosts the site.

| Data | Stored in | Leaves the device? |
| --- | --- | --- |
| Letter text | IndexedDB (`letters`) | No |
| Photographs, signatures | IndexedDB (`attachments`) | No |
| Draft history | IndexedDB (`snapshots`) | No |
| Addresses and envelope details | IndexedDB, with the letter | No |
| Theme, text size, sounds, motion, last section, paper size | localStorage | No |

Letters, images, signatures and backups are never placed in localStorage, never
put in a URL, never written to the browser console, never included in an error
message, and never stored in the browser's HTTP cache.

Application routes carry only opaque identifiers such as
`#/write/ltr_9f3c1a20b4d7`. No name, recipient or letter text appears in the
address bar or in browser history.

## What clearing your browser data does

Because your letters live in this browser, deleting site data deletes them.
Any of these can remove everything Dearly has stored:

- "Clear browsing data" / "Clear cookies and site data"
- Closing a private-browsing window
- Uninstalling the installed app, on some platforms
- A browser evicting storage when the device runs low on space

Settings has a button that asks the browser to keep Dearly's data even under
storage pressure, and shows you whether the browser agreed.

**The only real protection is a backup file you have exported and put somewhere
safe.** Dearly cannot restore anything for you; there is no copy anywhere else.

## How backups work

A backup is a single `.dearly` file, produced on your device and saved to your
downloads folder. It is plain JSON containing:

- version metadata (backup format, app version, schema version, export date)
- letter data, including stationery, typography and envelope settings
- photographs, embedded as base64
- a SHA-256 checksum of the contents

You can back up a single letter or your whole library, encrypted or not.

Restoring validates the file before anything is written: the checksum is
verified, images are checked by their actual contents, unexpected or dangerous
content is refused, and any letter that would be replaced is snapshotted first.
Nothing inside a backup is ever executed.

## How encryption works

You can lock individual letters, and you can encrypt backups. Both use the
browser's Web Crypto API:

- a 256-bit AES-GCM key is derived from your password using PBKDF2-SHA256 over
  250,000 iterations with a fresh random salt;
- every encryption uses a fresh random initialisation vector;
- AES-GCM authenticates the data, so tampering is detected on decryption.

Your password is used to derive the key and is then discarded. It is never
stored, never logged, and never sent anywhere.

**Dearly cannot recover a forgotten password.** There is no reset link, no
backdoor, and no support route back in. Write it down somewhere safe.

A locked letter keeps only what the memory box needs to list it — title, dates,
occasion, status and counters. Its text, addresses, tags, signature and
photographs are inside the encrypted payload, and the plaintext copies are
deleted from storage as part of locking. Draft history for that letter is cleared
at the same time, because an unencrypted snapshot would defeat the purpose.

## What leaves this device

In normal use: nothing. Dearly is a static site. Once loaded, it can write,
edit, organise, print, export and back up with no connection at all.

Two optional features can make a network request:

**1. The feedback form** (off unless the build enables it)
Sends exactly what you type, plus the application version and deployment label.
Never letter content, never photographs, never addresses.

**2. The AI writing assistant** (off by default, twice over: the build must
enable it *and* you must switch it on in Settings)
Before anything is sent, Dearly shows you the exact text that will be
transmitted, with names, addresses, email addresses, telephone numbers and
postcodes removed. You can send a selection instead of the whole letter, and you
can cancel. Photographs are never sent. Requests go to this site's own
`/api/assist` route, which holds the provider key server-side; the browser never
has it. Responses are not stored. It never runs on its own.

## Which features need the internet

| Feature | Needs a connection |
| --- | --- |
| Loading Dearly the first time | Yes |
| Downloading an update | Yes |
| Writing, editing, organising | No |
| Stationery, photographs, signatures | No |
| Printing and print preview | No |
| PDF, PNG, JPEG, text, HTML export | No |
| Backup and restore | No |
| Locking, unlocking, encryption | No |
| The optional feedback form | Yes, when used |
| The optional AI assistant | Yes, when used |

## Hosting

The site is served as static files (from Cloudflare Pages, in the reference
deployment). The host sees what any web server sees: that a browser requested a
file, roughly from where, at what time. It cannot see your letters, because your
letters are never sent to it.

Preview deployments for pull requests are marked `noindex` and show a *Preview
build* banner. They store data under their own hostname, separately from
production.

## Children

Dearly collects nothing, so there is nothing to collect from anyone of any age.
It is suitable for family use.

## Changes to this document

Material changes will be noted in `CHANGELOG.md` and dated at the top of this
file. Because Dearly holds no data about you, there is no back catalogue of
consent to revisit — only this description of how the software behaves.

## Questions

[hello@storitellah.com](mailto:hello@storitellah.com)

Security reports have their own route: see [SECURITY.md](SECURITY.md).
