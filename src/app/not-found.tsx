import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

export default async function NotFound() {
  const t = await getTranslations('errors');

  return (
    <div className="max-w-2xl mx-auto px-6 py-24 text-center">
      <div className="card p-10">
        <p className="font-display text-6xl text-amber mb-4">404</p>
        <h1 className="font-display text-3xl text-cream mb-3">{t('notFoundTitle')}</h1>
        <p className="text-taupe font-accent mb-8">{t('notFoundDescription')}</p>
        <Link href="/" className="btn-primary text-sm inline-flex">
          {t('backHome')}
        </Link>
      </div>
    </div>
  );
}
