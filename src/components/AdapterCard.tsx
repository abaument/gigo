/**
 * Adapter card — links to the adapter hub, shows endpoint, stats and a
 * schema preview.
 */

'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { DeleteAdapterButton } from './DeleteAdapterButton';
import { CopyButton } from './CopyButton';
import { buildWebhookUrl } from '@/lib/utils/webhook';
import { formatDate, formatNumber } from '@/lib/utils/format';

export interface AdapterListItem {
  id: string;
  name: string;
  description: string | null;
  targetSchema: string;
  destinationUrl: string | null;
  modelProvider: string;
  isActive: boolean;
  createdAt: Date | string;
  _count: {
    logs: number;
  };
}

interface AdapterCardProps {
  adapter: AdapterListItem;
  style?: React.CSSProperties;
}

export function AdapterCard({ adapter, style }: AdapterCardProps) {
  const t = useTranslations('dashboard');
  const tCommon = useTranslations('common');
  const locale = useLocale();

  const webhookUrl = buildWebhookUrl(adapter.id);

  let schemaPreview = '';
  try {
    const schema = JSON.parse(adapter.targetSchema);
    schemaPreview = JSON.stringify(schema, null, 2).slice(0, 200);
    if (schemaPreview.length >= 200) schemaPreview += '...';
  } catch {
    schemaPreview = tCommon('invalidJson');
  }

  return (
    <div
      className={`card-highlight p-6 stagger-item ${!adapter.isActive ? 'opacity-60' : ''}`}
      style={style}
    >
      <div className="flex flex-col lg:flex-row lg:items-start gap-6">
        {/* Left: Adapter Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber/20 to-copper/10 border border-amber/30 flex items-center justify-center shrink-0">
              <svg className="w-6 h-6 text-amber" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Link
                  href={`/adapters/${adapter.id}`}
                  className="font-accent font-semibold text-cream text-lg truncate hover:text-amber transition-colors"
                >
                  {adapter.name}
                </Link>
                <span className="badge bg-bark text-sand border border-timber text-[10px]">
                  {adapter.modelProvider}
                </span>
                {!adapter.isActive && (
                  <span className="badge bg-clay/20 text-clay border-clay/30 text-xs">
                    {tCommon('disabled')}
                  </span>
                )}
              </div>
              {adapter.description && (
                <p className="text-sm text-taupe line-clamp-2 font-accent">{adapter.description}</p>
              )}
            </div>
          </div>

          {/* Webhook URL */}
          <div className="mb-4">
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-roast px-4 py-2.5 rounded-lg text-sm text-amber font-mono truncate border border-bark">
                {webhookUrl}
              </code>
              <CopyButton text={webhookUrl} />
            </div>
          </div>

          {/* Stats */}
          <div className="flex flex-wrap items-center gap-4 text-sm font-accent text-taupe">
            <span>{t('transformations', { count: formatNumber(adapter._count.logs, locale) })}</span>
            <span>{formatDate(adapter.createdAt, locale)}</span>
            {adapter.destinationUrl && (
              <span className="flex items-center gap-1.5 text-sage">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
                →
              </span>
            )}
          </div>
        </div>

        {/* Right: Schema Preview */}
        <div className="lg:w-80 shrink-0">
          <pre className="code-block text-xs h-28 overflow-hidden">{schemaPreview}</pre>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-bark">
        <Link href={`/adapters/${adapter.id}`} className="btn-secondary text-sm py-2">
          {tCommon('edit')}
        </Link>
        <Link href={`/adapters/${adapter.id}/logs`} className="btn-secondary text-sm py-2">
          {tCommon('viewLogs')}
        </Link>
        <DeleteAdapterButton adapterId={adapter.id} adapterName={adapter.name} />
      </div>
    </div>
  );
}
