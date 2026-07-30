/**
 * Presentational logs table — receives already-filtered rows and
 * pagination controls from LogsExplorer.
 */

'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { LogListItem } from '@/lib/actions';
import { formatDuration, formatTimestamp } from '@/lib/utils/format';
import { Spinner } from '@/components/ui/Spinner';

function StatusBadge({ log }: { log: LogListItem }) {
  if (!log.success) {
    return <span className="badge-error text-[11px]">✕ {log.forwardingStatus ?? ''}</span>;
  }
  if (log.forwardingSuccess === false) {
    return <span className="badge-pending text-[11px]">⚠ {log.forwardingStatus ?? ''}</span>;
  }
  return <span className="badge-success text-[11px]">✓ {log.forwardingStatus ?? ''}</span>;
}

function DurationBadge({ ms }: { ms: number | null }) {
  if (ms === null) return <span className="text-clay text-xs">—</span>;
  const color = ms < 1500 ? 'text-sage' : ms < 4000 ? 'text-amber' : 'text-coral';
  return <span className={`text-xs font-mono ${color}`}>{formatDuration(ms)}</span>;
}

interface LogsTableProps {
  logs: LogListItem[];
  onSelect: (log: LogListItem) => void;
  isLoading?: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  isLoadingMore?: boolean;
}

export function LogsTable({
  logs,
  onSelect,
  isLoading = false,
  hasMore,
  onLoadMore,
  isLoadingMore = false,
}: LogsTableProps) {
  const t = useTranslations('logs');
  const tCommon = useTranslations('common');
  const locale = useLocale();

  if (isLoading) {
    return (
      <div className="card p-12 flex items-center justify-center text-taupe">
        <Spinner className="w-6 h-6" />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="card p-12 text-center text-taupe font-accent text-sm">{t('empty')}</div>
    );
  }

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-12 gap-3 px-5 py-3 border-b border-bark text-[11px] font-accent uppercase tracking-wider text-taupe">
        <div className="col-span-2">{t('colStatus')}</div>
        <div className="col-span-3">{t('colTrace')}</div>
        <div className="col-span-2">{t('colDuration')}</div>
        <div className="col-span-2">{t('colModel')}</div>
        <div className="col-span-3 text-right">{t('colTime')}</div>
      </div>

      {/* Rows */}
      <ul className="divide-y divide-bark/60">
        {logs.map((log) => (
          <li key={log.id}>
            <button
              type="button"
              onClick={() => onSelect(log)}
              className="w-full grid grid-cols-12 gap-3 px-5 py-3 items-center text-left table-row-hover"
            >
              <div className="col-span-2 flex items-center gap-1.5 flex-wrap">
                <StatusBadge log={log} />
                {log.isTest && (
                  <span className="badge bg-amber/15 text-amber border border-amber/30 text-[10px] px-1.5 py-0">
                    {t('badgeTest')}
                  </span>
                )}
                {log.replayOfId && (
                  <span className="badge bg-bark text-sand border border-timber text-[10px] px-1.5 py-0">
                    {t('badgeReplay')}
                  </span>
                )}
              </div>
              <div className="col-span-3">
                <code className="text-xs text-taupe truncate block">{log.id}</code>
              </div>
              <div className="col-span-2">
                <DurationBadge ms={log.totalDuration} />
              </div>
              <div className="col-span-2">
                <span className="text-xs text-sand font-mono truncate block">
                  {log.provider ?? '—'}
                </span>
              </div>
              <div className="col-span-3 text-right">
                <span className="text-xs text-clay font-accent">
                  {formatTimestamp(log.createdAt, locale)}
                </span>
              </div>
            </button>
          </li>
        ))}
      </ul>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-bark text-center">
        {hasMore ? (
          <button
            type="button"
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className="btn-secondary text-sm py-2 px-6 inline-flex items-center gap-2"
          >
            {isLoadingMore && <Spinner />}
            {tCommon('loadMore')}
          </button>
        ) : (
          <span className="text-xs text-clay font-accent">{t('endOfLogs')}</span>
        )}
      </div>
    </div>
  );
}
