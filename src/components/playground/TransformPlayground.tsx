/**
 * Transform playground — the "try it live" panel of the adapter hub.
 * Left: editable JSON input. Right: transformed output with latency,
 * tokens and model metadata. Runs against POST /api/adapters/[id]/test
 * (authenticated; forwards only when the toggle is on).
 */

'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { buildCurl } from '@/lib/utils/webhook';
import { saveLogAsExample } from '@/lib/actions';
import { formatDuration, formatRelativeTime } from '@/lib/utils/format';
import { useToast } from '@/components/ui/ToastProvider';
import { JsonEditor } from '@/components/JsonEditor';
import { JsonViewer } from '@/components/JsonViewer';
import { CopyButton } from '@/components/CopyButton';
import { Toggle } from '@/components/ui/Toggle';
import { Spinner } from '@/components/ui/Spinner';

interface TestResponse {
  status: 'success' | 'error';
  trace_id: string | null;
  data?: unknown;
  message?: string;
  code?: string;
  meta?: {
    duration_ms: number;
    transform_duration_ms: number;
    provider?: string;
    model?: string;
    input_tokens?: number | null;
    output_tokens?: number | null;
    learnings_applied?: { examples: number; pitfalls: number };
    warnings?: string[];
  };
  forwarding?: {
    success: boolean;
    status?: number;
    error?: string;
  };
}

type RunState =
  | { status: 'idle' }
  | { status: 'running' }
  | { status: 'success'; result: TestResponse }
  | { status: 'error'; message: string; result?: TestResponse };

interface HistoryEntry {
  id: number;
  at: Date;
  input: string;
  state: RunState;
}

interface TransformPlaygroundProps {
  adapterId: string;
  hasDestination: boolean;
  webhookSecret: string | null;
  sampleInput?: string;
  /** show the with/without-learnings comparison toggle */
  hasLearnings?: boolean;
}

const DEFAULT_INPUT = `{
  "user_first_name": "John",
  "user_email": "john@example.com"
}`;

export function TransformPlayground({
  adapterId,
  hasDestination,
  webhookSecret,
  sampleInput,
  hasLearnings = false,
}: TransformPlaygroundProps) {
  const t = useTranslations('playground');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();

  const [input, setInput] = useState(sampleInput ?? DEFAULT_INPUT);
  const [inputValid, setInputValid] = useState(false);
  const [forward, setForward] = useState(false);
  const [ignoreLearnings, setIgnoreLearnings] = useState(false);
  const [run, setRun] = useState<RunState>({ status: 'idle' });
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [savedTraceIds, setSavedTraceIds] = useState<Set<string>>(new Set());
  const [savingExample, setSavingExample] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const handleSaveExample = async (traceId: string) => {
    setSavingExample(true);
    try {
      const result = await saveLogAsExample(traceId);
      if (result.success) {
        setSavedTraceIds((prev) => new Set(prev).add(traceId));
        toast({ variant: 'success', title: t('exampleSaved') });
        router.refresh();
      } else {
        toast({ variant: 'error', title: t('exampleSaveError'), description: result.error });
      }
    } catch {
      toast({ variant: 'error', title: t('exampleSaveError') });
    } finally {
      setSavingExample(false);
    }
  };

  const handleRun = async () => {
    if (!inputValid || run.status === 'running') return;

    const controller = new AbortController();
    abortRef.current = controller;
    setRun({ status: 'running' });

    let nextState: RunState;
    try {
      const response = await fetch(`/api/adapters/${adapterId}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: JSON.parse(input), forward, ignoreLearnings }),
        signal: controller.signal,
      });
      const result = (await response.json()) as TestResponse;

      if (response.status === 429) {
        nextState = { status: 'error', message: t('rateLimited') };
      } else if (result.status === 'success') {
        nextState = { status: 'success', result };
      } else {
        nextState = {
          status: 'error',
          message: result.message || 'Transformation failed',
          result,
        };
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        nextState = { status: 'idle' };
      } else {
        nextState = {
          status: 'error',
          message: error instanceof Error ? error.message : 'Request failed',
        };
      }
    }

    setRun(nextState);
    if (nextState.status !== 'idle') {
      setHistory((prev) =>
        [{ id: Date.now(), at: new Date(), input, state: nextState }, ...prev].slice(0, 10)
      );
    }
    if (forward) {
      router.refresh();
    }
  };

  const handleCancel = () => {
    abortRef.current?.abort();
  };

  const restoreEntry = (entry: HistoryEntry) => {
    setInput(entry.input);
    setRun(entry.state);
  };

  const meta = run.status === 'success' ? run.result.meta : undefined;
  const forwarding = run.status === 'success' ? run.result.forwarding : undefined;
  const tokens = (meta?.input_tokens ?? 0) + (meta?.output_tokens ?? 0);

  return (
    <div className="card p-6" id="playground">
      <div className="flex items-center justify-between gap-4 flex-wrap mb-1">
        <h2 className="font-accent font-semibold text-cream text-lg">{t('title')}</h2>
        <div className="flex items-center gap-4 flex-wrap">
          {hasLearnings && (
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-xs text-taupe font-accent">{t('learningsToggle')}</span>
              <Toggle
                checked={!ignoreLearnings}
                onChange={(checked) => setIgnoreLearnings(!checked)}
                label={t('learningsToggle')}
              />
            </label>
          )}
          {hasDestination && (
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-xs text-taupe font-accent">{t('forwardToggle')}</span>
              <Toggle checked={forward} onChange={setForward} label={t('forwardToggle')} />
            </label>
          )}
        </div>
      </div>
      <p className="text-xs text-clay font-accent mb-5">{t('subtitle')}</p>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Input panel */}
        <div>
          <label className="label">{t('inputLabel')}</label>
          <JsonEditor
            value={input}
            onChange={setInput}
            onValidChange={setInputValid}
            minHeight="min-h-[14rem]"
          />
          <div className="flex items-center gap-3 mt-4">
            {run.status === 'running' ? (
              <button
                type="button"
                onClick={handleCancel}
                className="btn-secondary text-sm flex items-center gap-2"
              >
                <Spinner />
                {t('cancel')}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleRun}
                disabled={!inputValid}
                className="btn-primary text-sm flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                {t('run')}
              </button>
            )}
            <CopyButton
              text={buildCurl(adapterId, input, webhookSecret)}
              variant="label"
              label={tCommon('copy') + ' cURL'}
              copiedLabel={tCommon('copied')}
            />
          </div>
        </div>

        {/* Output panel */}
        <div>
          <label className="label">{t('outputLabel')}</label>
          {run.status === 'idle' && (
            <div className="code-block min-h-[14rem] flex items-center justify-center text-clay text-sm font-accent">
              {t('idleHint')}
            </div>
          )}
          {run.status === 'running' && (
            <div className="code-block min-h-[14rem] flex flex-col items-center justify-center gap-3 text-taupe">
              <Spinner className="w-6 h-6" />
              <span className="text-sm font-accent">{t('running')}</span>
            </div>
          )}
          {run.status === 'success' && (
            <div className="animate-fade-in">
              <JsonViewer json={JSON.stringify(run.result.data)} maxHeight="max-h-[14rem]" />
              {meta && (
                <div className="flex items-center gap-2 mt-3 flex-wrap text-xs font-accent">
                  <span className="badge-success">
                    {formatDuration(meta.transform_duration_ms)}
                  </span>
                  {tokens > 0 && <span className="badge-pending">{tokens} tokens</span>}
                  {meta.model && (
                    <span className="badge bg-bark text-sand border border-timber">
                      {meta.provider}/{meta.model}
                    </span>
                  )}
                  {meta.learnings_applied && (
                    <span
                      className="badge bg-amber/15 text-amber border border-amber/30"
                      title={t('learningsAppliedHelp')}
                    >
                      🧠{' '}
                      {t('learningsApplied', {
                        count:
                          meta.learnings_applied.examples + meta.learnings_applied.pitfalls,
                      })}
                    </span>
                  )}
                  {run.status === 'success' &&
                    run.result.trace_id &&
                    !meta.warnings &&
                    (savedTraceIds.has(run.result.trace_id) ? (
                      <span className="badge bg-sage/15 text-sage border border-sage/30">
                        ✓ {t('exampleSavedBadge')}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSaveExample(run.result.trace_id as string)}
                        disabled={savingExample}
                        className="badge bg-roast text-sand border border-timber hover:border-amber hover:text-amber transition-colors disabled:opacity-50"
                        title={t('saveExampleHelp')}
                      >
                        {savingExample ? '…' : `+ ${t('saveExample')}`}
                      </button>
                    ))}
                  {forwarding &&
                    (forwarding.success ? (
                      <span className="badge-success">
                        {t('forwarded', { status: forwarding.status ?? 200 })}
                      </span>
                    ) : (
                      <span className="badge-error">
                        {t('forwardFailed', { error: forwarding.error ?? `HTTP ${forwarding.status}` })}
                      </span>
                    ))}
                </div>
              )}
            </div>
          )}
          {run.status === 'error' && (
            <div className="min-h-[14rem] p-4 bg-coral/10 border border-coral/30 rounded-lg animate-fade-in">
              <p className="text-coral text-sm font-accent font-semibold mb-2">{t('errorTitle')}</p>
              <p className="text-coral/90 text-xs font-mono break-words">{run.message}</p>
            </div>
          )}
        </div>
      </div>

      {/* Session history */}
      <div className="mt-6 pt-5 border-t border-bark">
        <h3 className="text-sm font-accent font-semibold text-taupe mb-3">{t('history')}</h3>
        {history.length === 0 ? (
          <p className="text-xs text-clay font-accent">{t('historyEmpty')}</p>
        ) : (
          <ul className="space-y-1.5">
            {history.map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => restoreEntry(entry)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-roast/50 hover:bg-roast border border-transparent hover:border-bark transition-all text-left"
                >
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      entry.state.status === 'success' ? 'bg-sage' : 'bg-coral'
                    }`}
                  />
                  <code className="text-xs text-sand truncate flex-1">
                    {entry.input.replace(/\s+/g, ' ').slice(0, 80)}
                  </code>
                  <span className="text-xs text-clay font-accent shrink-0">
                    {formatRelativeTime(entry.at, locale)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
