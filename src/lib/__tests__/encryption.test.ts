import { describe, expect, it } from 'vitest';
import CryptoJS from 'crypto-js';
import { decrypt, encrypt, isLegacyCiphertext, maskSensitive } from '../encryption';

describe('encryption (AES-256-GCM)', () => {
  it('round-trips a plaintext', () => {
    const secret = 'sk-super-secret-token-1234';
    expect(decrypt(encrypt(secret))).toBe(secret);
  });

  it('produces the versioned 4-segment format', () => {
    const ciphertext = encrypt('hello');
    expect(ciphertext.startsWith('v1:')).toBe(true);
    expect(ciphertext.split(':')).toHaveLength(4);
  });

  it('uses a unique IV per encryption', () => {
    expect(encrypt('same')).not.toBe(encrypt('same'));
  });

  it('rejects a tampered auth tag', () => {
    const [v, iv, tag, data] = encrypt('payload').split(':');
    const flipped = Buffer.from(tag, 'base64');
    flipped[0] ^= 0xff;
    const tampered = [v, iv, flipped.toString('base64'), data].join(':');
    expect(() => decrypt(tampered)).toThrow();
  });

  it('rejects malformed ciphertexts with the v1 prefix', () => {
    expect(() => decrypt('v1:not-valid')).toThrow('Invalid ciphertext format');
  });

  it('returns empty string for empty input', () => {
    expect(encrypt('')).toBe('');
    expect(decrypt('')).toBe('');
  });

  it('decrypts legacy CryptoJS ciphertexts with the same passphrase', () => {
    const legacy = CryptoJS.AES.encrypt('legacy-token', process.env.ENCRYPTION_KEY!).toString();
    expect(isLegacyCiphertext(legacy)).toBe(true);
    expect(decrypt(legacy)).toBe('legacy-token');
  });

  it('detects v1 ciphertexts as non-legacy', () => {
    expect(isLegacyCiphertext(encrypt('x'))).toBe(false);
  });
});

describe('maskSensitive', () => {
  it('masks all but the last 4 characters', () => {
    expect(maskSensitive('secret-token-abcd')).toMatch(/^•+abcd$/);
  });

  it('fully masks short values', () => {
    expect(maskSensitive('abc')).toBe('•••');
  });
});
