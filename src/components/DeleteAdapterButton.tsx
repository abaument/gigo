/**
 * Delete adapter button with confirmation dialog.
 */

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteAdapter } from '@/lib/actions';

interface DeleteAdapterButtonProps {
  adapterId: string;
  adapterName: string;
}

export function DeleteAdapterButton({ adapterId, adapterName }: DeleteAdapterButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteAdapter(adapterId);
      if (result.success) {
        router.refresh();
      } else {
        alert('Failed to delete adapter: ' + result.error);
      }
      setShowConfirm(false);
    });
  };

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        className="btn-danger text-sm py-2"
        disabled={isPending}
      >
        Delete
      </button>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-espresso/90 backdrop-blur-sm"
            onClick={() => setShowConfirm(false)}
          />
          
          {/* Modal */}
          <div className="relative card p-8 max-w-md w-full animate-slide-up border-coral/30">
            <div className="w-14 h-14 rounded-2xl bg-coral/10 border border-coral/30 flex items-center justify-center mx-auto mb-6">
              <svg className="w-7 h-7 text-coral" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="font-display text-2xl text-cream mb-3 text-center">
              Delete Adapter
            </h3>
            <p className="text-taupe mb-8 text-center font-accent">
              Are you sure you want to delete <span className="text-coral font-semibold">{adapterName}</span>? 
              This will also delete all transformation logs. This action cannot be undone.
            </p>
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={() => setShowConfirm(false)}
                className="btn-secondary text-sm py-2.5 px-6"
                disabled={isPending}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="btn-danger text-sm py-2.5 px-6 flex items-center gap-2"
                disabled={isPending}
              >
                {isPending ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Deleting...
                  </>
                ) : (
                  'Delete Adapter'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
