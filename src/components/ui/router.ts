/**
 * Hash routing.
 *
 * Hash routes were chosen deliberately: they work from any static host, from a
 * subdirectory and from a `file://` copy, and they never put a letter id on the
 * wire. No personal data appears in a route — only opaque identifiers.
 */

export type RouteName = 'library' | 'write' | 'settings' | 'privacy' | 'print-check' | 'about';

export interface Route {
  name: RouteName;
  /** Letter id, for the `write` route. */
  id: string | null;
}

const NAMES = new Set<RouteName>([
  'library',
  'write',
  'settings',
  'privacy',
  'print-check',
  'about',
]);

export function parseRoute(hash: string): Route {
  const clean = hash.replace(/^#\/?/, '').trim();
  if (clean.length === 0) return { name: 'library', id: null };

  const [rawName, rawId] = clean.split('/');
  const name = (rawName ?? '') as RouteName;
  if (!NAMES.has(name)) return { name: 'library', id: null };

  const id = rawId && /^[a-z]{2,8}_[0-9a-f]{8,64}$/.test(rawId) ? rawId : null;
  return { name, id };
}

export function routeToHash(route: Route): string {
  return route.id ? `#/${route.name}/${route.id}` : `#/${route.name}`;
}

export function navigate(route: Route, replace = false): void {
  const hash = routeToHash(route);
  if (window.location.hash === hash) {
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    return;
  }
  if (replace) window.history.replaceState(null, '', hash);
  else window.location.hash = hash;
  if (replace) window.dispatchEvent(new HashChangeEvent('hashchange'));
}

export function onRouteChange(handler: (route: Route) => void): () => void {
  const listener = (): void => handler(parseRoute(window.location.hash));
  window.addEventListener('hashchange', listener);
  return () => window.removeEventListener('hashchange', listener);
}
