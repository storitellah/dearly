/**
 * Types for the plain-JavaScript cache policy shared by the service worker
 * build and the test suite.
 */

export declare const CACHE_PREFIX: string;
export declare function cacheName(version: string): string;
export declare function staleCaches(names: string[], current: string): string[];
export declare function shouldHandle(
  request: {
    method: string;
    url: string;
    headers?: { get: (name: string) => string | null };
    mode?: string;
  },
  origin: string,
): boolean;
export declare function strategyFor(
  pathname: string,
  mode?: string,
): 'navigation' | 'bypass' | 'cache-first' | 'revalidate';
export declare function isCacheable(response: {
  ok: boolean;
  status: number;
  type: string;
}): boolean;
