/**
 * Per-user LLM API key resolution (bring your own key).
 *
 * Resolution order for a given user + provider:
 *   1. the user's own key, stored encrypted in `user_api_keys`
 *   2. the server-level env var (OPENAI_API_KEY / ANTHROPIC_API_KEY),
 *      kept as a fallback so single-operator self-hosted installs keep
 *      working without every account entering a key
 *   3. null — callers surface a typed AUTH error telling the user to add
 *      a key in Settings
 */

import { db } from './db';
import { decrypt } from './encryption';
import type { ProviderName } from './providers/types';

export const KEYABLE_PROVIDERS: ProviderName[] = ['openai', 'anthropic'];

export function envApiKey(provider: ProviderName): string | null {
  const value =
    provider === 'anthropic' ? process.env.ANTHROPIC_API_KEY : process.env.OPENAI_API_KEY;
  return value && value.trim() !== '' ? value : null;
}

/** The user's own decrypted key, or null if they have not stored one. */
export async function getUserApiKey(
  userId: string,
  provider: ProviderName
): Promise<string | null> {
  const row = await db.userApiKey.findUnique({
    where: { userId_provider: { userId, provider } },
    select: { encryptedKey: true },
  });
  if (!row) return null;
  try {
    return decrypt(row.encryptedKey) || null;
  } catch (error) {
    console.error(`Failed to decrypt ${provider} key for user ${userId}:`, error);
    return null;
  }
}

/** User key first, env var fallback, null when neither exists. */
export async function resolveApiKey(
  userId: string,
  provider: ProviderName
): Promise<string | null> {
  return (await getUserApiKey(userId, provider)) ?? envApiKey(provider);
}
