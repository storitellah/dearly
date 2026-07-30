/**
 * Keyboard focus management.
 *
 * Every dialog traps focus, returns it where it came from, and closes on Escape.
 * Focus order follows the DOM, and nothing is reachable by mouse alone.
 */

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  'summary',
].join(', ');

export function focusableWithin(root: ParentNode): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((element) => {
    if (element.hasAttribute('inert')) return false;
    if (element.getAttribute('aria-hidden') === 'true') return false;
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden';
  });
}

export interface FocusTrap {
  release(): void;
}

export function trapFocus(container: HTMLElement, onEscape?: () => void): FocusTrap {
  const previouslyFocused = document.activeElement as HTMLElement | null;

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onEscape?.();
      return;
    }
    if (event.key !== 'Tab') return;

    const focusable = focusableWithin(container);
    if (focusable.length === 0) {
      event.preventDefault();
      container.focus();
      return;
    }
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    const active = document.activeElement;

    if (event.shiftKey && (active === first || !container.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  container.addEventListener('keydown', onKeyDown);

  const initial = focusableWithin(container)[0] ?? container;
  if (!container.hasAttribute('tabindex') && initial === container) {
    container.setAttribute('tabindex', '-1');
  }
  window.setTimeout(() => initial.focus(), 0);

  return {
    release(): void {
      container.removeEventListener('keydown', onKeyDown);
      if (previouslyFocused && previouslyFocused.isConnected) previouslyFocused.focus();
    },
  };
}

/** Moves focus to a view's heading after navigation, without scrolling jank. */
export function focusHeading(root: ParentNode): void {
  const heading = root.querySelector<HTMLElement>('h1, h2, [data-view-heading]');
  if (!heading) return;
  if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
  heading.focus({ preventScroll: true });
}
