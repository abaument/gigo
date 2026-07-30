import { describe, expect, it } from 'vitest';
import { generateJsonSchemaFromExample, validateTransformedOutput } from '../transformer';

describe('generateJsonSchemaFromExample', () => {
  it('derives object schemas with required + additionalProperties:false', () => {
    const schema = generateJsonSchemaFromExample({ name: 'John', age: 30 });
    expect(schema).toEqual({
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
      },
      required: ['name', 'age'],
      additionalProperties: false,
    });
  });

  it('handles nested objects and arrays', () => {
    const schema = generateJsonSchemaFromExample({
      items: [{ sku: 'A1', qty: 2 }],
      active: true,
      note: null,
    }) as any;
    expect(schema.properties.items).toEqual({
      type: 'array',
      items: {
        type: 'object',
        properties: { sku: { type: 'string' }, qty: { type: 'number' } },
        required: ['sku', 'qty'],
        additionalProperties: false,
      },
    });
    expect(schema.properties.active).toEqual({ type: 'boolean' });
    expect(schema.properties.note).toEqual({ type: 'null' });
  });

  it('never emits degenerate sub-schemas (strict-mode safe)', () => {
    // empty arrays and unknown types would break Anthropic strict tool use
    const schema = generateJsonSchemaFromExample({ tags: [] }) as any;
    expect(schema.properties.tags).toEqual({ type: 'array', items: { type: 'string' } });
    expect(generateJsonSchemaFromExample(undefined)).toEqual({ type: 'string' });
  });
});

describe('validateTransformedOutput', () => {
  it('accepts matching keys', () => {
    const result = validateTransformedOutput({ a: 1, b: 'x' }, { a: 0, b: '' });
    expect(result.isValid).toBe(true);
    expect(result.extraKeys).toEqual([]);
  });

  it('reports extra keys with their paths', () => {
    const result = validateTransformedOutput(
      { a: 1, extra: true, nested: { known: 1, ghost: 2 } },
      { a: 0, nested: { known: 0 } }
    );
    expect(result.isValid).toBe(false);
    expect(result.extraKeys).toContain('extra');
    expect(result.extraKeys).toContain('nested.ghost');
  });
});
