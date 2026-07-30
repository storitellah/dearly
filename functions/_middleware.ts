/**
 * Optional middleware.
 *
 * Its only job is to mark preview deployments `noindex`. Cloudflare's `_headers`
 * file cannot match on hostname, and a preview build should never end up in a
 * search index alongside the real site.
 *
 * The application does not depend on this file: delete the whole `functions/`
 * directory and Dearly still builds, deploys and works.
 */

interface Env {
  CF_PAGES_BRANCH?: string;
}

const PRODUCTION_BRANCH = 'main';

export const onRequest: PagesFunction<Env> = async (context) => {
  const response = await context.next();
  const url = new URL(context.request.url);

  const branch = context.env.CF_PAGES_BRANCH;
  const isPreviewHost = /\.pages\.dev$/i.test(url.hostname) && url.hostname.split('.').length > 3;
  const isPreviewBranch = typeof branch === 'string' && branch !== PRODUCTION_BRANCH;

  if (!isPreviewHost && !isPreviewBranch) return response;

  const headers = new Headers(response.headers);
  headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};
