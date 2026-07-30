/**
 * AI-powered JSON transformation engine.
 *
 * Derives a strict JSON Schema from the adapter's target example, then
 * delegates the AI call to the configured provider (OpenAI structured
 * outputs or Anthropic forced tool use).
 *
 * The target schema lives in the system prompt: it is identical for
 * every call of the same adapter, which makes it cacheable on the
 * Anthropic side (prompt caching) and is neutral for OpenAI.
 */

import { getProvider } from '@/lib/providers';
import {
  ProviderError,
  type ProviderErrorCode,
  type ProviderName,
  type TransformUsage,
} from '@/lib/providers/types';

/**
 * Generates a strict JSON Schema from an example JSON object.
 *
 * Strict mode (OpenAI structured outputs and Anthropic strict tool use)
 * rejects degenerate sub-schemas, so unknown types and empty arrays fall
 * back to `string` instead of `{}`.
 */
export function generateJsonSchemaFromExample(example: unknown): Record<string, unknown> {
  if (example === null) {
    return { type: 'null' };
  }

  if (Array.isArray(example)) {
    if (example.length === 0) {
      return { type: 'array', items: { type: 'string' } };
    }
    return {
      type: 'array',
      items: generateJsonSchemaFromExample(example[0]),
    };
  }

  if (typeof example === 'object') {
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(example as Record<string, unknown>)) {
      properties[key] = generateJsonSchemaFromExample(value);
      required.push(key);
    }

    return {
      type: 'object',
      properties,
      required,
      additionalProperties: false,
    };
  }

  if (typeof example === 'string') {
    return { type: 'string' };
  }

  if (typeof example === 'number') {
    return { type: 'number' };
  }

  if (typeof example === 'boolean') {
    return { type: 'boolean' };
  }

  return { type: 'string' };
}

export interface TransformResult {
  success: boolean;
  data?: unknown;
  error?: string;
  errorCode?: ProviderErrorCode;
  durationMs: number;
  usage?: TransformUsage;
  provider?: ProviderName;
  model?: string;
}

export interface TransformJsonOptions {
  provider?: string;
  modelName?: string;
}

function buildSystemPrompt(targetSchemaExample: string): string {
  return `You are a rigid API middleware that transforms JSON payloads.

Your task:
1. Analyze the incoming JSON payload
2. Map it to the target schema structure
3. Perform necessary transformations:
   - Rename keys based on semantic meaning (e.g., "firstName" maps to "first_name")
   - Convert types appropriately (string "42" to number 42, etc.)
   - Extract or restructure nested data as needed
   - Use null for missing required fields that cannot be inferred
   - Use empty arrays for missing array fields
   - Use empty strings for missing string fields that cannot be inferred

CRITICAL RULES:
- Output ONLY fields that exist in the target schema
- NEVER invent or hallucinate fields not in the target schema
- NEVER add extra keys or nested structures not defined in the schema
- Match the EXACT structure of the target schema
- Preserve semantic meaning when mapping fields

TARGET SCHEMA EXAMPLE (your output must match this exact structure):
${targetSchemaExample}`;
}

/**
 * Transform arbitrary JSON to match a target schema using the
 * configured AI provider. Never throws — errors come back as a failed
 * TransformResult with a typed errorCode.
 */
export async function transformJson(
  inputJson: unknown,
  targetSchemaExample: string,
  opts?: TransformJsonOptions
): Promise<TransformResult> {
  const startTime = Date.now();
  const provider = getProvider(opts?.provider);

  try {
    const targetExample = JSON.parse(targetSchemaExample);
    const jsonSchema = generateJsonSchemaFromExample(targetExample);
    const systemPrompt = buildSystemPrompt(targetSchemaExample);

    const result = await provider.transform(inputJson, jsonSchema, systemPrompt, {
      modelName: opts?.modelName,
    });

    return {
      success: true,
      data: result.data,
      durationMs: Date.now() - startTime,
      usage: result.usage,
      provider: provider.name,
      model: result.model,
    };
  } catch (error) {
    if (error instanceof ProviderError) {
      return {
        success: false,
        error: error.message,
        errorCode: error.code,
        durationMs: Date.now() - startTime,
        provider: provider.name,
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown transformation error',
      durationMs: Date.now() - startTime,
      provider: provider.name,
    };
  }
}

/**
 * Validate that transformed output matches target schema keys — a safety
 * check that the AI didn't hallucinate extra keys.
 */
export function validateTransformedOutput(
  transformed: unknown,
  targetExample: unknown
): { isValid: boolean; extraKeys: string[] } {
  const extraKeys: string[] = [];

  function checkKeys(obj: unknown, target: unknown, path = ''): void {
    if (obj === null || target === null) return;
    if (typeof obj !== 'object' || typeof target !== 'object') return;
    if (Array.isArray(obj) || Array.isArray(target)) {
      // For arrays, check the first element structure
      if (Array.isArray(obj) && Array.isArray(target) && obj.length > 0 && target.length > 0) {
        checkKeys(obj[0], target[0], `${path}[0]`);
      }
      return;
    }

    const objKeys = Object.keys(obj as Record<string, unknown>);
    const targetKeys = new Set(Object.keys(target as Record<string, unknown>));

    for (const key of objKeys) {
      if (!targetKeys.has(key)) {
        extraKeys.push(path ? `${path}.${key}` : key);
      } else {
        checkKeys(
          (obj as Record<string, unknown>)[key],
          (target as Record<string, unknown>)[key],
          path ? `${path}.${key}` : key
        );
      }
    }
  }

  checkKeys(transformed, targetExample);

  return {
    isValid: extraKeys.length === 0,
    extraKeys,
  };
}
