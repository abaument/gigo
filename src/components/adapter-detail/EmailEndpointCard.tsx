/**
 * Inbound email card — shown when the operator configured
 * NEXT_PUBLIC_EMAIL_INBOUND_ADDRESS. Ingress is opt-in per adapter: the
 * address only exists once enabled, and carries a secret token so a
 * leaked adapter UUID cannot be used to inject data by email.
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { disableEmailIngress, enableEmailIngress } from '@/lib/actions';
import { CopyButton } from '@/components/CopyButton';
import { useToast } from '@/components/ui/ToastProvider';

interface EmailEndpointCardProps {
  adapterId: string;
  /** full address when ingress is enabled, null when disabled */
  address: string | null;
}

export function EmailEndpointCard({ adapterId, address }: EmailEndpointCardProps) {
  const t = useTranslations('adapterDetail');
  const tToasts = useTranslations('toasts');
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const handleEnable = async () => {
    setBusy(true);
    try {
      const result = await enableEmailIngress(adapterId);
      if (result.success) {
        toast({ variant: 'success', title: t('emailEnabled') });
        router.refresh();
      } else {
        toast({ variant: 'error', title: tToasts('error'), description: result.error });
      }
    } catch {
      toast({ variant: 'error', title: tToasts('error') });
    } finally {
      setBusy(false);
    }
  };

  const handleDisable = async () => {
    setBusy(true);
    try {
      const result = await disableEmailIngress(adapterId);
      if (result.success) {
        toast({ variant: 'success', title: t('emailDisabled') });
        router.refresh();
      } else {
        toast({ variant: 'error', title: tToasts('error'), description: result.error });
      }
    } catch {
      toast({ variant: 'error', title: tToasts('error') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-1">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-amber" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            <h2 className="font-accent font-semibold text-cream text-lg">{t('emailTitle')}</h2>
          </div>
          <p className="text-xs text-clay font-accent mt-1">{t('emailHelp')}</p>
        </div>
        <button
          type="button"
          onClick={address ? handleDisable : handleEnable}
          disabled={busy}
          className={`${address ? 'btn-danger' : 'btn-secondary'} text-xs py-1.5 px-3 shrink-0 disabled:opacity-50`}
        >
          {busy ? '…' : address ? t('emailDisable') : t('emailEnable')}
        </button>
      </div>

      {address ? (
        <div className="flex items-center gap-2 mt-4">
          <code className="code-block flex-1 min-w-0 py-2.5 px-4 text-xs truncate">{address}</code>
          <CopyButton text={address} />
        </div>
      ) : (
        <p className="text-sm text-clay font-accent mt-4">{t('emailDisabledHint')}</p>
      )}
    </div>
  );
}
