/**
 * Quick actions for an adapter: active toggle (optimistic), duplicate,
 * edit, delete.
 */

'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toggleAdapterActive, duplicateAdapter } from '@/lib/actions';
import { Toggle } from '@/components/ui/Toggle';
import { useToast } from '@/components/ui/ToastProvider';
import { DeleteAdapterButton } from '@/components/DeleteAdapterButton';

interface AdapterQuickActionsProps {
  adapterId: string;
  adapterName: string;
  isActive: boolean;
}

export function AdapterQuickActions({ adapterId, adapterName, isActive }: AdapterQuickActionsProps) {
  const t = useTranslations('common');
  const tToasts = useTranslations('toasts');
  const { toast } = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [optimisticActive, setOptimisticActive] = useState(isActive);

  const handleToggle = () => {
    const next = !optimisticActive;
    setOptimisticActive(next);
    startTransition(async () => {
      const result = await toggleAdapterActive(adapterId);
      if (result.success) {
        toast({
          variant: 'success',
          title: result.data.isActive ? tToasts('adapterEnabled') : tToasts('adapterDisabled'),
        });
        router.refresh();
      } else {
        setOptimisticActive(!next); // rollback
        toast({ variant: 'error', title: tToasts('error'), description: result.error });
      }
    });
  };

  const handleDuplicate = () => {
    startTransition(async () => {
      const result = await duplicateAdapter(adapterId);
      if (result.success) {
        toast({ variant: 'success', title: tToasts('adapterDuplicated') });
        router.push(`/adapters/${result.data.id}/edit`);
      } else {
        toast({ variant: 'error', title: tToasts('error'), description: result.error });
      }
    });
  };

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <label className="flex items-center gap-2 cursor-pointer">
        <span className={`text-xs font-accent ${optimisticActive ? 'text-sage' : 'text-taupe'}`}>
          {optimisticActive ? t('active') : t('inactive')}
        </span>
        <Toggle checked={optimisticActive} onChange={handleToggle} disabled={isPending} />
      </label>
      <button
        type="button"
        onClick={handleDuplicate}
        className="btn-secondary text-sm py-2 px-4"
        disabled={isPending}
      >
        {t('duplicate')}
      </button>
      <Link href={`/adapters/${adapterId}/edit`} className="btn-secondary text-sm py-2 px-4">
        {t('edit')}
      </Link>
      <DeleteAdapterButton adapterId={adapterId} adapterName={adapterName} redirectTo="/" />
    </div>
  );
}
