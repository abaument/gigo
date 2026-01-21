/**
 * Transformation logs page for a specific adapter.
 *
 * Displays the history of all transformation attempts with
 * input/output comparison and success/failure status.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAdapterById, getAdapterLogs } from '@/lib/actions';
import { LogEntry } from '@/components/LogEntry';

interface LogsPageProps {
  params: { id: string };
}

export const dynamic = 'force-dynamic';

export default async function LogsPage({ params }: LogsPageProps) {
  const [adapter, logs] = await Promise.all([
    getAdapterById(params.id),
    getAdapterLogs(params.id, { take: 100 }),
  ]);

  if (!adapter) {
    notFound();
  }

  const successCount = logs.filter(l => l.success).length;
  const failureCount = logs.filter(l => !l.success).length;

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      {/* Header */}
      <div className="flex items-start justify-between mb-10 animate-fade-in">
        <div>
          <div className="flex items-center gap-2 text-sm text-taupe mb-3 font-accent">
            <Link href="/" className="hover:text-amber transition-colors">
              Dashboard
            </Link>
            <span className="text-clay">/</span>
            <span className="text-cream">{adapter.name}</span>
          </div>
          <h1 className="font-display text-4xl text-cream mb-2">
            Transformation Logs
          </h1>
          <p className="text-taupe font-accent">
            View the history of all transformations processed by this adapter.
          </p>
        </div>
        <Link href="/" className="btn-secondary text-sm">
          ← Back to Dashboard
        </Link>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-4 gap-4 mb-10">
        <div className="card p-5 stagger-item">
          <div className="text-3xl font-display text-cream">{logs.length}</div>
          <div className="text-sm text-taupe font-accent">Total Requests</div>
        </div>
        <div className="card p-5 stagger-item">
          <div className="text-3xl font-display text-sage">{successCount}</div>
          <div className="text-sm text-taupe font-accent">Successful</div>
        </div>
        <div className="card p-5 stagger-item">
          <div className="text-3xl font-display text-coral">{failureCount}</div>
          <div className="text-sm text-taupe font-accent">Failed</div>
        </div>
        <div className="card p-5 stagger-item">
          <div className="text-3xl font-display text-amber">
            {logs.length > 0 
              ? `${Math.round((successCount / logs.length) * 100)}%`
              : '—'}
          </div>
          <div className="text-sm text-taupe font-accent">Success Rate</div>
        </div>
      </div>

      {/* Webhook URL */}
      <div className="card p-5 mb-10 animate-slide-up">
        <div className="flex items-center justify-between">
          <div>
            <label className="text-xs text-taupe font-accent uppercase tracking-wider">Webhook URL</label>
            <code className="block text-amber font-mono text-sm mt-1.5">
              {process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/webhook/{adapter.id}
            </code>
          </div>
          <div className="text-sm text-taupe font-accent">
            POST JSON to this URL
          </div>
        </div>
      </div>

      {/* Logs List */}
      <div className="space-y-4">
        <h2 className="font-display text-2xl text-cream">
          Recent Transformations
        </h2>

        {logs.length === 0 ? (
          <div className="card p-16 text-center animate-fade-in">
            <div className="w-20 h-20 rounded-2xl bg-amber/10 border border-amber/20 flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-amber/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="font-display text-xl text-cream mb-3">No Logs Yet</h3>
            <p className="text-taupe mb-8 max-w-md mx-auto font-accent">
              Send a JSON payload to your webhook URL to see transformation logs here.
            </p>
            <div className="bg-roast rounded-lg p-5 text-left max-w-lg mx-auto border border-bark">
              <p className="text-xs text-taupe mb-3 font-accent uppercase tracking-wider">Example cURL command:</p>
              <code className="text-xs text-amber font-mono break-all leading-relaxed">
                curl -X POST {process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/webhook/{adapter.id} \<br/>
                &nbsp;&nbsp;-H &quot;Content-Type: application/json&quot; \<br/>
                &nbsp;&nbsp;-d &apos;{`{"name": "Test", "value": 123}`}&apos;
              </code>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {logs.map((log, index) => (
              <LogEntry 
                key={log.id} 
                log={log} 
                style={{ animationDelay: `${index * 0.03}s` }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
