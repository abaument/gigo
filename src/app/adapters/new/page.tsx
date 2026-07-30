/**
 * Create adapter page — thin server component around the shared form.
 */

import { getTranslations } from 'next-intl/server';
import { AdapterForm } from '@/components/adapter-form/AdapterForm';

export const dynamic = 'force-dynamic';

export default async function NewAdapterPage() {
  const t = await getTranslations('adapterForm');

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <div className="mb-10 animate-fade-in">
        <h1 className="font-display text-4xl text-cream mb-3">{t('createTitle')}</h1>
      </div>
      <AdapterForm mode="create" />
    </div>
  );
}
