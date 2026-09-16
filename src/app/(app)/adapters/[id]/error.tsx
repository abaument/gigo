'use client';

import { useTranslations } from 'next-intl';

export default function AdapterError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('errors');
  const tCommon = useTranslations('common');

  return (
    <div className="max-w-2xl mx-auto px-6 py-24 text-center">
      <div className="card border-coral/30 p-10">
        <h1 className="font-display text-3xl text-cream mb-3">{t('title')}</h1>
        <p className="text-taupe font-accent mb-6">{t('description')}</p>
        <button type="button" onClick={reset} className="btn-primary text-sm">
          {tCommon('retry')}
        </button>
      </div>
    </div>
  );
}
