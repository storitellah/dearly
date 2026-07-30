/**
 * IndexedDB access layer.
 *
 * Letters live here — never in localStorage, never in the HTTP cache, never in
 * a URL. The wrapper is intentionally thin: promise-shaped requests, explicit
 * transactions and errors that surface to the caller instead of being swallowed.
 */

import { describe } from '../utilities/events';

export const DB_NAME = 'dearly';
export const DB_VERSION = 2;

export const STORE_LETTERS = 'letters';
export const STORE_ATTACHMENTS = 'attachments';
export const STORE_SNAPSHOTS = 'snapshots';
export const STORE_META = 'meta';

export class StorageError extends Error {
  constructor(
    message: string,
    readonly kind: 'quota' | 'blocked' | 'unavailable' | 'failed',
    override readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'StorageError';
  }
}

let dbPromise: Promise<IDBDatabase> | null = null;

function classify(error: unknown): StorageError {
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'QuotaExceededError') {
    return new StorageError('Not enough space left on this device.', 'quota', error);
  }
  if (name === 'VersionError' || name === 'InvalidStateError') {
    return new StorageError('Local storage is in an unexpected state.', 'blocked', error);
  }
  return new StorageError(describe(error) || 'Local storage failed.', 'failed', error);
}

export function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(classify(request.error));
  });
}

function upgrade(db: IDBDatabase, tx: IDBTransaction | null, oldVersion: number): void {
  if (!db.objectStoreNames.contains(STORE_LETTERS)) {
    const letters = db.createObjectStore(STORE_LETTERS, { keyPath: 'id' });
    letters.createIndex('updatedAt', 'updatedAt');
    letters.createIndex('status', 'status');
    letters.createIndex('category', 'category');
  } else if (tx) {
    // Add indexes introduced after the first release without touching records.
    const letters = tx.objectStore(STORE_LETTERS);
    for (const name of ['updatedAt', 'status', 'category'] as const) {
      if (!letters.indexNames.contains(name)) letters.createIndex(name, name);
    }
  }
  if (!db.objectStoreNames.contains(STORE_ATTACHMENTS)) {
    const attachments = db.createObjectStore(STORE_ATTACHMENTS, { keyPath: 'id' });
    attachments.createIndex('letterId', 'letterId');
  }
  if (!db.objectStoreNames.contains(STORE_SNAPSHOTS)) {
    const snapshots = db.createObjectStore(STORE_SNAPSHOTS, { keyPath: 'id' });
    snapshots.createIndex('letterId', 'letterId');
    snapshots.createIndex('createdAt', 'createdAt');
  }
  if (!db.objectStoreNames.contains(STORE_META)) {
    db.createObjectStore(STORE_META, { keyPath: 'key' });
  }
  // Letter records themselves are migrated lazily on read, by
  // src/components/storage/migrations.ts, so an upgrade never rewrites content.
  void oldVersion;
}

export function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(
        new StorageError(
          'This browser has no IndexedDB, so letters cannot be stored locally.',
          'unavailable',
        ),
      );
      return;
    }

    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (error) {
      reject(classify(error));
      return;
    }

    request.onupgradeneeded = (event) => {
      const db = request.result;
      upgrade(db, request.transaction, event.oldVersion);
    };
    request.onblocked = () => {
      reject(
        new StorageError(
          'Another Dearly tab is holding the database open. Close it and try again.',
          'blocked',
        ),
      );
    };
    request.onerror = () => reject(classify(request.error));
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        // A newer build wants to upgrade. Release the handle so it can.
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
  }).catch((error: unknown) => {
    dbPromise = null;
    throw error;
  });

  return dbPromise;
}

/** Runs `work` inside one transaction and resolves when it has committed. */
export async function withTransaction<T>(
  stores: string | string[],
  mode: IDBTransactionMode,
  work: (tx: IDBTransaction) => Promise<T> | T,
): Promise<T> {
  const db = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    let tx: IDBTransaction;
    try {
      tx = db.transaction(stores, mode);
    } catch (error) {
      reject(classify(error));
      return;
    }

    let result: T;
    let settled = false;

    tx.oncomplete = () => {
      if (!settled) {
        settled = true;
        resolve(result);
      }
    };
    tx.onerror = () => {
      if (!settled) {
        settled = true;
        reject(classify(tx.error));
      }
    };
    tx.onabort = () => {
      if (!settled) {
        settled = true;
        reject(classify(tx.error));
      }
    };

    void (async () => {
      try {
        result = await work(tx);
      } catch (error) {
        settled = true;
        try {
          tx.abort();
        } catch {
          /* already finished */
        }
        reject(error instanceof StorageError ? error : classify(error));
      }
    })();
  });
}

export async function readMeta<T>(key: string): Promise<T | undefined> {
  return withTransaction(STORE_META, 'readonly', async (tx) => {
    const row = await requestToPromise(
      tx.objectStore(STORE_META).get(key) as IDBRequest<{ key: string; value: T } | undefined>,
    );
    return row?.value;
  });
}

export async function writeMeta<T>(key: string, value: T): Promise<void> {
  await withTransaction(STORE_META, 'readwrite', async (tx) => {
    await requestToPromise(tx.objectStore(STORE_META).put({ key, value }));
  });
}

/** Test hook: forget the cached connection. */
export function resetDatabaseHandle(): void {
  dbPromise = null;
}

/** Deletes the whole local database. Used by Settings → Erase everything. */
export async function deleteDatabase(): Promise<void> {
  resetDatabaseHandle();
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(classify(request.error));
    request.onblocked = () => resolve();
  });
}
