/**
 * Adapter logs page — SQL-aggregate stats (whole table, never a page of
 * rows) + cursor-paginated explorer with live polling.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { getAdapterById, getAdapterLogs, getAdapterStats } from '@/lib/actions';
import { formatDuration, formatNumber } from '@/lib/utils/format';
import { StatCard } from '@/components/ui/StatCard';
import { LogsExplorer } from '@/components/logs/LogsExplorer';

export const dynamic = 'force-dynamic';

export default async function AdapterLogsPage({ params }: { params: { id: string } }) {
  const [adapter, stats, initial, t, tCommon, locale] = await Promise.all([
    getAdapterById(params.id),
    getAdapterStats(params.id),
    getAdapterLogs(params.id, { take: 50 }),
    getTranslations('logs'),
    getTranslations('common'),
    getLocale(),
  ]);

  if (!adapter) notFound();

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 space-y-6">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap animate-fade-in">
        <div>
          <Link
            href={`/adapters/${adapter.id}`}
            className="text-sm text-taupe hover:text-amber font-accent transition-colors"
          >
            ← {t('backToAdapter')}
          </Link>
          <div className="flex items-center gap-3 mt-1">
            <h1 className="font-display text-3xl text-cream">{adapter.name}</h1>
            <span className={adapter.isActive ? 'badge-success' : 'badge-error'}>
              <span className="relative flex h-2 w-2 mr-1.5">
                {adapter.isActive && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sage opacity-60" />
                )}
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${adapter.isActive ? 'bg-sage' : 'bg-coral'}`}
                />
              </span>
              {adapter.isActive ? tCommon('active') : tCommon('inactive')}
            </span>
          </div>
        </div>
      </div>

      {/* Stats — global SQL aggregates */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 animate-slide-up">
          <StatCard label={t('statTotal')} value={formatNumber(stats.total, locale)} />
          <StatCard
            label={t('statSuccess')}
            value={formatNumber(stats.successCount, locale)}
            tone="success"
          />
          <StatCard
            label={t('statErrors')}
            value={formatNumber(stats.errorCount, locale)}
            tone={stats.errorCount > 0 ? 'error' : 'default'}
          />
          <StatCard
            label={t('statRate')}
            value={`${stats.successRate}%`}
            tone={stats.successRate >= 95 ? 'success' : stats.successRate >= 80 ? 'accent' : 'error'}
          />
          <StatCard label={t('statAvgLatency')} value={formatDuration(stats.avgTransformMs)} />
        </div>
      )}

      {/* Explorer or empty state */}
      {stats && stats.total === 0 && initial.logs.length === 0 ? (
        <div className="card p-12 text-center animate-slide-up">
          <h2 className="font-display text-2xl text-cream mb-2">{t('emptyNoLogs')}</h2>
          <p className="text-taupe font-accent text-sm max-w-md mx-auto mb-6">{t('emptyHint')}</p>
          <Link
            href={`/adapters/${adapter.id}#playground`}
            className="btn-primary inline-flex text-sm"
          >
            {t('backToAdapter')}
          </Link>
        </div>
      ) : (
        <div className="animate-slide-up">
          <LogsExplorer
            adapterId={adapter.id}
            initialLogs={initial.logs}
            initialCursor={initial.nextCursor}
          />
        </div>
      )}
    </div>
  );
}
