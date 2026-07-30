'use client';

import { useTranslations } from 'next-intl';

export default function AppError({
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
        <div className="w-14 h-14 rounded-2xl bg-coral/10 border border-coral/30 flex items-center justify-center mx-auto mb-6">
          <svg className="w-7 h-7 text-coral" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h1 className="font-display text-3xl text-cream mb-3">{t('title')}</h1>
        <p className="text-taupe font-accent mb-2">{t('description')}</p>
        {error.digest && <p className="text-xs text-clay font-mono mb-6">digest: {error.digest}</p>}
        <button type="button" onClick={reset} className="btn-primary text-sm">
          {tCommon('retry')}
        </button>
      </div>
    </div>
  );
}
