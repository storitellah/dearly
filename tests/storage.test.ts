/** Creating, editing, listing, deleting letters, and attachment storage. */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  deleteLetter,
  getAllLetters,
  getLetter,
  listLetters,
  putLetter,
  toSummary,
} from '../src/components/storage/letters-repo';
import {
  deleteAttachment,
  getAttachmentsForLetter,
  putAttachment,
} from '../src/components/storage/attachments-repo';
import { listSnapshots, saveSnapshot } from '../src/components/storage/snapshots';
import { createLetter } from '../src/components/storage/schema';
import { freshDatabase, sampleAttachment, sampleLetter } from './helpers';

beforeEach(async () => {
  await freshDatabase();
});

describe('creating and editing a letter', () => {
  it('stores a new letter and reads it back unchanged', async () => {
    const letter = sampleLetter();
    await putLetter(letter);

    const loaded = await getLetter(letter.id);
    expect(loaded).not.toBeNull();
    expect(loaded?.title).toBe('For Nan');
    expect(loaded?.body).toContain('The garden is doing what you said');
    expect(loaded?.tags).toEqual(['garden', 'family']);
  });

  it('stamps updatedAt on every save, and leaves it alone when asked not to', async () => {
    const letter = await putLetter(sampleLetter({ updatedAt: '2020-01-01T00:00:00.000Z' }));
    expect(letter.updatedAt).not.toBe('2020-01-01T00:00:00.000Z');

    const untouched = await putLetter(
      { ...letter, updatedAt: '2020-01-01T00:00:00.000Z' },
      { touch: false },
    );
    expect(untouched.updatedAt).toBe('2020-01-01T00:00:00.000Z');
  });

  it('persists an edit', async () => {
    const letter = await putLetter(sampleLetter());
    await putLetter({ ...letter, body: 'A different letter entirely.' });

    const loaded = await getLetter(letter.id);
    expect(loaded?.body).toBe('A different letter entirely.');
  });

  it('returns null for a letter that is not on this device', async () => {
    expect(await getLetter('ltr_deadbeefdeadbeef')).toBeNull();
  });
});

describe('deleting a letter', () => {
  it('removes the letter, its attachments and its snapshots together', async () => {
    const letter = await putLetter(sampleLetter());
    await putAttachment(sampleAttachment(letter.id));
    await saveSnapshot(letter, 'manual', { force: true });

    expect(await getAttachmentsForLetter(letter.id)).toHaveLength(1);
    expect(await listSnapshots(letter.id)).toHaveLength(1);

    await deleteLetter(letter.id);

    expect(await getLetter(letter.id)).toBeNull();
    expect(await getAttachmentsForLetter(letter.id)).toHaveLength(0);
    expect(await listSnapshots(letter.id)).toHaveLength(0);
  });

  it('leaves other letters alone', async () => {
    const keep = await putLetter(sampleLetter({ title: 'Keep me' }));
    const remove = await putLetter(sampleLetter({ title: 'Remove me' }));
    await deleteLetter(remove.id);

    const all = await getAllLetters();
    expect(all).toHaveLength(1);
    expect(all[0]?.letter.id).toBe(keep.id);
  });
});

describe('the memory box listing', () => {
  it('paginates, searches, filters and sorts', async () => {
    for (let index = 0; index < 25; index += 1) {
      await putLetter(
        createLetter({
          title: `Letter ${String(index).padStart(2, '0')}`,
          recipient: index % 2 === 0 ? 'Nan' : 'Sam',
          category: index % 3 === 0 ? 'love' : 'everyday',
          status: index < 5 ? 'sent' : 'draft',
          body: index === 7 ? 'a very particular phrase' : 'ordinary words',
          updatedAt: new Date(2026, 0, index + 1).toISOString(),
        }),
      );
    }

    const firstPage = await listLetters({ pageSize: 10, sort: 'title-asc' });
    expect(firstPage.items).toHaveLength(10);
    expect(firstPage.total).toBe(25);
    expect(firstPage.pageCount).toBe(3);
    expect(firstPage.items[0]?.title).toBe('Letter 00');

    const lastPage = await listLetters({ pageSize: 10, page: 2, sort: 'title-asc' });
    expect(lastPage.items).toHaveLength(5);

    const searched = await listLetters({ search: 'particular' });
    expect(searched.total).toBe(1);
    expect(searched.items[0]?.title).toBe('Letter 07');

    const filtered = await listLetters({ category: 'love', status: 'sent' });
    expect(filtered.items.every((item) => item.category === 'love')).toBe(true);
    expect(filtered.items.every((item) => item.status === 'sent')).toBe(true);

    const outOfRange = await listLetters({ pageSize: 10, page: 99 });
    expect(outOfRange.page).toBe(2);
  });

  it('summarises a letter without loading image bytes', async () => {
    const letter = sampleLetter();
    const summary = toSummary(letter);
    expect(summary.words).toBeGreaterThan(0);
    expect(summary.preview.length).toBeGreaterThan(0);
    expect(summary.locked).toBe(false);
    expect(Object.keys(summary)).not.toContain('original');
  });

  it('shows a placeholder title for an untitled letter', async () => {
    expect(toSummary(createLetter({ title: '   ' })).title).toBe('Untitled letter');
  });
});

describe('attachments', () => {
  it('adds and removes photographs independently of the letter record', async () => {
    const letter = await putLetter(sampleLetter());
    const first = sampleAttachment(letter.id);
    const second = sampleAttachment(letter.id, { caption: 'Second' });

    await putAttachment(first);
    await putAttachment(second);
    expect(await getAttachmentsForLetter(letter.id)).toHaveLength(2);

    await deleteAttachment(first.id);
    const remaining = await getAttachmentsForLetter(letter.id);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.caption).toBe('Second');
  });

  it('keeps a print original and a smaller preview', async () => {
    const letter = await putLetter(sampleLetter());
    const attachment = sampleAttachment(letter.id);
    await putAttachment(attachment);

    const [stored] = await getAttachmentsForLetter(letter.id);
    expect(stored?.original).toBeInstanceOf(Blob);
    expect(stored?.preview).toBeInstanceOf(Blob);
    expect(stored?.role).toBe('photo');
  });
});
