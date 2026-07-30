/**
 * Minimal Cloudflare Pages Functions types.
 *
 * Declared locally so the repository type-checks without pulling in
 * `@cloudflare/workers-types`, which the core application does not need.
 * Install that package instead if you start writing larger Functions.
 */

declare interface PagesFunctionContext<Env = Record<string, string | undefined>> {
  request: Request;
  env: Env;
  params: Record<string, string | string[]>;
  waitUntil(promise: Promise<unknown>): void;
  next(input?: Request | string, init?: RequestInit): Promise<Response>;
  data: Record<string, unknown>;
}

declare type PagesFunction<Env = Record<string, string | undefined>> = (
  context: PagesFunctionContext<Env>,
) => Response | Promise<Response>;
