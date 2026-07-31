/** Encryption: round trips, wrong passwords, corruption and unsupported versions. */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  assessPassword,
  CryptoError,
  decryptString,
  encryptString,
  parseEnvelope,
  MIN_PASSWORD_LENGTH,
} from '../src/components/security/crypto';
import { lockLetter, unlockLetter, canUnlock } from '../src/components/security/letter-lock';
import { putLetter, getLetter } from '../src/components/storage/letters-repo';
import { getAttachmentsForLetter, putAttachment } from '../src/components/storage/attachments-repo';
import { documentFromPlainText, documentText } from '../src/components/document/model';
import { freshDatabase, sampleAttachment, sampleLetter } from './helpers';

const PASSWORD = 'a quiet green door';

beforeEach(async () => {
  await freshDatabase();
});

describe('encryptString / decryptString', () => {
  it('round-trips text with the correct password', async () => {
    const envelope = await encryptString('The garden is doing well.', PASSWORD);
    expect(envelope.algorithm).toBe('AES-GCM');
    expect(envelope.keyDerivation).toBe('PBKDF2-SHA256');
    expect(envelope.iterations).toBeGreaterThanOrEqual(250_000);
    expect(await decryptString(envelope, PASSWORD)).toBe('The garden is doing well.');
  });

  it('never stores the plaintext or the password in the envelope', async () => {
    const envelope = await encryptString('a secret sentence', PASSWORD);
    const serialised = JSON.stringify(envelope);
    expect(serialised).not.toContain('a secret sentence');
    expect(serialised).not.toContain(PASSWORD);
  });

  it('uses a fresh salt and IV for every encryption', async () => {
    const first = await encryptString('same text', PASSWORD);
    const second = await encryptString('same text', PASSWORD);
    expect(first.saltBase64).not.toBe(second.saltBase64);
    expect(first.ivBase64).not.toBe(second.ivBase64);
    expect(first.cipherTextBase64).not.toBe(second.cipherTextBase64);
  });

  it('refuses the wrong password without revealing anything', async () => {
    const envelope = await encryptString('private', PASSWORD);
    await expect(decryptString(envelope, 'not the password')).rejects.toMatchObject({
      name: 'CryptoError',
      kind: 'wrong-password',
    });
  });

  it('detects a corrupted ciphertext', async () => {
    const envelope = await encryptString('private', PASSWORD);
    const tampered = {
      ...envelope,
      cipherTextBase64: `${envelope.cipherTextBase64.slice(0, -4)}AAAA`,
    };
    await expect(decryptString(tampered, PASSWORD)).rejects.toBeInstanceOf(CryptoError);
  });

  it('rejects a truncated envelope', async () => {
    const envelope = await encryptString('private', PASSWORD);
    await expect(decryptString({ ...envelope, cipherTextBase64: 'AAAA' }, PASSWORD)).rejects.toMatchObject({
      kind: 'corrupt',
    });
  });

  it('refuses an envelope from a future format version', async () => {
    const envelope = await encryptString('private', PASSWORD);
    expect(() => parseEnvelope({ ...envelope, version: 99 })).toThrowError(/newer version/i);
  });

  it('refuses an unknown algorithm', async () => {
    const envelope = await encryptString('private', PASSWORD);
    expect(() => parseEnvelope({ ...envelope, algorithm: 'ROT13' })).toThrowError(
      /encryption method/i,
    );
  });

  it('refuses an absurd key-derivation cost', async () => {
    const envelope = await encryptString('private', PASSWORD);
    expect(() => parseEnvelope({ ...envelope, iterations: 5 })).toThrowError(/key-derivation/i);
  });

  it('refuses to encrypt with a password that is too short', async () => {
    await expect(encryptString('x', 'short')).rejects.toMatchObject({ kind: 'weak-password' });
    expect(assessPassword('short').acceptable).toBe(false);
    expect(assessPassword('x'.repeat(MIN_PASSWORD_LENGTH)).acceptable).toBe(true);
    expect(assessPassword('a quiet green door with rain').label).toBe('strong');
  });
});

describe('locking a letter', () => {
  it('encrypts the contents and removes the plaintext from storage', async () => {
    const letter = await putLetter(sampleLetter());
    await putAttachment(sampleAttachment(letter.id));

    const locked = await lockLetter(letter, PASSWORD);
    await putLetter(locked);

    const stored = await getLetter(letter.id);
    expect(stored?.locked).not.toBeNull();
    expect(stored?.body).toBe('');
    expect(stored?.recipient).toBe('');
    expect(stored?.tags).toEqual([]);
    expect(stored?.attachments).toEqual([]);
    expect(await getAttachmentsForLetter(letter.id)).toHaveLength(0);

    // The title stays readable so the memory box can still list it.
    expect(stored?.title).toBe('For Nan');
    expect(JSON.stringify(stored)).not.toContain('The garden is doing what you said');
  });

  it('encrypts the document, where the words actually live', async () => {
    // The plain-text `body` is only a mirror. If locking cleared it and left
    // `doc` behind, every word would still be sitting in IndexedDB.
    const letter = await putLetter({
      ...sampleLetter(),
      doc: documentFromPlainText('The garden is doing what you said it would.'),
    });

    const locked = await putLetter(await lockLetter(letter, PASSWORD));
    const stored = await getLetter(letter.id);

    expect(documentText(stored!.doc)).not.toContain('The garden is doing what you said');
    expect(JSON.stringify(stored)).not.toContain('The garden is doing what you said');

    const unlocked = await unlockLetter(locked, PASSWORD);
    expect(documentText(unlocked.doc)).toContain('The garden is doing what you said');
  });

  it('rebuilds the page from a letter locked before the document model existed', async () => {
    // A version 1 payload has no `doc`. Unlocking must not hand back a blank
    // page just because the letter is old.
    const letter = await putLetter(sampleLetter());
    const locked = await putLetter(await lockLetter(letter, PASSWORD));

    const legacyPayload = JSON.parse(
      JSON.stringify({ ...locked.locked }),
    ) as NonNullable<typeof locked.locked>;
    const contents = JSON.parse(
      await decryptString(
        {
          version: legacyPayload.version,
          algorithm: legacyPayload.algorithm,
          keyDerivation: legacyPayload.keyDerivation,
          iterations: legacyPayload.iterations,
          saltBase64: legacyPayload.saltBase64,
          ivBase64: legacyPayload.ivBase64,
          cipherTextBase64: legacyPayload.cipherTextBase64,
        },
        PASSWORD,
      ),
    ) as Record<string, unknown>;
    delete contents.doc;
    contents.version = 1;
    const reEncrypted = await encryptString(JSON.stringify(contents), PASSWORD);

    const legacy = {
      ...locked,
      locked: {
        ...legacyPayload,
        saltBase64: reEncrypted.saltBase64,
        ivBase64: reEncrypted.ivBase64,
        cipherTextBase64: reEncrypted.cipherTextBase64,
        iterations: reEncrypted.iterations,
      },
    };

    const unlocked = await unlockLetter(legacy, PASSWORD);
    expect(documentText(unlocked.doc)).toContain('The garden is doing what you said');
  });

  it('restores everything, including photographs, with the right password', async () => {
    const letter = await putLetter(sampleLetter());
    await putAttachment(sampleAttachment(letter.id));

    const locked = await putLetter(await lockLetter(letter, PASSWORD));
    const unlocked = await unlockLetter(locked, PASSWORD);
    await putLetter(unlocked, { touch: false });

    expect(unlocked.body).toContain('The garden is doing what you said');
    expect(unlocked.recipient).toBe('Nan');
    expect(unlocked.tags).toEqual(['garden', 'family']);
    expect(unlocked.locked).toBeNull();

    const restored = await getAttachmentsForLetter(letter.id);
    expect(restored).toHaveLength(1);
    expect(restored[0]?.caption).toBe('The greenhouse, still standing');
  });

  it('leaves the letter untouched when the password is wrong', async () => {
    const letter = await putLetter(sampleLetter());
    const locked = await putLetter(await lockLetter(letter, PASSWORD));

    expect(await canUnlock(locked, 'the wrong one entirely')).toBe(false);
    await expect(unlockLetter(locked, 'the wrong one entirely')).rejects.toMatchObject({
      kind: 'wrong-password',
    });

    const stored = await getLetter(letter.id);
    expect(stored?.locked).not.toBeNull();
    expect(stored?.body).toBe('');
  });

  it('confirms a correct password without changing anything', async () => {
    const letter = await putLetter(sampleLetter());
    const locked = await putLetter(await lockLetter(letter, PASSWORD));
    expect(await canUnlock(locked, PASSWORD)).toBe(true);
    expect((await getLetter(letter.id))?.locked).not.toBeNull();
  });
});
