/**
 * Motion, theme and text-size preferences.
 *
 * The system setting is respected by default; the in-app setting can override it
 * in either direction, because someone may want reduced motion in Dearly only.
 */

import { getPreferences, setPreferences, type Preferences } from '../storage/preferences';

export function prefersReducedMotionSystem(): boolean {
  return typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
}

export function reducedMotionActive(preferences = getPreferences()): boolean {
  if (preferences.reducedMotion === 'reduce') return true;
  if (preferences.reducedMotion === 'allow') return false;
  return prefersReducedMotionSystem();
}

export function prefersDarkSystem(): boolean {
  return typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : false;
}

export function resolvedTheme(preferences = getPreferences()): 'light' | 'dark' | 'contrast' {
  if (preferences.theme === 'system') return prefersDarkSystem() ? 'dark' : 'light';
  return preferences.theme;
}

/** Applies every visual preference to the document root. */
export function applyPreferences(preferences: Preferences = getPreferences()): void {
  const root = document.documentElement;
  root.dataset.theme = resolvedTheme(preferences);
  root.dataset.motion = reducedMotionActive(preferences) ? 'reduced' : 'full';
  root.style.setProperty('--font-scale', String(preferences.fontScale));

  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) {
    meta.content = root.dataset.theme === 'dark' ? '#161311' : '#f6f1e7';
  }
}

/** Re-applies preferences when the operating system's settings change. */
export function watchSystemPreferences(): () => void {
  if (typeof window.matchMedia !== 'function') return () => {};
  const queries = [
    window.matchMedia('(prefers-color-scheme: dark)'),
    window.matchMedia('(prefers-reduced-motion: reduce)'),
  ];
  const handler = (): void => applyPreferences();
  for (const query of queries) query.addEventListener('change', handler);
  return () => {
    for (const query of queries) query.removeEventListener('change', handler);
  };
}

export function setTheme(theme: Preferences['theme']): void {
  applyPreferences(setPreferences({ theme }));
}

export function setFontScale(scale: number): void {
  applyPreferences(setPreferences({ fontScale: scale }));
}

export function setReducedMotion(mode: Preferences['reducedMotion']): void {
  applyPreferences(setPreferences({ reducedMotion: mode }));
}
