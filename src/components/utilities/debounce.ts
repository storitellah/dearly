/** Debounce and throttle helpers used by autosave and resize handling. */

export interface Debounced<A extends unknown[]> {
  (...args: A): void;
  /** Run the pending call immediately, if any. */
  flush(): void;
  /** Drop the pending call. */
  cancel(): void;
  /** True while a call is pending. */
  readonly pending: boolean;
}

export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  waitMs: number,
): Debounced<A> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastArgs: A | undefined;

  const wrapped = ((...args: A) => {
    lastArgs = args;
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      const call = lastArgs;
      lastArgs = undefined;
      if (call) fn(...call);
    }, waitMs);
  }) as Debounced<A>;

  Object.defineProperty(wrapped, 'pending', { get: () => timer !== undefined });

  wrapped.flush = () => {
    if (timer === undefined) return;
    clearTimeout(timer);
    timer = undefined;
    const call = lastArgs;
    lastArgs = undefined;
    if (call) fn(...call);
  };

  wrapped.cancel = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    lastArgs = undefined;
  };

  return wrapped;
}

/** Calls `fn` at most once per `intervalMs`, always running the final call. */
export function throttle<A extends unknown[]>(
  fn: (...args: A) => void,
  intervalMs: number,
): Debounced<A> {
  let last = 0;
  const trailing = debounce(fn, intervalMs);

  const wrapped = ((...args: A) => {
    const now = Date.now();
    if (now - last >= intervalMs) {
      last = now;
      trailing.cancel();
      fn(...args);
    } else {
      trailing(...args);
    }
  }) as Debounced<A>;

  Object.defineProperty(wrapped, 'pending', { get: () => trailing.pending });
  wrapped.flush = () => trailing.flush();
  wrapped.cancel = () => trailing.cancel();
  return wrapped;
}
