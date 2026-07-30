/**
 * Service worker registration and update handling.
 *
 * What the service worker does, and does not do:
 *  - It caches application assets so Dearly starts offline: HTML, CSS, JS, icons,
 *    stationery textures, sounds.
 *  - It never caches letter content. Letters live in IndexedDB and are never
 *    fetched over the network, so they cannot enter the HTTP cache.
 *  - A new version never activates while there is unsaved work: the update is
 *    offered, and applied when the user says so.
 */

import { assetUrl } from '../utilities/assets';
import { describe } from '../utilities/events';

export interface UpdateState {
  /** A newer version is installed and waiting. */
  updateReady: boolean;
  registration: ServiceWorkerRegistration | null;
}

export interface RegisterOptions {
  /** Called when a new version is waiting to take over. */
  onUpdateReady: (apply: () => void) => void;
  /** Called when the service worker has cached everything for offline use. */
  onOfflineReady?: () => void;
}

let registration: ServiceWorkerRegistration | null = null;
let refreshing = false;

export function serviceWorkerSupported(): boolean {
  return 'serviceWorker' in navigator && window.isSecureContext;
}

export async function registerServiceWorker(options: RegisterOptions): Promise<UpdateState> {
  if (!serviceWorkerSupported() || import.meta.env.DEV) {
    // In development the app runs unbundled; a service worker would only serve
    // stale modules.
    return { updateReady: false, registration: null };
  }

  try {
    registration = await navigator.serviceWorker.register(assetUrl('sw.js'), {
      scope: assetUrl(''),
      updateViaCache: 'none',
    });

    const notifyIfWaiting = (): void => {
      if (registration?.waiting && navigator.serviceWorker.controller) {
        options.onUpdateReady(() => applyUpdate());
      }
    };

    notifyIfWaiting();

    registration.addEventListener('updatefound', () => {
      const installing = registration?.installing;
      if (!installing) return;
      installing.addEventListener('statechange', () => {
        if (installing.state === 'installed') {
          if (navigator.serviceWorker.controller) notifyIfWaiting();
          else options.onOfflineReady?.();
        }
      });
    });

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });

    // Check for a new build when the app regains focus, not on a timer.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void registration?.update();
    });

    return { updateReady: Boolean(registration.waiting), registration };
  } catch (error) {
    // Offline support is a bonus, never a requirement for the app to run.
    console.warn('Dearly: the service worker could not be registered.', describe(error));
    return { updateReady: false, registration: null };
  }
}

/** Tells the waiting worker to take over; the page reloads once it does. */
export function applyUpdate(): void {
  const waiting = registration?.waiting;
  if (!waiting) {
    window.location.reload();
    return;
  }
  waiting.postMessage({ type: 'dearly:skip-waiting' });
}

export async function unregisterServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((item) => item.unregister()));
}

/** Live online/offline state, for the header indicator. */
export function watchConnection(onChange: (online: boolean) => void): () => void {
  const update = (): void => onChange(navigator.onLine);
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  update();
  return () => {
    window.removeEventListener('online', update);
    window.removeEventListener('offline', update);
  };
}
