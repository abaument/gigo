/**
 * OpenAI transformation provider — structured outputs (strict JSON Schema).
 */

import OpenAI from 'openai';
import {
  DEFAULT_MAX_TOKENS,
  ProviderError,
  REQUEST_TIMEOUT_MS,
  SDK_MAX_RETRIES,
  type TransformProvider,
} from './types';
import { DEFAULT_MODELS } from './models';

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new ProviderError('OPENAI_API_KEY is not configured', 'AUTH', false);
  }
  client ??= new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: REQUEST_TIMEOUT_MS,
    maxRetries: SDK_MAX_RETRIES,
  });
  return client;
}

export const openaiProvider: TransformProvider = {
  name: 'openai',

  async transform(inputJson, jsonSchema, systemPrompt, opts) {
    const model = opts?.modelName ?? DEFAULT_MODELS.openai;
    const maxTokens = opts?.maxTokens ?? DEFAULT_MAX_TOKENS;

    let response: OpenAI.Chat.Completions.ChatCompletion;
    try {
      response = await getClient().chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `INCOMING JSON PAYLOAD:\n${JSON.stringify(inputJson, null, 2)}`,
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'transformed_data',
            strict: true,
            schema: jsonSchema,
          },
        },
        temperature: 0,
        max_tokens: maxTokens,
      });
    } catch (error) {
      throw mapOpenAiError(error);
    }

    const choice = response.choices[0];

    if (choice?.finish_reason === 'length') {
      throw new ProviderError(
        `Output truncated at ${maxTokens} tokens — payload or target schema too large for a single response`,
        'MAX_TOKENS',
        false
      );
    }

    const content = choice?.message?.content;
    if (!content) {
      throw new ProviderError('No response content from OpenAI', 'PARSE_ERROR', false);
    }

    let data: unknown;
    try {
      data = JSON.parse(content);
    } catch {
      throw new ProviderError('OpenAI returned invalid JSON', 'PARSE_ERROR', false);
    }

    return {
      data,
      usage: {
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
      },
      model: response.model,
    };
  },
};

function mapOpenAiError(error: unknown): ProviderError {
  if (error instanceof ProviderError) return error;
  if (error instanceof OpenAI.APIUserAbortError) {
    return new ProviderError('OpenAI request aborted', 'TIMEOUT', true);
  }
  if (error instanceof OpenAI.APIConnectionTimeoutError) {
    return new ProviderError('OpenAI request timed out', 'TIMEOUT', true);
  }
  if (error instanceof OpenAI.RateLimitError) {
    return new ProviderError('OpenAI rate limit exceeded', 'RATE_LIMIT', true);
  }
  if (error instanceof OpenAI.AuthenticationError) {
    return new ProviderError('OpenAI authentication failed', 'AUTH', false);
  }
  if (error instanceof OpenAI.APIConnectionError) {
    return new ProviderError('Could not reach OpenAI', 'TIMEOUT', true);
  }
  if (error instanceof OpenAI.APIError) {
    return new ProviderError(`OpenAI API error: ${error.message}`, 'API_ERROR', false);
  }
  return new ProviderError(
    error instanceof Error ? error.message : 'Unknown OpenAI error',
    'API_ERROR',
    false
  );
}
