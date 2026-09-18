/**
 * Deterministic mapping with JSONata.
 *
 * The model is excellent at writing a mapping once, and wasteful at applying
 * the same mapping ten thousand times. So an adapter can carry a JSONata
 * expression: when it is enabled, a run evaluates the expression instead of
 * calling a model. Same output every time, no token, a few milliseconds.
 *
 * The expression is never trusted blindly: it is checked against the sample
 * payload and the target schema before being stored, and evaluation is bounded
 * in time so a pathological expression cannot hold a request open.
 */

import jsonata from 'jsonata';

/** An expression that has not returned by then is treated as runaway. */
export const JSONATA_TIMEOUT_MS = 2_000;
/** Beyond this the expression stops being a mapping and becomes a program. */
export const MAX_EXPRESSION_CHARS = 8_000;

export interface RuleResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export function isExpressionAcceptable(expression: string): string | null {
  const trimmed = expression.trim();
  if (!trimmed) return 'Expression is empty';
  if (trimmed.length > MAX_EXPRESSION_CHARS) {
    return `Expression exceeds ${MAX_EXPRESSION_CHARS} characters`;
  }
  return null;
}

/** jsonata calls this hook before every node: the only way to actually stop a
 *  runaway evaluation rather than just stop waiting for it. */
const ENTRY_HOOK = Symbol.for('jsonata.__evaluate_entry');

/**
 * Evaluate an expression against an input. Never throws: a broken expression
 * is a failed run with a readable message, like any other transform failure.
 */
export async function applyRule(
  expression: string,
  input: unknown,
  timeoutMs: number = JSONATA_TIMEOUT_MS
): Promise<RuleResult> {
  const rejected = isExpressionAcceptable(expression);
  if (rejected) return { success: false, error: rejected };

  let compiled: ReturnType<typeof jsonata>;
  try {
    compiled = jsonata(expression);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid JSONata expression';
    return { success: false, error: `JSONata syntax error: ${message}` };
  }

  const deadline = Date.now() + timeoutMs;
  compiled.assign(ENTRY_HOOK as unknown as string, () => {
    if (Date.now() > deadline) {
      throw { code: 'TIMEBOX', message: `Evaluation exceeded ${timeoutMs}ms` };
    }
  });

  try {
    const data = await compiled.evaluate(input);
    if (data === undefined) {
      return { success: false, error: 'Expression produced no result for this input' };
    }
    return { success: true, data };
  } catch (error) {
    const message =
      typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message: unknown }).message)
        : 'Evaluation failed';
    return { success: false, error: `JSONata evaluation failed: ${message}` };
  }
}

/**
 * Does the expression reproduce the expected output on the sample?
 *
 * Key-level comparison rather than strict equality: the target schema is an
 * example, so what matters is that every expected key is produced with an
 * equal value, not that the model guessed the same key order.
 */
export interface VerifyResult {
  ok: boolean;
  missingKeys: string[];
  differingKeys: string[];
  extraKeys: string[];
  produced?: unknown;
  error?: string;
}

export async function verifyRule(
  expression: string,
  sampleInput: unknown,
  expectedOutput: unknown
): Promise<VerifyResult> {
  const run = await applyRule(expression, sampleInput);
  if (!run.success) {
    return { ok: false, missingKeys: [], differingKeys: [], extraKeys: [], error: run.error };
  }

  const produced = run.data;
  if (
    produced === null ||
    typeof produced !== 'object' ||
    Array.isArray(produced) ||
    expectedOutput === null ||
    typeof expectedOutput !== 'object' ||
    Array.isArray(expectedOutput)
  ) {
    const same = JSON.stringify(produced) === JSON.stringify(expectedOutput);
    return {
      ok: same,
      missingKeys: [],
      differingKeys: same ? [] : ['(racine)'],
      extraKeys: [],
      produced,
    };
  }

  const expected = expectedOutput as Record<string, unknown>;
  const actual = produced as Record<string, unknown>;
  const missingKeys: string[] = [];
  const differingKeys: string[] = [];

  for (const [key, value] of Object.entries(expected)) {
    if (!(key in actual)) {
      missingKeys.push(key);
    } else if (JSON.stringify(actual[key]) !== JSON.stringify(value)) {
      differingKeys.push(key);
    }
  }
  const extraKeys = Object.keys(actual).filter((k) => !(k in expected));

  return {
    ok: missingKeys.length === 0 && differingKeys.length === 0,
    missingKeys,
    differingKeys,
    extraKeys,
    produced,
  };
}

/**
 * The instruction given to the model when it is asked to write the rule.
 * Kept here so the prompt lives next to the verification that judges it.
 */
export function buildRulePrompt(targetSchema: string, sampleInput: string): string {
  return [
    'Write a single JSONata expression that maps the input payload to the target structure.',
    '',
    'Rules:',
    '- Return ONLY the expression. No explanation, no markdown fence, no comment.',
    '- The expression must produce every key of the target structure, with the same types.',
    '- Reproduce the normalisations visible between the payload and the target: trimming,',
    '  casing, date formats, numbers stored as text, amounts converted to integer cents.',
    '- Use ONLY these JSONata functions. Any other name does not exist and will fail:',
    '  $trim $uppercase $lowercase $substring $substringBefore $substringAfter $split $join',
    '  $replace $match $contains $length $number $string $boolean $abs $floor $ceil $round',
    '  $sum $count $max $min $map $filter $reduce $sort $exists $not $merge $keys $lookup',
    '  $type $each $append $distinct $now $fromMillis $toMillis $formatNumber $base64encode',
    '- There is no $indexOf, no $find, no $parseInt, no $toUpperCase: use the list above.',
    '- To cut a string around a marker use $substringBefore and $substringAfter, never an index lookup.',
    '- Dates: there is no parser for arbitrary formats. Split the string and reassemble it,',
    '  for example 14/06/2026 to 2026-06-14 becomes:',
    '  $join([$split(d, "/")[2], $split(d, "/")[1], $split(d, "/")[0]], "-")',
    '- Casing: a name like "nadia" to "Nadia" is $uppercase($substring(n,0,1)) & $lowercase($substring(n,1)).',
    '- Amounts: "99,00 EUR" to 9900 cents is $number($replace($substringBefore(a, " "), ",", ".")) * 100.',
    '- Never hardcode a value that should be read from the payload.',
    '',
    'TARGET STRUCTURE (an example of the expected output):',
    targetSchema,
    '',
    'INPUT PAYLOAD (representative of what the source sends):',
    sampleInput,
  ].join('\n');
}
