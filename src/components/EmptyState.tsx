/**
 * Dashboard empty state — first-run onboarding. The "how it works"
 * walkthrough only lives here: visible when useful, gone afterwards.
 */

import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

export async function EmptyState() {
  const t = await getTranslations('emptyStates');

  const steps = [
    { title: t('step1Title'), description: t('step1Description') },
    { title: t('step2Title'), description: t('step2Description') },
    { title: t('step3Title'), description: t('step3Description') },
  ];

  return (
    <div className="text-center py-16 animate-fade-in">
      <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-amber/20 to-copper/10 border border-amber/30 flex items-center justify-center mx-auto mb-6">
        <svg className="w-10 h-10 text-amber" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
      </div>
      <h2 className="font-display text-3xl text-cream mb-3">{t('noAdaptersTitle')}</h2>
      <p className="text-taupe font-accent max-w-md mx-auto mb-8">{t('noAdaptersDescription')}</p>
      <Link href="/adapters/new" className="btn-primary inline-flex items-center gap-2">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        {t('createFirst')}
      </Link>

      <div className="mt-16 max-w-4xl mx-auto">
        <h3 className="text-sm font-accent uppercase tracking-wider text-taupe mb-6">
          {t('howItWorksTitle')}
        </h3>
        <div className="grid md:grid-cols-3 gap-4 text-left">
          {steps.map((step, i) => (
            <div key={i} className="card p-5 stagger-item">
              <span className="w-7 h-7 rounded-full bg-amber/20 text-amber text-sm font-accent flex items-center justify-center mb-3">
                {i + 1}
              </span>
              <h4 className="font-accent font-semibold text-cream text-sm mb-1.5">{step.title}</h4>
              <p className="text-xs text-taupe font-accent leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
