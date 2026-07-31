/**
 * Interface preferences.
 *
 * localStorage holds only these small, non-sensitive values. Letters, images,
 * signatures and archives never touch it — they live in IndexedDB.
 */

import { describe } from '../utilities/events';

export interface Preferences {
  theme: 'system' | 'light' | 'dark' | 'contrast';
  fontScale: number;
  sounds: boolean;
  reducedMotion: 'system' | 'reduce' | 'allow';
  lastSection: string;
  paperSize: 'a4' | 'letter' | 'a5';
  lastStationeryId: string;
  senderName: string;
  senderLocation: string;
  /** Set once the user has read the privacy screen. */
  privacyAcknowledged: boolean;
  /** Explicit opt-in for the optional AI assistant. Default off. */
  aiAssistEnabled: boolean;
  libraryPageSize: number;
  /** Colour theme last chosen, applied on launch. */
  lastThemeId: string;
  /** Slash commands in the writing surface. */
  slashCommands: boolean;
  /** Writing prompts shown on the desk. */
  showPrompts: boolean;
  /** The prompt most recently offered, so it is not repeated immediately. */
  lastPrompt: string;
  /** Decorative background patterns and textures. */
  decorations: boolean;
  /** Favourite sticker ids. */
  favouriteStickers: string[];
  /** Favourite template ids. */
  favouriteTemplates: string[];
}

export const DEFAULT_PREFERENCES: Preferences = {
  theme: 'system',
  fontScale: 1,
  sounds: false,
  reducedMotion: 'system',
  lastSection: 'library',
  paperSize: 'a4',
  lastStationeryId: 'ivory-laid',
  senderName: '',
  senderLocation: '',
  privacyAcknowledged: false,
  aiAssistEnabled: false,
  libraryPageSize: 12,
  lastThemeId: 'bubblegum-pink',
  slashCommands: true,
  showPrompts: true,
  lastPrompt: '',
  decorations: true,
  favouriteStickers: [],
  favouriteTemplates: [],
};

const STORAGE_KEY = 'dearly.preferences.v1';

let cache: Preferences | null = null;

function readRaw(): Partial<Preferences> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object') return {};
    const source = parsed as Record<string, unknown>;
    const clean: Record<string, unknown> = {};
    for (const key of Object.keys(DEFAULT_PREFERENCES) as Array<keyof Preferences>) {
      if (key in source) clean[key] = source[key];
    }
    return clean as Partial<Preferences>;
  } catch (error) {
    console.warn('Dearly: preferences could not be read.', describe(error));
    return {};
  }
}

function coerce(input: Partial<Preferences>): Preferences {
  const merged = { ...DEFAULT_PREFERENCES, ...input };
  return {
    theme: (['system', 'light', 'dark', 'contrast'] as const).includes(merged.theme)
      ? merged.theme
      : 'system',
    fontScale: Math.min(1.6, Math.max(0.85, Number(merged.fontScale) || 1)),
    sounds: Boolean(merged.sounds),
    reducedMotion: (['system', 'reduce', 'allow'] as const).includes(merged.reducedMotion)
      ? merged.reducedMotion
      : 'system',
    lastSection: typeof merged.lastSection === 'string' ? merged.lastSection.slice(0, 40) : 'library',
    paperSize: (['a4', 'letter', 'a5'] as const).includes(merged.paperSize)
      ? merged.paperSize
      : 'a4',
    lastStationeryId:
      typeof merged.lastStationeryId === 'string'
        ? merged.lastStationeryId.slice(0, 40)
        : 'ivory-laid',
    senderName: typeof merged.senderName === 'string' ? merged.senderName.slice(0, 120) : '',
    senderLocation:
      typeof merged.senderLocation === 'string' ? merged.senderLocation.slice(0, 120) : '',
    privacyAcknowledged: Boolean(merged.privacyAcknowledged),
    aiAssistEnabled: Boolean(merged.aiAssistEnabled),
    libraryPageSize: Math.min(48, Math.max(6, Math.trunc(Number(merged.libraryPageSize) || 12))),
    lastThemeId:
      typeof merged.lastThemeId === 'string' ? merged.lastThemeId.slice(0, 40) : 'bubblegum-pink',
    slashCommands: merged.slashCommands !== false,
    showPrompts: merged.showPrompts !== false,
    lastPrompt: typeof merged.lastPrompt === 'string' ? merged.lastPrompt.slice(0, 200) : '',
    decorations: merged.decorations !== false,
    favouriteStickers: Array.isArray(merged.favouriteStickers)
      ? merged.favouriteStickers.filter((id): id is string => typeof id === 'string').slice(0, 400)
      : [],
    favouriteTemplates: Array.isArray(merged.favouriteTemplates)
      ? merged.favouriteTemplates.filter((id): id is string => typeof id === 'string').slice(0, 200)
      : [],
  };
}

export function getPreferences(): Preferences {
  if (!cache) cache = coerce(readRaw());
  return cache;
}

export function setPreferences(patch: Partial<Preferences>): Preferences {
  const next = coerce({ ...getPreferences(), ...patch });
  cache = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (error) {
    // A full or blocked localStorage must never break writing a letter.
    console.warn('Dearly: preferences could not be saved.', describe(error));
  }
  return next;
}

/** Forgets the in-memory copy, so the next read comes from localStorage. */
export function clearPreferencesCache(): void {
  cache = null;
}

export function resetPreferences(): void {
  cache = null;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn('Dearly: preferences could not be cleared.', describe(error));
  }
}
