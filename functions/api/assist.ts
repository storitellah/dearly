/**
 * Optional: the AI writing assistant proxy.
 *
 * Exists for one reason: to keep the provider's API key on the server. The
 * browser never holds it, and the browser never talks to the provider directly.
 *
 * Rules enforced here, not merely promised in the interface:
 *  - POST only, JSON only, small bodies only.
 *  - A short allow-list of tasks; anything else is refused.
 *  - Rate limited per address.
 *  - The submitted text is never logged, never stored and never echoed back in
 *    an error message.
 *  - With `AI_API_KEY` unset the route replies 503 and Dearly carries on: the
 *    assistant is an extra, never a dependency.
 */

interface Env {
  /** Cloudflare secret. Never a VITE_ variable, never in the repository. */
  AI_API_KEY?: string;
  /** Provider endpoint, e.g. https://api.anthropic.com/v1/messages */
  AI_API_URL?: string;
  AI_MODEL?: string;
}

const MAX_BODY_BYTES = 24 * 1024;
const MAX_TEXT = 6000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 6;

const TASKS = ['opening', 'questions', 'spelling', 'translate', 'closing'] as const;
type Task = (typeof TASKS)[number];

const INSTRUCTIONS: Record<Task, string> = {
  opening:
    'Suggest three ways the writer might open this letter, in their own register. Do not write the letter for them.',
  questions:
    'Suggest three questions the writer might ask the person they are writing to, based on what they have written.',
  spelling:
    'List only spelling and punctuation corrections. Do not rewrite, reword or restyle anything. If there are none, say so.',
  translate:
    'Translate the text faithfully into the language the writer appears to want, keeping their tone. Do not improve it.',
  closing: 'Suggest three closing lines and sign-offs that would suit this letter.',
};

const SYSTEM_PROMPT =
  'You are a careful assistant inside a private letter-writing application. You never write a ' +
  'complete letter for the user, never imitate their intimate voice, and never invent facts about ' +
  'the people involved. You offer short, plain suggestions the writer can accept, adapt or ignore. ' +
  'Reply as a JSON array of strings and nothing else.';

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

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { Allow: 'POST, OPTIONS' } });
  }
  if (request.method !== 'POST') {
    return json({ error: 'Only POST is supported.' }, 405);
  }
  if (!(request.headers.get('content-type') ?? '').includes('application/json')) {
    return json({ error: 'Send JSON.' }, 415);
  }
  if (Number(request.headers.get('content-length') ?? '0') > MAX_BODY_BYTES) {
    return json({ error: 'That selection is too long. Select a smaller passage.' }, 413);
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return json({ error: 'That selection is too long. Select a smaller passage.' }, 413);
  }

  let payload: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return json({ error: 'Unexpected request format.' }, 400);
    }
    payload = parsed as Record<string, unknown>;
  } catch {
    return json({ error: 'Unexpected request format.' }, 400);
  }

  const task = TASKS.includes(payload.task as Task) ? (payload.task as Task) : null;
  if (!task) return json({ error: 'Unknown task.' }, 400);

  const text = typeof payload.text === 'string' ? payload.text.slice(0, MAX_TEXT).trim() : '';
  if (text.length < 2) return json({ error: 'There is nothing to work with.' }, 400);

  const clientKey = request.headers.get('cf-connecting-ip') ?? 'unknown';
  if (rateLimited(clientKey)) {
    return json({ error: 'Too many requests just now. Please try again shortly.' }, 429);
  }

  const apiKey = env.AI_API_KEY;
  const apiUrl = env.AI_API_URL;
  if (!apiKey || !apiUrl) {
    return json(
      {
        error:
          'The writing assistant is not configured on this deployment. Every other part of Dearly works as normal.',
      },
      503,
    );
  }

  try {
    const upstream = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: env.AI_MODEL ?? 'claude-sonnet-5',
        max_tokens: 700,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `${INSTRUCTIONS[task]}\n\n---\n${text}\n---`,
          },
        ],
      }),
    });

    if (!upstream.ok) {
      // Never pass a provider error body back: it can echo the submitted text.
      return json({ error: 'The assistant is unavailable at the moment.' }, 502);
    }

    const result = (await upstream.json()) as {
      content?: Array<{ type?: string; text?: string }>;
    };
    const reply = (result.content ?? [])
      .filter((part) => part.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text as string)
      .join('\n')
      .trim();

    return json({ suggestions: parseSuggestions(reply) }, 200);
  } catch {
    return json({ error: 'The assistant could not be reached.' }, 502);
  }
};

/** Accepts a JSON array, or falls back to splitting lines. */
function parseSuggestions(reply: string): string[] {
  const trimmed = reply.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim().slice(0, 600))
        .filter((item) => item.length > 0)
        .slice(0, 6);
    }
  } catch {
    /* fall through to line splitting */
  }
  return trimmed
    .split(/\n+/)
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim().slice(0, 600))
    .filter((line) => line.length > 0)
    .slice(0, 6);
}
