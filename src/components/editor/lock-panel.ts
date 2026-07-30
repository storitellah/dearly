/**
 * Locking a single letter with a password.
 *
 * Locking encrypts the body, addresses, tags, signature and photographs, and
 * removes the plaintext from local storage. Only the title, dates, occasion and
 * status stay readable, because the memory box has to be able to list the letter.
 */

import { el } from '../utilities/dom';
import { assessPassword, CryptoError, encryptionAvailable } from '../security/crypto';
import { canUnlock, lockLetter, unlockLetter } from '../security/letter-lock';
import { putLetter } from '../storage/letters-repo';
import { getAttachmentsForLetter } from '../storage/attachments-repo';
import { saveSnapshot, clearSnapshots } from '../storage/snapshots';
import { confirmDialog, passwordDialog } from '../accessibility/dialog';
import { announce } from '../accessibility/announce';
import { toast } from '../ui/toast';
import { describe } from '../utilities/events';
import type { EditorContext } from './context';

export interface LockPanel {
  element: HTMLElement;
  /** Prompts for the password and unlocks; used when opening a locked letter. */
  promptUnlock(): Promise<boolean>;
}

export function createLockPanel(context: EditorContext): LockPanel {
  const panel = el('details', { class: 'panel panel--security' });
  panel.append(el('summary', { class: 'panel__summary', text: 'Lock this letter' }));
  const body = el('div', { class: 'panel__body' });

  const explanation = el('p', { class: 'field-hint' });
  const actions = el('div', { class: 'button-row' });

  const lockButton = el('button', { type: 'button', class: 'button button--quiet', text: 'Lock with a password' });
  const unlockButton = el('button', { type: 'button', class: 'button button--primary', text: 'Unlock' });

  lockButton.addEventListener('click', () => void doLock());
  unlockButton.addEventListener('click', () => void promptUnlock());

  actions.append(lockButton, unlockButton);
  body.append(explanation, actions);
  panel.append(body);

  async function doLock(): Promise<void> {
    if (!encryptionAvailable()) {
      toast('This browser cannot encrypt here. A secure (https) connection is required.', 'error');
      return;
    }
    const confirmed = await confirmDialog({
      title: 'Lock this letter?',
      body: [
        'The text, addresses, tags, signature and photographs will be encrypted on this device.',
        'The title, dates and occasion stay readable so the letter can still be listed in your memory box.',
        'Dearly cannot recover a forgotten password. There is no reset, no backdoor and no support route back in.',
      ],
      confirmLabel: 'Continue',
    });
    if (!confirmed) return;

    const password = await passwordDialog({
      title: 'Choose a password',
      body: [
        'This password encrypts the letter with AES-GCM. Write it down somewhere safe before continuing.',
      ],
      confirmLabel: 'Lock the letter',
      requireConfirmation: true,
      strengthHint: (value) => {
        const assessment = assessPassword(value);
        return `Strength: ${assessment.label}. ${assessment.hint}`;
      },
      verify: (value) => (assessPassword(value).acceptable ? null : assessPassword(value).hint),
    }).result;
    if (!password) return;

    try {
      await context.flush();
      // A version is kept until the letter is locked, then history is cleared:
      // an unencrypted snapshot would defeat the point of locking.
      await saveSnapshot(context.letter, 'pre-lock', { force: true });
      const attachments = await getAttachmentsForLetter(context.letter.id);
      const locked = await lockLetter(context.letter, password, attachments);
      const saved = await putLetter(locked);
      await clearSnapshots(saved.id);
      context.setAttachments([]);
      context.replace(saved, 'lock');
      announce('This letter is now locked.', 'assertive');
      toast('Locked. Its contents are encrypted on this device.', 'success');
    } catch (error) {
      toast(`The letter could not be locked: ${describe(error)}`, 'error');
    }
  }

  async function promptUnlock(): Promise<boolean> {
    if (!context.locked) return true;

    const password = await passwordDialog({
      title: 'Unlock this letter',
      body: ['Enter the password used when this letter was locked.'],
      confirmLabel: 'Unlock',
      verify: async (value) => {
        const ok = await canUnlock(context.letter, value);
        return ok ? null : 'That password did not work. Nothing has been changed.';
      },
    }).result;
    if (!password) return false;

    try {
      const unlocked = await unlockLetter(context.letter, password);
      const saved = await putLetter(unlocked, { touch: false });
      const attachments = await getAttachmentsForLetter(saved.id);
      context.setAttachments(attachments);
      context.replace(saved, 'unlock');
      announce('The letter is unlocked.', 'assertive');
      toast('Unlocked. Lock it again when you are finished.', 'success');
      return true;
    } catch (error) {
      const message =
        error instanceof CryptoError ? error.message : `The letter could not be unlocked: ${describe(error)}`;
      toast(message, 'error');
      return false;
    }
  }

  const sync = (): void => {
    const locked = context.locked;
    lockButton.hidden = locked;
    unlockButton.hidden = !locked;
    explanation.textContent = locked
      ? 'This letter is locked. Its text, addresses and photographs are encrypted on this device and cannot be read, printed or exported until it is unlocked.'
      : 'Locking encrypts this letter on this device using a password only you know. Everything stays local: the password is never stored, never logged and never sent anywhere.';
    if (locked) panel.open = true;
  };

  sync();
  context.events.on('change', () => sync());

  return { element: panel, promptUnlock };
}
