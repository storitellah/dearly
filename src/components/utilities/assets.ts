/**
 * Base-path helpers.
 *
 * No hostname is ever hardcoded. `import.meta.env.BASE_URL` is set at build time
 * from `VITE_BASE_PATH`, so the same bundle works from a pages.dev address, a
 * root domain, a subdomain or a subdirectory.
 */

export function basePath(): string {
  const base = import.meta.env.BASE_URL ?? '/';
  return base.endsWith('/') ? base : `${base}/`;
}

/** Resolves an asset that lives in `public/`. */
export function assetUrl(path: string): string {
  return `${basePath()}${path.replace(/^\/+/, '')}`;
}

/**
 * Canonical URL for the current page. Uses `VITE_SITE_URL` when configured and
 * otherwise the browser's own origin, so previews are never mislabelled as
 * production.
 */
export function siteUrl(path = ''): string {
  const configured = (import.meta.env.VITE_SITE_URL ?? '').trim();
  const origin = configured.length > 0 ? configured.replace(/\/+$/, '') : window.location.origin;
  const base = basePath();
  return `${origin}${base}${path.replace(/^\/+/, '')}`;
}

/** Deployment label, used by the preview banner and the About panel. */
export function deployEnvironment(): string {
  const value = (import.meta.env.VITE_DEPLOY_ENV ?? '').trim();
  if (value.length > 0) return value;
  return import.meta.env.PROD ? 'production' : 'development';
}

export const appVersion: string = __APP_VERSION__;
