/**
 * Zod validation schemas for GIGO.
 *
 * These are the single source of truth for adapter input validation —
 * applied in the server actions (create/update) and reused by the API
 * routes.
 */

import { z } from 'zod';

function isValidJson(val: string): boolean {
  try {
    JSON.parse(val);
    return true;
  } catch {
    return false;
  }
}

export const providerEnum = z.enum(['openai', 'anthropic']);
export const authMethodEnum = z.enum(['none', 'bearer', 'api_key', 'basic']);
export const schemaSourceEnum = z.enum(['manual', 'documentation', 'url']);

/**
 * Schema for creating a new adapter.
 */
export const createAdapterSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be less than 100 characters'),
  description: z
    .string()
    .max(500, 'Description must be less than 500 characters')
    .optional(),
  targetSchema: z
    .string()
    .min(1, 'Target schema is required')
    .max(100_000, 'Target schema is too large')
    .refine(isValidJson, { message: 'Target schema must be valid JSON' }),
  schemaSourceType: schemaSourceEnum.default('manual'),
  schemaSourceUrl: z.string().url().max(2000).optional(),
  modelProvider: providerEnum.default('openai'),
  modelName: z.string().max(100).optional(),
  destinationUrl: z.string().url('Destination must be a valid URL').max(2000).optional(),
  destinationMethod: z.enum(['POST', 'PUT', 'PATCH']).default('POST'),
  authMethod: authMethodEnum.default('none'),
  authHeaderName: z
    .string()
    .max(100)
    .regex(/^[A-Za-z0-9-]+$/, 'Header name may only contain letters, digits and dashes')
    .optional(),
  authValue: z.string().max(5000).optional(),
  webhookSecret: z
    .string()
    .min(16, 'Webhook secret must be at least 16 characters')
    .max(200)
    .optional(),
  forwardTimeoutMs: z.number().int().min(1000).max(60_000).default(15_000),
  rateLimitPerMin: z.number().int().min(1).max(10_000).default(60),
});

export type CreateAdapterInput = z.input<typeof createAdapterSchema>;

/**
 * Schema for updating an adapter — all fields optional.
 * `authValue: undefined` means "keep the stored credential".
 */
export const updateAdapterSchema = createAdapterSchema.partial();

export type UpdateAdapterInput = z.input<typeof updateAdapterSchema>;

/**
 * Query options for paginated log fetching.
 */
export const getLogsQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  take: z.number().int().min(1).max(100).default(50),
  status: z.enum(['all', 'success', 'error']).default('all'),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  traceId: z.string().optional(),
  includeTests: z.boolean().default(true),
});

export type GetLogsQuery = z.input<typeof getLogsQuerySchema>;
