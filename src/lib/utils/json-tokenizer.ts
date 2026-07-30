/**
 * Tiny regex-based JSON tokenizer used for syntax highlighting.
 * Rendered through the `.json-*` classes defined in globals.css.
 */

export type JsonTokenType =
  | 'key'
  | 'string'
  | 'number'
  | 'boolean'
  | 'null'
  | 'punct'
  | 'ws';

export interface JsonToken {
  type: JsonTokenType;
  text: string;
}

const TOKEN_RE =
  /("(?:\\.|[^"\\])*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false)\b|\b(null)\b|([{}\[\],:])|(\s+)|(.)/g;

export function tokenizeJson(src: string): JsonToken[] {
  const out: JsonToken[] = [];
  let match: RegExpExecArray | null;
  TOKEN_RE.lastIndex = 0;

  while ((match = TOKEN_RE.exec(src))) {
    if (match[1] !== undefined) {
      // A quoted string followed by ":" is a key.
      out.push({ type: match[2] ? 'key' : 'string', text: match[1] });
      if (match[2]) out.push({ type: 'punct', text: match[2] });
    } else if (match[3]) {
      out.push({ type: 'number', text: match[3] });
    } else if (match[4]) {
      out.push({ type: 'boolean', text: match[4] });
    } else if (match[5]) {
      out.push({ type: 'null', text: match[5] });
    } else if (match[6]) {
      out.push({ type: 'punct', text: match[6] });
    } else {
      out.push({ type: 'ws', text: match[0] });
    }
  }

  return out;
}

export const TOKEN_CLASS: Record<JsonTokenType, string | undefined> = {
  key: 'json-key',
  string: 'json-string',
  number: 'json-number',
  boolean: 'json-boolean',
  null: 'json-null',
  punct: undefined,
  ws: undefined,
};

/**
 * Extract line/column from a V8 JSON.parse SyntaxError message
 * ("… at position N").
 */
export function parseJsonError(
  src: string,
  err: SyntaxError
): { message: string; line?: number; column?: number } {
  const match = /position (\d+)/.exec(err.message);
  if (!match) return { message: err.message };

  const pos = Number(match[1]);
  const before = src.slice(0, pos);
  return {
    message: err.message,
    line: before.split('\n').length,
    column: pos - before.lastIndexOf('\n'),
  };
}
