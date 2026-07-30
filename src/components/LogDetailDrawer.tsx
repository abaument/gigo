/**
 * Log detail drawer. The list only carries light columns, so the full
 * payload (input/output/forwarding response) is fetched on open via
 * getLogById.
 */

'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { TransformationLog } from '@prisma/client';
import { getLogById, type LogListItem } from '@/lib/actions';
import { formatDuration, formatTimestamp } from '@/lib/utils/format';
import { JsonViewer } from '@/components/JsonViewer';
import { CopyButton } from '@/components/CopyButton';
import { Spinner } from '@/components/ui/Spinner';
import { ReplayLogButton } from '@/components/logs/ReplayLogButton';

type DrawerTab = 'overview' | 'input' | 'output' | 'response';

interface LogDetailDrawerProps {
  log: LogListItem;
  onClose: () => void;
  onReplayed?: () => void;
}

export function LogDetailDrawer({ log, onClose, onReplayed }: LogDetailDrawerProps) {
  const t = useTranslations('logs');
  const locale = useLocale();
  const [tab, setTab] = useState<DrawerTab>('overview');
  const [fullLog, setFullLog] = useState<TransformationLog | null>(null);

  useEffect(() => {
    let cancelled = false;
    getLogById(log.id).then((result) => {
      if (!cancelled) setFullLog(result);
    });
    return () => {
      cancelled = true;
    };
  }, [log.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const canReplay = !log.success || log.forwardingSuccess === false;

  const tabs: { id: DrawerTab; label: string }[] = [
    { id: 'overview', label: t('drawerOverview') },
    { id: 'input', label: t('drawerInput') },
    { id: 'output', label: t('drawerOutput') },
    { id: 'response', label: t('drawerResponse') },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-espresso/80 backdrop-blur-sm drawer-overlay" onClick={onClose} />

      <aside className="relative w-full max-w-2xl bg-coffee border-l border-bark h-full overflow-y-auto animate-slide-in-right">
        {/* Header */}
        <div className="sticky top-0 bg-coffee/95 backdrop-blur-md border-b border-bark px-6 py-4 z-10">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className={log.success ? 'badge-success' : 'badge-error'}>
                {log.success ? '✓' : '✕'}
              </span>
              {log.isTest && <span className="badge-pending text-[10px]">{t('badgeTest')}</span>}
              <code className="text-xs text-taupe truncate">{log.id}</code>
              <CopyButton text={log.id} className="p-1.5" />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {canReplay && <ReplayLogButton logId={log.id} onReplayed={onReplayed} />}
              <button
                type="button"
                onClick={onClose}
                className="p-2 text-taupe hover:text-cream rounded-lg hover:bg-roast transition-colors"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-4">
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`px-4 py-1.5 rounded-md text-sm font-accent transition-all ${
                  tab === item.id
                    ? 'bg-amber text-espresso font-semibold'
                    : 'text-taupe hover:text-cream hover:bg-roast'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          {tab === 'overview' && (
            <div className="space-y-5">
              {/* Pipeline timeline */}
              <div className="card p-5 bg-roast/50">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-[11px] font-accent uppercase tracking-wider text-taupe mb-1">
                      Transform
                    </p>
                    <p className="font-mono text-sm text-cream">
                      {formatDuration(log.transformDuration)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-accent uppercase tracking-wider text-taupe mb-1">
                      Forward
                    </p>
                    <p className="font-mono text-sm text-cream">
                      {formatDuration(log.forwardDuration)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-accent uppercase tracking-wider text-taupe mb-1">
                      Total
                    </p>
                    <p className="font-mono text-sm text-amber">
                      {formatDuration(log.totalDuration)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Metadata */}
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <MetaRow label={t('colTime')} value={formatTimestamp(log.createdAt, locale)} />
                <MetaRow label={t('provider')} value={log.provider ?? '—'} />
                <MetaRow label={t('colModel')} value={log.modelName ?? '—'} />
                <MetaRow
                  label={t('tokens')}
                  value={
                    log.inputTokens !== null || log.outputTokens !== null
                      ? `${log.inputTokens ?? 0} in / ${log.outputTokens ?? 0} out`
                      : '—'
                  }
                />
                <MetaRow label="Source" value={log.sourceIp ?? '—'} />
                <MetaRow
                  label={t('colForwarding')}
                  value={
                    log.forwardingSuccess === null
                      ? '—'
                      : log.forwardingSuccess
                        ? `✓ HTTP ${log.forwardingStatus ?? ''}`
                        : `✕ HTTP ${log.forwardingStatus ?? ''}`
                  }
                />
              </dl>

              {log.error && (
                <div className="p-4 bg-coral/10 border border-coral/30 rounded-lg">
                  <p className="text-xs font-mono text-coral break-words">{log.error}</p>
                </div>
              )}
            </div>
          )}

          {tab !== 'overview' &&
            (fullLog === null ? (
              <div className="flex items-center justify-center py-16 text-taupe">
                <Spinner className="w-6 h-6" />
              </div>
            ) : (
              <>
                {tab === 'input' && <JsonViewer json={fullLog.inputJson} maxHeight="max-h-[70vh]" />}
                {tab === 'output' &&
                  (fullLog.outputJson ? (
                    <JsonViewer json={fullLog.outputJson} maxHeight="max-h-[70vh]" />
                  ) : (
                    <p className="text-sm text-clay font-accent text-center py-10">—</p>
                  ))}
                {tab === 'response' &&
                  (fullLog.forwardingResponse ? (
                    <JsonViewer json={fullLog.forwardingResponse} maxHeight="max-h-[70vh]" />
                  ) : (
                    <p className="text-sm text-clay font-accent text-center py-10">—</p>
                  ))}
              </>
            ))}
        </div>
      </aside>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-accent uppercase tracking-wider text-taupe">{label}</dt>
      <dd className="text-sand font-mono text-xs mt-0.5 break-all">{value}</dd>
    </div>
  );
}
