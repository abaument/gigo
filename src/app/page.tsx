/**
 * Dashboard — a tool, not a landing page: global stats + searchable
 * adapter list. The onboarding walkthrough only appears in the empty
 * state.
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { getAdapters, getAdapterStats, getCurrentUser } from '@/lib/actions';
import { formatDuration, formatNumber } from '@/lib/utils/format';
import { StatCard } from '@/components/ui/StatCard';
import { AdapterList } from '@/components/dashboard/AdapterList';
import { EmptyState } from '@/components/EmptyState';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const [adapters, stats, t, tNav, locale] = await Promise.all([
    getAdapters(),
    getAdapterStats(),
    getTranslations('dashboard'),
    getTranslations('nav'),
    getLocale(),
  ]);

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between gap-4 mb-8 animate-fade-in">
        <div>
          <h1 className="font-display text-4xl text-cream mb-1">{t('title')}</h1>
          <p className="text-taupe font-accent">{t('subtitle')}</p>
        </div>
        <Link
          href="/adapters/new"
          className="btn-primary text-sm shrink-0 hidden sm:flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {tNav('newAdapter')}
        </Link>
      </div>

      {adapters.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {stats && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 animate-slide-up">
              <StatCard
                label={t('statAdapters')}
                value={formatNumber(stats.adapterCount ?? adapters.length, locale)}
              />
              <StatCard label={t('statCalls30d')} value={formatNumber(stats.last30dCount, locale)} />
              <StatCard
                label={t('statSuccessRate')}
                value={`${stats.successRate}%`}
                tone={stats.successRate >= 95 ? 'success' : stats.successRate >= 80 ? 'accent' : 'error'}
              />
              <StatCard label={t('statAvgLatency')} value={formatDuration(stats.avgTransformMs)} />
            </div>
          )}
          <AdapterList
            adapters={adapters.map((a) => ({
              id: a.id,
              name: a.name,
              description: a.description,
              targetSchema: a.targetSchema,
              destinationUrl: a.destinationUrl,
              modelProvider: a.modelProvider,
              isActive: a.isActive,
              createdAt: a.createdAt,
              _count: a._count,
            }))}
          />
        </>
      )}
    </div>
  );
}
