/**
 * Smart Schema Generator - AI-powered documentation parser.
 *
 * Analyzes API documentation (text, cURL examples, or URLs) and
 * automatically generates a strict JSON schema for transformation.
 */

import OpenAI from 'openai';
import { z } from 'zod';
import { fetchWithGuards, SsrfError } from '@/lib/ssrf-guard';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 30_000,
  maxRetries: 2,
});

const generatedSchemaResponse = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  schema: z.record(z.unknown()),
});

/**
 * Result from schema generation.
 */
export interface SchemaGenerationResult {
  success: boolean;
  schema?: string;
  schemaName?: string;
  description?: string;
  error?: string;
}

/**
 * Generate a JSON schema from API documentation.
 *
 * Analyzes documentation text (including cURL examples, API references,
 * or raw JSON examples) and extracts a strict JSON schema.
 *
 * Parameters
 * ----------
 * documentationText : string
 *     Raw documentation text, cURL example, or JSON structure.
 *
 * Returns
 * -------
 * SchemaGenerationResult
 *     Object containing the generated schema or error message.
 *
 * Examples
 * --------
 * >>> const result = await generateSchemaFromDocs(`
 * ...   curl -X POST https://api.example.com/orders \\
 * ...   -H "Content-Type: application/json" \\
 * ...   -d '{"order_id": "123", "amount": 99.99}'
 * ... `);
 * >>> console.log(result.schema);
 * '{"order_id": "123", "amount": 99.99}'
 */
export async function generateSchemaFromDocs(
  documentationText: string
): Promise<SchemaGenerationResult> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return {
        success: false,
        error: 'OpenAI API key not configured',
      };
    }

    const systemPrompt = `You are an expert API documentation analyzer. Your task is to extract a JSON schema from documentation.

INSTRUCTIONS:
1. Analyze the provided documentation (could be cURL examples, API docs, JSON samples, or text descriptions)
2. Extract the JSON structure that the API expects or returns
3. Generate a clean, example JSON object that represents the schema
4. Include realistic example values for each field
5. Preserve all field names exactly as they appear in the documentation

OUTPUT FORMAT:
Return a JSON object with this exact structure:
{
  "name": "A short descriptive name for this schema",
  "description": "Brief description of what this schema represents",
  "schema": { /* The actual JSON schema with example values */ }
}

RULES:
- The "schema" field must contain a valid JSON object
- Use realistic example values (not placeholders like "string" or "number")
- Preserve exact field naming conventions from the docs (snake_case, camelCase, etc.)
- For arrays, include one or two example items
- For nested objects, include all documented fields
- If documentation is unclear, make reasonable assumptions based on field names

EXAMPLE INPUT:
curl -X POST https://api.stripe.com/v1/charges \\
  -d amount=2000 \\
  -d currency=usd \\
  -d source=tok_visa

EXAMPLE OUTPUT:
{
  "name": "Stripe Charge",
  "description": "Create a new charge with Stripe API",
  "schema": {
    "amount": 2000,
    "currency": "usd",
    "source": "tok_visa"
  }
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-2024-08-06',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Analyze this documentation and extract the JSON schema:\n\n${documentationText}` },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
      max_tokens: 4096,
    });

    const content = response.choices[0]?.message?.content;

    if (!content) {
      return {
        success: false,
        error: 'No response from AI model',
      };
    }

    const parsed = generatedSchemaResponse.safeParse(JSON.parse(content));

    if (!parsed.success) {
      return {
        success: false,
        error: 'Could not extract a valid schema from the documentation',
      };
    }

    return {
      success: true,
      schema: JSON.stringify(parsed.data.schema, null, 2),
      schemaName: parsed.data.name || 'Extracted Schema',
      description: parsed.data.description || '',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error during schema generation';
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Fetch and parse documentation from a URL.
 *
 * Extracts text content from a documentation URL and generates a schema.
 *
 * Parameters
 * ----------
 * url : string
 *     URL to fetch documentation from.
 *
 * Returns
 * -------
 * SchemaGenerationResult
 *     Object containing the generated schema or error message.
 */
export async function generateSchemaFromUrl(
  url: string
): Promise<SchemaGenerationResult> {
  try {
    // Fetch with SSRF protection: private/metadata IPs blocked (including
    // on redirects), 10s timeout, 2MB response cap.
    const response = await fetchWithGuards(url, {
      timeoutMs: 10_000,
      maxBytes: 2 * 1024 * 1024,
    });

    if (response.status < 200 || response.status >= 300) {
      return {
        success: false,
        error: `Failed to fetch URL: ${response.status}`,
      };
    }

    let text = response.text;

    // If the response is pure JSON, use it directly as the schema example.
    try {
      const json = JSON.parse(text);
      if (json && typeof json === 'object') {
        return {
          success: true,
          schema: JSON.stringify(json, null, 2),
          schemaName: 'Imported JSON',
          description: `Schema imported from ${url}`,
        };
      }
    } catch {
      // not JSON — treat as HTML/text documentation
    }

    // Basic HTML stripping (keep it simple for MVP)
    text = text
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Limit text length to avoid token limits
    if (text.length > 15000) {
      text = text.slice(0, 15000) + '... [truncated]';
    }

    // Generate schema from the extracted text
    return await generateSchemaFromDocs(text);
  } catch (error) {
    if (error instanceof SsrfError) {
      return { success: false, error: error.message };
    }
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch URL';
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Validate and format a JSON schema string.
 *
 * Parameters
 * ----------
 * schemaString : string
 *     JSON string to validate.
 *
 * Returns
 * -------
 * object
 *     Object with isValid flag and formatted schema or error.
 */
export function validateSchema(schemaString: string): {
  isValid: boolean;
  formatted?: string;
  error?: string;
} {
  try {
    const parsed = JSON.parse(schemaString);
    return {
      isValid: true,
      formatted: JSON.stringify(parsed, null, 2),
    };
  } catch (error) {
    return {
      isValid: false,
      error: error instanceof Error ? error.message : 'Invalid JSON',
    };
  }
}
