/**
 * JSON editor with live validation and syntax highlighting — zero
 * dependencies. A transparent textarea is overlaid on a highlighted
 * <pre>; both layers share the exact same font metrics and wrapping so
 * the caret lines up with the colored text.
 */

'use client';

import { useMemo, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { tokenizeJson, parseJsonError, TOKEN_CLASS } from '@/lib/utils/json-tokenizer';
import { formatBytes } from '@/lib/utils/format';

interface JsonEditorProps {
  value: string;
  onChange: (value: string) => void;
  onValidChange?: (valid: boolean) => void;
  placeholder?: string;
  minHeight?: string;
  readOnly?: boolean;
  showToolbar?: boolean;
}

// Both layers MUST use identical font/padding/wrapping classes.
const SHARED_TEXT_CLASSES =
  'font-mono text-sm leading-6 whitespace-pre-wrap break-words p-4';

export function JsonEditor({
  value,
  onChange,
  onValidChange,
  placeholder = '{\n  "example": "value"\n}',
  minHeight = 'min-h-[16rem]',
  readOnly = false,
  showToolbar = true,
}: JsonEditorProps) {
  const t = useTranslations('common');
  const preRef = useRef<HTMLPreElement>(null);

  const { tokens, error } = useMemo(() => {
    const tokens = tokenizeJson(value);
    if (!value.trim()) {
      onValidChange?.(false);
      return { tokens, error: null };
    }
    try {
      JSON.parse(value);
      onValidChange?.(true);
      return { tokens, error: null };
    } catch (err) {
      onValidChange?.(false);
      return {
        tokens,
        error: parseJsonError(value, err as SyntaxError),
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (preRef.current) {
      preRef.current.scrollTop = e.currentTarget.scrollTop;
      preRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  };

  const handleFormat = () => {
    try {
      onChange(JSON.stringify(JSON.parse(value), null, 2));
    } catch {
      // invalid JSON — the error bar already says so
    }
  };

  const isValid = !error && value.trim().length > 0;

  return (
    <div>
      <div className={`relative bg-roast border rounded-lg overflow-hidden transition-colors
        ${error ? 'border-coral/50' : 'border-bark focus-within:border-amber'}`}>
        <pre
          ref={preRef}
          aria-hidden
          className={`absolute inset-0 overflow-auto pointer-events-none text-sand m-0 ${SHARED_TEXT_CLASSES}`}
        >
          {tokens.map((token, i) => {
            const cls = TOKEN_CLASS[token.type];
            return cls ? (
              <span key={i} className={cls}>
                {token.text}
              </span>
            ) : (
              token.text
            );
          })}
          {/* trailing newline keeps the pre as tall as the textarea */}
          {'\n'}
        </pre>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={handleScroll}
          placeholder={placeholder}
          readOnly={readOnly}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          className={`relative w-full ${minHeight} bg-transparent text-transparent caret-cream
            placeholder:text-clay resize-none focus:outline-none block ${SHARED_TEXT_CLASSES}`}
        />
      </div>

      {showToolbar && (
        <div className="flex items-center justify-between mt-2 text-xs font-accent">
          <div>
            {error ? (
              <span className="text-coral">
                {t('invalidJson')}
                {error.line !== undefined && (
                  <> — {t('jsonErrorAt', { line: error.line, column: error.column })}</>
                )}
              </span>
            ) : isValid ? (
              <span className="text-sage flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {t('validJson')}
              </span>
            ) : (
              <span className="text-clay">&nbsp;</span>
            )}
          </div>
          <div className="flex items-center gap-3 text-clay">
            <span>{formatBytes(new Blob([value]).size)}</span>
            {!readOnly && (
              <button
                type="button"
                onClick={handleFormat}
                disabled={!isValid}
                className="text-taupe hover:text-amber transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t('format')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
