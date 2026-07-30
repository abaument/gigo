/**
 * Delete adapter button — ConfirmDialog + toast feedback.
 */

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { deleteAdapter } from '@/lib/actions';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/ToastProvider';

interface DeleteAdapterButtonProps {
  adapterId: string;
  adapterName: string;
  /** navigate here after deletion (e.g. "/" from the detail page) */
  redirectTo?: string;
  className?: string;
}

export function DeleteAdapterButton({
  adapterId,
  adapterName,
  redirectTo,
  className = 'btn-danger text-sm py-2',
}: DeleteAdapterButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { toast } = useToast();
  const t = useTranslations('deleteDialog');
  const tToasts = useTranslations('toasts');
  const tCommon = useTranslations('common');

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteAdapter(adapterId);
      if (result.success) {
        toast({ variant: 'success', title: tToasts('adapterDeleted') });
        setShowConfirm(false);
        if (redirectTo) {
          router.push(redirectTo);
        } else {
          router.refresh();
        }
      } else {
        toast({ variant: 'error', title: tToasts('error'), description: result.error });
        setShowConfirm(false);
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setShowConfirm(true)}
        className={className}
        disabled={isPending}
      >
        {tCommon('delete')}
      </button>

      <ConfirmDialog
        open={showConfirm}
        title={t('title')}
        description={t.rich('description', {
          name: () => <span className="text-coral font-semibold">{adapterName}</span>,
        })}
        confirmLabel={isPending ? t('deleting') : t('confirm')}
        cancelLabel={tCommon('cancel')}
        tone="danger"
        isPending={isPending}
        onConfirm={handleDelete}
        onClose={() => setShowConfirm(false)}
      />
    </>
  );
}
