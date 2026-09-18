/**
 * Adapter hub — endpoint + secret, stats, playground, recent logs and
 * configuration summary.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import {
  getAdapterById,
  getAdapterLearnings,
  getAdapterLogs,
  getAdapterStats,
} from '@/lib/actions';
import { formatDuration, formatNumber, formatTimestamp } from '@/lib/utils/format';
import { StatCard } from '@/components/ui/StatCard';
import { JsonViewer } from '@/components/JsonViewer';
import { WebhookEndpointCard } from '@/components/adapter-detail/WebhookEndpointCard';
import { EmailEndpointCard } from '@/components/adapter-detail/EmailEndpointCard';
import { AdapterQuickActions } from '@/components/adapter-detail/AdapterQuickActions';
import { LearningsCard } from '@/components/adapter-detail/LearningsCard';
import { OutputRuleCard } from '@/components/adapter-detail/OutputRuleCard';
import { TransformPlayground } from '@/components/playground/TransformPlayground';
import { buildInboundAddress } from '@/lib/email-inbound';

export const dynamic = 'force-dynamic';

export default async function AdapterDetailPage({ params }: { params: { id: string } }) {
  const [adapter, stats, recentLogs, learnings, t, tCommon, locale] = await Promise.all([
    getAdapterById(params.id),
    getAdapterStats(params.id),
    getAdapterLogs(params.id, { take: 5 }),
    getAdapterLearnings(params.id),
    getTranslations('adapterDetail'),
    getTranslations('common'),
    getLocale(),
  ]);

  if (!adapter) notFound();

  const emailInboxConfigured = Boolean(process.env.NEXT_PUBLIC_EMAIL_INBOUND_ADDRESS);
  const inboundEmailAddress = buildInboundAddress(
    process.env.NEXT_PUBLIC_EMAIL_INBOUND_ADDRESS,
    adapter.id,
    adapter.emailIngestToken
  );

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-6 flex-wrap animate-fade-in">
        <div className="min-w-0">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h1 className="font-display text-2xl sm:text-3xl text-cream truncate min-w-0">{adapter.name}</h1>
            <span className={adapter.isActive ? 'badge-success' : 'badge-error'}>
              {adapter.isActive ? tCommon('active') : tCommon('inactive')}
            </span>
            <span className="badge bg-bark text-sand border border-timber">
              {adapter.jsonataEnabled ? 'jsonata' : adapter.modelProvider}
            </span>
            <span className="badge bg-bark text-sand border border-timber uppercase">
              {adapter.outputFormat}
            </span>
            <a
              href="#apprentissages"
              className="badge bg-amber/10 text-amber border border-amber/30 hover:bg-amber/20 transition-colors"
            >
              {t('learningsJump', { count: learnings.length })}
            </a>
          </div>
          {adapter.description && (
            <p className="text-taupe font-accent">{adapter.description}</p>
          )}
        </div>
        <AdapterQuickActions
          adapterId={adapter.id}
          adapterName={adapter.name}
          isActive={adapter.isActive}
        />
      </div>

      {/* Endpoint + secret */}
      <div className="animate-slide-up">
        <WebhookEndpointCard
          adapterId={adapter.id}
          webhookSecret={adapter.webhookSecret}
          sampleBody={adapter.samplePayload ?? '{"example": "payload"}'}
        />
      </div>

      {/* Inbound email (only when the operator configured an inbox) */}
      {emailInboxConfigured && (
        <div className="animate-slide-up">
          <EmailEndpointCard adapterId={adapter.id} address={inboundEmailAddress} />
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-slide-up">
          <StatCard label={t('statTotal')} value={formatNumber(stats.total, locale)} />
          <StatCard
            label={t('statSuccessRate')}
            value={`${stats.successRate}%`}
            tone={stats.successRate >= 95 ? 'success' : stats.successRate >= 80 ? 'accent' : 'error'}
          />
          <StatCard label={t('statAvgTransform')} value={formatDuration(stats.avgTransformMs)} />
          <StatCard
            label={t('statTokens')}
            value={formatNumber(stats.tokensIn + stats.tokensOut, locale)}
          />
        </div>
      )}

      {/* Playground */}
      <div className="animate-slide-up">
        <TransformPlayground
          adapterId={adapter.id}
          hasDestination={Boolean(adapter.destinationUrl)}
          webhookSecret={adapter.webhookSecret}
          sampleInput={adapter.samplePayload ?? undefined}
          hasLearnings={adapter.learningEnabled && learnings.some((l) => l.enabled)}
        />
      </div>

      {/* Output format + deterministic rule */}
      <div className="animate-slide-up">
        <OutputRuleCard
          adapterId={adapter.id}
          outputFormat={adapter.outputFormat}
          expression={adapter.jsonataExpression}
          ruleEnabled={adapter.jsonataEnabled}
          hasSample={Boolean(adapter.samplePayload)}
        />
      </div>

      {/* Learning loop */}
      <div id="apprentissages" className="animate-slide-up scroll-mt-24">
        <LearningsCard
          adapterId={adapter.id}
          learningEnabled={adapter.learningEnabled}
          learnings={learnings.map((l) => ({
            id: l.id,
            kind: l.kind,
            inputJson: l.inputJson,
            note: l.note,
            source: l.source,
            enabled: l.enabled,
            createdAt: l.createdAt.toISOString(),
          }))}
        />
      </div>

      {/* Recent logs */}
      <section className="card p-6 animate-slide-up" id="logs">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-accent font-semibold text-cream text-lg">{t('recentLogs')}</h2>
          <Link
            href={`/adapters/${adapter.id}/logs`}
            className="text-sm text-amber hover:underline font-accent"
          >
            {t('viewAllLogs')} →
          </Link>
        </div>
        {recentLogs.logs.length === 0 ? (
          <p className="text-sm text-clay font-accent py-4">—</p>
        ) : (
          <ul className="divide-y divide-bark">
            {recentLogs.logs.map((log) => (
              <li key={log.id} className="flex items-center gap-4 py-2.5 text-sm">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${log.success ? 'bg-sage' : 'bg-coral'}`}
                />
                <code className="text-xs text-taupe truncate flex-1">{log.id}</code>
                {log.isTest && <span className="badge-pending text-[10px] px-2 py-0.5">TEST</span>}
                <span className="text-xs text-sand font-accent">
                  {formatDuration(log.totalDuration)}
                </span>
                <span className="text-xs text-clay font-accent shrink-0" suppressHydrationWarning>
                  {formatTimestamp(log.createdAt, locale)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Settings summary */}
      <section className="card p-6 animate-slide-up" id="settings">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-accent font-semibold text-cream text-lg">{t('settings')}</h2>
          <Link href={`/adapters/${adapter.id}/edit`} className="btn-secondary text-sm py-2 px-4">
            {tCommon('edit')}
          </Link>
        </div>
        <div className="grid lg:grid-cols-2 gap-6">
          <div>
            <h3 className="label">{t('configSchema')}</h3>
            <JsonViewer json={adapter.targetSchema} maxHeight="max-h-64" />
          </div>
          <div className="space-y-4">
            <div>
              <h3 className="label">{t('configModel')}</h3>
              <p className="text-sm text-sand font-mono">
                {adapter.modelProvider} · {adapter.modelName ?? 'default'}
              </p>
            </div>
            <div>
              <h3 className="label">{t('configDestination')}</h3>
              {adapter.destinationUrl ? (
                <p className="text-sm text-sand font-mono break-all">
                  {adapter.destinationMethod} {adapter.destinationUrl}
                </p>
              ) : (
                <p className="text-sm text-clay font-accent">{t('configNoDestination')}</p>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
