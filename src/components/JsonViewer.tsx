/**
 * Read-only JSON display with syntax highlighting and a copy button —
 * replaces every raw `<pre>{JSON.stringify(...)}</pre>` in the app.
 */

'use client';

import { useMemo } from 'react';
import { tokenizeJson, TOKEN_CLASS } from '@/lib/utils/json-tokenizer';
import { CopyButton } from '@/components/CopyButton';

interface JsonViewerProps {
  json: string;
  maxHeight?: string;
  showCopy?: boolean;
  className?: string;
}

export function JsonViewer({
  json,
  maxHeight = 'max-h-96',
  showCopy = true,
  className = '',
}: JsonViewerProps) {
  const { pretty, tokens } = useMemo(() => {
    let pretty = json;
    try {
      pretty = JSON.stringify(JSON.parse(json), null, 2);
    } catch {
      // keep as-is if not valid JSON
    }
    return { pretty, tokens: tokenizeJson(pretty) };
  }, [json]);

  return (
    <div className={`relative group ${className}`}>
      <pre className={`code-block overflow-auto ${maxHeight} whitespace-pre-wrap break-words`}>
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
      </pre>
      {showCopy && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <CopyButton text={pretty} className="bg-coffee/80 backdrop-blur-sm" />
        </div>
      )}
    </div>
  );
}
