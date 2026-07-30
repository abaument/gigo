/**
 * The single copy-to-clipboard component of the app.
 *
 * `variant="icon"` — square icon button (default).
 * `variant="label"` — compact button with a text label.
 */

'use client';

import { useCallback, useState } from 'react';

export function useCopy(text: string) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [text]);

  return { copied, copy };
}

const CheckIcon = ({ className }: { className: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const ClipboardIcon = ({ className }: { className: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
    />
  </svg>
);

interface CopyButtonProps {
  text: string;
  variant?: 'icon' | 'label';
  /** already-translated label passed by the parent */
  label?: string;
  copiedLabel?: string;
  className?: string;
}

export function CopyButton({
  text,
  variant = 'icon',
  label = 'Copy',
  copiedLabel = 'Copied!',
  className = '',
}: CopyButtonProps) {
  const { copied, copy } = useCopy(text);

  if (variant === 'label') {
    return (
      <button
        type="button"
        onClick={copy}
        className={`flex items-center gap-1.5 px-2 py-1 text-xs text-taupe hover:text-amber
                 bg-roast/50 hover:bg-roast rounded border border-bark hover:border-timber
                 transition-all ${className}`}
      >
        {copied ? (
          <>
            <CheckIcon className="w-3.5 h-3.5 text-sage" />
            {copiedLabel}
          </>
        ) : (
          <>
            <ClipboardIcon className="w-3.5 h-3.5" />
            {label}
          </>
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={`p-2 text-taupe hover:text-amber hover:bg-roast rounded-lg border border-bark
               transition-colors shrink-0 ${className}`}
      title={copied ? copiedLabel : label}
    >
      {copied ? (
        <CheckIcon className="w-5 h-5 text-sage" />
      ) : (
        <ClipboardIcon className="w-5 h-5" />
      )}
    </button>
  );
}
