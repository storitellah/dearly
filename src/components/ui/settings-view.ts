/**
 * Settings: appearance, storage, backups and the optional extras.
 *
 * Everything here is local. There is no account, no sync and nothing to sign in
 * to, so "settings" means preferences on this device plus the tools for getting
 * your letters in and out of it.
 */

import { el, clear } from '../utilities/dom';
import {
  getPreferences,
  setPreferences,
  resetPreferences,
  type Preferences,
} from '../storage/preferences';
import { applyPreferences } from '../accessibility/motion';
import { readQuota, requestPersistence } from '../storage/quota';
import { countLetters } from '../storage/letters-repo';
import { deleteDatabase } from '../storage/db';
import { formatBytes } from '../utilities/bytes';
import { appVersion, deployEnvironment } from '../utilities/assets';
import { assessPassword, encryptionAvailable } from '../security/crypto';
import { confirmDialog, passwordDialog } from '../accessibility/dialog';
import { focusHeading } from '../accessibility/focus';
import { announce } from '../accessibility/announce';
import { toast } from './toast';
import { createFeedbackForm } from './feedback-form';
import { playSound, soundsSupported } from './sounds';
import { unregisterServiceWorker, serviceWorkerSupported } from '../service-worker/register';
import { describe } from '../utilities/events';

export interface SettingsView {
  element: HTMLElement;
  refresh(): Promise<void>;
}

export function createSettingsView(): SettingsView {
  const element = el('section', { class: 'view view--settings', 'aria-labelledby': 'settings-title' });
  element.append(
    el('h1', { class: 'view__title', id: 'settings-title', text: 'Settings' }),
    el('p', {
      class: 'view__intro',
      text: 'These preferences are stored on this device. Your letters are never part of them.',
    }),
  );

  /* Appearance ------------------------------------------------------------- */

  const appearance = section('Appearance and accessibility');

  const themeSelect = select('settings-theme', [
    ['system', 'Follow the system setting'],
    ['light', 'Light'],
    ['dark', 'Dark'],
    ['contrast', 'High contrast'],
  ]);
  themeSelect.addEventListener('change', () => {
    applyPreferences(setPreferences({ theme: themeSelect.value as Preferences['theme'] }));
    announce(`Theme set to ${themeSelect.value}.`);
  });

  const scaleInput = el('input', {
    type: 'range',
    class: 'input input--range',
    id: 'settings-scale',
    min: '0.85',
    max: '1.6',
    step: '0.05',
  }) as HTMLInputElement;
  const scaleValue = el('output', { class: 'field-hint', for: 'settings-scale' });
  scaleInput.addEventListener('input', () => {
    const scale = Number(scaleInput.value);
    scaleValue.textContent = `${Math.round(scale * 100)}%`;
    applyPreferences(setPreferences({ fontScale: scale }));
  });

  const motionSelect = select('settings-motion', [
    ['system', 'Follow the system setting'],
    ['reduce', 'Reduce motion in Dearly'],
    ['allow', 'Allow motion in Dearly'],
  ]);
  motionSelect.addEventListener('change', () => {
    applyPreferences(
      setPreferences({ reducedMotion: motionSelect.value as Preferences['reducedMotion'] }),
    );
  });

  const soundsInput = checkbox('settings-sounds', 'Play quiet interface sounds');
  soundsInput.input.addEventListener('change', () => {
    setPreferences({ sounds: soundsInput.input.checked });
    if (soundsInput.input.checked) void playSound('page');
  });

  appearance.append(
    el('div', { class: 'field-grid' }, [
      labelled('settings-theme', 'Theme', themeSelect),
      labelled('settings-motion', 'Motion', motionSelect),
      el('div', { class: 'field' }, [
        el('label', { class: 'label', for: 'settings-scale', text: 'Text size' }),
        scaleInput,
        scaleValue,
      ]),
    ]),
    soundsInput.field,
    el('p', {
      class: 'field-hint',
      text: soundsSupported()
        ? 'Sounds are optional decoration. Nothing is ever communicated by sound alone.'
        : 'This browser has no audio support, so interface sounds are unavailable. Nothing else is affected.',
    }),
  );

  /* Writing defaults ------------------------------------------------------- */

  const defaults = section('Writing defaults');
  const nameInput = el('input', { type: 'text', class: 'input', id: 'settings-name', autocomplete: 'name' }) as HTMLInputElement;
  const placeInput = el('input', { type: 'text', class: 'input', id: 'settings-place', autocomplete: 'address-level2' }) as HTMLInputElement;
  const paperSelect = select('settings-paper', [
    ['a4', 'A4'],
    ['letter', 'US Letter'],
    ['a5', 'A5'],
  ]);

  nameInput.addEventListener('change', () => setPreferences({ senderName: nameInput.value }));
  placeInput.addEventListener('change', () => setPreferences({ senderLocation: placeInput.value }));
  paperSelect.addEventListener('change', () =>
    setPreferences({ paperSize: paperSelect.value as Preferences['paperSize'] }),
  );

  defaults.append(
    el('div', { class: 'field-grid' }, [
      labelled('settings-name', 'Your name', nameInput),
      labelled('settings-place', 'Where you usually write', placeInput),
      labelled('settings-paper', 'Preferred paper', paperSelect),
    ]),
    el('p', {
      class: 'field-hint',
      text: 'Used to fill in new letters. Stored on this device only.',
    }),
  );

  /* Storage ---------------------------------------------------------------- */

  const storage = section('Storage on this device');
  const storageReport = el('div', { class: 'storage-report', role: 'status' });
  const persistButton = el('button', {
    type: 'button',
    class: 'button button--quiet',
    text: 'Ask the browser to keep this data',
  });
  persistButton.addEventListener('click', () => {
    void (async () => {
      const granted = await requestPersistence();
      toast(
        granted
          ? 'The browser has agreed to keep Dearly’s data even when space is short.'
          : 'The browser did not grant persistent storage. Your letters are still saved; export backups regularly.',
        granted ? 'success' : 'warning',
      );
      await refreshStorage();
    })();
  });

  storage.append(
    storageReport,
    el('div', { class: 'button-row' }, [persistButton]),
    el('p', {
      class: 'field-hint',
      text:
        'Clearing site data, or “clear cookies and site data” in your browser, deletes every letter ' +
        'stored here. Nothing can bring them back except a backup file you exported.',
    }),
  );

  /* Backups ---------------------------------------------------------------- */

  const backups = section('Backups');

  const exportPlain = el('button', { type: 'button', class: 'button button--primary', text: 'Export my whole library (.dearly)' });
  exportPlain.addEventListener('click', () => {
    void runExport();
  });

  const exportEncrypted = el('button', {
    type: 'button',
    class: 'button button--quiet',
    text: 'Export encrypted library (.dearly)',
  });
  exportEncrypted.addEventListener('click', () => {
    void runExport(true);
  });

  const importInput = el('input', {
    type: 'file',
    class: 'input input--file',
    id: 'settings-import',
    accept: '.dearly,application/json',
  }) as HTMLInputElement;

  const importMode = select('settings-import-mode', [
    ['merge-keep-existing', 'Keep letters already on this device'],
    ['merge-replace-existing', 'Replace letters that have the same id'],
  ]);

  const importStatus = el('div', { class: 'import-status', role: 'status' });

  importInput.addEventListener('change', () => {
    const file = importInput.files?.[0];
    importInput.value = '';
    if (file) void runImport(file);
  });

  backups.append(
    el('div', { class: 'button-row' }, [exportPlain, exportEncrypted]),
    el('p', {
      class: 'field-hint',
      text:
        'A .dearly file is plain JSON containing your letters, their settings, embedded photographs, ' +
        'a checksum and the app version. An encrypted export wraps all of that in AES-GCM using a ' +
        'password only you know.',
    }),
    el('div', { class: 'field-grid' }, [
      labelled('settings-import', 'Restore from a backup', importInput),
      labelled('settings-import-mode', 'When a letter already exists', importMode),
    ]),
    importStatus,
    el('p', {
      class: 'field-hint',
      text:
        'Backups are validated before anything is written: the checksum is verified, images are ' +
        'checked by their contents, and anything unexpected is refused rather than imported.',
    }),
  );

  /* Optional features ------------------------------------------------------ */

  const optional = section('Optional features');
  const aiToggle = checkbox('settings-ai', 'Enable the optional AI writing assistant');
  aiToggle.input.addEventListener('change', () => {
    setPreferences({ aiAssistEnabled: aiToggle.input.checked });
    toast(
      aiToggle.input.checked
        ? 'The assistant is on. It still asks before every single request, and shows you the exact text first.'
        : 'The assistant is off. Nothing can be sent anywhere.',
      'info',
    );
  });

  optional.append(
    aiToggle.field,
    el('p', {
      class: 'field-hint',
      text:
        import.meta.env.VITE_ENABLE_AI_ASSIST === 'true'
          ? 'When enabled, selected text can be sent — with names, addresses and numbers removed — to this site’s own /api/assist function, which holds the provider key server-side. Photographs are never sent. Off by default.'
          : 'This build was made with the assistant disabled, so no text can leave this device at all.',
    }),
    createFeedbackForm().element,
  );

  /* Danger zone ------------------------------------------------------------ */

  const danger = section('Erase everything');
  const eraseButton = el('button', { type: 'button', class: 'button button--danger', text: 'Delete all local data' });
  eraseButton.addEventListener('click', () => void eraseEverything());
  danger.append(
    el('p', {
      text:
        'Removes every letter, photograph, signature, saved version and preference from this device, ' +
        'and unregisters the offline service worker.',
    }),
    el('div', { class: 'button-row' }, [eraseButton]),
  );

  /* About ------------------------------------------------------------------ */

  const about = section('About this build');
  const aboutList = el('dl', { class: 'about-list' });
  about.append(
    aboutList,
    el('p', {
      class: 'field-hint',
      text: 'Dearly by Storitellah — write what deserves to be kept.',
    }),
  );

  element.append(appearance, defaults, storage, backups, optional, danger, about);

  /* Behaviour -------------------------------------------------------------- */

  async function runExport(encrypted = false): Promise<void> {
    try {
      let password: string | undefined;
      if (encrypted) {
        if (!encryptionAvailable()) {
          toast('Encryption needs a secure (https) connection.', 'error');
          return;
        }
        const entered = await passwordDialog({
          title: 'Encrypt this backup',
          body: [
            'Your whole library will be encrypted with AES-GCM using a key derived from this password.',
            'A forgotten password cannot be recovered, by you or by anyone else.',
          ],
          confirmLabel: 'Encrypt and save',
          requireConfirmation: true,
          strengthHint: (value) => {
            const assessment = assessPassword(value);
            return `Strength: ${assessment.label}. ${assessment.hint}`;
          },
          verify: (value) => (assessPassword(value).acceptable ? null : assessPassword(value).hint),
        }).result;
        if (!entered) return;
        password = entered;
      }

      const api = await import('../export/index');
      const result = await api.exportLibraryArchive(password);
      toast(`Saved ${result.fileName} (${formatBytes(result.bytes)}).`, 'success');
    } catch (error) {
      toast(`The backup could not be created: ${describe(error)}`, 'error');
    }
  }

  async function runImport(file: File): Promise<void> {
    clear(importStatus);
    importStatus.append(el('p', { text: `Checking ${file.name}…` }));
    try {
      const api = await import('../export/index');
      const mode = importMode.value as 'merge-keep-existing' | 'merge-replace-existing';

      let password: string | undefined;
      const text = await file.slice(0, 4096).text();
      if (text.includes('"encrypted": true')) {
        const entered = await passwordDialog({
          title: 'This backup is encrypted',
          body: ['Enter the password that was used when the backup was created.'],
          confirmLabel: 'Decrypt and restore',
        }).result;
        if (!entered) {
          clear(importStatus);
          return;
        }
        password = entered;
      }

      const summary = await api.importArchiveFile(file, {
        mode,
        ...(password ? { password } : {}),
      });

      clear(importStatus);
      importStatus.append(
        el('p', {
          text:
            `Restored ${summary.imported} new ${summary.imported === 1 ? 'letter' : 'letters'}` +
            `, replaced ${summary.replaced}, skipped ${summary.skipped}` +
            `, and restored ${summary.images} ${summary.images === 1 ? 'image' : 'images'}.` +
            (summary.wasEncrypted ? ' The backup was encrypted and decrypted successfully.' : ''),
        }),
      );
      if (summary.warnings.length > 0) {
        const list = el('ul', { class: 'import-status__warnings' });
        for (const warning of [...new Set(summary.warnings)]) {
          list.append(el('li', { text: warning }));
        }
        importStatus.append(el('p', { class: 'label', text: 'Notes' }), list);
      }
      announce('Backup restored.', 'assertive');
      toast('Backup restored.', 'success');
      await refreshStorage();
    } catch (error) {
      clear(importStatus);
      const message = describe(error);
      importStatus.append(
        el('p', { class: 'import-status__error', text: `Nothing was imported. ${message}` }),
      );
      announce(`Import refused. ${message}`, 'assertive');
    }
  }

  async function eraseEverything(): Promise<void> {
    const confirmed = await confirmDialog({
      title: 'Delete everything on this device?',
      body: [
        'Every letter, photograph, signature and saved version will be permanently deleted.',
        'This cannot be undone. Export a backup first if there is anything you want to keep.',
      ],
      confirmLabel: 'Delete everything',
      danger: true,
    });
    if (!confirmed) return;
    try {
      await deleteDatabase();
      resetPreferences();
      await unregisterServiceWorker();
      toast('Everything has been deleted from this device.', 'success');
      window.setTimeout(() => window.location.reload(), 600);
    } catch (error) {
      toast(`The data could not be deleted: ${describe(error)}`, 'error');
    }
  }

  async function refreshStorage(): Promise<void> {
    clear(storageReport);
    const [quota, letters] = await Promise.all([readQuota(), countLetters().catch(() => 0)]);

    const rows: Array<[string, string]> = [
      ['Letters stored', String(letters)],
      [
        'Space used',
        quota.supported
          ? `${formatBytes(quota.usageBytes)} of about ${formatBytes(quota.quotaBytes)} (${Math.round(
              quota.ratio * 100,
            )}%)`
          : 'This browser does not report storage use',
      ],
      [
        'Eviction protection',
        quota.persisted
          ? 'Granted — the browser will keep this data'
          : 'Not granted — export backups regularly',
      ],
      [
        'Offline support',
        serviceWorkerSupported() ? 'Available in this browser' : 'Not available in this browser',
      ],
    ];

    const list = el('dl', { class: 'about-list' });
    for (const [term, value] of rows) {
      list.append(el('dt', { text: term }), el('dd', { text: value }));
    }
    storageReport.append(list);

    if (quota.level === 'almost-full') {
      storageReport.append(
        el('p', {
          class: 'import-status__error',
          text: 'Storage is almost full. Export a backup, then remove letters or photographs you no longer need.',
        }),
      );
    }
  }

  function refreshAbout(): void {
    clear(aboutList);
    const rows: Array<[string, string]> = [
      ['Version', appVersion],
      ['Deployment', deployEnvironment()],
      ['Encryption', encryptionAvailable() ? 'Available (Web Crypto, AES-GCM)' : 'Unavailable — needs https'],
      ['Data location', 'This device only, in IndexedDB'],
    ];
    for (const [term, value] of rows) {
      aboutList.append(el('dt', { text: term }), el('dd', { text: value }));
    }
  }

  async function refresh(): Promise<void> {
    const preferences = getPreferences();
    themeSelect.value = preferences.theme;
    motionSelect.value = preferences.reducedMotion;
    scaleInput.value = String(preferences.fontScale);
    scaleValue.textContent = `${Math.round(preferences.fontScale * 100)}%`;
    soundsInput.input.checked = preferences.sounds;
    nameInput.value = preferences.senderName;
    placeInput.value = preferences.senderLocation;
    paperSelect.value = preferences.paperSize;
    aiToggle.input.checked = preferences.aiAssistEnabled;
    aiToggle.input.disabled = import.meta.env.VITE_ENABLE_AI_ASSIST !== 'true';
    refreshAbout();
    await refreshStorage();
  }

  void refresh();
  setPreferences({ lastSection: 'settings' });
  focusHeading(element);

  return { element, refresh };
}

function section(title: string): HTMLElement {
  const node = el('section', { class: 'settings-section' });
  node.append(el('h2', { class: 'settings-section__title', text: title }));
  return node;
}

function labelled(id: string, label: string, control: HTMLElement): HTMLElement {
  return el('div', { class: 'field' }, [
    el('label', { class: 'label', for: id, text: label }),
    control,
  ]);
}

function select(id: string, options: Array<[string, string]>): HTMLSelectElement {
  const node = el('select', { class: 'input', id }) as HTMLSelectElement;
  for (const [value, label] of options) node.append(el('option', { value, text: label }));
  return node;
}

function checkbox(id: string, label: string): { field: HTMLElement; input: HTMLInputElement } {
  const input = el('input', { type: 'checkbox', class: 'checkbox', id }) as HTMLInputElement;
  return {
    field: el('div', { class: 'field field--checkbox' }, [
      input,
      el('label', { class: 'label', for: id, text: label }),
    ]),
    input,
  };
}
