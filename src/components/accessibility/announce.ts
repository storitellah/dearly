/**
 * Screen-reader announcements.
 *
 * Save state, page counts and errors are all communicated in text through a live
 * region, so nothing important is conveyed by colour, motion or sound alone.
 */

let politeRegion: HTMLElement | null = null;
let assertiveRegion: HTMLElement | null = null;

function ensureRegion(kind: 'polite' | 'assertive'): HTMLElement {
  const existing = kind === 'polite' ? politeRegion : assertiveRegion;
  if (existing && existing.isConnected) return existing;

  const region = document.createElement('div');
  region.className = 'visually-hidden';
  region.setAttribute('aria-live', kind);
  region.setAttribute('aria-atomic', 'true');
  region.setAttribute('role', kind === 'assertive' ? 'alert' : 'status');
  document.body.append(region);

  if (kind === 'polite') politeRegion = region;
  else assertiveRegion = region;
  return region;
}

export function announce(message: string, urgency: 'polite' | 'assertive' = 'polite'): void {
  const region = ensureRegion(urgency);
  // Clearing first makes repeated identical messages announce again.
  region.textContent = '';
  window.setTimeout(() => {
    region.textContent = message;
  }, 30);
}

export function resetAnnouncers(): void {
  politeRegion?.remove();
  assertiveRegion?.remove();
  politeRegion = null;
  assertiveRegion = null;
}
