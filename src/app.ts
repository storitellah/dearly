/**
 * Application wiring: shell, routing, and the lifecycle of each view.
 *
 * Views are created on demand and disposed on the way out, which keeps object
 * URLs, listeners and canvases from accumulating during a long session.
 */

import { buildShell, type Shell } from './components/ui/shell';
import { navigate, onRouteChange, parseRoute, type Route } from './components/ui/router';
import { createLibraryView } from './components/ui/library-view';
import { createSettingsView } from './components/ui/settings-view';
import { createPrivacyView } from './components/ui/privacy-view';
import { createCalibrationView } from './components/ui/calibration-view';
import { createEditorView, type EditorView } from './components/editor/editor-view';
import { createLetter } from './components/storage/schema';
import { putLetter, listLetters } from './components/storage/letters-repo';
import { getPreferences } from './components/storage/preferences';
import { applyPreferences, watchSystemPreferences } from './components/accessibility/motion';
import { readQuota } from './components/storage/quota';
import { registerServiceWorker, watchConnection } from './components/service-worker/register';
import { announce } from './components/accessibility/announce';
import { focusHeading } from './components/accessibility/focus';
import { clear, el } from './components/utilities/dom';
import { siteUrl } from './components/utilities/assets';
import { toast } from './components/ui/toast';
import { describe } from './components/utilities/events';

interface ActiveView {
  element: HTMLElement;
  dispose?: () => void;
  hasUnsavedChanges?: () => boolean;
  flush?: () => Promise<void>;
}

/**
 * Fills in the canonical and social URLs at runtime, from `VITE_SITE_URL` when
 * it is configured and otherwise from the browser's own origin. Nothing in the
 * build hardcodes a hostname, so attaching a custom domain needs no rebuild.
 */
function setCanonicalUrls(): void {
  const url = siteUrl();
  const canonical = document.getElementById('canonical-url');
  if (canonical instanceof HTMLLinkElement) canonical.href = url;
  const ogUrl = document.getElementById('og-url');
  if (ogUrl instanceof HTMLMetaElement) ogUrl.content = url;
}

export async function startApp(container: HTMLElement): Promise<void> {
  applyPreferences();
  watchSystemPreferences();
  setCanonicalUrls();

  const shell: Shell = buildShell();
  clear(container);
  container.append(shell.root);

  let active: ActiveView | null = null;
  let currentKey = '';
  let firstRender = true;

  const disposeActive = async (): Promise<void> => {
    if (!active) return;
    if (active.flush) {
      try {
        await active.flush();
      } catch (error) {
        console.warn('Dearly: a final save did not complete.', describe(error));
      }
    }
    active.dispose?.();
    active = null;
  };

  const render = async (route: Route): Promise<void> => {
    const key = `${route.name}:${route.id ?? ''}`;
    if (key === currentKey && active) return;

    await disposeActive();
    currentKey = key;
    shell.setActiveRoute(route);
    clear(shell.main);

    try {
      switch (route.name) {
        case 'write': {
          if (!route.id) {
            await openMostRecentOrNew();
            return;
          }
          const view: EditorView = await createEditorView(route.id);
          active = view;
          break;
        }
        case 'settings': {
          active = createSettingsView();
          break;
        }
        case 'privacy': {
          active = createPrivacyView();
          break;
        }
        case 'print-check': {
          active = createCalibrationView();
          break;
        }
        case 'about': {
          navigate({ name: 'settings', id: null }, true);
          return;
        }
        case 'library':
        default: {
          const view = createLibraryView();
          await view.refresh();
          active = view;
          break;
        }
      }
    } catch (error) {
      active = { element: errorView(describe(error)) };
    }

    if (active) {
      shell.main.append(active.element);
      // Move focus to the new view's heading, but not on the very first paint:
      // a focus ring on arrival is startling and helps nobody.
      if (!firstRender) focusHeading(shell.main);
      firstRender = false;
    }
    void checkStorage();
  };

  async function openMostRecentOrNew(): Promise<void> {
    try {
      const result = await listLetters({ pageSize: 1, sort: 'updated-desc' });
      const existing = result.items[0];
      if (existing) {
        navigate({ name: 'write', id: existing.id }, true);
        return;
      }
      const preferences = getPreferences();
      const letter = createLetter({
        sender: preferences.senderName,
        senderLocation: preferences.senderLocation,
        stationeryId: preferences.lastStationeryId,
        signature: {
          name: preferences.senderName,
          style: 'typed',
          attachmentId: null,
          closing: 'With love,',
        },
      });
      await putLetter(letter);
      navigate({ name: 'write', id: letter.id }, true);
    } catch (error) {
      shell.main.append(errorView(describe(error)));
    }
  }

  async function checkStorage(): Promise<void> {
    try {
      const report = await readQuota();
      if (report.level === 'almost-full') {
        shell.setStorageWarning(
          'This device is almost out of space for local data. Export a backup, then remove letters or photographs you no longer need.',
        );
      } else if (report.level === 'watch') {
        shell.setStorageWarning('Local storage is filling up. A backup would be wise.');
      } else {
        shell.setStorageWarning(null);
      }
    } catch {
      shell.setStorageWarning(null);
    }
  }

  onRouteChange((route) => {
    void render(route);
  });

  watchConnection((online) => {
    shell.setOnline(online);
    if (!online) announce('You are offline. Dearly keeps working.');
  });

  await render(parseRoute(window.location.hash));

  void registerServiceWorker({
    onUpdateReady: (apply) => {
      shell.showUpdateNotice(apply, () => Boolean(active?.hasUnsavedChanges?.()));
    },
    onOfflineReady: () => {
      toast('Dearly is ready to work offline.', 'success');
    },
  });
}

function errorView(message: string): HTMLElement {
  const view = el('section', { class: 'view view--error' });
  view.append(
    el('h1', { class: 'view__title', text: 'Something went wrong' }),
    el('p', { class: 'view__intro', text: message }),
    el('p', {
      text:
        'Your letters are stored locally and have not been changed. If this keeps happening, check that ' +
        'the browser is allowed to store data for this site, and that you are not in a private window.',
    }),
    el('a', { class: 'button button--primary', href: '#/library', text: 'Back to your memory box' }),
  );
  return view;
}
