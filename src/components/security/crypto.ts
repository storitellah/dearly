/**
 * Local encryption, built on the Web Crypto API.
 *
 * Design, in full, because you should be able to audit it:
 *
 *  - Key derivation: PBKDF2 with SHA-256 and 250,000 iterations over a fresh
 *    16-byte random salt. Browsers do not expose Argon2; PBKDF2-SHA256 is the
 *    strongest reviewed KDF available to a purely client-side application.
 *  - Encryption: AES-GCM, 256-bit key, fresh 12-byte random IV per operation.
 *    GCM authenticates the ciphertext, so tampering is detected on decryption.
 *  - The password is used to derive a key and is then dropped. It is never
 *    stored, never written to disk, never logged and never sent anywhere.
 *  - There is no recovery path. A forgotten password means the data is gone,
 *    and the interface says so plainly instead of implying otherwise.
 */

import { fromBase64, toBase64, utf8ToBytes, bytesToUtf8 } from '../utilities/bytes';

export const ENVELOPE_VERSION = 1;
export const PBKDF2_ITERATIONS = 250_000;
export const SALT_BYTES = 16;
export const IV_BYTES = 12;

export interface CryptoEnvelope {
  version: number;
  algorithm: 'AES-GCM';
  keyDerivation: 'PBKDF2-SHA256';
  iterations: number;
  saltBase64: string;
  ivBase64: string;
  cipherTextBase64: string;
}

export class CryptoError extends Error {
  constructor(
    message: string,
    readonly kind:
      | 'unsupported'
      | 'wrong-password'
      | 'corrupt'
      | 'unsupported-version'
      | 'weak-password'
      | 'no-crypto',
  ) {
    super(message);
    this.name = 'CryptoError';
  }
}

function subtle(): SubtleCrypto {
  const api = globalThis.crypto?.subtle;
  if (!api) {
    throw new CryptoError(
      'This browser does not expose the Web Crypto API, so letters cannot be encrypted here. ' +
        'A secure (https) context is required.',
      'no-crypto',
    );
  }
  return api;
}

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  label: 'far too short' | 'weak' | 'fair' | 'good' | 'strong';
  acceptable: boolean;
  hint: string;
}

/** Minimum length Dearly will accept for an encryption password. */
export const MIN_PASSWORD_LENGTH = 8;

export function assessPassword(password: string): PasswordStrength {
  const length = password.length;
  if (length < MIN_PASSWORD_LENGTH) {
    return {
      score: 0,
      label: 'far too short',
      acceptable: false,
      hint: `Use at least ${MIN_PASSWORD_LENGTH} characters. A short phrase you will remember beats a clever short word.`,
    };
  }
  let variety = 0;
  if (/[a-z]/.test(password)) variety += 1;
  if (/[A-Z]/.test(password)) variety += 1;
  if (/[0-9]/.test(password)) variety += 1;
  if (/[^A-Za-z0-9]/.test(password)) variety += 1;

  const long = length >= 16;
  const medium = length >= 12;

  if (long && variety >= 2) {
    return { score: 4, label: 'strong', acceptable: true, hint: 'Strong. Write it down somewhere safe.' };
  }
  if (medium && variety >= 2) {
    return { score: 3, label: 'good', acceptable: true, hint: 'Good. A longer phrase would be better still.' };
  }
  if (variety >= 3 || medium) {
    return { score: 2, label: 'fair', acceptable: true, hint: 'Fair. Consider a longer passphrase of several words.' };
  }
  return {
    score: 1,
    label: 'weak',
    acceptable: true,
    hint: 'Weak. This can be guessed. Try a passphrase of four unrelated words.',
  };
}

async function deriveKey(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<CryptoKey> {
  const api = subtle();
  const baseKey = await api.importKey(
    'raw',
    utf8ToBytes(password) as unknown as BufferSource,
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return api.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as unknown as BufferSource,
      iterations,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptString(plainText: string, password: string): Promise<CryptoEnvelope> {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new CryptoError(
      `Choose a password of at least ${MIN_PASSWORD_LENGTH} characters.`,
      'weak-password',
    );
  }
  const api = subtle();
  const salt = new Uint8Array(SALT_BYTES);
  const iv = new Uint8Array(IV_BYTES);
  crypto.getRandomValues(salt);
  crypto.getRandomValues(iv);

  const key = await deriveKey(password, salt, PBKDF2_ITERATIONS);
  const cipherText = await api.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    key,
    utf8ToBytes(plainText) as unknown as BufferSource,
  );

  return {
    version: ENVELOPE_VERSION,
    algorithm: 'AES-GCM',
    keyDerivation: 'PBKDF2-SHA256',
    iterations: PBKDF2_ITERATIONS,
    saltBase64: toBase64(salt),
    ivBase64: toBase64(iv),
    cipherTextBase64: toBase64(new Uint8Array(cipherText)),
  };
}

export async function decryptString(envelope: unknown, password: string): Promise<string> {
  const parsed = parseEnvelope(envelope);
  const api = subtle();

  let salt: Uint8Array;
  let iv: Uint8Array;
  let cipherText: Uint8Array;
  try {
    salt = fromBase64(parsed.saltBase64);
    iv = fromBase64(parsed.ivBase64);
    cipherText = fromBase64(parsed.cipherTextBase64);
  } catch {
    throw new CryptoError('This encrypted data is damaged and cannot be read.', 'corrupt');
  }
  if (salt.length === 0 || iv.length === 0 || cipherText.length <= 16) {
    throw new CryptoError('This encrypted data is damaged and cannot be read.', 'corrupt');
  }

  const key = await deriveKey(password, salt, parsed.iterations);
  let plain: ArrayBuffer;
  try {
    plain = await api.decrypt(
      { name: 'AES-GCM', iv: iv as unknown as BufferSource },
      key,
      cipherText as unknown as BufferSource,
    );
  } catch {
    // AES-GCM cannot distinguish a wrong key from altered bytes: both fail the
    // authentication tag. The message says so rather than guessing.
    throw new CryptoError(
      'That password did not work. Either the password is wrong or the data has been altered.',
      'wrong-password',
    );
  }
  return bytesToUtf8(new Uint8Array(plain));
}

export function parseEnvelope(input: unknown): CryptoEnvelope {
  if (input === null || typeof input !== 'object') {
    throw new CryptoError('This is not an encrypted Dearly payload.', 'corrupt');
  }
  const raw = input as Record<string, unknown>;
  const version = typeof raw.version === 'number' ? raw.version : 0;
  if (version === 0) {
    throw new CryptoError('This is not an encrypted Dearly payload.', 'corrupt');
  }
  if (version > ENVELOPE_VERSION) {
    throw new CryptoError(
      `This was encrypted by a newer version of Dearly (format ${version}). Update Dearly, then try again.`,
      'unsupported-version',
    );
  }
  if (raw.algorithm !== 'AES-GCM' || raw.keyDerivation !== 'PBKDF2-SHA256') {
    throw new CryptoError('This payload uses an encryption method Dearly cannot read.', 'unsupported');
  }
  const iterations = typeof raw.iterations === 'number' ? Math.trunc(raw.iterations) : 0;
  if (iterations < 10_000 || iterations > 5_000_000) {
    throw new CryptoError('This payload declares an unusable key-derivation cost.', 'corrupt');
  }
  const saltBase64 = typeof raw.saltBase64 === 'string' ? raw.saltBase64 : '';
  const ivBase64 = typeof raw.ivBase64 === 'string' ? raw.ivBase64 : '';
  const cipherTextBase64 = typeof raw.cipherTextBase64 === 'string' ? raw.cipherTextBase64 : '';
  if (!saltBase64 || !ivBase64 || !cipherTextBase64) {
    throw new CryptoError('This encrypted data is incomplete.', 'corrupt');
  }
  return {
    version,
    algorithm: 'AES-GCM',
    keyDerivation: 'PBKDF2-SHA256',
    iterations,
    saltBase64,
    ivBase64,
    cipherTextBase64,
  };
}

/** True when this browser can encrypt at all (needs a secure context). */
export function encryptionAvailable(): boolean {
  return Boolean(globalThis.crypto?.subtle);
}
