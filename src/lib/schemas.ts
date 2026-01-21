/**
 * Zod validation schemas for the Universal Data Adapter.
 *
 * Defines type-safe validation for adapter creation, webhook payloads,
 * and API responses.
 */

import { z } from 'zod';

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
    .refine(
      (val) => {
        try {
          JSON.parse(val);
          return true;
        } catch {
          return false;
        }
      },
      { message: 'Target schema must be valid JSON' }
    ),
});

export type CreateAdapterInput = z.infer<typeof createAdapterSchema>;

/**
 * Schema for adapter response.
 */
export const adapterSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  targetSchema: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Adapter = z.infer<typeof adapterSchema>;

/**
 * Schema for transformation log response.
 */
export const transformationLogSchema = z.object({
  id: z.string().uuid(),
  adapterId: z.string().uuid(),
  inputJson: z.string(),
  outputJson: z.string().nullable(),
  success: z.boolean(),
  error: z.string().nullable(),
  duration: z.number().nullable(),
  createdAt: z.date(),
});

export type TransformationLog = z.infer<typeof transformationLogSchema>;

/**
 * Schema for webhook transformation result.
 */
export const transformationResultSchema = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z.string().optional(),
  originalInput: z.unknown().optional(),
});

export type TransformationResult = z.infer<typeof transformationResultSchema>;
