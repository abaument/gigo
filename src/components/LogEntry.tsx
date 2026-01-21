/**
 * Log entry component for displaying transformation details.
 * V1: Includes forwarding results and improved metrics.
 */

'use client';

import { useState } from 'react';

interface Log {
  id: string;
  adapterId: string;
  inputJson: string;
  outputJson: string | null;
  success: boolean;
  error: string | null;
  transformDuration: number | null;
  forwardedAt: Date | null;
  forwardingSuccess: boolean | null;
  forwardingResponse: string | null;
  forwardingStatus: number | null;
  forwardDuration: number | null;
  totalDuration: number | null;
  createdAt: Date;
}

interface LogEntryProps {
  log: Log;
  style?: React.CSSProperties;
}

export function LogEntry({ log, style }: LogEntryProps) {
  const [expanded, setExpanded] = useState(false);

  const formatJson = (json: string | null): string => {
    if (!json) return '';
    try {
      return JSON.stringify(JSON.parse(json), null, 2);
    } catch {
      return json;
    }
  };

  const inputFormatted = formatJson(log.inputJson);
  const outputFormatted = formatJson(log.outputJson);
  const forwardingResponseFormatted = formatJson(log.forwardingResponse);

  // Determine overall status
  const hasForwarding = log.forwardedAt !== null;
  const overallSuccess = log.success && (!hasForwarding || log.forwardingSuccess);

  return (
    <div 
      className={`card overflow-hidden stagger-item border-l-4 ${
        overallSuccess ? 'border-l-sage' : 'border-l-coral'
      }`}
      style={style}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-5 flex items-center justify-between text-left hover:bg-roast/50 transition-colors"
      >
        <div className="flex flex-wrap items-center gap-3">
          {/* Transform Status */}
          {log.success ? (
            <span className="badge-success">Transform ✓</span>
          ) : (
            <span className="badge-error">Transform ✗</span>
          )}

          {/* Forward Status */}
          {hasForwarding && (
            log.forwardingSuccess ? (
              <span className="badge bg-sage/20 text-sage border-sage/30">
                Forward ✓ ({log.forwardingStatus})
              </span>
            ) : (
              <span className="badge-error">Forward ✗</span>
            )
          )}

          {/* Timestamp */}
          <span className="text-sm text-taupe font-accent">
            {new Date(log.createdAt).toLocaleString()}
          </span>

          {/* Duration */}
          {log.totalDuration && (
            <span className="text-xs text-taupe bg-roast px-2.5 py-1 rounded font-mono border border-bark">
              {log.totalDuration}ms total
            </span>
          )}

          {/* Error Preview */}
          {log.error && (
            <span className="text-xs text-coral truncate max-w-xs font-accent">
              {log.error}
            </span>
          )}
        </div>

        <svg 
          className={`w-5 h-5 text-taupe transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t border-bark">
          {/* Error Message */}
          {log.error && (
            <div className="px-5 py-4 bg-coral/10 border-b border-coral/20">
              <p className="text-sm text-coral font-accent">
                <span className="font-semibold">Error:</span> {log.error}
              </p>
            </div>
          )}

          {/* Timing Breakdown */}
          <div className="px-5 py-3 bg-roast/50 border-b border-bark flex flex-wrap gap-6 text-xs font-accent">
            {log.transformDuration && (
              <div>
                <span className="text-taupe">Transform: </span>
                <span className="text-amber">{log.transformDuration}ms</span>
              </div>
            )}
            {log.forwardDuration && (
              <div>
                <span className="text-taupe">Forward: </span>
                <span className="text-amber">{log.forwardDuration}ms</span>
              </div>
            )}
            {log.totalDuration && (
              <div>
                <span className="text-taupe">Total: </span>
                <span className="text-cream font-semibold">{log.totalDuration}ms</span>
              </div>
            )}
          </div>

          {/* Input/Output Comparison */}
          <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-bark">
            {/* Input */}
            <div className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-accent uppercase tracking-wider text-taupe">Input JSON</h4>
                <CopyButton text={inputFormatted} />
              </div>
              <pre className="code-block text-xs max-h-64 overflow-auto">
                {inputFormatted || '(empty)'}
              </pre>
            </div>

            {/* Output */}
            <div className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-accent uppercase tracking-wider text-taupe">
                  Transformed Output
                </h4>
                {outputFormatted && <CopyButton text={outputFormatted} />}
              </div>
              <pre className="code-block text-xs max-h-64 overflow-auto">
                {outputFormatted || '(no output)'}
              </pre>
            </div>
          </div>

          {/* Forwarding Response */}
          {hasForwarding && (
            <div className="border-t border-bark p-5">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-accent uppercase tracking-wider text-taupe flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                  Destination Response
                  {log.forwardingStatus && (
                    <span className={`ml-2 px-2 py-0.5 rounded text-xs ${
                      log.forwardingSuccess 
                        ? 'bg-sage/20 text-sage' 
                        : 'bg-coral/20 text-coral'
                    }`}>
                      HTTP {log.forwardingStatus}
                    </span>
                  )}
                </h4>
                {forwardingResponseFormatted && <CopyButton text={forwardingResponseFormatted} />}
              </div>
              <pre className="code-block text-xs max-h-48 overflow-auto">
                {forwardingResponseFormatted || '(no response)'}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="text-xs text-taupe hover:text-amber transition-colors flex items-center gap-1.5 font-accent"
    >
      {copied ? (
        <>
          <svg className="w-3.5 h-3.5 text-sage" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Copied
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Copy
        </>
      )}
    </button>
  );
}
