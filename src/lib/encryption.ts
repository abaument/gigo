/**
 * Encryption utilities for secure API key storage.
 *
 * Uses AES encryption to store sensitive credentials like API keys
 * and Bearer tokens in the database.
 *
 * Notes
 * -----
 * In production, consider using a dedicated secrets management service
 * like HashiCorp Vault, AWS Secrets Manager, or Supabase Vault.
 */

import CryptoJS from 'crypto-js';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-dev-key-change-in-prod!';

/**
 * Encrypt a plaintext string.
 *
 * Parameters
 * ----------
 * plaintext : string
 *     The string to encrypt.
 *
 * Returns
 * -------
 * string
 *     Base64-encoded encrypted string.
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) return '';
  
  const encrypted = CryptoJS.AES.encrypt(plaintext, ENCRYPTION_KEY);
  return encrypted.toString();
}

/**
 * Decrypt an encrypted string.
 *
 * Parameters
 * ----------
 * ciphertext : string
 *     Base64-encoded encrypted string.
 *
 * Returns
 * -------
 * string
 *     Decrypted plaintext string.
 */
export function decrypt(ciphertext: string): string {
  if (!ciphertext) return '';
  
  const decrypted = CryptoJS.AES.decrypt(ciphertext, ENCRYPTION_KEY);
  return decrypted.toString(CryptoJS.enc.Utf8);
}

/**
 * Mask a sensitive string for display purposes.
 *
 * Parameters
 * ----------
 * value : string
 *     The string to mask.
 * visibleChars : number, optional
 *     Number of characters to show at the end. (Default is 4)
 *
 * Returns
 * -------
 * string
 *     Masked string like "••••••••abcd".
 */
export function maskSensitive(value: string, visibleChars = 4): string {
  if (!value) return '';
  if (value.length <= visibleChars) return '•'.repeat(value.length);
  
  const masked = '•'.repeat(Math.min(12, value.length - visibleChars));
  const visible = value.slice(-visibleChars);
  return masked + visible;
}
