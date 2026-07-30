import { describe, expect, it } from 'vitest';
import { createAdapterSchema, getLogsQuerySchema, updateAdapterSchema } from '../schemas';

const validInput = {
  name: 'Test Adapter',
  targetSchema: '{"a": 1}',
};

describe('createAdapterSchema', () => {
  it('accepts a minimal valid input with defaults', () => {
    const parsed = createAdapterSchema.parse(validInput);
    expect(parsed.modelProvider).toBe('openai');
    expect(parsed.authMethod).toBe('none');
    expect(parsed.forwardTimeoutMs).toBe(15_000);
    expect(parsed.rateLimitPerMin).toBe(60);
  });

  it('rejects invalid JSON in targetSchema', () => {
    expect(createAdapterSchema.safeParse({ ...validInput, targetSchema: '{oops' }).success).toBe(false);
  });

  it('rejects unknown providers', () => {
    expect(
      createAdapterSchema.safeParse({ ...validInput, modelProvider: 'gemini' }).success
    ).toBe(false);
  });

  it('rejects invalid destination URLs', () => {
    expect(
      createAdapterSchema.safeParse({ ...validInput, destinationUrl: 'not-a-url' }).success
    ).toBe(false);
  });

  it('rejects header names with CRLF/injection characters', () => {
    expect(
      createAdapterSchema.safeParse({ ...validInput, authHeaderName: 'X-Key\r\nHost: evil' }).success
    ).toBe(false);
    expect(
      createAdapterSchema.safeParse({ ...validInput, authHeaderName: 'X-API-Key' }).success
    ).toBe(true);
  });

  it('rejects webhook secrets under 16 characters', () => {
    expect(createAdapterSchema.safeParse({ ...validInput, webhookSecret: 'short' }).success).toBe(false);
    expect(
      createAdapterSchema.safeParse({ ...validInput, webhookSecret: 'whsec_0123456789abcdef' }).success
    ).toBe(true);
  });
});

describe('updateAdapterSchema', () => {
  it('accepts partial input', () => {
    expect(updateAdapterSchema.safeParse({ name: 'Renamed' }).success).toBe(true);
    expect(updateAdapterSchema.safeParse({}).success).toBe(true);
  });
});

describe('getLogsQuerySchema', () => {
  it('applies defaults', () => {
    const parsed = getLogsQuerySchema.parse({});
    expect(parsed.take).toBe(50);
    expect(parsed.status).toBe('all');
    expect(parsed.includeTests).toBe(true);
  });

  it('caps take at 100', () => {
    expect(getLogsQuerySchema.safeParse({ take: 500 }).success).toBe(false);
  });

  it('coerces date strings', () => {
    const parsed = getLogsQuerySchema.parse({ from: '2026-01-01T00:00:00Z' });
    expect(parsed.from).toBeInstanceOf(Date);
  });
});
