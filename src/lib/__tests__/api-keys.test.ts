import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }));
vi.mock('@/lib/db', () => ({
  db: { userApiKey: { findUnique } },
}));

// encryption.ts refuses to load without a key; tests never hit real crypto paths
process.env.ENCRYPTION_KEY ??= 'test-encryption-key-16+';

import { encrypt } from '../encryption';
import { envApiKey, getUserApiKey, resolveApiKey } from '../api-keys';

beforeEach(() => {
  findUnique.mockReset();
  delete process.env.OPENAI_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
});

afterEach(() => {
  delete process.env.OPENAI_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
});

describe('envApiKey', () => {
  it('returns the provider env var when set', () => {
    process.env.OPENAI_API_KEY = 'sk-env-openai';
    process.env.ANTHROPIC_API_KEY = 'sk-ant-env';
    expect(envApiKey('openai')).toBe('sk-env-openai');
    expect(envApiKey('anthropic')).toBe('sk-ant-env');
  });

  it('returns null when unset or blank', () => {
    expect(envApiKey('openai')).toBeNull();
    process.env.OPENAI_API_KEY = '   ';
    expect(envApiKey('openai')).toBeNull();
  });
});

describe('getUserApiKey', () => {
  it('decrypts and returns the stored key', async () => {
    findUnique.mockResolvedValue({ encryptedKey: encrypt('sk-user-key-123') });
    expect(await getUserApiKey('u1', 'openai')).toBe('sk-user-key-123');
    expect(findUnique).toHaveBeenCalledWith({
      where: { userId_provider: { userId: 'u1', provider: 'openai' } },
      select: { encryptedKey: true },
    });
  });

  it('returns null when the user has no stored key', async () => {
    findUnique.mockResolvedValue(null);
    expect(await getUserApiKey('u1', 'openai')).toBeNull();
  });

  it('returns null (not throw) on undecryptable ciphertext', async () => {
    findUnique.mockResolvedValue({ encryptedKey: 'v1:not:valid:base64' });
    expect(await getUserApiKey('u1', 'openai')).toBeNull();
  });
});

describe('resolveApiKey', () => {
  it('prefers the user key over the env var', async () => {
    process.env.OPENAI_API_KEY = 'sk-env-openai';
    findUnique.mockResolvedValue({ encryptedKey: encrypt('sk-user-key-123') });
    expect(await resolveApiKey('u1', 'openai')).toBe('sk-user-key-123');
  });

  it('falls back to the env var when the user has no key', async () => {
    process.env.OPENAI_API_KEY = 'sk-env-openai';
    findUnique.mockResolvedValue(null);
    expect(await resolveApiKey('u1', 'openai')).toBe('sk-env-openai');
  });

  it('returns null when neither exists', async () => {
    findUnique.mockResolvedValue(null);
    expect(await resolveApiKey('u1', 'openai')).toBeNull();
  });
});
