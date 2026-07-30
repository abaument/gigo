/**
 * Generic confirmation dialog built on Modal — generalization of the
 * delete-adapter confirmation.
 */

'use client';

import { Modal } from './Modal';
import { Spinner } from './Spinner';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  tone?: 'danger' | 'default';
  isPending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  tone = 'default',
  isPending = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const danger = tone === 'danger';

  return (
    <Modal open={open} onClose={onClose} className={danger ? 'border-coral/30' : ''}>
      <div
        className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-6 border ${
          danger ? 'bg-coral/10 border-coral/30' : 'bg-amber/10 border-amber/30'
        }`}
      >
        {danger ? (
          <svg className="w-7 h-7 text-coral" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        ) : (
          <svg className="w-7 h-7 text-amber" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        )}
      </div>
      <h3 className="font-display text-2xl text-cream mb-3 text-center">{title}</h3>
      <div className="text-taupe mb-8 text-center font-accent">{description}</div>
      <div className="flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={onClose}
          className="btn-secondary text-sm py-2.5 px-6"
          disabled={isPending}
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className={`${danger ? 'btn-danger' : 'btn-primary'} text-sm py-2.5 px-6 flex items-center gap-2`}
          disabled={isPending}
        >
          {isPending && <Spinner className="w-4 h-4" />}
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
