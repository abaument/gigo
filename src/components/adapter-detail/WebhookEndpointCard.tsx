/**
 * Webhook endpoint card: URL with copy, cURL export, secret management
 * (reveal / regenerate / remove).
 */

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { regenerateWebhookSecret, removeWebhookSecret } from '@/lib/actions';
import { buildWebhookUrl, buildCurl } from '@/lib/utils/webhook';
import { CopyButton } from '@/components/CopyButton';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/ToastProvider';

interface WebhookEndpointCardProps {
  adapterId: string;
  webhookSecret: string | null;
  sampleBody?: string;
}

export function WebhookEndpointCard({
  adapterId,
  webhookSecret,
  sampleBody,
}: WebhookEndpointCardProps) {
  const t = useTranslations('adapterDetail');
  const tToasts = useTranslations('toasts');
  const tCommon = useTranslations('common');
  const { toast } = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [revealed, setRevealed] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'regenerate' | 'remove' | null>(null);
  // secret freshly generated this session — shown once in clear
  const [freshSecret, setFreshSecret] = useState<string | null>(null);

  const secret = freshSecret ?? webhookSecret;
  const url = buildWebhookUrl(adapterId);
  const curl = buildCurl(adapterId, sampleBody, secret);

  const handleRegenerate = () => {
    startTransition(async () => {
      const result = await regenerateWebhookSecret(adapterId);
      if (result.success) {
        setFreshSecret(result.data.secret);
        setRevealed(true);
        toast({ variant: 'success', title: tToasts('secretRegenerated') });
        router.refresh();
      } else {
        toast({ variant: 'error', title: tToasts('error'), description: result.error });
      }
      setConfirmAction(null);
    });
  };

  const handleRemove = () => {
    startTransition(async () => {
      const result = await removeWebhookSecret(adapterId);
      if (result.success) {
        setFreshSecret(null);
        setRevealed(false);
        toast({ variant: 'success', title: tToasts('secretRemoved') });
        router.refresh();
      } else {
        toast({ variant: 'error', title: tToasts('error'), description: result.error });
      }
      setConfirmAction(null);
    });
  };

  return (
    <div className="card p-6">
      <h2 className="font-accent font-semibold text-cream text-lg mb-1">{t('endpointTitle')}</h2>
      <p className="text-xs text-clay font-accent mb-4">{t('endpointHelp')}</p>

      <div className="flex items-center gap-2 mb-5">
        <code className="code-block flex-1 py-2.5 px-4 text-xs truncate">{url}</code>
        <CopyButton text={url} />
        <CopyButton
          text={curl}
          variant="label"
          label={t('copyCurl')}
          copiedLabel={tCommon('copied')}
          className="shrink-0 py-2.5"
        />
      </div>

      <div className="pt-4 border-t border-bark">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h3 className="text-sm font-accent font-semibold text-cream mb-0.5">
              {t('secretTitle')}
            </h3>
            <p className="text-xs text-clay font-accent">
              {secret ? t('secretSet') : t('secretNone')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {secret && (
              <button
                type="button"
                onClick={() => setRevealed((r) => !r)}
                className="btn-secondary text-xs py-1.5 px-3"
              >
                {revealed ? t('secretHide') : t('secretReveal')}
              </button>
            )}
            <button
              type="button"
              onClick={() => setConfirmAction('regenerate')}
              className="btn-secondary text-xs py-1.5 px-3"
              disabled={isPending}
            >
              {t('secretRegenerate')}
            </button>
            {secret && (
              <button
                type="button"
                onClick={() => setConfirmAction('remove')}
                className="btn-danger text-xs py-1.5 px-3"
                disabled={isPending}
              >
                {t('secretRemove')}
              </button>
            )}
          </div>
        </div>

        {secret && revealed && (
          <div className="flex items-center gap-2 mt-3 animate-fade-in">
            <code className="code-block flex-1 py-2 px-4 text-xs truncate">{secret}</code>
            <CopyButton text={secret} />
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmAction === 'regenerate'}
        title={t('secretRegenerateTitle')}
        description={t('secretRegenerateDescription')}
        confirmLabel={t('secretRegenerate')}
        cancelLabel={tCommon('cancel')}
        isPending={isPending}
        onConfirm={handleRegenerate}
        onClose={() => setConfirmAction(null)}
      />
      <ConfirmDialog
        open={confirmAction === 'remove'}
        title={t('secretRemoveTitle')}
        description={t('secretRemoveDescription')}
        confirmLabel={t('secretRemove')}
        cancelLabel={tCommon('cancel')}
        tone="danger"
        isPending={isPending}
        onConfirm={handleRemove}
        onClose={() => setConfirmAction(null)}
      />
    </div>
  );
}
