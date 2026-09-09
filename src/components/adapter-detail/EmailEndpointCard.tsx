/**
 * Inbound email address card — shown when the operator configured
 * NEXT_PUBLIC_EMAIL_INBOUND_ADDRESS. Any email sent (or forwarded) to
 * this address goes through the adapter's transformation pipeline; JSON
 * and CSV attachments are parsed automatically.
 */

'use client';

import { useTranslations } from 'next-intl';
import { CopyButton } from '@/components/CopyButton';

interface EmailEndpointCardProps {
  address: string;
}

export function EmailEndpointCard({ address }: EmailEndpointCardProps) {
  const t = useTranslations('adapterDetail');

  return (
    <div className="card p-6">
      <div className="flex items-center gap-2 mb-1">
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
      <p className="text-xs text-clay font-accent mb-4">{t('emailHelp')}</p>

      <div className="flex items-center gap-2">
        <code className="code-block flex-1 py-2.5 px-4 text-xs truncate">{address}</code>
        <CopyButton text={address} />
      </div>
    </div>
  );
}
