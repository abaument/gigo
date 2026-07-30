/**
 * Shared adapter form (create + edit). The create page and the edit
 * page are thin server components around this island.
 */

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { createAdapter, updateAdapter } from '@/lib/actions';
import { DEFAULT_MODELS } from '@/lib/providers/models';
import { useToast } from '@/components/ui/ToastProvider';
import { Spinner } from '@/components/ui/Spinner';
import { ModelPicker } from './ModelPicker';
import { SchemaEditor } from './SchemaEditor';
import { DestinationConfig, type DestinationValues } from './DestinationConfig';

export interface AdapterFormValues extends DestinationValues {
  name: string;
  description: string;
  targetSchema: string;
  schemaSourceType: 'manual' | 'documentation' | 'url';
  schemaSourceUrl: string;
  modelProvider: 'openai' | 'anthropic';
  modelName: string;
  webhookSecret: string;
}

const DEFAULT_VALUES: AdapterFormValues = {
  name: '',
  description: '',
  targetSchema: '',
  schemaSourceType: 'manual',
  schemaSourceUrl: '',
  modelProvider: 'openai',
  modelName: DEFAULT_MODELS.openai,
  enableDestination: false,
  destinationUrl: '',
  destinationMethod: 'POST',
  authMethod: 'none',
  authHeaderName: 'X-API-Key',
  authValue: '',
  webhookSecret: '',
};

interface AdapterFormProps {
  mode: 'create' | 'edit';
  adapterId?: string;
  initialValues?: Partial<AdapterFormValues>;
  maskedAuthValue?: string | null;
}

function SectionHeading({ index, color, children }: { index: number; color: string; children: React.ReactNode }) {
  return (
    <h2 className="font-accent font-semibold text-cream text-lg mb-6 flex items-center gap-2">
      <span className={`w-6 h-6 rounded-full text-xs flex items-center justify-center ${color}`}>
        {index}
      </span>
      {children}
    </h2>
  );
}

export function AdapterForm({ mode, adapterId, initialValues, maskedAuthValue }: AdapterFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const t = useTranslations('adapterForm');
  const tCommon = useTranslations('common');
  const tToasts = useTranslations('toasts');
  const [isPending, startTransition] = useTransition();

  const [values, setValues] = useState<AdapterFormValues>({
    ...DEFAULT_VALUES,
    ...initialValues,
  });
  const [schemaValid, setSchemaValid] = useState(Boolean(initialValues?.targetSchema));
  const [error, setError] = useState('');

  const set = <K extends keyof AdapterFormValues>(key: K, value: AdapterFormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const canSubmit = values.name.trim().length > 0 && schemaValid && !isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!schemaValid) {
      setError(t('schemaRequired'));
      return;
    }

    const payload = {
      name: values.name,
      description: values.description || undefined,
      targetSchema: values.targetSchema,
      schemaSourceType: values.schemaSourceType,
      schemaSourceUrl: values.schemaSourceUrl || undefined,
      modelProvider: values.modelProvider,
      modelName: values.modelName || undefined,
      destinationUrl: values.enableDestination ? values.destinationUrl : undefined,
      destinationMethod: values.destinationMethod,
      authMethod: values.enableDestination ? values.authMethod : ('none' as const),
      authHeaderName:
        values.enableDestination && values.authMethod === 'api_key'
          ? values.authHeaderName
          : undefined,
      authValue:
        values.enableDestination && values.authMethod !== 'none' && values.authValue
          ? values.authValue
          : undefined,
      webhookSecret: values.webhookSecret || undefined,
    };

    startTransition(async () => {
      if (mode === 'create') {
        const result = await createAdapter(payload);
        if (result.success) {
          toast({ variant: 'success', title: tToasts('adapterCreated') });
          router.push(`/adapters/${result.data.id}`);
        } else {
          setError(result.error);
        }
      } else if (adapterId) {
        const result = await updateAdapter(adapterId, payload);
        if (result.success) {
          toast({ variant: 'success', title: tToasts('adapterUpdated') });
          router.push(`/adapters/${adapterId}`);
        } else {
          setError(result.error);
        }
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && (
        <div className="p-4 bg-coral/10 border border-coral/30 rounded-lg text-coral text-sm font-accent animate-fade-in">
          {error}
        </div>
      )}

      {/* 1. Basic info */}
      <section className="card p-6 animate-slide-up">
        <SectionHeading index={1} color="bg-amber/20 text-amber">
          {t('sectionBasics')}
        </SectionHeading>
        <div className="space-y-5">
          <div>
            <label htmlFor="adapter-name" className="label">
              {t('nameLabel')} <span className="text-coral">*</span>
            </label>
            <input
              id="adapter-name"
              type="text"
              value={values.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder={t('namePlaceholder')}
              className="input"
              required
            />
          </div>
          <div>
            <label htmlFor="adapter-description" className="label">
              {t('descriptionLabel')}
            </label>
            <input
              id="adapter-description"
              type="text"
              value={values.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder={t('descriptionPlaceholder')}
              className="input"
            />
          </div>
        </div>
      </section>

      {/* 2. Target schema */}
      <section className="card p-6 animate-slide-up" style={{ animationDelay: '0.05s' }}>
        <SectionHeading index={2} color="bg-gold/20 text-gold">
          {t('sectionSchema')}
        </SectionHeading>
        <SchemaEditor
          value={values.targetSchema}
          onChange={(schema) => set('targetSchema', schema)}
          onValidChange={setSchemaValid}
          onMeta={({ name, description }) => {
            setValues((prev) => ({
              ...prev,
              name: prev.name || name || prev.name,
              description: prev.description || description || prev.description,
            }));
          }}
          onSourceChange={(source, url) => {
            setValues((prev) => ({
              ...prev,
              schemaSourceType: source,
              schemaSourceUrl: url ?? prev.schemaSourceUrl,
            }));
          }}
        />
      </section>

      {/* 3. AI model */}
      <section className="card p-6 animate-slide-up" style={{ animationDelay: '0.1s' }}>
        <SectionHeading index={3} color="bg-sage/20 text-sage">
          {t('sectionModel')}
        </SectionHeading>
        <ModelPicker
          provider={values.modelProvider}
          modelName={values.modelName}
          onChange={(provider, modelName) =>
            setValues((prev) => ({ ...prev, modelProvider: provider, modelName }))
          }
        />
      </section>

      {/* 4. Destination */}
      <section className="card p-6 animate-slide-up" style={{ animationDelay: '0.15s' }}>
        <SectionHeading index={4} color="bg-copper/20 text-copper">
          {t('sectionDestination')}
        </SectionHeading>
        <DestinationConfig
          values={values}
          onChange={(dest) => setValues((prev) => ({ ...prev, ...dest }))}
          maskedAuthValue={maskedAuthValue}
        />
      </section>

      {/* 5. Security */}
      <section className="card p-6 animate-slide-up" style={{ animationDelay: '0.2s' }}>
        <SectionHeading index={5} color="bg-terracotta/20 text-terracotta">
          {t('sectionSecurity')}
        </SectionHeading>
        <div>
          <label htmlFor="webhook-secret" className="label">
            {t('webhookSecretLabel')}
          </label>
          <input
            id="webhook-secret"
            type="text"
            value={values.webhookSecret}
            onChange={(e) => set('webhookSecret', e.target.value)}
            placeholder="whsec_..."
            className="input font-mono"
            minLength={16}
          />
          <p className="text-xs text-clay mt-1.5 font-accent">{t('webhookSecretHelp')}</p>
        </div>
      </section>

      {/* Actions */}
      <div className="flex items-center justify-end gap-4 pt-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="btn-secondary"
          disabled={isPending}
        >
          {tCommon('cancel')}
        </button>
        <button type="submit" className="btn-primary flex items-center gap-2" disabled={!canSubmit}>
          {isPending && <Spinner />}
          {mode === 'create'
            ? isPending
              ? t('creating')
              : t('createSubmit')
            : isPending
              ? t('saving')
              : t('saveSubmit')}
        </button>
      </div>
    </form>
  );
}
