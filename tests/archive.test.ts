/** Export and import of `.dearly` archives, including hostile input. */

import { beforeEach, describe, expect, it } from 'vitest';
import { buildArchive, openArchive } from '../src/components/export/archive';
import {
  assertAcceptableArchiveFile,
  validateArchiveText,
  ImportError,
  ARCHIVE_FORMAT,
} from '../src/components/security/validate-import';
import { importArchiveFile } from '../src/components/export/index';
import { getAllLetters, getLetter, putLetter } from '../src/components/storage/letters-repo';
import { getAttachmentsForLetter } from '../src/components/storage/attachments-repo';
import { freshDatabase, sampleAttachment, sampleLetter, JPEG_BYTES } from './helpers';
import { toBase64 } from '../src/components/utilities/bytes';

const PASSWORD = 'four unrelated quiet words';

beforeEach(async () => {
  await freshDatabase();
});

function fileFrom(text: string, name = 'backup.dearly'): File {
  return new File([text], name, { type: 'application/json' });
}

describe('building an archive', () => {
  it('produces a checksummed, versioned file', async () => {
    const letter = sampleLetter();
    const archive = await buildArchive({
      letters: [letter],
      attachments: [sampleAttachment(letter.id)],
      kind: 'letter',
    });

    const parsed = JSON.parse(archive.json);
    expect(parsed.format).toBe(ARCHIVE_FORMAT);
    expect(parsed.version).toBe(1);
    expect(parsed.schemaVersion).toBeGreaterThanOrEqual(2);
    expect(parsed.checksum.algorithm).toBe('SHA-256');
    expect(parsed.checksum.value).toMatch(/^[0-9a-f]{64}$/);
    expect(parsed.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(parsed.payload.letters).toHaveLength(1);
    expect(parsed.payload.attachments[0].originalBase64.length).toBeGreaterThan(0);
    expect(parsed.encrypted).toBe(false);
  });

  it('encrypts the payload when a password is given', async () => {
    const letter = sampleLetter();
    const archive = await buildArchive({
      letters: [letter],
      attachments: [],
      kind: 'library',
      password: PASSWORD,
    });

    expect(archive.json).not.toContain('The garden is doing what you said');
    const parsed = JSON.parse(archive.json);
    expect(parsed.encrypted).toBe(true);
    expect(parsed.payload).toBeUndefined();
    expect(parsed.envelope.cipherTextBase64.length).toBeGreaterThan(0);
  });
});

describe('opening an archive', () => {
  it('round-trips a plain archive', async () => {
    const letter = sampleLetter();
    const archive = await buildArchive({ letters: [letter], attachments: [], kind: 'letter' });
    const opened = await openArchive(archive.json);

    expect(opened.letters).toHaveLength(1);
    expect(opened.letters[0]?.body).toContain('The garden is doing what you said');
    expect(opened.wasEncrypted).toBe(false);
  });

  it('round-trips an encrypted archive with the right password', async () => {
    const letter = sampleLetter();
    const archive = await buildArchive({
      letters: [letter],
      attachments: [],
      kind: 'letter',
      password: PASSWORD,
    });
    const opened = await openArchive(archive.json, PASSWORD);
    expect(opened.wasEncrypted).toBe(true);
    expect(opened.letters[0]?.title).toBe('For Nan');
  });

  it('refuses an encrypted archive without a password', async () => {
    const archive = await buildArchive({
      letters: [sampleLetter()],
      attachments: [],
      kind: 'letter',
      password: PASSWORD,
    });
    await expect(openArchive(archive.json)).rejects.toBeInstanceOf(ImportError);
  });

  it('refuses an encrypted archive with the wrong password', async () => {
    const archive = await buildArchive({
      letters: [sampleLetter()],
      attachments: [],
      kind: 'letter',
      password: PASSWORD,
    });
    await expect(openArchive(archive.json, 'not the password')).rejects.toMatchObject({
      kind: 'wrong-password',
    });
  });
});

describe('rejecting dangerous or damaged backups', () => {
  it('rejects a file that is not JSON', async () => {
    await expect(validateArchiveText('<html><script>alert(1)</script></html>')).rejects.toMatchObject({
      kind: 'not-json',
    });
  });

  it('rejects JSON that is not a Dearly archive', async () => {
    await expect(validateArchiveText('{"hello":"world"}')).rejects.toMatchObject({
      kind: 'not-an-archive',
    });
  });

  it('rejects an archive from a future format version', async () => {
    const archive = await buildArchive({ letters: [sampleLetter()], attachments: [], kind: 'letter' });
    const future = { ...JSON.parse(archive.json), version: 99 };
    await expect(validateArchiveText(JSON.stringify(future))).rejects.toMatchObject({
      kind: 'unsupported-version',
    });
  });

  it('rejects a payload whose checksum no longer matches', async () => {
    const archive = await buildArchive({ letters: [sampleLetter()], attachments: [], kind: 'letter' });
    const parsed = JSON.parse(archive.json);
    parsed.payload.letters[0].body = 'quietly altered after export';
    await expect(validateArchiveText(JSON.stringify(parsed))).rejects.toMatchObject({
      kind: 'checksum-mismatch',
    });
  });

  it('refuses executables and other file types by name and MIME type', () => {
    expect(() => assertAcceptableArchiveFile({ name: 'letters.exe', size: 10 })).toThrowError(
      ImportError,
    );
    expect(() => assertAcceptableArchiveFile({ name: 'letters.svg', size: 10 })).toThrowError(
      ImportError,
    );
    expect(() => assertAcceptableArchiveFile({ name: 'letters.zip', size: 10 })).toThrowError(
      ImportError,
    );
    expect(() =>
      assertAcceptableArchiveFile({ name: 'letters.dearly', size: 10, type: 'text/html' }),
    ).toThrowError(ImportError);
    expect(() => assertAcceptableArchiveFile({ name: 'letters.dearly', size: 0 })).toThrowError(
      /empty/i,
    );
    expect(() =>
      assertAcceptableArchiveFile({ name: 'letters.dearly', size: 900 * 1024 * 1024 }),
    ).toThrowError(/larger than/i);
    expect(() =>
      assertAcceptableArchiveFile({ name: 'letters.dearly', size: 100, type: 'application/json' }),
    ).not.toThrow();
  });

  it('strips HTML and scripts smuggled into letter text', async () => {
    const letter = sampleLetter({
      body: '<script>fetch("https://example.invalid")</script><p onclick="steal()">Hello</p>',
    });
    const archive = await buildArchive({ letters: [letter], attachments: [], kind: 'letter' });
    const opened = await openArchive(archive.json);

    expect(opened.letters[0]?.body).not.toContain('<script');
    expect(opened.letters[0]?.body).not.toContain('onclick');
    expect(opened.letters[0]?.body).toContain('Hello');
    expect(opened.warnings.some((warning) => warning.includes('HTML was removed'))).toBe(true);
  });

  it('drops prototype-polluting keys', async () => {
    const archive = await buildArchive({ letters: [sampleLetter()], attachments: [], kind: 'letter' });
    const parsed = JSON.parse(archive.json);
    const hostile = JSON.stringify(parsed).replace(
      '"letters":[',
      '"letters":[{"__proto__":{"polluted":true},"id":"ltr_00000000aaaa","body":"x"},',
    );

    // The checksum will now fail, which is itself the correct outcome; check the
    // prototype was not touched on the way there.
    await expect(validateArchiveText(hostile)).rejects.toBeInstanceOf(ImportError);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('refuses SVG and unknown files disguised as photographs', async () => {
    const letter = sampleLetter();
    const archive = await buildArchive({ letters: [letter], attachments: [], kind: 'letter' });
    const parsed = JSON.parse(archive.json);

    parsed.payload.attachments = [
      {
        id: 'img_aaaabbbbcccc',
        letterId: letter.id,
        name: '../../etc/passwd',
        type: 'image/png',
        width: 10,
        height: 10,
        caption: '',
        role: 'photo',
        createdAt: new Date().toISOString(),
        originalBase64: toBase64(new TextEncoder().encode('<svg onload="alert(1)"></svg>')),
      },
    ];
    delete parsed.checksum;

    const result = await validateArchiveText(JSON.stringify(parsed));
    expect(result.attachments).toHaveLength(0);
    expect(result.warnings.some((warning) => warning.includes('SVG'))).toBe(true);
  });

  it('sanitises attachment file names so they cannot escape a directory', async () => {
    const letter = sampleLetter();
    const archive = await buildArchive({ letters: [letter], attachments: [], kind: 'letter' });
    const parsed = JSON.parse(archive.json);
    parsed.payload.attachments = [
      {
        id: 'img_aaaabbbbcccc',
        letterId: letter.id,
        name: '../../../../home/user/.ssh/authorized_keys',
        type: 'image/jpeg',
        width: 10,
        height: 10,
        caption: '',
        role: 'photo',
        createdAt: new Date().toISOString(),
        originalBase64: toBase64(JPEG_BYTES),
      },
    ];
    delete parsed.checksum;

    const result = await validateArchiveText(JSON.stringify(parsed));
    expect(result.attachments).toHaveLength(1);
    expect(result.attachments[0]?.name).not.toContain('..');
    expect(result.attachments[0]?.name).not.toContain('/');
  });

  it('skips images that belong to a letter not in the backup', async () => {
    const letter = sampleLetter();
    const archive = await buildArchive({ letters: [letter], attachments: [], kind: 'letter' });
    const parsed = JSON.parse(archive.json);
    parsed.payload.attachments = [
      {
        id: 'img_ffffffffffff',
        letterId: 'ltr_notinthisfile',
        type: 'image/jpeg',
        originalBase64: toBase64(JPEG_BYTES),
      },
    ];
    delete parsed.checksum;

    const result = await validateArchiveText(JSON.stringify(parsed));
    expect(result.attachments).toHaveLength(0);
    expect(result.warnings.join(' ')).toContain('not in this backup');
  });
});

describe('importing into local storage', () => {
  it('restores letters and their photographs', async () => {
    const letter = sampleLetter();
    const archive = await buildArchive({
      letters: [letter],
      attachments: [sampleAttachment(letter.id)],
      kind: 'library',
    });

    const summary = await importArchiveFile(fileFrom(archive.json));
    expect(summary.imported).toBe(1);
    expect(summary.images).toBe(1);

    const stored = await getLetter(letter.id);
    expect(stored?.title).toBe('For Nan');
    expect(await getAttachmentsForLetter(letter.id)).toHaveLength(1);
  });

  it('keeps existing letters by default, and can replace them on request', async () => {
    const letter = await putLetter(sampleLetter({ body: 'the version on this device' }));
    const archive = await buildArchive({
      letters: [{ ...letter, body: 'the version in the backup' }],
      attachments: [],
      kind: 'library',
    });

    const kept = await importArchiveFile(fileFrom(archive.json));
    expect(kept.skipped).toBe(1);
    expect((await getLetter(letter.id))?.body).toBe('the version on this device');

    const replaced = await importArchiveFile(fileFrom(archive.json), {
      mode: 'merge-replace-existing',
    });
    expect(replaced.replaced).toBe(1);
    expect((await getLetter(letter.id))?.body).toBe('the version in the backup');
  });

  it('imports nothing at all when the file is rejected', async () => {
    await expect(importArchiveFile(fileFrom('{"format":"something-else"}'))).rejects.toBeInstanceOf(
      ImportError,
    );
    expect(await getAllLetters()).toHaveLength(0);
  });
});
