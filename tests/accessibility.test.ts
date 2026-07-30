/** Keyboard navigation, dialogs, announcements, motion and preferences. */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { focusableWithin, trapFocus, focusHeading } from '../src/components/accessibility/focus';
import { confirmDialog, openDialog } from '../src/components/accessibility/dialog';
import { announce, resetAnnouncers } from '../src/components/accessibility/announce';
import {
  applyPreferences,
  reducedMotionActive,
  resolvedTheme,
} from '../src/components/accessibility/motion';
import {
  DEFAULT_PREFERENCES,
  clearPreferencesCache,
  getPreferences,
  resetPreferences,
  setPreferences,
} from '../src/components/storage/preferences';
import { levelFor, hasHeadroom } from '../src/components/storage/quota';
import { nextPrompt, promptsFor } from '../src/components/prompts/prompt-library';
import { wait } from './helpers';

beforeEach(() => {
  document.body.replaceChildren();
  resetAnnouncers();
  resetPreferences();
});

afterEach(() => {
  document.body.replaceChildren();
  resetPreferences();
});

describe('keyboard navigation', () => {
  function buildPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.innerHTML = '';
    for (const label of ['One', 'Two', 'Three']) {
      const button = document.createElement('button');
      button.textContent = label;
      panel.append(button);
    }
    const hidden = document.createElement('button');
    hidden.textContent = 'Hidden';
    hidden.setAttribute('aria-hidden', 'true');
    panel.append(hidden);
    document.body.append(panel);
    return panel;
  }

  it('finds only genuinely focusable, visible controls', () => {
    const panel = buildPanel();
    const focusable = focusableWithin(panel);
    expect(focusable.map((node) => node.textContent)).toEqual(['One', 'Two', 'Three']);
  });

  it('wraps Tab and Shift+Tab inside a trap, and returns focus on release', async () => {
    const outside = document.createElement('button');
    outside.textContent = 'Outside';
    document.body.append(outside);
    outside.focus();

    const panel = buildPanel();
    const trap = trapFocus(panel);
    await wait(10);

    const buttons = focusableWithin(panel);
    expect(document.activeElement).toBe(buttons[0]);

    buttons[2]!.focus();
    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(document.activeElement).toBe(buttons[0]);

    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }));
    expect(document.activeElement).toBe(buttons[2]);

    trap.release();
    expect(document.activeElement).toBe(outside);
  });

  it('calls the escape handler on Escape', () => {
    const panel = buildPanel();
    let escaped = false;
    const trap = trapFocus(panel, () => {
      escaped = true;
    });
    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(escaped).toBe(true);
    trap.release();
  });

  it('moves focus to a view heading after navigation', () => {
    const view = document.createElement('section');
    const heading = document.createElement('h1');
    heading.textContent = 'Your memory box';
    view.append(heading);
    document.body.append(view);

    focusHeading(view);
    expect(document.activeElement).toBe(heading);
    expect(heading.getAttribute('tabindex')).toBe('-1');
  });
});

describe('dialogs', () => {
  it('is labelled, traps focus and returns the chosen value', async () => {
    const dialog = openDialog({
      title: 'Delete this letter?',
      body: ['This cannot be undone.'],
      buttons: [
        { label: 'Cancel', value: 'cancel', variant: 'quiet' },
        { label: 'Delete', value: 'confirm', variant: 'danger' },
      ],
      dismissValue: 'cancel',
    });

    const element = dialog.element;
    expect(element.getAttribute('aria-labelledby')).toBeTruthy();
    const labelId = element.getAttribute('aria-labelledby')!;
    expect(element.querySelector(`#${labelId}`)?.textContent).toBe('Delete this letter?');

    const confirm = Array.from(element.querySelectorAll('button')).find(
      (button) => button.dataset.value === 'confirm',
    );
    confirm?.click();

    expect(await dialog.result).toBe('confirm');
    expect(element.isConnected).toBe(false);
  });

  it('shows an error next to the field instead of closing', async () => {
    let attempts = 0;
    const dialog = openDialog({
      title: 'Password',
      content: document.createElement('input'),
      buttons: [
        { label: 'Cancel', value: 'cancel' },
        { label: 'Unlock', value: 'confirm', variant: 'primary' },
      ],
      dismissValue: 'cancel',
      validate: () => {
        attempts += 1;
        return attempts > 1;
      },
    });

    const confirm = Array.from(dialog.element.querySelectorAll('button')).find(
      (button) => button.dataset.value === 'confirm',
    )!;

    confirm.click();
    await wait(10);
    expect(dialog.element.isConnected).toBe(true);

    dialog.setError('That password did not work.');
    const error = dialog.element.querySelector('.dialog__error');
    expect(error?.getAttribute('role')).toBe('alert');
    expect(error?.textContent).toBe('That password did not work.');
    expect(dialog.element.querySelector('input')?.getAttribute('aria-invalid')).toBe('true');

    confirm.click();
    expect(await dialog.result).toBe('confirm');
  });

  it('cancels on Escape', async () => {
    const pending = confirmDialog({
      title: 'Sure?',
      body: ['Really?'],
      confirmLabel: 'Yes',
    });
    await wait(10);
    const element = document.querySelector('dialog')!;
    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(await pending).toBe(false);
  });
});

describe('announcements', () => {
  it('writes to a polite live region', async () => {
    announce('Saved locally.');
    await wait(60);
    const region = document.querySelector('[aria-live="polite"]');
    expect(region?.getAttribute('role')).toBe('status');
    expect(region?.textContent).toBe('Saved locally.');
  });

  it('uses an assertive region for errors', async () => {
    announce('Unable to save.', 'assertive');
    await wait(60);
    const region = document.querySelector('[aria-live="assertive"]');
    expect(region?.getAttribute('role')).toBe('alert');
    expect(region?.textContent).toBe('Unable to save.');
  });
});

describe('motion, theme and text size', () => {
  it('honours the in-app reduced-motion setting in both directions', () => {
    expect(reducedMotionActive({ ...DEFAULT_PREFERENCES, reducedMotion: 'reduce' })).toBe(true);
    expect(reducedMotionActive({ ...DEFAULT_PREFERENCES, reducedMotion: 'allow' })).toBe(false);
    // jsdom reports no system preference, so `system` resolves to false here.
    expect(reducedMotionActive({ ...DEFAULT_PREFERENCES, reducedMotion: 'system' })).toBe(false);
  });

  it('applies theme, motion and text scale to the document', () => {
    applyPreferences({ ...DEFAULT_PREFERENCES, theme: 'dark', reducedMotion: 'reduce', fontScale: 1.25 });
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.dataset.motion).toBe('reduced');
    expect(document.documentElement.style.getPropertyValue('--font-scale')).toBe('1.25');

    applyPreferences({ ...DEFAULT_PREFERENCES, theme: 'contrast' });
    expect(resolvedTheme({ ...DEFAULT_PREFERENCES, theme: 'contrast' })).toBe('contrast');
  });
});

describe('preferences', () => {
  it('stores only small interface settings, never letters', () => {
    setPreferences({ theme: 'dark', fontScale: 1.2, senderName: 'Bee' });
    const raw = localStorage.getItem('dearly.preferences.v1') ?? '';
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    expect(Object.keys(parsed).sort()).toEqual(Object.keys(DEFAULT_PREFERENCES).sort());
    expect(raw).not.toContain('body');
    expect(getPreferences().theme).toBe('dark');
  });

  it('clamps and repairs nonsense values', () => {
    localStorage.setItem(
      'dearly.preferences.v1',
      JSON.stringify({ theme: 'rainbow', fontScale: 99, libraryPageSize: -4, sounds: 'yes' }),
    );
    clearPreferencesCache();
    const preferences = getPreferences();

    expect(preferences.theme).toBe('system');
    expect(preferences.fontScale).toBeLessThanOrEqual(1.6);
    expect(preferences.libraryPageSize).toBeGreaterThanOrEqual(6);
    expect(preferences.sounds).toBe(true);
  });

  it('survives a broken localStorage entry', () => {
    localStorage.setItem('dearly.preferences.v1', 'not json');
    clearPreferencesCache();
    expect(getPreferences()).toEqual(DEFAULT_PREFERENCES);
  });
});

describe('storage quota reporting', () => {
  it('classifies usage', () => {
    expect(levelFor(10, 100)).toBe('ok');
    expect(levelFor(80, 100)).toBe('watch');
    expect(levelFor(95, 100)).toBe('almost-full');
    expect(levelFor(10, 0)).toBe('unknown');
  });

  it('knows when there is no room for a large write', () => {
    const report = {
      supported: true,
      usageBytes: 90,
      quotaBytes: 100,
      ratio: 0.9,
      level: 'almost-full' as const,
      persisted: false,
    };
    expect(hasHeadroom(report, 5)).toBe(true);
    expect(hasHeadroom(report, 50)).toBe(false);
  });
});

describe('writing prompts', () => {
  it('offers prompts for the chosen occasion plus general ones', () => {
    const prompts = promptsFor('apology');
    expect(prompts.some((prompt) => prompt.category === 'apology')).toBe(true);
    expect(prompts.some((prompt) => prompt.category === 'any')).toBe(true);
  });

  it('never repeats the prompt currently on screen', () => {
    const first = nextPrompt('love', null, () => 0);
    const second = nextPrompt('love', first.id, () => 0);
    expect(second.id).not.toBe(first.id);
  });
});
