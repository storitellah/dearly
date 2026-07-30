/**
 * Accessible dialogs, built on `<dialog>`.
 *
 * Each dialog has a label, traps focus, restores focus on close, closes on
 * Escape and on backdrop click, and reports its result. Form errors are
 * associated with their field through `aria-describedby`, never by colour alone.
 */

import { el } from '../utilities/dom';
import { trapFocus, type FocusTrap } from './focus';
import { announce } from './announce';

export interface DialogButton {
  label: string;
  value: string;
  variant?: 'primary' | 'quiet' | 'danger';
}

export interface DialogOptions {
  title: string;
  /** Paragraphs of body text. */
  body?: string[];
  /** Extra content, e.g. a form. */
  content?: Node;
  buttons: DialogButton[];
  /** Value returned when the dialog is dismissed. */
  dismissValue?: string;
  /** Announced when the dialog opens. */
  announcement?: string;
  /**
   * Called before the dialog closes. Return false to keep it open — used for
   * form validation, so an error can be shown next to the field.
   */
  validate?: (value: string) => boolean | Promise<boolean>;
}

export interface OpenDialog {
  element: HTMLDialogElement;
  /** Resolves with the chosen button value. */
  result: Promise<string>;
  close(value: string): void;
  setError(message: string | null): void;
  setBusy(busy: boolean): void;
}

export function openDialog(options: DialogOptions): OpenDialog {
  const titleId = `dlg-title-${Math.random().toString(36).slice(2, 8)}`;
  const errorId = `${titleId}-error`;

  const dialog = el('dialog', {
    class: 'dialog',
    'aria-labelledby': titleId,
  }) as HTMLDialogElement;

  const form = el('form', { method: 'dialog', class: 'dialog__form' });
  const heading = el('h2', { class: 'dialog__title', id: titleId, text: options.title });
  form.append(heading);

  if (options.body) {
    for (const paragraph of options.body) {
      form.append(el('p', { class: 'dialog__text', text: paragraph }));
    }
  }
  if (options.content) form.append(options.content);

  const error = el('p', { class: 'dialog__error', id: errorId, role: 'alert', hidden: true });
  form.append(error);

  const actions = el('div', { class: 'dialog__actions' });
  const buttons: HTMLButtonElement[] = [];
  for (const button of options.buttons) {
    const node = el('button', {
      type: 'button',
      class: `button button--${button.variant ?? 'quiet'}`,
      text: button.label,
      'data-value': button.value,
    });
    buttons.push(node);
    actions.append(node);
  }
  form.append(actions);
  dialog.append(form);
  document.body.append(dialog);

  let trap: FocusTrap | null = null;
  let settle: ((value: string) => void) | null = null;

  const result = new Promise<string>((resolve) => {
    settle = resolve;
  });

  const finish = (value: string): void => {
    if (!settle) return;
    const resolve = settle;
    settle = null;
    trap?.release();
    trap = null;
    if (dialog.open) {
      // `close()` is missing in some test environments and older engines.
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    }
    dialog.remove();
    resolve(value);
  };

  const setBusy = (busy: boolean): void => {
    for (const button of buttons) button.disabled = busy;
    dialog.classList.toggle('dialog--busy', busy);
    dialog.setAttribute('aria-busy', busy ? 'true' : 'false');
  };

  for (const button of buttons) {
    button.addEventListener('click', () => {
      const value = button.dataset.value ?? '';
      if (!options.validate || value === (options.dismissValue ?? 'cancel')) {
        finish(value);
        return;
      }
      setBusy(true);
      void Promise.resolve(options.validate(value))
        .then((ok) => {
          if (ok) finish(value);
        })
        .finally(() => setBusy(false));
    });
  }

  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    finish(options.dismissValue ?? 'cancel');
  });

  dialog.addEventListener('click', (event) => {
    // A click on the backdrop lands on the dialog element itself.
    if (event.target === dialog) finish(options.dismissValue ?? 'cancel');
  });

  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');

  trap = trapFocus(dialog, () => finish(options.dismissValue ?? 'cancel'));
  if (options.announcement) announce(options.announcement, 'assertive');

  return {
    element: dialog,
    result,
    close: finish,
    setError(message: string | null): void {
      if (message === null) {
        error.hidden = true;
        error.textContent = '';
        return;
      }
      error.hidden = false;
      error.textContent = message;
      announce(message, 'assertive');
      const field = dialog.querySelector<HTMLElement>('input, textarea, select');
      field?.setAttribute('aria-describedby', errorId);
      field?.setAttribute('aria-invalid', 'true');
    },
    setBusy,
  };
}

export async function confirmDialog(options: {
  title: string;
  body: string[];
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
}): Promise<boolean> {
  const dialog = openDialog({
    title: options.title,
    body: options.body,
    buttons: [
      { label: options.cancelLabel ?? 'Cancel', value: 'cancel', variant: 'quiet' },
      {
        label: options.confirmLabel,
        value: 'confirm',
        variant: options.danger ? 'danger' : 'primary',
      },
    ],
    dismissValue: 'cancel',
  });
  return (await dialog.result) === 'confirm';
}

export interface PasswordDialogOptions {
  title: string;
  body: string[];
  confirmLabel: string;
  /** Ask for the password twice, for locking and encrypted exports. */
  requireConfirmation?: boolean;
  strengthHint?: (password: string) => string;
  /**
   * Checks the entered password, e.g. by attempting a decryption. Return an
   * error message to keep the dialog open, or null to accept.
   */
  verify?: (password: string) => Promise<string | null> | string | null;
}

/**
 * Password prompt used for locking, unlocking and encrypted archives.
 * Resolves with the password, or null when cancelled.
 */
export function passwordDialog(options: PasswordDialogOptions): {
  result: Promise<string | null>;
} {
  const fields = el('div', { class: 'field-group' });

  const passwordId = `pwd-${Math.random().toString(36).slice(2, 8)}`;
  const hintId = `${passwordId}-hint`;
  const passwordField = el('input', {
    type: 'password',
    id: passwordId,
    class: 'input',
    autocomplete: 'new-password',
    'aria-describedby': hintId,
    required: true,
  }) as HTMLInputElement;

  fields.append(
    el('label', { class: 'label', for: passwordId, text: 'Password' }),
    passwordField,
    el('p', { class: 'field-hint', id: hintId, text: 'Dearly cannot recover a forgotten password.' }),
  );

  let confirmField: HTMLInputElement | null = null;
  if (options.requireConfirmation) {
    const confirmId = `${passwordId}-confirm`;
    confirmField = el('input', {
      type: 'password',
      id: confirmId,
      class: 'input',
      autocomplete: 'new-password',
      required: true,
    }) as HTMLInputElement;
    fields.append(el('label', { class: 'label', for: confirmId, text: 'Password again' }), confirmField);
  }

  const strength = el('p', { class: 'field-hint field-hint--strength', 'aria-live': 'polite' });
  if (options.strengthHint) fields.append(strength);

  passwordField.addEventListener('input', () => {
    if (options.strengthHint) strength.textContent = options.strengthHint(passwordField.value);
  });

  let dialogRef: OpenDialog | null = null;

  const validate = async (): Promise<boolean> => {
    const dialog = dialogRef;
    if (!dialog) return false;
    const password = passwordField.value;

    if (password.length === 0) {
      dialog.setError('Enter a password.');
      passwordField.focus();
      return false;
    }
    if (confirmField && confirmField.value !== password) {
      dialog.setError('The two passwords are not the same.');
      confirmField.focus();
      return false;
    }
    if (options.verify) {
      const message = await options.verify(password);
      if (message) {
        dialog.setError(message);
        passwordField.select();
        return false;
      }
    }
    dialog.setError(null);
    return true;
  };

  const dialog = openDialog({
    title: options.title,
    body: options.body,
    content: fields,
    buttons: [
      { label: 'Cancel', value: 'cancel', variant: 'quiet' },
      { label: options.confirmLabel, value: 'confirm', variant: 'primary' },
    ],
    dismissValue: 'cancel',
    validate,
  });
  dialogRef = dialog;

  const result = dialog.result.then((value) => (value === 'confirm' ? passwordField.value : null));
  return { result };
}
