/**
 * The privacy screen.
 *
 * Same content as PRIVACY.md, in the app, in plain language — because a promise
 * you have to go and find on a website is not much of a promise.
 */

import { el, externalLink } from '../utilities/dom';
import { focusHeading } from '../accessibility/focus';
import { setPreferences } from '../storage/preferences';
import { encryptionAvailable } from '../security/crypto';
import { serviceWorkerSupported } from '../service-worker/register';

export interface PrivacyView {
  element: HTMLElement;
}

interface Block {
  heading: string;
  paragraphs: string[];
  points?: string[];
}

const BLOCKS: Block[] = [
  {
    heading: 'Where your letters live',
    paragraphs: [
      'Every letter you write in Dearly is stored in your browser’s own database (IndexedDB) on the ' +
        'device you wrote it on. It is not uploaded, not synchronised, and not readable by Storitellah ' +
        'or by anyone hosting this site.',
      'Small preferences — your theme, text size, sound setting, preferred paper and the section you ' +
        'last opened — are kept in localStorage. Letters, photographs, signatures and backups never are.',
    ],
    points: [
      'No account, no sign-in, no profile.',
      'No letter text, photograph, signature or address leaves this device.',
      'No personal data appears in the address bar: routes carry only opaque identifiers.',
      'No letter text is written to the browser console or into any error report.',
      'No advertising, no tracking scripts and no third-party analytics.',
    ],
  },
  {
    heading: 'What clearing your browser data does',
    paragraphs: [
      'Because letters live in this browser, deleting site data deletes them. “Clear browsing data”, ' +
        '“clear cookies and site data”, a private-browsing window closing, or uninstalling the ' +
        'installed app can all remove everything Dearly has stored.',
      'Browsers may also evict storage on their own when a device runs low on space. Settings has a ' +
        'button that asks the browser to protect Dearly’s data, and shows whether it agreed.',
      'The only real protection is a backup file you have exported and put somewhere safe.',
    ],
  },
  {
    heading: 'How backups work',
    paragraphs: [
      'A backup is a single `.dearly` file, produced on this device and saved to your downloads. It is ' +
        'plain JSON: letters, their stationery and envelope settings, embedded photographs, a checksum, ' +
        'the export date and the application version.',
      'You can back up one letter or your whole library, encrypted or not. Restoring validates the file ' +
        'first: the checksum is verified, images are checked by their actual contents, and anything ' +
        'unexpected is refused rather than imported. Nothing inside a backup is ever executed.',
    ],
  },
  {
    heading: 'How encryption works',
    paragraphs: [
      'Locking a letter, or encrypting a backup, uses the browser’s Web Crypto API. A 256-bit AES-GCM ' +
        'key is derived from your password with PBKDF2-SHA256 over 250,000 iterations, using a fresh ' +
        'random salt, and every encryption uses a fresh random initialisation vector.',
      'Your password is used to derive that key and then discarded. It is never stored, never logged and ' +
        'never sent anywhere. Dearly cannot recover a forgotten password — there is no reset link, no ' +
        'backdoor and no support route back in.',
      'A locked letter keeps only what the memory box needs to list it: title, dates, occasion, status ' +
        'and counters. Its text, addresses, tags, signature and photographs are inside the encrypted ' +
        'payload, and the plaintext copies are removed from storage as part of locking.',
    ],
  },
  {
    heading: 'What leaves this device',
    paragraphs: [
      'In normal use: nothing. Dearly is a static site. Once loaded, it can write, edit, organise, print, ' +
        'export and back up with the network switched off entirely.',
      'Two optional features can make a network request, and both are off unless you turn them on:',
    ],
    points: [
      'The feedback form sends exactly what you type, plus the app version — never letter content.',
      'The AI writing assistant sends only the text you select, with names, addresses, email addresses, ' +
        'telephone numbers and postcodes removed, and only after showing you the exact text and waiting ' +
        'for your confirmation. Photographs are never sent, and it is never enabled automatically.',
    ],
  },
  {
    heading: 'Which features need the internet',
    paragraphs: [
      'Loading Dearly for the first time, and downloading an update, need a connection. After that, ' +
        'writing, editing, stationery, photographs, printing, PDF, image, text, HTML and backup exports, ' +
        'restoring backups, locking and unlocking all work offline.',
      'The optional feedback form and the optional AI assistant need a connection when used. Nothing ' +
        'else does.',
    ],
  },
  {
    heading: 'Hosting',
    paragraphs: [
      'This site is served as static files. The host can see the ordinary things any web server sees — ' +
        'that a browser requested a file, from roughly where, at what time. It cannot see your letters, ' +
        'because your letters are never sent to it.',
    ],
  },
];

export function createPrivacyView(): PrivacyView {
  const element = el('section', { class: 'view view--privacy', 'aria-labelledby': 'privacy-title' });

  element.append(
    el('h1', { class: 'view__title', id: 'privacy-title', text: 'Your letters stay with you' }),
    el('p', {
      class: 'view__intro',
      text:
        'Dearly is local-first. That is not a slogan here; it is how the application is built, and this ' +
        'page explains exactly what that means.',
    }),
  );

  for (const block of BLOCKS) {
    const section = el('section', { class: 'prose' });
    section.append(el('h2', { text: block.heading }));
    for (const paragraph of block.paragraphs) section.append(el('p', { text: paragraph }));
    if (block.points) {
      const list = el('ul');
      for (const point of block.points) list.append(el('li', { text: point }));
      section.append(list);
    }
    element.append(section);
  }

  const capabilities = el('section', { class: 'prose' });
  capabilities.append(
    el('h2', { text: 'This browser, right now' }),
    (() => {
      const list = el('dl', { class: 'about-list' });
      const rows: Array<[string, string]> = [
        [
          'Encryption',
          encryptionAvailable()
            ? 'Available — letters can be locked on this device'
            : 'Unavailable — a secure (https) connection is required',
        ],
        [
          'Offline support',
          serviceWorkerSupported()
            ? 'Available — Dearly can start without a connection'
            : 'Unavailable in this browser or context',
        ],
        ['Storage', 'IndexedDB in this browser profile, on this device'],
      ];
      for (const [term, value] of rows) list.append(el('dt', { text: term }), el('dd', { text: value }));
      return list;
    })(),
  );
  element.append(capabilities);

  const contact = el('section', { class: 'prose' });
  contact.append(el('h2', { text: 'Questions' }));
  const paragraph = el('p');
  paragraph.append(
    document.createTextNode('Write to '),
    externalLink('mailto:hello@storitellah.com', 'hello@storitellah.com'),
    document.createTextNode('. Security reports have their own route, described in SECURITY.md in the repository.'),
  );
  contact.append(paragraph);
  element.append(contact);

  setPreferences({ lastSection: 'privacy', privacyAcknowledged: true });
  focusHeading(element);

  return { element };
}
