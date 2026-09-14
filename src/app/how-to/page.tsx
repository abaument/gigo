/**
 * How-to guide — the full journey from zero to a live adapter, in six
 * steps. Public page (works logged out) so it can be shared as-is.
 */

import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

export const dynamic = 'force-dynamic';

function StepCard({
  num,
  title,
  children,
}: {
  num: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card p-5 sm:p-6">
      <div className="flex items-start gap-4">
        <span className="shrink-0 w-9 h-9 rounded-full bg-amber/20 border border-amber/40 text-amber font-accent font-bold flex items-center justify-center">
          {num}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg sm:text-xl text-cream mb-2">{title}</h2>
          <div className="text-sm text-sand font-accent leading-relaxed space-y-2">{children}</div>
        </div>
      </div>
    </div>
  );
}

export default async function HowToPage() {
  const t = await getTranslations('howTo');
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://your-gigo.example.com';
  const emailConfigured = Boolean(process.env.NEXT_PUBLIC_EMAIL_INBOUND_ADDRESS);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <div className="mb-8 animate-fade-in">
        <h1 className="font-display text-3xl sm:text-4xl text-cream mb-1">{t('title')}</h1>
        <p className="text-taupe font-accent">{t('subtitle')}</p>
      </div>

      <div className="space-y-4 animate-slide-up">
        <StepCard num="1" title={t('s1Title')}>
          <p>{t('s1Body')}</p>
          <p>
            <Link href="/settings" className="text-amber hover:underline">
              {t('s1Link')}
            </Link>{' '}
            {t('s1LinkSuffix')}
          </p>
        </StepCard>

        <StepCard num="2" title={t('s2Title')}>
          <p>{t('s2Body')}</p>
          <div className="code-block text-xs whitespace-pre">{`{
  "first_name": "Jean",
  "email": "jean@exemple.fr",
  "amount_cents": 4990
}`}</div>
          <p>{t('s2Body2')}</p>
        </StepCard>

        <StepCard num="3" title={t('s3Title')}>
          <p>{t('s3Body')}</p>
        </StepCard>

        <StepCard num="4" title={t('s4Title')}>
          <p>{t('s4Body')}</p>
          <div className="code-block text-xs overflow-x-auto whitespace-pre">{`curl -X POST ${baseUrl}/api/webhook/<ID> \\
  -H "Content-Type: application/json" \\
  -H "X-Webhook-Secret: whsec_..." \\
  -d '{"user_first_name": "jean", "amount": "49,90 €"}'`}</div>
          {emailConfigured && <p>{t('s4Email')}</p>}
        </StepCard>

        <StepCard num="5" title={t('s5Title')}>
          <p>{t('s5Body')}</p>
        </StepCard>

        <StepCard num="6" title={t('s6Title')}>
          <p>{t('s6Body')}</p>
        </StepCard>
      </div>

      <div className="card p-5 sm:p-6 mt-8 border-amber/30 bg-amber/5 animate-slide-up">
        <h2 className="font-display text-lg text-cream mb-2">{t('tipsTitle')}</h2>
        <ul className="text-sm text-sand font-accent leading-relaxed space-y-1.5 list-disc pl-5">
          <li>{t('tip1')}</li>
          <li>{t('tip2')}</li>
          <li>{t('tip3')}</li>
        </ul>
      </div>

      <div className="text-center mt-10">
        <Link href="/adapters/new" className="btn-primary inline-flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {t('cta')}
        </Link>
      </div>
    </div>
  );
}
