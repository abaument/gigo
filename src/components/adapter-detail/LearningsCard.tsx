/**
 * Learning loop card — what this adapter has learned from its runs:
 * reference examples (validated transformations re-injected as few-shot)
 * and pitfall constraints (e.g. keys the model hallucinated once and must
 * never output again). Each item can be paused or deleted; the whole loop
 * can be switched off per adapter.
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import {
  deleteLearning,
  setAdapterLearningEnabled,
  setLearningEnabled,
} from '@/lib/actions';
import { Toggle } from '@/components/ui/Toggle';
import { useToast } from '@/components/ui/ToastProvider';
import { formatTimestamp } from '@/lib/utils/format';

export interface LearningItem {
  id: string;
  kind: string;
  inputJson: string | null;
  note: string | null;
  source: string;
  enabled: boolean;
  createdAt: string;
}

interface LearningsCardProps {
  adapterId: string;
  learningEnabled: boolean;
  learnings: LearningItem[];
}

export function LearningsCard({ adapterId, learningEnabled, learnings }: LearningsCardProps) {
  const t = useTranslations('learnings');
  const tToasts = useTranslations('toasts');
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  // Plain pending state: React 18's startTransition does not track async
  // callbacks, and a rejected action must never leave a control stuck.
  const [isPending, setIsPending] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleLoopToggle = async (enabled: boolean) => {
    setIsPending(true);
    try {
      const result = await setAdapterLearningEnabled(adapterId, enabled);
      if (result.success) {
        toast({ variant: 'success', title: enabled ? t('loopEnabled') : t('loopDisabled') });
        router.refresh();
      } else {
        toast({ variant: 'error', title: tToasts('error'), description: result.error });
      }
    } catch {
      toast({ variant: 'error', title: tToasts('error') });
    } finally {
      setIsPending(false);
    }
  };

  const handleItemToggle = async (item: LearningItem) => {
    setBusyId(item.id);
    try {
      const result = await setLearningEnabled(item.id, !item.enabled);
      if (result.success) {
        router.refresh();
      } else {
        toast({ variant: 'error', title: tToasts('error'), description: result.error });
      }
    } catch {
      toast({ variant: 'error', title: tToasts('error') });
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (item: LearningItem) => {
    setBusyId(item.id);
    try {
      const result = await deleteLearning(item.id);
      if (result.success) {
        toast({ variant: 'success', title: t('deleted') });
        router.refresh();
      } else {
        toast({ variant: 'error', title: tToasts('error'), description: result.error });
      }
    } catch {
      toast({ variant: 'error', title: tToasts('error') });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="card p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-1">
        <div className="min-w-0">
          <h2 className="font-accent font-semibold text-cream text-lg flex items-center gap-2">
            <svg className="w-4 h-4 text-amber" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
              />
            </svg>
            {t('title')}
            {learnings.length > 0 && (
              <span className="badge bg-amber/15 text-amber border border-amber/30 text-[10px]">
                {learnings.length}
              </span>
            )}
          </h2>
          <p className="text-xs text-clay font-accent mt-1">{t('help')}</p>
        </div>
        <label className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-taupe font-accent">{t('loopLabel')}</span>
          <Toggle checked={learningEnabled} onChange={handleLoopToggle} disabled={isPending} />
        </label>
      </div>

      {learnings.length === 0 ? (
        <p className="text-sm text-clay font-accent py-4">{t('empty')}</p>
      ) : (
        <ul className="divide-y divide-bark/60 mt-4">
          {learnings.map((item) => (
            <li key={item.id} className="py-3 flex items-start gap-3">
              <span
                className={`badge shrink-0 text-[10px] ${
                  item.kind === 'example'
                    ? 'bg-sage/15 text-sage border border-sage/30'
                    : 'bg-coral/15 text-coral border border-coral/30'
                }`}
              >
                {item.kind === 'example' ? t('kindExample') : t('kindPitfall')}
              </span>
              <div className={`min-w-0 flex-1 ${item.enabled ? '' : 'opacity-40'}`}>
                <p className="text-xs text-sand font-mono truncate">
                  {item.kind === 'example'
                    ? (item.inputJson ?? '').replace(/\s+/g, ' ').slice(0, 110)
                    : item.note}
                </p>
                <p className="text-[10px] text-clay font-accent mt-0.5">
                  {t(`source_${item.source}` as Parameters<typeof t>[0])} ·{' '}
                  {formatTimestamp(new Date(item.createdAt), locale)}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleItemToggle(item)}
                  disabled={busyId === item.id}
                  className="text-xs text-taupe hover:text-amber font-accent transition-colors disabled:opacity-50"
                >
                  {item.enabled ? t('pause') : t('resume')}
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(item)}
                  disabled={busyId === item.id}
                  className="text-xs text-coral hover:underline font-accent disabled:opacity-50"
                >
                  {t('delete')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
