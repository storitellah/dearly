/** Autosave: debouncing, honest status, failure handling and recovery. */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Autosave, STATUS_TEXT, type SaveStatus } from '../src/components/editor/autosave';
import { StorageError } from '../src/components/storage/db';
import { putLetter, getLetter } from '../src/components/storage/letters-repo';
import { saveSnapshot, latestSnapshot, shouldSnapshot } from '../src/components/storage/snapshots';
import { freshDatabase, sampleLetter, wait } from './helpers';
import type { QuotaReport } from '../src/components/storage/quota';

const fullQuota: QuotaReport = {
  supported: true,
  usageBytes: 99,
  quotaBytes: 100,
  ratio: 0.99,
  level: 'almost-full',
  persisted: false,
};

beforeEach(async () => {
  await freshDatabase();
});

describe('autosave', () => {
  it('debounces typing into a single save', async () => {
    const save = vi.fn(async (letter) => letter);
    const autosave = new Autosave({ save, delayMs: 20 });
    const letter = sampleLetter();

    autosave.queue({ ...letter, body: 'a' });
    autosave.queue({ ...letter, body: 'ab' });
    autosave.queue({ ...letter, body: 'abc' });
    expect(save).not.toHaveBeenCalled();

    await wait(60);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0]?.[0].body).toBe('abc');
  });

  it('reports "Saved locally" only after the write resolves', async () => {
    const statuses: SaveStatus[] = [];
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const autosave = new Autosave({
      save: async (letter) => {
        await gate;
        return letter;
      },
      onStatus: (status) => statuses.push(status),
      delayMs: 5,
    });

    autosave.queue(sampleLetter());
    await wait(20);

    expect(statuses.map((status) => status.state)).toEqual(['unsaved', 'saving']);
    expect(statuses.some((status) => status.state === 'saved')).toBe(false);

    release();
    await wait(20);
    expect(statuses.at(-1)?.state).toBe('saved');
    expect(statuses.at(-1)?.message).toBe(STATUS_TEXT.saved);
  });

  it('surfaces a failure and keeps the letter marked unsaved', async () => {
    const statuses: SaveStatus[] = [];
    const autosave = new Autosave({
      save: async () => {
        throw new StorageError('Not enough space left on this device.', 'quota');
      },
      onStatus: (status) => statuses.push(status),
      delayMs: 5,
    });

    autosave.queue(sampleLetter());
    await wait(30);

    const last = statuses.at(-1);
    expect(last?.state).toBe('error');
    expect(last?.detail).toContain('run out of space');
    expect(autosave.hasUnsavedChanges).toBe(true);
  });

  it('never runs two saves at once, and saves again for changes made mid-save', async () => {
    let running = 0;
    let overlapped = false;
    const seen: string[] = [];

    const autosave = new Autosave({
      save: async (letter) => {
        running += 1;
        if (running > 1) overlapped = true;
        await wait(15);
        seen.push(letter.body);
        running -= 1;
        return letter;
      },
      delayMs: 5,
    });

    const letter = sampleLetter();
    autosave.queue({ ...letter, body: 'first' });
    await wait(10);
    autosave.queue({ ...letter, body: 'second' });
    await wait(80);

    expect(overlapped).toBe(false);
    expect(seen).toContain('first');
    expect(seen).toContain('second');
    expect(autosave.hasUnsavedChanges).toBe(false);
  });

  it('flushes immediately when asked', async () => {
    const save = vi.fn(async (letter) => letter);
    const autosave = new Autosave({ save, delayMs: 10_000 });
    autosave.queue(sampleLetter());
    await autosave.flush();
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('warns when storage is nearly full', async () => {
    const statuses: SaveStatus[] = [];
    const autosave = new Autosave({
      save: async (letter) => letter,
      onStatus: (status) => statuses.push(status),
      delayMs: 1,
      quotaEveryNSaves: 1,
      quota: async () => fullQuota,
    });

    autosave.queue(sampleLetter());
    await wait(30);
    expect(statuses.at(-1)?.state).toBe('storage-almost-full');
    expect(statuses.at(-1)?.detail).toContain('nearly out of space');
  });

  it('writes through to IndexedDB and can be read back', async () => {
    const autosave = new Autosave({ save: (letter) => putLetter(letter), delayMs: 5 });
    const letter = sampleLetter({ body: 'Persisted through autosave.' });
    autosave.queue(letter);
    await autosave.flush();

    const loaded = await getLetter(letter.id);
    expect(loaded?.body).toBe('Persisted through autosave.');
  });
});

describe('recovery snapshots', () => {
  it('does not create a snapshot for every keystroke', () => {
    const now = Date.now();
    const latest = { createdAt: new Date(now - 1000).toISOString(), bodyLength: 100 };

    expect(shouldSnapshot({ latest, now, bodyLength: 100 }).take).toBe(false);
    expect(shouldSnapshot({ latest, now, bodyLength: 105 }).reason).toBe('too-soon');
    expect(
      shouldSnapshot({
        latest: { createdAt: new Date(now - 200_000).toISOString(), bodyLength: 100 },
        now,
        bodyLength: 102,
      }).reason,
    ).toBe('too-small');
    expect(
      shouldSnapshot({
        latest: { createdAt: new Date(now - 200_000).toISOString(), bodyLength: 100 },
        now,
        bodyLength: 400,
      }).take,
    ).toBe(true);
    expect(shouldSnapshot({ latest: null, now, bodyLength: 1 }).reason).toBe('first');
  });

  it('keeps a recoverable snapshot after a reload', async () => {
    const letter = await putLetter(sampleLetter());
    await saveSnapshot({ ...letter, body: 'Words written just before the crash.' }, 'autosave', {
      force: true,
    });

    // Simulate a reload: the repository is read again from scratch.
    const recovered = await latestSnapshot(letter.id);
    expect(recovered?.letter.body).toBe('Words written just before the crash.');
    expect(recovered?.wordCount).toBeGreaterThan(0);
  });

  it('prunes old snapshots rather than growing without limit', async () => {
    const letter = await putLetter(sampleLetter());
    for (let index = 0; index < 20; index += 1) {
      await saveSnapshot({ ...letter, body: `version ${index}` }, 'manual', { force: true });
    }
    const snapshots = await latestSnapshot(letter.id);
    expect(snapshots).not.toBeNull();
    const { listSnapshots } = await import('../src/components/storage/snapshots');
    expect((await listSnapshots(letter.id)).length).toBeLessThanOrEqual(12);
  });
});
