/**
 * Edit adapter page — prefilled shared form. An empty credential field
 * means "keep the stored one".
 */

import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getAdapterWithMaskedCredentials } from '@/lib/actions';
import { AdapterForm, type AdapterFormValues } from '@/components/adapter-form/AdapterForm';
import { DEFAULT_MODELS } from '@/lib/providers/models';

export const dynamic = 'force-dynamic';

export default async function EditAdapterPage({ params }: { params: { id: string } }) {
  const [t, adapter] = await Promise.all([
    getTranslations('adapterForm'),
    getAdapterWithMaskedCredentials(params.id),
  ]);

  if (!adapter) notFound();

  const initialValues: Partial<AdapterFormValues> = {
    name: adapter.name,
    description: adapter.description ?? '',
    targetSchema: adapter.targetSchema,
    schemaSourceType: (adapter.schemaSourceType as AdapterFormValues['schemaSourceType']) ?? 'manual',
    schemaSourceUrl: adapter.schemaSourceUrl ?? '',
    modelProvider: (adapter.modelProvider as AdapterFormValues['modelProvider']) ?? 'openai',
    modelName:
      adapter.modelName ??
      DEFAULT_MODELS[(adapter.modelProvider as 'openai' | 'anthropic') ?? 'openai'],
    enableDestination: Boolean(adapter.destinationUrl),
    destinationUrl: adapter.destinationUrl ?? '',
    destinationMethod: (adapter.destinationMethod as AdapterFormValues['destinationMethod']) ?? 'POST',
    authMethod: (adapter.authMethod as AdapterFormValues['authMethod']) ?? 'none',
    authHeaderName: adapter.authHeaderName ?? 'X-API-Key',
    authValue: '',
    webhookSecret: adapter.webhookSecret ?? '',
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <div className="mb-10 animate-fade-in">
        <h1 className="font-display text-4xl text-cream mb-3">{t('editTitle')}</h1>
        <p className="text-taupe font-accent">{adapter.name}</p>
      </div>
      <AdapterForm
        mode="edit"
        adapterId={adapter.id}
        initialValues={initialValues}
        maskedAuthValue={adapter.maskedAuthValue}
      />
    </div>
  );
}
