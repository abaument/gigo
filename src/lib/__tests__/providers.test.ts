import { beforeEach, describe, expect, it, vi } from 'vitest';

const anthropicCreate = vi.fn();
const openaiCreate = vi.fn();

vi.mock('@anthropic-ai/sdk', () => {
  class APIError extends Error {}
  class MockAnthropic {
    messages = { create: anthropicCreate };
  }
  return {
    default: Object.assign(MockAnthropic, {
      APIError,
      APIUserAbortError: class extends APIError {},
      APIConnectionError: class extends APIError {},
      APIConnectionTimeoutError: class extends APIError {},
      RateLimitError: class extends APIError {},
      AuthenticationError: class extends APIError {},
    }),
  };
});

vi.mock('openai', () => {
  class APIError extends Error {}
  class MockOpenAI {
    chat = { completions: { create: openaiCreate } };
  }
  return {
    default: Object.assign(MockOpenAI, {
      APIError,
      APIUserAbortError: class extends APIError {},
      APIConnectionError: class extends APIError {},
      APIConnectionTimeoutError: class extends APIError {},
      RateLimitError: class extends APIError {},
      AuthenticationError: class extends APIError {},
    }),
  };
});

process.env.ANTHROPIC_API_KEY = 'test-key';
process.env.OPENAI_API_KEY = 'test-key';

import { getProvider } from '../providers';
import { ProviderError } from '../providers/types';

const JSON_SCHEMA = {
  type: 'object',
  properties: { a: { type: 'number' } },
  required: ['a'],
  additionalProperties: false,
};

beforeEach(() => {
  anthropicCreate.mockReset();
  openaiCreate.mockReset();
});

describe('getProvider factory', () => {
  it('resolves providers by name and falls back to openai', () => {
    expect(getProvider('anthropic').name).toBe('anthropic');
    expect(getProvider('openai').name).toBe('openai');
    expect(getProvider('unknown').name).toBe('openai');
    expect(getProvider(undefined).name).toBe('openai');
  });
});

describe('anthropic provider', () => {
  it('forces strict tool use with prompt caching and no temperature', async () => {
    anthropicCreate.mockResolvedValue({
      stop_reason: 'tool_use',
      model: 'claude-sonnet-5',
      content: [{ type: 'tool_use', name: 'emit_transformed_json', input: { a: 1 } }],
      usage: { input_tokens: 100, output_tokens: 20 },
    });

    const result = await getProvider('anthropic').transform({ raw: 1 }, JSON_SCHEMA, 'SYSTEM');

    expect(result.data).toEqual({ a: 1 });
    expect(result.usage).toEqual({ inputTokens: 100, outputTokens: 20 });

    const call = anthropicCreate.mock.calls[0][0];
    expect(call.tool_choice).toEqual({ type: 'tool', name: 'emit_transformed_json' });
    expect(call.tools[0].strict).toBe(true);
    expect(call.tools[0].input_schema).toEqual(JSON_SCHEMA);
    expect(call.system[0].cache_control).toEqual({ type: 'ephemeral' });
    expect(call).not.toHaveProperty('temperature');
  });

  it('maps stop_reason max_tokens to a MAX_TOKENS ProviderError', async () => {
    anthropicCreate.mockResolvedValue({
      stop_reason: 'max_tokens',
      model: 'claude-sonnet-5',
      content: [],
      usage: { input_tokens: 10, output_tokens: 8192 },
    });

    await expect(
      getProvider('anthropic').transform({}, JSON_SCHEMA, 'SYSTEM')
    ).rejects.toMatchObject({ code: 'MAX_TOKENS' });
  });

  it('throws PARSE_ERROR when no tool_use block is returned', async () => {
    anthropicCreate.mockResolvedValue({
      stop_reason: 'end_turn',
      model: 'claude-sonnet-5',
      content: [{ type: 'text', text: 'sorry' }],
      usage: { input_tokens: 10, output_tokens: 5 },
    });

    await expect(
      getProvider('anthropic').transform({}, JSON_SCHEMA, 'SYSTEM')
    ).rejects.toMatchObject({ code: 'PARSE_ERROR' });
  });
});

describe('openai provider', () => {
  it('parses structured output content and returns usage', async () => {
    openaiCreate.mockResolvedValue({
      model: 'gpt-4o-2024-08-06',
      choices: [{ finish_reason: 'stop', message: { content: '{"a": 42}' } }],
      usage: { prompt_tokens: 50, completion_tokens: 10 },
    });

    const result = await getProvider('openai').transform({ raw: 1 }, JSON_SCHEMA, 'SYSTEM');
    expect(result.data).toEqual({ a: 42 });
    expect(result.usage).toEqual({ inputTokens: 50, outputTokens: 10 });

    const call = openaiCreate.mock.calls[0][0];
    expect(call.response_format.json_schema.strict).toBe(true);
    expect(call.temperature).toBe(0);
  });

  it('maps finish_reason length to MAX_TOKENS instead of a broken JSON.parse', async () => {
    openaiCreate.mockResolvedValue({
      model: 'gpt-4o-2024-08-06',
      choices: [{ finish_reason: 'length', message: { content: '{"a": 4' } }],
      usage: { prompt_tokens: 50, completion_tokens: 8192 },
    });

    await expect(getProvider('openai').transform({}, JSON_SCHEMA, 'SYSTEM')).rejects.toMatchObject(
      { code: 'MAX_TOKENS' }
    );
  });

  it('wraps invalid JSON responses in PARSE_ERROR', async () => {
    openaiCreate.mockResolvedValue({
      model: 'gpt-4o-2024-08-06',
      choices: [{ finish_reason: 'stop', message: { content: 'not-json' } }],
      usage: { prompt_tokens: 5, completion_tokens: 2 },
    });

    await expect(getProvider('openai').transform({}, JSON_SCHEMA, 'SYSTEM')).rejects.toBeInstanceOf(
      ProviderError
    );
  });
});
