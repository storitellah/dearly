/**
 * Transient messages.
 *
 * Every toast is also announced to screen readers, and none of them is the only
 * way to learn something: state that matters is always reflected in the page.
 */

import { el } from '../utilities/dom';
import { announce } from '../accessibility/announce';
import { reducedMotionActive } from '../accessibility/motion';

export type ToastKind = 'info' | 'success' | 'warning' | 'error';

let container: HTMLElement | null = null;

function ensureContainer(): HTMLElement {
  if (container && container.isConnected) return container;
  container = el('div', { class: 'toasts', id: 'dearly-toasts' });
  document.body.append(container);
  return container;
}

export function toast(message: string, kind: ToastKind = 'info', durationMs = 5000): void {
  const host = ensureContainer();
  const node = el('div', { class: `toast toast--${kind}` });
  node.append(el('p', { class: 'toast__text', text: message }));

  const dismiss = el('button', {
    type: 'button',
    class: 'toast__close',
    'aria-label': 'Dismiss this message',
    text: '×',
  });
  dismiss.addEventListener('click', () => remove());
  node.append(dismiss);
  host.append(node);

  announce(message, kind === 'error' ? 'assertive' : 'polite');

  let removed = false;
  const remove = (): void => {
    if (removed) return;
    removed = true;
    if (reducedMotionActive()) {
      node.remove();
      return;
    }
    node.classList.add('toast--leaving');
    window.setTimeout(() => node.remove(), 200);
  };

  window.setTimeout(remove, Math.max(2000, durationMs));
}

export function clearToasts(): void {
  container?.remove();
  container = null;
}
