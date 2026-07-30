/**
 * Letter repository.
 *
 * Reads always pass through migration; writes always stamp `updatedAt`. Nothing
 * here reports success before the IndexedDB transaction has actually committed.
 */

import {
  STORE_ATTACHMENTS,
  STORE_LETTERS,
  STORE_SNAPSHOTS,
  requestToPromise,
  withTransaction,
} from './db';
import { migrateLetter } from './migrations';
import { CURRENT_SCHEMA_VERSION, isLetterLocked, type LetterRecord } from './schema';
import { truncate, wordCount } from '../utilities/format';

export interface LetterSummary {
  id: string;
  title: string;
  recipient: string;
  category: LetterRecord['category'];
  status: LetterRecord['status'];
  tags: string[];
  updatedAt: string;
  createdAt: string;
  dateWritten: string;
  openingDate: string | null;
  words: number;
  preview: string;
  attachmentCount: number;
  locked: boolean;
  sealed: boolean;
  printCount: number;
  fromFuture: boolean;
}

export interface ListOptions {
  /** Zero-based page index; the library view uses this for pagination. */
  page?: number;
  pageSize?: number;
  search?: string;
  category?: LetterRecord['category'] | 'all';
  status?: LetterRecord['status'] | 'all';
  sort?: 'updated-desc' | 'updated-asc' | 'created-desc' | 'title-asc';
}

export interface ListResult {
  items: LetterSummary[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export function toSummary(letter: LetterRecord, fromFuture = false): LetterSummary {
  const locked = isLetterLocked(letter);
  return {
    id: letter.id,
    title: letter.title.trim().length > 0 ? letter.title.trim() : 'Untitled letter',
    recipient: letter.recipient,
    category: letter.category,
    status: letter.status,
    tags: letter.tags,
    updatedAt: letter.updatedAt,
    createdAt: letter.createdAt,
    dateWritten: letter.dateWritten,
    openingDate: letter.openingDate,
    words: locked ? 0 : wordCount(letter.body),
    preview: locked ? '' : truncate(letter.body, 160),
    attachmentCount: locked ? letter.locked!.attachmentCount : letter.attachments.length,
    locked,
    sealed: letter.sealed,
    printCount: letter.printCount,
    fromFuture,
  };
}

export async function getLetter(id: string): Promise<LetterRecord | null> {
  const stored = await withTransaction(STORE_LETTERS, 'readonly', async (tx) =>
    requestToPromise(tx.objectStore(STORE_LETTERS).get(id) as IDBRequest<unknown>),
  );
  if (stored === undefined) return null;
  const outcome = migrateLetter(stored);
  if (outcome.changed && !outcome.fromFuture) {
    await putLetter(outcome.letter, { touch: false });
  }
  return outcome.letter;
}

export interface PutOptions {
  /** Set `updatedAt` to now. Disabled for migrations and imports. */
  touch?: boolean;
}

export async function putLetter(
  letter: LetterRecord,
  options: PutOptions = {},
): Promise<LetterRecord> {
  const touch = options.touch !== false;
  const record: LetterRecord = {
    ...letter,
    schemaVersion: letter.schemaVersion || CURRENT_SCHEMA_VERSION,
    updatedAt: touch ? new Date().toISOString() : letter.updatedAt,
  };
  await withTransaction(STORE_LETTERS, 'readwrite', async (tx) => {
    await requestToPromise(tx.objectStore(STORE_LETTERS).put(structuredCloneSafe(record)));
  });
  return record;
}

/**
 * IndexedDB stores structured clones. `unknownFields` may hold data from a newer
 * build, so it is round-tripped through JSON to guarantee it is cloneable.
 */
function structuredCloneSafe(letter: LetterRecord): LetterRecord {
  if (!letter.unknownFields) return letter;
  try {
    return { ...letter, unknownFields: JSON.parse(JSON.stringify(letter.unknownFields)) };
  } catch {
    const { unknownFields: _dropped, ...rest } = letter;
    return rest as LetterRecord;
  }
}

/** Deletes a letter together with its attachments and snapshots, atomically. */
export async function deleteLetter(id: string): Promise<void> {
  await withTransaction(
    [STORE_LETTERS, STORE_ATTACHMENTS, STORE_SNAPSHOTS],
    'readwrite',
    async (tx) => {
      await requestToPromise(tx.objectStore(STORE_LETTERS).delete(id));
      await deleteByIndex(tx.objectStore(STORE_ATTACHMENTS), 'letterId', id);
      await deleteByIndex(tx.objectStore(STORE_SNAPSHOTS), 'letterId', id);
    },
  );
}

function deleteByIndex(store: IDBObjectStore, indexName: string, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = store.index(indexName).openKeyCursor(IDBKeyRange.only(key));
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve();
        return;
      }
      store.delete(cursor.primaryKey);
      cursor.continue();
    };
    request.onerror = () => reject(request.error);
  });
}

/** Every letter, migrated. Used by backup and by the library index. */
export async function getAllLetters(): Promise<Array<{ letter: LetterRecord; fromFuture: boolean }>> {
  const rows = await withTransaction(STORE_LETTERS, 'readonly', async (tx) =>
    requestToPromise(tx.objectStore(STORE_LETTERS).getAll() as IDBRequest<unknown[]>),
  );
  return rows.map((row) => {
    const outcome = migrateLetter(row);
    return { letter: outcome.letter, fromFuture: outcome.fromFuture };
  });
}

/**
 * Paginated, filtered summaries. Only summary fields are kept in memory, and
 * attachment bytes live in a separate store, so a large memory box never loads
 * full-resolution photographs to draw a list.
 */
export async function listLetters(options: ListOptions = {}): Promise<ListResult> {
  const page = Math.max(0, options.page ?? 0);
  const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 12));
  const search = (options.search ?? '').trim().toLowerCase();
  const category = options.category ?? 'all';
  const status = options.status ?? 'all';
  const sort = options.sort ?? 'updated-desc';

  const all = await getAllLetters();
  let summaries = all.map(({ letter, fromFuture }) => toSummary(letter, fromFuture));

  if (category !== 'all') summaries = summaries.filter((item) => item.category === category);
  if (status !== 'all') summaries = summaries.filter((item) => item.status === status);
  if (search.length > 0) {
    summaries = summaries.filter((item) => {
      const haystack = [item.title, item.recipient, item.tags.join(' '), item.preview]
        .join(' ')
        .toLowerCase();
      return haystack.includes(search);
    });
  }

  summaries.sort((a, b) => {
    switch (sort) {
      case 'updated-asc':
        return a.updatedAt.localeCompare(b.updatedAt);
      case 'created-desc':
        return b.createdAt.localeCompare(a.createdAt);
      case 'title-asc':
        return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
      case 'updated-desc':
      default:
        return b.updatedAt.localeCompare(a.updatedAt);
    }
  });

  const total = summaries.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const start = safePage * pageSize;

  return {
    items: summaries.slice(start, start + pageSize),
    total,
    page: safePage,
    pageSize,
    pageCount,
  };
}

export async function countLetters(): Promise<number> {
  return withTransaction(STORE_LETTERS, 'readonly', async (tx) =>
    requestToPromise(tx.objectStore(STORE_LETTERS).count()),
  );
}
