/**
 * AI-powered JSON transformation engine.
 *
 * Uses OpenAI's structured outputs to ensure reliable transformation
 * of arbitrary JSON payloads to match a defined target schema.
 */

import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generates a JSON schema from an example JSON object.
 *
 * Converts a sample JSON structure into a valid JSON Schema that can be
 * used with OpenAI's structured outputs feature.
 *
 * Parameters
 * ----------
 * example : unknown
 *     Example JSON object to derive schema from.
 *
 * Returns
 * -------
 * object
 *     JSON Schema representation of the example structure.
 */
function generateJsonSchemaFromExample(example: unknown): Record<string, unknown> {
  if (example === null) {
    return { type: 'null' };
  }

  if (Array.isArray(example)) {
    if (example.length === 0) {
      return { type: 'array', items: {} };
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

  return {};
}

/**
 * Result of a transformation operation.
 */
export interface TransformResult {
  success: boolean;
  data?: unknown;
  error?: string;
  durationMs: number;
}

/**
 * Transform arbitrary JSON to match a target schema using AI.
 *
 * This is the core transformation engine. It uses OpenAI's structured
 * outputs feature to ensure the AI response strictly conforms to the
 * target schema structure.
 *
 * Parameters
 * ----------
 * inputJson : unknown
 *     Arbitrary JSON payload to transform.
 * targetSchemaExample : string
 *     JSON string representing an example of the desired output structure.
 *
 * Returns
 * -------
 * TransformResult
 *     Object containing success status, transformed data or error message,
 *     and processing duration.
 *
 * Notes
 * -----
 * The transformation uses semantic understanding to:
 * - Rename keys based on meaning (e.g., "firstName" -> "first_name")
 * - Convert types appropriately (e.g., "42" -> 42)
 * - Extract nested values to flat structures or vice versa
 * - Handle missing fields gracefully with sensible defaults
 */
export async function transformJson(
  inputJson: unknown,
  targetSchemaExample: string
): Promise<TransformResult> {
  const startTime = Date.now();

  try {
    // Parse the target schema example
    const targetExample = JSON.parse(targetSchemaExample);

    // Generate JSON Schema from the example
    const jsonSchema = generateJsonSchemaFromExample(targetExample);

    // Build the system prompt that enforces strict transformation
    const systemPrompt = `You are a rigid API middleware that transforms JSON payloads.

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
- Preserve semantic meaning when mapping fields`;

    // Create the user message with both input and target example
    const userMessage = `Transform this incoming JSON payload to match the target schema.

INCOMING JSON PAYLOAD:
${JSON.stringify(inputJson, null, 2)}

TARGET SCHEMA EXAMPLE (your output must match this exact structure):
${targetSchemaExample}

Transform the incoming payload to match the target structure.`;

    // Call OpenAI with structured outputs
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-2024-08-06',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'transformed_data',
          strict: true,
          schema: jsonSchema,
        },
      },
      temperature: 0, // Deterministic output for consistency
      max_tokens: 4096,
    });

    const content = response.choices[0]?.message?.content;

    if (!content) {
      return {
        success: false,
        error: 'No response from AI model',
        durationMs: Date.now() - startTime,
      };
    }

    // Parse the transformed JSON
    const transformedData = JSON.parse(content);

    return {
      success: true,
      data: transformedData,
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown transformation error';
    
    return {
      success: false,
      error: errorMessage,
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * Validate that transformed output matches target schema keys.
 *
 * Provides an additional safety check to ensure the AI didn't
 * hallucinate extra keys.
 *
 * Parameters
 * ----------
 * transformed : unknown
 *     The transformed JSON output.
 * targetExample : unknown
 *     The target schema example.
 *
 * Returns
 * -------
 * object
 *     Validation result with isValid flag and any extra keys found.
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

    const objKeys = new Set(Object.keys(obj as Record<string, unknown>));
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
