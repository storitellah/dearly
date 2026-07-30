/** Minimal typed event emitter — enough for the app's internal messaging. */

export type Listener<T> = (payload: T) => void;

export class Emitter<Events extends Record<string, unknown>> {
  private listeners = new Map<keyof Events, Set<Listener<never>>>();

  on<K extends keyof Events>(event: K, listener: Listener<Events[K]>): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener as Listener<never>);
    return () => {
      set?.delete(listener as Listener<never>);
    };
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const listener of [...set]) {
      (listener as unknown as Listener<Events[K]>)(payload);
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}

/** Tracks disposables so views can be torn down without leaking listeners. */
export class Disposables {
  private items: Array<() => void> = [];

  add(dispose: () => void): void {
    this.items.push(dispose);
  }

  listen<K extends keyof HTMLElementEventMap>(
    target: EventTarget,
    type: K | string,
    handler: (event: Event) => void,
    options?: AddEventListenerOptions,
  ): void {
    target.addEventListener(type as string, handler, options);
    this.items.push(() => target.removeEventListener(type as string, handler, options));
  }

  /** Object URLs are revoked here so image-heavy letters do not leak memory. */
  objectUrl(blob: Blob): string {
    const url = URL.createObjectURL(blob);
    this.items.push(() => URL.revokeObjectURL(url));
    return url;
  }

  dispose(): void {
    const items = this.items;
    this.items = [];
    for (const item of items.reverse()) {
      try {
        item();
      } catch (error) {
        console.warn('Dearly: failed to dispose a resource.', describe(error));
      }
    }
  }
}

/**
 * Error text safe to log: the message only, never the letter payload that may
 * have caused it.
 */
export function describe(error: unknown): string {
  if (error instanceof DOMException) return `${error.name}: ${error.message}`;
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown error';
}
