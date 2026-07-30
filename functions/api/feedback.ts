/**
 * Optional: private feedback and bug reports.
 *
 * This is the only server-side route the interface offers by default, and it is
 * hidden unless the build sets `VITE_ENABLE_FEEDBACK=true`. It forwards a short
 * message to a webhook whose URL is a Cloudflare secret — never a frontend value.
 *
 * Never logs letter content. It cannot: no letter content is ever sent here.
 */

interface Env {
  /** Set as an encrypted environment variable in the Pages dashboard. */
  FEEDBACK_WEBHOOK_URL?: string;
}

const MAX_BODY_BYTES = 8 * 1024;
const MAX_MESSAGE = 4000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 3;

/**
 * In-memory rate limit. A Pages Function instance is short-lived, so this stops
 * accidental double-submits and casual abuse; a KV or Durable Object binding
 * would be needed for a hard guarantee.
 */
const recent = new Map<string, number[]>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const hits = (recent.get(key) ?? []).filter((time) => now - time < RATE_LIMIT_WINDOW_MS);
  hits.push(now);
  recent.set(key, hits);
  if (recent.size > 5000) recent.clear();
  return hits.length > RATE_LIMIT_MAX;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function clean(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, max).trim();
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { Allow: 'POST, OPTIONS' } });
  }
  if (request.method !== 'POST') {
    return json({ error: 'Only POST is supported.' }, 405);
  }

  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return json({ error: 'Send JSON.' }, 415);
  }

  const declaredLength = Number(request.headers.get('content-length') ?? '0');
  if (declaredLength > MAX_BODY_BYTES) {
    return json({ error: 'That message is too long.' }, 413);
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return json({ error: 'That message is too long.' }, 413);
  }

  let payload: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return json({ error: 'Unexpected message format.' }, 400);
    }
    payload = parsed as Record<string, unknown>;
  } catch {
    return json({ error: 'Unexpected message format.' }, 400);
  }

  const message = clean(payload.message, MAX_MESSAGE);
  if (message.length < 4) {
    return json({ error: 'Please write a little more.' }, 400);
  }

  const kind = ['feedback', 'bug', 'idea'].includes(String(payload.kind))
    ? String(payload.kind)
    : 'feedback';
  const replyTo = clean(payload.replyTo, 200);
  if (replyTo.length > 0 && !/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(replyTo)) {
    return json({ error: 'That email address does not look right.' }, 400);
  }
  const appVersion = clean(payload.appVersion, 32);
  const deployEnvironment = clean(payload.deployEnvironment, 32);

  const clientKey = request.headers.get('cf-connecting-ip') ?? 'unknown';
  if (rateLimited(clientKey)) {
    return json({ error: 'Too many messages just now. Please try again shortly.' }, 429);
  }

  const webhook = env.FEEDBACK_WEBHOOK_URL;
  if (!webhook) {
    // Configured off: say so honestly rather than pretending it was delivered.
    return json(
      { error: 'Feedback is not configured on this deployment. Email hello@storitellah.com instead.' },
      503,
    );
  }

  try {
    const upstream = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'dearly',
        kind,
        message,
        replyTo: replyTo.length > 0 ? replyTo : undefined,
        appVersion,
        deployEnvironment,
        receivedAt: new Date().toISOString(),
      }),
    });
    if (!upstream.ok) {
      return json({ error: 'The message could not be delivered. Please try again later.' }, 502);
    }
  } catch {
    return json({ error: 'The message could not be delivered. Please try again later.' }, 502);
  }

  return json({ ok: true }, 200);
};
