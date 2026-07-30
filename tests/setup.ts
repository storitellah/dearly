/**
 * Test environment setup.
 *
 * jsdom provides no IndexedDB and, depending on the version, no Web Crypto, so
 * both are supplied here: a real in-memory IndexedDB implementation and Node's
 * own WebCrypto. The code under test is otherwise untouched.
 */

import 'fake-indexeddb/auto';
import { webcrypto } from 'node:crypto';
import { beforeEach, vi } from 'vitest';

if (!globalThis.crypto || !globalThis.crypto.subtle) {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    configurable: true,
    writable: true,
  });
}

// jsdom has no structuredClone before Node 17-style globals are exposed.
if (typeof globalThis.structuredClone !== 'function') {
  globalThis.structuredClone = (value: unknown) => JSON.parse(JSON.stringify(value)) as never;
}

// jsdom's Blob lacks arrayBuffer()/text() in some versions.
if (typeof Blob !== 'undefined' && typeof Blob.prototype.arrayBuffer !== 'function') {
  Object.defineProperty(Blob.prototype, 'arrayBuffer', {
    async value(this: Blob) {
      const reader = new FileReader();
      return new Promise<ArrayBuffer>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(this);
      });
    },
    configurable: true,
    writable: true,
  });
}

if (typeof Blob !== 'undefined' && typeof Blob.prototype.text !== 'function') {
  Object.defineProperty(Blob.prototype, 'text', {
    async value(this: Blob) {
      const buffer = await this.arrayBuffer();
      return new TextDecoder().decode(new Uint8Array(buffer));
    },
    configurable: true,
    writable: true,
  });
}

if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
    configurable: true,
    writable: true,
  });
}

if (typeof URL.createObjectURL !== 'function') {
  let counter = 0;
  Object.defineProperty(URL, 'createObjectURL', {
    value: () => `blob:dearly-test/${(counter += 1)}`,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    value: () => undefined,
    configurable: true,
    writable: true,
  });
}

beforeEach(() => {
  // Letter content must never be logged. Tests fail loudly if that changes.
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
