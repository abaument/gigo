/**
 * Anthropic transformation provider — forced tool use with a strict
 * input schema, so the tool input IS the transformed payload (already
 * parsed and validated, no fragile JSON.parse).
 *
 * The system prompt carries the target schema and is identical for every
 * call of the same adapter, so it gets a `cache_control` breakpoint:
 * repeat calls read the schema from the prompt cache instead of paying
 * for it again. The variable payload lives in the user message, after
 * the breakpoint.
 */

import Anthropic from '@anthropic-ai/sdk';
import {
  DEFAULT_MAX_TOKENS,
  ProviderError,
  REQUEST_TIMEOUT_MS,
  SDK_MAX_RETRIES,
  type TransformProvider,
} from './types';
import { DEFAULT_MODELS } from './models';

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new ProviderError('ANTHROPIC_API_KEY is not configured', 'AUTH', false);
  }
  client ??= new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    timeout: REQUEST_TIMEOUT_MS,
    maxRetries: SDK_MAX_RETRIES,
  });
  return client;
}

export const anthropicProvider: TransformProvider = {
  name: 'anthropic',

  async transform(inputJson, jsonSchema, systemPrompt, opts) {
    const model = opts?.modelName ?? DEFAULT_MODELS.anthropic;
    const maxTokens = opts?.maxTokens ?? DEFAULT_MAX_TOKENS;

    let response: Anthropic.Message;
    try {
      response = await getClient().messages.create({
        model,
        max_tokens: maxTokens,
        // No temperature: recent Claude models reject non-default sampling params.
        system: [
          {
            type: 'text',
            text: systemPrompt,
            cache_control: { type: 'ephemeral' },
          },
        ],
        tools: [
          {
            name: 'emit_transformed_json',
            description:
              'Emit the transformed JSON payload matching the target schema exactly.',
            strict: true,
            input_schema: jsonSchema as Anthropic.Tool['input_schema'],
          } as Anthropic.ToolUnion,
        ],
        tool_choice: { type: 'tool', name: 'emit_transformed_json' },
        messages: [
          {
            role: 'user',
            content: `INCOMING JSON PAYLOAD:\n${JSON.stringify(inputJson, null, 2)}`,
          },
        ],
      });
    } catch (error) {
      throw mapAnthropicError(error);
    }

    if (response.stop_reason === 'max_tokens') {
      throw new ProviderError(
        `Output truncated at ${maxTokens} tokens — payload or target schema too large for a single response`,
        'MAX_TOKENS',
        false
      );
    }

    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
    );
    if (!toolUse) {
      throw new ProviderError(
        `No tool_use block in Anthropic response (stop_reason=${response.stop_reason})`,
        'PARSE_ERROR',
        false
      );
    }

    return {
      data: toolUse.input,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
      model: response.model,
    };
  },
};

function mapAnthropicError(error: unknown): ProviderError {
  if (error instanceof ProviderError) return error;
  if (error instanceof Anthropic.APIUserAbortError) {
    return new ProviderError('Anthropic request aborted', 'TIMEOUT', true);
  }
  if (error instanceof Anthropic.APIConnectionTimeoutError) {
    return new ProviderError('Anthropic request timed out', 'TIMEOUT', true);
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new ProviderError('Anthropic rate limit exceeded', 'RATE_LIMIT', true);
  }
  if (error instanceof Anthropic.AuthenticationError) {
    return new ProviderError('Anthropic authentication failed', 'AUTH', false);
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return new ProviderError('Could not reach Anthropic', 'TIMEOUT', true);
  }
  if (error instanceof Anthropic.APIError) {
    return new ProviderError(`Anthropic API error: ${error.message}`, 'API_ERROR', false);
  }
  return new ProviderError(
    error instanceof Error ? error.message : 'Unknown Anthropic error',
    'API_ERROR',
    false
  );
}
