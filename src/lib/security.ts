/**
 * Webhook secret generation and timing-safe verification.
 */

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Compare a provided secret against the expected one without leaking
 * timing information. Both sides are hashed first so the buffers always
 * have equal length regardless of input size.
 */
export function verifyWebhookSecret(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  const a = createHash('sha256').update(provided).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

export function generateWebhookSecret(): string {
  return `whsec_${randomBytes(24).toString('base64url')}`;
}
