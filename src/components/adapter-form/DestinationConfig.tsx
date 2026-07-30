/**
 * Destination forwarding configuration: toggle, URL, HTTP method,
 * auth method pills and credential input.
 */

'use client';

import { useTranslations } from 'next-intl';
import { Toggle } from '@/components/ui/Toggle';

type AuthMethod = 'none' | 'bearer' | 'api_key' | 'basic';

export interface DestinationValues {
  enableDestination: boolean;
  destinationUrl: string;
  destinationMethod: 'POST' | 'PUT' | 'PATCH';
  authMethod: AuthMethod;
  authHeaderName: string;
  authValue: string;
}

interface DestinationConfigProps {
  values: DestinationValues;
  onChange: (values: DestinationValues) => void;
  /** shown in edit mode when a credential already exists */
  maskedAuthValue?: string | null;
}

export function DestinationConfig({ values, onChange, maskedAuthValue }: DestinationConfigProps) {
  const t = useTranslations('adapterForm');

  const set = <K extends keyof DestinationValues>(key: K, value: DestinationValues[K]) =>
    onChange({ ...values, [key]: value });

  const authOptions: { id: AuthMethod; label: string }[] = [
    { id: 'none', label: t('authNone') },
    { id: 'bearer', label: t('authBearer') },
    { id: 'api_key', label: t('authApiKey') },
    { id: 'basic', label: t('authBasic') },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <span className="text-sm text-taupe font-accent">{t('enableForwarding')}</span>
        <Toggle
          checked={values.enableDestination}
          onChange={(checked) => set('enableDestination', checked)}
          label={t('enableForwarding')}
        />
      </div>

      {values.enableDestination && (
        <div className="space-y-5 animate-fade-in">
          <div className="flex gap-3">
            <div className="w-32 shrink-0">
              <label className="label">{t('methodLabel')}</label>
              <select
                value={values.destinationMethod}
                onChange={(e) => set('destinationMethod', e.target.value as DestinationValues['destinationMethod'])}
                className="input"
              >
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="PATCH">PATCH</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="label">
                {t('destinationUrlLabel')} <span className="text-coral">*</span>
              </label>
              <input
                type="url"
                value={values.destinationUrl}
                onChange={(e) => set('destinationUrl', e.target.value)}
                placeholder={t('destinationUrlPlaceholder')}
                className="input"
              />
            </div>
          </div>

          <div>
            <label className="label">{t('authLabel')}</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {authOptions.map((auth) => (
                <button
                  key={auth.id}
                  type="button"
                  onClick={() => set('authMethod', auth.id)}
                  className={`px-4 py-2.5 rounded-lg text-sm font-accent border transition-all ${
                    values.authMethod === auth.id
                      ? 'bg-amber/10 border-amber text-amber'
                      : 'bg-roast border-bark text-taupe hover:border-timber'
                  }`}
                >
                  {auth.label}
                </button>
              ))}
            </div>
          </div>

          {values.authMethod !== 'none' && (
            <div className="space-y-4 pt-4 border-t border-bark">
              {values.authMethod === 'api_key' && (
                <div>
                  <label className="label">{t('authHeaderNameLabel')}</label>
                  <input
                    type="text"
                    value={values.authHeaderName}
                    onChange={(e) => set('authHeaderName', e.target.value)}
                    placeholder="X-API-Key"
                    className="input"
                  />
                </div>
              )}
              <div>
                <label className="label">{t('authValueLabel')}</label>
                <input
                  type="password"
                  value={values.authValue}
                  onChange={(e) => set('authValue', e.target.value)}
                  placeholder={maskedAuthValue || '••••••••••••'}
                  className="input"
                />
                <p className="text-xs text-clay mt-1.5 font-accent">
                  {t('authValueEncrypted')}
                  {maskedAuthValue && <> — {t('authValueKeep')}</>}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
