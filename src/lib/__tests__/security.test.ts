import { describe, expect, it } from 'vitest';
import { generateWebhookSecret, verifyWebhookSecret } from '../security';

describe('verifyWebhookSecret', () => {
  it('accepts the exact secret', () => {
    expect(verifyWebhookSecret('whsec_abc123', 'whsec_abc123')).toBe(true);
  });

  it('rejects a wrong secret', () => {
    expect(verifyWebhookSecret('whsec_wrong', 'whsec_abc123')).toBe(false);
  });

  it('rejects missing secrets without throwing on length mismatch', () => {
    expect(verifyWebhookSecret(null, 'whsec_abc123')).toBe(false);
    expect(verifyWebhookSecret('', 'whsec_abc123')).toBe(false);
    expect(verifyWebhookSecret('x', 'a-much-longer-secret-value')).toBe(false);
  });
});

describe('generateWebhookSecret', () => {
  it('generates prefixed, unique, sufficiently long secrets', () => {
    const a = generateWebhookSecret();
    const b = generateWebhookSecret();
    expect(a.startsWith('whsec_')).toBe(true);
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(16);
  });
});
