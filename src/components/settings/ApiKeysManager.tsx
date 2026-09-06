/**
 * BYOK key manager — one card per supported LLM provider. Keys are
 * write-only: entered once, then displayed masked. Deleting falls back
 * to the server key when the operator configured one.
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { saveUserApiKey, deleteUserApiKey } from '@/lib/actions';
import { useToast } from '@/components/ui/ToastProvider';

interface StoredKey {
  provider: string;
  maskedKey: string;
  updatedAt: string;
}

interface ApiKeysManagerProps {
  initialKeys: StoredKey[];
  serverFallback: Record<string, boolean>;
}

const PROVIDERS: {
  id: string;
  label: string;
  keyHint: string;
  consoleUrl: string;
  consoleLabel: string;
}[] = [
  {
    id: 'openai',
    label: 'OpenAI',
    keyHint: 'sk-...',
    consoleUrl: 'https://platform.openai.com/api-keys',
    consoleLabel: 'platform.openai.com',
  },
  {
    id: 'anthropic',
    label: 'Anthropic (Claude)',
    keyHint: 'sk-ant-...',
    consoleUrl: 'https://console.anthropic.com/settings/keys',
    consoleLabel: 'console.anthropic.com',
  },
];

export function ApiKeysManager({ initialKeys, serverFallback }: ApiKeysManagerProps) {
  const t = useTranslations('settings');
  const router = useRouter();
  const { toast } = useToast();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const storedByProvider = new Map(initialKeys.map((k) => [k.provider, k]));

  const handleSave = async (provider: string) => {
    const value = (drafts[provider] ?? '').trim();
    if (!value) return;
    setBusy(provider);
    const result = await saveUserApiKey(provider, value);
    setBusy(null);
    if (result.success) {
      setDrafts((d) => ({ ...d, [provider]: '' }));
      toast({ variant: 'success', title: t('keySaved') });
      router.refresh();
    } else {
      toast({ variant: 'error', title: t('keySaveError'), description: result.error });
    }
  };

  const handleDelete = async (provider: string) => {
    setBusy(provider);
    const result = await deleteUserApiKey(provider);
    setBusy(null);
    if (result.success) {
      toast({ variant: 'success', title: t('keyDeleted') });
      router.refresh();
    } else {
      toast({ variant: 'error', title: t('keyDeleteError'), description: result.error });
    }
  };

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="card p-5 border-amber/30 bg-amber/5">
        <p className="text-sm text-sand font-accent leading-relaxed">{t('explainer')}</p>
      </div>

      {PROVIDERS.map((provider) => {
        const stored = storedByProvider.get(provider.id);
        const hasFallback = serverFallback[provider.id] === true;
        const isBusy = busy === provider.id;

        return (
          <div key={provider.id} className="card p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="font-display text-xl text-cream">{provider.label}</h2>
                <a
                  href={provider.consoleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-amber hover:underline font-accent"
                >
                  {t('getKeyAt', { console: provider.consoleLabel })}
                </a>
              </div>
              {stored ? (
                <span className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sage/15 text-sage text-xs font-accent">
                  <span className="w-1.5 h-1.5 rounded-full bg-sage" />
                  {t('statusConfigured')}
                </span>
              ) : hasFallback ? (
                <span className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber/15 text-amber text-xs font-accent">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber" />
                  {t('statusServerKey')}
                </span>
              ) : (
                <span className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-coral/15 text-coral text-xs font-accent">
                  <span className="w-1.5 h-1.5 rounded-full bg-coral" />
                  {t('statusMissing')}
                </span>
              )}
            </div>

            {stored && (
              <div className="flex items-center justify-between gap-3 mb-4 px-4 py-3 rounded-lg bg-roast border border-bark">
                <code className="text-sm text-sand tracking-wider">{stored.maskedKey}</code>
                <button
                  onClick={() => handleDelete(provider.id)}
                  disabled={isBusy}
                  className="text-xs text-coral hover:underline font-accent disabled:opacity-50"
                >
                  {t('deleteKey')}
                </button>
              </div>
            )}

            <div className="flex gap-3">
              <input
                type="password"
                autoComplete="off"
                value={drafts[provider.id] ?? ''}
                onChange={(e) => setDrafts((d) => ({ ...d, [provider.id]: e.target.value }))}
                placeholder={stored ? t('replacePlaceholder') : provider.keyHint}
                className="input flex-1"
              />
              <button
                onClick={() => handleSave(provider.id)}
                disabled={isBusy || !(drafts[provider.id] ?? '').trim()}
                className="btn-primary text-sm shrink-0 disabled:opacity-50"
              >
                {isBusy ? '…' : stored ? t('replaceKey') : t('saveKey')}
              </button>
            </div>
          </div>
        );
      })}

      <p className="text-xs text-taupe font-accent leading-relaxed">{t('securityNote')}</p>
    </div>
  );
}
