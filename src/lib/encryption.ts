/**
 * Encryption utilities for secure credential storage.
 *
 * AES-256-GCM (authenticated encryption) via node:crypto.
 * Ciphertext format: `v1:<iv_b64>:<tag_b64>:<ciphertext_b64>`.
 *
 * Ciphertexts without the `v1:` prefix are legacy CryptoJS values and are
 * still decryptable until `scripts/migrate-encryption.ts` has been run.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import CryptoJS from 'crypto-js';

const RAW_KEY = process.env.ENCRYPTION_KEY;
if (!RAW_KEY || RAW_KEY.length < 16) {
  throw new Error(
    'ENCRYPTION_KEY environment variable is required (min 16 chars). Refusing to start.'
  );
}
// SHA-256 of the passphrase gives a stable 32-byte key without changing the env var.
const KEY = createHash('sha256').update(RAW_KEY).digest();

const VERSION_PREFIX = 'v1:';

export function isLegacyCiphertext(ciphertext: string): boolean {
  return !ciphertext.startsWith(VERSION_PREFIX);
}

export function encrypt(plaintext: string): string {
  if (!plaintext) return '';

  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', KEY, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${VERSION_PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
}

export function decrypt(ciphertext: string): string {
  if (!ciphertext) return '';

  if (isLegacyCiphertext(ciphertext)) {
    return decryptLegacy(ciphertext, RAW_KEY!);
  }

  const parts = ciphertext.split(':');
  if (parts.length !== 4) {
    throw new Error('Invalid ciphertext format');
  }
  const [, ivB64, tagB64, dataB64] = parts;

  const decipher = createDecipheriv('aes-256-gcm', KEY, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

/** Decrypt a pre-v1 CryptoJS ciphertext with an arbitrary passphrase (used by the migration script). */
export function decryptLegacy(ciphertext: string, passphrase: string): string {
  const decrypted = CryptoJS.AES.decrypt(ciphertext, passphrase);
  return decrypted.toString(CryptoJS.enc.Utf8);
}

/**
 * Mask a sensitive string for display purposes ("••••••••abcd").
 */
export function maskSensitive(value: string, visibleChars = 4): string {
  if (!value) return '';
  if (value.length <= visibleChars) return '•'.repeat(value.length);

  const masked = '•'.repeat(Math.min(12, value.length - visibleChars));
  const visible = value.slice(-visibleChars);
  return masked + visible;
}
