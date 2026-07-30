import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

export default async function AdapterNotFound() {
  const [t, tErrors] = await Promise.all([
    getTranslations('adapterDetail'),
    getTranslations('errors'),
  ]);

  return (
    <div className="max-w-2xl mx-auto px-6 py-24 text-center">
      <div className="card p-10">
        <p className="font-display text-6xl text-amber mb-4">404</p>
        <h1 className="font-display text-3xl text-cream mb-8">{t('notFound')}</h1>
        <Link href="/" className="btn-primary text-sm inline-flex">
          {tErrors('backHome')}
        </Link>
      </div>
    </div>
  );
}
