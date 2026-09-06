/**
 * Settings — per-user LLM API keys (bring your own key).
 *
 * Each user stores their own provider keys, encrypted at rest; the
 * platform operator never has to supply shared keys. A server-level env
 * key, when present, acts as a fallback and is surfaced as such.
 */

import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser, getUserApiKeys } from '@/lib/actions';
import { ApiKeysManager } from '@/components/settings/ApiKeysManager';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const [{ keys, serverFallback }, t] = await Promise.all([
    getUserApiKeys(),
    getTranslations('settings'),
  ]);

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <div className="mb-8 animate-fade-in">
        <h1 className="font-display text-4xl text-cream mb-1">{t('title')}</h1>
        <p className="text-taupe font-accent">{t('subtitle')}</p>
      </div>

      <ApiKeysManager
        initialKeys={keys.map((k) => ({
          provider: k.provider,
          maskedKey: k.maskedKey,
          updatedAt: k.updatedAt.toISOString(),
        }))}
        serverFallback={serverFallback}
      />
    </div>
  );
}
