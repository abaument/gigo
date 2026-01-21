/**
 * Adapter card component for displaying adapter information.
 * V1: Includes destination status indicator.
 */

'use client';

import Link from 'next/link';
import { useState } from 'react';
import { DeleteAdapterButton } from './DeleteAdapterButton';

interface Adapter {
  id: string;
  name: string;
  description: string | null;
  targetSchema: string;
  destinationUrl: string | null;
  authMethod: string;
  isActive: boolean;
  createdAt: Date;
  _count: {
    logs: number;
  };
}

interface AdapterCardProps {
  adapter: Adapter;
  style?: React.CSSProperties;
}

export function AdapterCard({ adapter, style }: AdapterCardProps) {
  const [copied, setCopied] = useState(false);
  
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const webhookUrl = `${baseUrl}/api/webhook/${adapter.id}`;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Parse and preview the target schema
  let schemaPreview = '';
  try {
    const schema = JSON.parse(adapter.targetSchema);
    schemaPreview = JSON.stringify(schema, null, 2).slice(0, 200);
    if (schemaPreview.length >= 200) schemaPreview += '...';
  } catch {
    schemaPreview = 'Invalid JSON';
  }

  return (
    <div className={`card-highlight p-6 stagger-item ${!adapter.isActive ? 'opacity-60' : ''}`} style={style}>
      <div className="flex flex-col lg:flex-row lg:items-start gap-6">
        {/* Left: Adapter Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber/20 to-copper/10 border border-amber/30 flex items-center justify-center shrink-0">
              <svg 
                className="w-6 h-6 text-amber" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
                />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-accent font-semibold text-cream text-lg truncate">
                  {adapter.name}
                </h3>
                {!adapter.isActive && (
                  <span className="badge bg-clay/20 text-clay border-clay/30 text-xs">
                    Disabled
                  </span>
                )}
              </div>
              {adapter.description && (
                <p className="text-sm text-taupe line-clamp-2 font-accent">
                  {adapter.description}
                </p>
              )}
            </div>
          </div>

          {/* Webhook URL */}
          <div className="mb-4">
            <label className="text-xs text-taupe mb-1.5 block font-accent uppercase tracking-wider">Webhook URL</label>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-roast px-4 py-2.5 rounded-lg text-sm text-amber font-mono truncate border border-bark">
                {webhookUrl}
              </code>
              <button
                onClick={copyToClipboard}
                className="shrink-0 px-3 py-2.5 bg-roast border border-bark rounded-lg text-taupe hover:text-amber hover:border-amber/50 transition-all duration-300"
                title="Copy URL"
              >
                {copied ? (
                  <svg className="w-5 h-5 text-sage" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="flex flex-wrap items-center gap-4 text-sm font-accent">
            <div className="flex items-center gap-2 text-taupe">
              <svg className="w-4 h-4 text-copper" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <span>{adapter._count.logs} transformations</span>
            </div>
            <div className="flex items-center gap-2 text-taupe">
              <svg className="w-4 h-4 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{new Date(adapter.createdAt).toLocaleDateString()}</span>
            </div>
            {/* Destination indicator */}
            {adapter.destinationUrl ? (
              <div className="flex items-center gap-2 text-sage">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
                <span>Forwards to destination</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-clay">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Returns JSON only</span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Schema Preview */}
        <div className="lg:w-80 shrink-0">
          <label className="text-xs text-taupe mb-1.5 block font-accent uppercase tracking-wider">Target Schema</label>
          <pre className="code-block text-xs h-28 overflow-hidden">
            {schemaPreview}
          </pre>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-bark">
        <Link 
          href={`/adapters/${adapter.id}/logs`}
          className="btn-secondary text-sm py-2"
        >
          View Logs
        </Link>
        <DeleteAdapterButton adapterId={adapter.id} adapterName={adapter.name} />
      </div>
    </div>
  );
}
