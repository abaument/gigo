/**
 * Replays a logged transformation with the adapter's current schema.
 */

'use client';

import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { replayTransformation } from '@/lib/actions';
import { useToast } from '@/components/ui/ToastProvider';
import { Spinner } from '@/components/ui/Spinner';

interface ReplayLogButtonProps {
  logId: string;
  onReplayed?: () => void;
}

export function ReplayLogButton({ logId, onReplayed }: ReplayLogButtonProps) {
  const t = useTranslations('logs');
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const handleReplay = () => {
    startTransition(async () => {
      const result = await replayTransformation(logId);
      if (result.success) {
        toast({ variant: 'success', title: t('replaySuccess') });
        onReplayed?.();
      } else {
        toast({ variant: 'error', title: t('replayFailed'), description: result.error });
      }
    });
  };

  return (
    <button
      type="button"
      onClick={handleReplay}
      disabled={isPending}
      className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
    >
      {isPending ? (
        <Spinner className="w-3.5 h-3.5" />
      ) : (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
      )}
      {isPending ? t('replaying') : t('replay')}
    </button>
  );
}
