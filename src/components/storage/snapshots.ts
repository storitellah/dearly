/**
 * Recovery snapshots and draft history.
 *
 * A snapshot is a copy of the letter record without image bytes. They are cheap,
 * but not free, so snapshots are rate-limited per letter and pruned to a fixed
 * ceiling: enough history to recover from a crash or a regretted edit, without
 * quietly filling the user's storage with near-identical copies.
 */

import { STORE_SNAPSHOTS, requestToPromise, withTransaction } from './db';
import type { LetterRecord, LetterSnapshot } from './schema';
import { createId } from '../utilities/id';
import { wordCount } from '../utilities/format';

/** Keep at most this many snapshots per letter. */
export const MAX_SNAPSHOTS_PER_LETTER = 12;
/** Do not take an automatic snapshot more often than this. */
export const MIN_SNAPSHOT_INTERVAL_MS = 90_000;
/** Ignore automatic snapshots that changed less than this many characters. */
export const MIN_SNAPSHOT_DELTA = 40;

export interface SnapshotDecision {
  take: boolean;
  reason: 'first' | 'interval' | 'delta' | 'forced' | 'unchanged' | 'too-soon' | 'too-small';
}

/**
 * Pure decision function — unit tested directly, so snapshot churn is a
 * property of the code rather than a hope.
 */
export function shouldSnapshot(input: {
  latest: { createdAt: string; bodyLength: number } | null;
  now: number;
  bodyLength: number;
  forced?: boolean;
}): SnapshotDecision {
  if (input.forced) return { take: true, reason: 'forced' };
  if (!input.latest) return { take: true, reason: 'first' };

  const age = input.now - new Date(input.latest.createdAt).getTime();
  const delta = Math.abs(input.bodyLength - input.latest.bodyLength);

  if (delta === 0) return { take: false, reason: 'unchanged' };
  if (age < MIN_SNAPSHOT_INTERVAL_MS) return { take: false, reason: 'too-soon' };
  if (delta < MIN_SNAPSHOT_DELTA) return { take: false, reason: 'too-small' };
  return { take: true, reason: 'interval' };
}

function stripAttachmentBytes(letter: LetterRecord): LetterRecord {
  return { ...letter, attachments: letter.attachments.map((item) => ({ ...item })) };
}

export async function listSnapshots(letterId: string): Promise<LetterSnapshot[]> {
  const rows = await withTransaction(STORE_SNAPSHOTS, 'readonly', async (tx) =>
    requestToPromise(
      tx.objectStore(STORE_SNAPSHOTS).index('letterId').getAll(letterId) as IDBRequest<
        LetterSnapshot[]
      >,
    ),
  );
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function latestSnapshot(letterId: string): Promise<LetterSnapshot | null> {
  const rows = await listSnapshots(letterId);
  return rows[0] ?? null;
}

export async function saveSnapshot(
  letter: LetterRecord,
  reason: LetterSnapshot['reason'],
  options: { force?: boolean } = {},
): Promise<LetterSnapshot | null> {
  const latest = await latestSnapshot(letter.id);
  const decision = shouldSnapshot({
    latest: latest ? { createdAt: latest.createdAt, bodyLength: latest.letter.body.length } : null,
    now: Date.now(),
    bodyLength: letter.body.length,
    forced: options.force ?? reason !== 'autosave',
  });
  if (!decision.take) return null;

  const snapshot: LetterSnapshot = {
    id: createId('snp'),
    letterId: letter.id,
    createdAt: new Date().toISOString(),
    reason,
    wordCount: wordCount(letter.body),
    letter: stripAttachmentBytes(letter),
  };

  await withTransaction(STORE_SNAPSHOTS, 'readwrite', async (tx) => {
    await requestToPromise(tx.objectStore(STORE_SNAPSHOTS).put(snapshot));
  });
  await prune(letter.id);
  return snapshot;
}

async function prune(letterId: string): Promise<void> {
  const rows = await listSnapshots(letterId);
  if (rows.length <= MAX_SNAPSHOTS_PER_LETTER) return;
  const excess = rows.slice(MAX_SNAPSHOTS_PER_LETTER);
  await withTransaction(STORE_SNAPSHOTS, 'readwrite', async (tx) => {
    const store = tx.objectStore(STORE_SNAPSHOTS);
    for (const row of excess) await requestToPromise(store.delete(row.id));
  });
}

export async function deleteSnapshot(id: string): Promise<void> {
  await withTransaction(STORE_SNAPSHOTS, 'readwrite', async (tx) => {
    await requestToPromise(tx.objectStore(STORE_SNAPSHOTS).delete(id));
  });
}

export async function clearSnapshots(letterId: string): Promise<void> {
  const rows = await listSnapshots(letterId);
  if (rows.length === 0) return;
  await withTransaction(STORE_SNAPSHOTS, 'readwrite', async (tx) => {
    const store = tx.objectStore(STORE_SNAPSHOTS);
    for (const row of rows) await requestToPromise(store.delete(row.id));
  });
}
