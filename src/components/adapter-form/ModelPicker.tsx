/**
 * AI provider + model selection (OpenAI / Anthropic).
 */

'use client';

import { useTranslations } from 'next-intl';
import { AVAILABLE_MODELS, DEFAULT_MODELS } from '@/lib/providers/models';

type Provider = 'openai' | 'anthropic';

interface ModelPickerProps {
  provider: Provider;
  modelName: string;
  onChange: (provider: Provider, modelName: string) => void;
}

export function ModelPicker({ provider, modelName, onChange }: ModelPickerProps) {
  const t = useTranslations('adapterForm');

  const providers: { id: Provider; label: string; hint: string }[] = [
    { id: 'openai', label: t('providerOpenai'), hint: 'GPT-4o' },
    { id: 'anthropic', label: t('providerAnthropic'), hint: 'Claude Sonnet 5' },
  ];

  return (
    <div className="space-y-4">
      <div>
        <label className="label">{t('providerLabel')}</label>
        <div className="grid grid-cols-2 gap-2">
          {providers.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onChange(p.id, DEFAULT_MODELS[p.id])}
              className={`px-4 py-3 rounded-lg text-sm font-accent border transition-all text-left ${
                provider === p.id
                  ? 'bg-amber/10 border-amber text-amber'
                  : 'bg-roast border-bark text-taupe hover:border-timber'
              }`}
            >
              <span className="block font-semibold">{p.label}</span>
              <span className="block text-xs opacity-70 mt-0.5">{p.hint}</span>
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="label" htmlFor="model-select">
          {t('modelLabel')}
        </label>
        <select
          id="model-select"
          value={modelName}
          onChange={(e) => onChange(provider, e.target.value)}
          className="input"
        >
          {AVAILABLE_MODELS[provider].map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
