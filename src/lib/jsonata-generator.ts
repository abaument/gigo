/**
 * Asks a model to write the mapping once, then proves it on the sample.
 *
 * This is the point of the feature: the expensive, non-deterministic step
 * happens a single time, in front of the user, and what gets stored is a rule
 * that any machine can replay for free. A rule that fails verification is
 * never stored: an unverified mapping would be worse than no mapping.
 */

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { buildRulePrompt, verifyRule, type VerifyResult } from '@/lib/jsonata-rule';
import { DEFAULT_MODELS } from '@/lib/providers/models';

const openaiClients = new Map<string, OpenAI>();
const anthropicClients = new Map<string, Anthropic>();

function getOpenAI(apiKey: string): OpenAI {
  let client = openaiClients.get(apiKey);
  if (!client) {
    client = new OpenAI({ apiKey, timeout: 60_000, maxRetries: 1 });
    openaiClients.set(apiKey, client);
  }
  return client;
}

function getAnthropic(apiKey: string): Anthropic {
  let client = anthropicClients.get(apiKey);
  if (!client) {
    client = new Anthropic({ apiKey, timeout: 60_000, maxRetries: 1 });
    anthropicClients.set(apiKey, client);
  }
  return client;
}

export interface RuleGenerationResult {
  success: boolean;
  expression?: string;
  /** what the verification found, present whether it passed or not */
  verification?: VerifyResult;
  error?: string;
}

/** Models like to wrap code in fences whatever the instruction says. */
export function stripFences(raw: string): string {
  const fenced = raw.match(/```(?:jsonata|json)?\s*([\s\S]*?)```/);
  return (fenced ? fenced[1] : raw).trim();
}

async function askModel(
  provider: string,
  apiKey: string,
  prompt: string,
  modelName?: string
): Promise<string> {
  if (provider === 'anthropic') {
    const response = await getAnthropic(apiKey).messages.create({
      model: modelName || DEFAULT_MODELS.anthropic,
      max_tokens: 2048,
      temperature: 0,
      messages: [{ role: 'user', content: prompt }],
    });
    const block = response.content[0];
    return block && block.type === 'text' ? block.text : '';
  }

  const response = await getOpenAI(apiKey).chat.completions.create({
    model: modelName || DEFAULT_MODELS.openai,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0,
    max_tokens: 2048,
  });
  return response.choices[0]?.message?.content ?? '';
}

/** Naming a wrong key is not enough: the model needs to see the two values. */
function describeMismatch(
  verification: VerifyResult,
  expectedOutput: unknown
): string {
  if (verification.error) return `It failed to evaluate: ${verification.error}`;

  const expected = (expectedOutput ?? {}) as Record<string, unknown>;
  const produced = (verification.produced ?? {}) as Record<string, unknown>;
  const lines: string[] = [];

  for (const key of verification.differingKeys) {
    lines.push(
      `- ${key}: you produced ${JSON.stringify(produced[key])}, ` +
        `expected ${JSON.stringify(expected[key])}`
    );
  }
  for (const key of verification.missingKeys) {
    lines.push(`- ${key}: missing, expected ${JSON.stringify(expected[key])}`);
  }
  return lines.length
    ? `The result did not match on these keys:\n${lines.join('\n')}`
    : 'The result did not match the target.';
}

/**
 * Generate a mapping and verify it against the sample. Three attempts at most:
 * each retry is shown the produced value next to the expected one, which is
 * what actually fixes casing, date formats and separators.
 */
export async function generateRule(args: {
  targetSchema: string;
  samplePayload: string;
  provider: string;
  apiKey: string;
  modelName?: string;
}): Promise<RuleGenerationResult> {
  let sampleInput: unknown;
  let expectedOutput: unknown;
  try {
    sampleInput = JSON.parse(args.samplePayload);
    expectedOutput = JSON.parse(args.targetSchema);
  } catch {
    return { success: false, error: 'Sample payload or target schema is not valid JSON' };
  }

  let prompt = buildRulePrompt(args.targetSchema, args.samplePayload);
  let last: VerifyResult | undefined;
  let lastExpression = '';

  for (let attempt = 0; attempt < 3; attempt += 1) {
    let raw: string;
    try {
      raw = await askModel(args.provider, args.apiKey, prompt, args.modelName);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Model call failed';
      return { success: false, error: message, verification: last };
    }

    lastExpression = stripFences(raw);
    if (!lastExpression) {
      return { success: false, error: 'The model returned an empty expression' };
    }

    last = await verifyRule(lastExpression, sampleInput, expectedOutput);
    if (last.ok) {
      return { success: true, expression: lastExpression, verification: last };
    }

    prompt = [
      buildRulePrompt(args.targetSchema, args.samplePayload),
      '',
      'A previous attempt was rejected. Here it is:',
      lastExpression,
      '',
      describeMismatch(last, expectedOutput),
      '',
      'Fix exactly those keys, keep the ones that were already correct,',
      'and return a corrected expression, only the expression.',
    ].join('\n');
  }

  return {
    success: false,
    expression: lastExpression,
    verification: last,
    error: 'The generated rule did not reproduce the expected output',
  };
}
