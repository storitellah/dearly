/**
 * Byte, base64 and hashing helpers.
 *
 * These are used by the archive format and the encryption envelope, so they are
 * deliberately dependency-free and work identically in a browser, a worker and
 * the test environment.
 */

export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function fromBase64(value: string): Uint8Array {
  const normalised = value.replace(/\s+/g, '');
  if (normalised.length === 0) return new Uint8Array(0);
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(normalised)) {
    throw new Error('Value is not valid base64 data.');
  }
  const binary = atob(normalised);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function utf8ToBytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

export function bytesToUtf8(bytes: Uint8Array): string {
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
}

export function toHex(bytes: Uint8Array): string {
  let out = '';
  for (const byte of bytes) out += byte.toString(16).padStart(2, '0');
  return out;
}

/** SHA-256 of a UTF-8 string, hex encoded. Used for archive checksums. */
export async function sha256Hex(value: string | Uint8Array): Promise<string> {
  const bytes = typeof value === 'string' ? utf8ToBytes(value) : value;
  const digest = await crypto.subtle.digest('SHA-256', bytes as unknown as BufferSource);
  return toHex(new Uint8Array(digest));
}

/** Constant-time comparison for checksum and tag comparisons. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '—';
  if (value < 1024) return `${value} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let size = value / 1024;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size < 10 ? size.toFixed(1) : Math.round(size)} ${units[unitIndex]}`;
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  return toBase64(new Uint8Array(buffer));
}

export function base64ToBlob(value: string, type: string): Blob {
  const bytes = fromBase64(value);
  return new Blob([bytes as unknown as BlobPart], { type });
}
