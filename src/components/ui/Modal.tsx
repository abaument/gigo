/**
 * Base modal: espresso backdrop with blur, centered card, Escape and
 * backdrop-click to close. Extracted from the delete-confirmation modal.
 */

'use client';

import { useEffect } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}

export function Modal({ open, onClose, children, className = '' }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-espresso/90 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className={`relative card p-8 max-w-md w-full animate-slide-up ${className}`}>
        {children}
      </div>
    </div>
  );
}
