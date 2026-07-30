/**
 * Identifier helpers.
 *
 * Identifiers never contain letter content, so they are safe to place in DOM
 * attributes, IndexedDB keys and archive files.
 */

/** Random, collision-resistant identifier. Uses the platform CSPRNG. */
export function createId(prefix = 'ltr'): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  let out = '';
  for (const byte of bytes) out += byte.toString(16).padStart(2, '0');
  return `${prefix}_${out}`;
}

/** True when a string looks like an identifier this application produced. */
export function isValidId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z]{2,8}_[0-9a-f]{8,64}$/.test(value);
}
