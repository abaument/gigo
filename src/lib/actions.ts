/**
 * Server actions for GIGO.
 *
 * All adapter actions verify authentication and ownership (queries are
 * scoped by userId). Inputs are validated with the Zod schemas from
 * `schemas.ts` — the single source of truth for validation rules.
 */

'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { db } from './db';
import { createClient } from './supabase/server';
import { encrypt, decrypt, maskSensitive } from './encryption';
import { generateSchemaFromDocs, generateSchemaFromUrl } from './schema-generator';
import { generateRule } from './jsonata-generator';
import { verifyRule } from './jsonata-rule';
import { DATA_FORMATS, type DataFormat } from './formats';
import { envApiKey, KEYABLE_PROVIDERS, resolveApiKey } from './api-keys';
import { disableLearningsOnSchemaChange, saveExample } from './learnings';
import { assertSafeUrl, SsrfError } from './ssrf-guard';
import { generateEmailIngestToken, generateWebhookSecret } from './security';
import { runTransformation } from './pipeline';
import {
  createAdapterSchema,
  updateAdapterSchema,
  getLogsQuerySchema,
  type CreateAdapterInput,
  type UpdateAdapterInput,
  type GetLogsQuery,
} from './schemas';

// =============================================================================
// AUTHENTICATION HELPERS
// =============================================================================

export async function getCurrentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  // Ensure user exists in our database
  let dbUser = await db.user.findUnique({
    where: { id: user.id },
  });

  if (!dbUser) {
    // First login. Upsert: two concurrent requests (typical on a fresh
    // session hitting several server components) must not race to create.
    try {
      dbUser = await db.user.upsert({
        where: { id: user.id },
        update: {},
        create: {
          id: user.id,
          email: user.email!,
          name: user.user_metadata?.full_name || user.email?.split('@')[0],
          avatarUrl: user.user_metadata?.avatar_url,
        },
      });
    } catch (error) {
      if ((error as { code?: string })?.code !== 'P2002') throw error;
      // The email already exists under an old auth id (account deleted and
      // re-provisioned in Supabase). Re-key the row: FKs cascade on update,
      // so the user keeps their adapters, logs and keys.
      dbUser = await db.user.update({
        where: { email: user.email! },
        data: { id: user.id },
      });
    }
  }

  return dbUser;
}

export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }
  return user;
}

// =============================================================================
// AUTH ACTIONS
// =============================================================================

export async function signUp(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const name = formData.get('name') as string;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: name,
      },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'}/auth/callback`,
    },
  });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/', 'layout');
  return { success: true, data };
}

export async function signIn(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/', 'layout');
  redirect('/dashboard');
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login');
}

// =============================================================================
// LOCALE
// =============================================================================

export async function setLocale(locale: 'fr' | 'en') {
  const cookieStore = await cookies();
  cookieStore.set('NEXT_LOCALE', locale, { maxAge: 31_536_000, path: '/' });
  revalidatePath('/', 'layout');
}

// =============================================================================
// ADAPTER ACTIONS
// =============================================================================

/**
 * Create a new adapter for the authenticated user.
 */
export async function createAdapter(input: CreateAdapterInput) {
  try {
    const user = await requireAuth();

    const parsed = createAdapterSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, error: parsed.error.issues[0].message };
    }
    const data = parsed.data;

    if (data.destinationUrl) {
      try {
        await assertSafeUrl(data.destinationUrl);
      } catch (error) {
        if (error instanceof SsrfError) {
          return { success: false as const, error: `Destination URL rejected: ${error.message}` };
        }
        throw error;
      }
    }

    const adapter = await db.adapter.create({
      data: {
        userId: user.id,
        name: data.name,
        description: data.description || null,
        targetSchema: JSON.stringify(JSON.parse(data.targetSchema), null, 2),
        samplePayload: data.samplePayload
          ? JSON.stringify(JSON.parse(data.samplePayload), null, 2)
          : null,
        schemaSourceType: data.schemaSourceType,
        schemaSourceUrl: data.schemaSourceUrl || null,
        modelProvider: data.modelProvider,
        modelName: data.modelName || null,
        destinationUrl: data.destinationUrl || null,
        destinationMethod: data.destinationMethod,
        authMethod: data.authMethod,
        authHeaderName: data.authHeaderName || null,
        encryptedAuthValue: data.authValue ? encrypt(data.authValue) : null,
        webhookSecret: data.webhookSecret || null,
        forwardTimeoutMs: data.forwardTimeoutMs,
        rateLimitPerMin: data.rateLimitPerMin,
      },
    });

    revalidatePath('/dashboard');
    return { success: true as const, data: adapter };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create adapter';
    return { success: false as const, error: message };
  }
}

/**
 * Get all adapters for the authenticated user.
 */
export async function getAdapters(options?: { take?: number; skip?: number }) {
  const user = await getCurrentUser();
  if (!user) return [];

  const adapters = await db.adapter.findMany({
    where: { userId: user.id },
    take: options?.take ?? 50,
    skip: options?.skip ?? 0,
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: { logs: true },
      },
    },
  });

  return adapters;
}

/**
 * Get a single adapter by ID (with ownership verification).
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getAdapterById(id: string) {
  if (!UUID_RE.test(id)) return null;
  const user = await getCurrentUser();
  if (!user) return null;

  const adapter = await db.adapter.findFirst({
    where: {
      id,
      userId: user.id, // Row-level security
    },
  });

  return adapter;
}

/**
 * Get adapter with masked credentials (for display and edit form).
 * The webhook secret IS returned — the caller is the authenticated owner.
 */
export async function getAdapterWithMaskedCredentials(id: string) {
  const adapter = await getAdapterById(id);
  if (!adapter) return null;

  return {
    ...adapter,
    maskedAuthValue: adapter.encryptedAuthValue
      ? maskSensitive(decrypt(adapter.encryptedAuthValue))
      : null,
    encryptedAuthValue: undefined, // Don't expose encrypted value
  };
}

/**
 * Update an adapter. `authValue` semantics: undefined/empty = keep the
 * stored credential; a non-empty value replaces it; switching
 * `authMethod` to "none" clears it.
 */
export async function updateAdapter(id: string, input: UpdateAdapterInput) {
  try {
    const user = await requireAuth();

    const existing = await db.adapter.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return { success: false as const, error: 'Adapter not found' };
    }

    const parsed = updateAdapterSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, error: parsed.error.issues[0].message };
    }
    const data = parsed.data;

    if (data.destinationUrl) {
      try {
        await assertSafeUrl(data.destinationUrl);
      } catch (error) {
        if (error instanceof SsrfError) {
          return { success: false as const, error: `Destination URL rejected: ${error.message}` };
        }
        throw error;
      }
    }

    const updateData: Record<string, unknown> = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description || null;
    if (data.targetSchema !== undefined) {
      updateData.targetSchema = JSON.stringify(JSON.parse(data.targetSchema), null, 2);
    }
    if (data.samplePayload !== undefined) {
      updateData.samplePayload = data.samplePayload
        ? JSON.stringify(JSON.parse(data.samplePayload), null, 2)
        : null;
    }
    if (data.schemaSourceType !== undefined) updateData.schemaSourceType = data.schemaSourceType;
    if (data.schemaSourceUrl !== undefined) updateData.schemaSourceUrl = data.schemaSourceUrl || null;
    if (data.modelProvider !== undefined) updateData.modelProvider = data.modelProvider;
    if (data.modelName !== undefined) updateData.modelName = data.modelName || null;
    if (data.destinationUrl !== undefined) updateData.destinationUrl = data.destinationUrl || null;
    if (data.destinationMethod !== undefined) updateData.destinationMethod = data.destinationMethod;
    if (data.authMethod !== undefined) updateData.authMethod = data.authMethod;
    if (data.authHeaderName !== undefined) updateData.authHeaderName = data.authHeaderName || null;
    if (data.authValue) {
      updateData.encryptedAuthValue = encrypt(data.authValue);
    }
    if (data.authMethod === 'none') {
      updateData.encryptedAuthValue = null;
    }
    if (data.webhookSecret !== undefined) updateData.webhookSecret = data.webhookSecret || null;
    if (data.forwardTimeoutMs !== undefined) updateData.forwardTimeoutMs = data.forwardTimeoutMs;
    if (data.rateLimitPerMin !== undefined) updateData.rateLimitPerMin = data.rateLimitPerMin;

    const adapter = await db.adapter.update({
      where: { id },
      data: updateData,
    });

    // A different target schema invalidates what was learned against the
    // old one — pause all learnings (reviewable, not deleted).
    if (
      typeof updateData.targetSchema === 'string' &&
      updateData.targetSchema !== existing.targetSchema
    ) {
      await disableLearningsOnSchemaChange(id);
    }

    revalidatePath('/dashboard');
    revalidatePath(`/adapters/${id}`);
    return { success: true as const, data: adapter };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update adapter';
    return { success: false as const, error: message };
  }
}

/**
 * Delete an adapter and all associated logs.
 */
export async function deleteAdapter(id: string) {
  try {
    const user = await requireAuth();

    const existing = await db.adapter.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return { success: false as const, error: 'Adapter not found' };
    }

    await db.adapter.delete({
      where: { id },
    });

    revalidatePath('/dashboard');
    return { success: true as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete adapter';
    return { success: false as const, error: message };
  }
}

/**
 * Toggle an adapter's active state.
 */
export async function toggleAdapterActive(id: string) {
  try {
    const user = await requireAuth();

    const existing = await db.adapter.findFirst({
      where: { id, userId: user.id },
      select: { id: true, isActive: true },
    });

    if (!existing) {
      return { success: false as const, error: 'Adapter not found' };
    }

    const adapter = await db.adapter.update({
      where: { id },
      data: { isActive: !existing.isActive },
    });

    revalidatePath('/dashboard');
    revalidatePath(`/adapters/${id}`);
    return { success: true as const, data: { isActive: adapter.isActive } };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to toggle adapter';
    return { success: false as const, error: message };
  }
}

/**
 * Duplicate an adapter. The webhook secret is never copied — the copy
 * gets its own (or none).
 */
export async function duplicateAdapter(id: string) {
  try {
    const user = await requireAuth();

    const existing = await db.adapter.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return { success: false as const, error: 'Adapter not found' };
    }

    const copy = await db.adapter.create({
      data: {
        userId: user.id,
        name: `${existing.name} (copy)`,
        description: existing.description,
        targetSchema: existing.targetSchema,
        samplePayload: existing.samplePayload,
        schemaSourceType: existing.schemaSourceType,
        schemaSourceUrl: existing.schemaSourceUrl,
        modelProvider: existing.modelProvider,
        modelName: existing.modelName,
        destinationUrl: existing.destinationUrl,
        destinationMethod: existing.destinationMethod,
        authMethod: existing.authMethod,
        authHeaderName: existing.authHeaderName,
        encryptedAuthValue: existing.encryptedAuthValue,
        forwardTimeoutMs: existing.forwardTimeoutMs,
        rateLimitPerMin: existing.rateLimitPerMin,
        webhookSecret: null,
      },
    });

    revalidatePath('/dashboard');
    return { success: true as const, data: copy };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to duplicate adapter';
    return { success: false as const, error: message };
  }
}

/**
 * Generate (or rotate) an adapter's webhook secret. Returns the plaintext
 * secret — display it once, it stays retrievable only on the detail page.
 */
export async function regenerateWebhookSecret(id: string) {
  try {
    const user = await requireAuth();

    const existing = await db.adapter.findFirst({
      where: { id, userId: user.id },
      select: { id: true },
    });

    if (!existing) {
      return { success: false as const, error: 'Adapter not found' };
    }

    const secret = generateWebhookSecret();
    await db.adapter.update({
      where: { id },
      data: { webhookSecret: secret },
    });

    revalidatePath(`/adapters/${id}`);
    return { success: true as const, data: { secret } };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to regenerate secret';
    return { success: false as const, error: message };
  }
}

/**
 * Enable (or rotate) email ingress for an adapter: returns the address
 * token that must appear in the plus-address. Disabled by default —
 * a leaked adapter UUID alone can never inject data by email.
 */
export async function enableEmailIngress(id: string) {
  try {
    const user = await requireAuth();

    const token = generateEmailIngestToken();
    const { count } = await db.adapter.updateMany({
      where: { id, userId: user.id },
      data: { emailIngestToken: token },
    });
    if (count === 0) return { success: false as const, error: 'Adapter not found' };

    revalidatePath(`/adapters/${id}`);
    return { success: true as const, data: { token } };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to enable email ingress';
    return { success: false as const, error: message };
  }
}

/** Disable email ingress for an adapter (existing address stops working). */
export async function disableEmailIngress(id: string) {
  try {
    const user = await requireAuth();

    const { count } = await db.adapter.updateMany({
      where: { id, userId: user.id },
      data: { emailIngestToken: null },
    });
    if (count === 0) return { success: false as const, error: 'Adapter not found' };

    revalidatePath(`/adapters/${id}`);
    return { success: true as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to disable email ingress';
    return { success: false as const, error: message };
  }
}

/**
 * Remove an adapter's webhook secret (open endpoint again).
 */
export async function removeWebhookSecret(id: string) {
  try {
    const user = await requireAuth();

    const existing = await db.adapter.findFirst({
      where: { id, userId: user.id },
      select: { id: true },
    });

    if (!existing) {
      return { success: false as const, error: 'Adapter not found' };
    }

    await db.adapter.update({
      where: { id },
      data: { webhookSecret: null },
    });

    revalidatePath(`/adapters/${id}`);
    return { success: true as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to remove secret';
    return { success: false as const, error: message };
  }
}

// =============================================================================
// STATS & LOGS
// =============================================================================

export interface AdapterStats {
  total: number;
  successCount: number;
  errorCount: number;
  successRate: number; // 0-100
  avgTransformMs: number | null;
  avgTotalMs: number | null;
  tokensIn: number;
  tokensOut: number;
  last30dCount: number;
  adapterCount?: number;
}

/**
 * SQL aggregates over the WHOLE log table (never a page of 50 rows).
 * With an adapterId: stats for that adapter. Without: global stats for
 * the authenticated user's adapters (dashboard).
 */
export async function getAdapterStats(adapterId?: string): Promise<AdapterStats | null> {
  if (adapterId && !UUID_RE.test(adapterId)) return null;
  const user = await getCurrentUser();
  if (!user) return null;

  if (adapterId) {
    const owned = await db.adapter.findFirst({
      where: { id: adapterId, userId: user.id },
      select: { id: true },
    });
    if (!owned) return null;
  }

  const where = adapterId
    ? { adapterId, isTest: false }
    : { adapter: { userId: user.id }, isTest: false };

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [byStatus, agg, last30d, adapterCount] = await Promise.all([
    db.transformationLog.groupBy({
      by: ['success'],
      where,
      _count: { _all: true },
    }),
    db.transformationLog.aggregate({
      where,
      _avg: { transformDuration: true, totalDuration: true },
      _sum: { inputTokens: true, outputTokens: true },
    }),
    db.transformationLog.count({
      where: { ...where, createdAt: { gte: thirtyDaysAgo } },
    }),
    adapterId ? Promise.resolve(undefined) : db.adapter.count({ where: { userId: user.id } }),
  ]);

  const successCount = byStatus.find((row) => row.success)?._count._all ?? 0;
  const errorCount = byStatus.find((row) => !row.success)?._count._all ?? 0;
  const total = successCount + errorCount;

  return {
    total,
    successCount,
    errorCount,
    successRate: total > 0 ? Math.round((successCount / total) * 1000) / 10 : 100,
    avgTransformMs: agg._avg.transformDuration ? Math.round(agg._avg.transformDuration) : null,
    avgTotalMs: agg._avg.totalDuration ? Math.round(agg._avg.totalDuration) : null,
    tokensIn: agg._sum.inputTokens ?? 0,
    tokensOut: agg._sum.outputTokens ?? 0,
    last30dCount: last30d,
    ...(adapterCount !== undefined ? { adapterCount } : {}),
  };
}

/**
 * A log row as returned in the paginated list — heavy JSON columns are
 * excluded; the detail drawer fetches them via getLogById.
 */
export type LogListItem = {
  id: string;
  adapterId: string;
  success: boolean;
  error: string | null;
  forwardingSuccess: boolean | null;
  forwardingStatus: number | null;
  transformDuration: number | null;
  forwardDuration: number | null;
  totalDuration: number | null;
  provider: string | null;
  modelName: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  isTest: boolean;
  replayOfId: string | null;
  sourceIp: string | null;
  /** format the caller sent, null on rows written before multi-format input */
  inputFormat: string | null;
  createdAt: Date;
};

/**
 * Cursor-paginated, server-filtered log fetching.
 */
export async function getAdapterLogs(
  adapterId: string,
  query?: GetLogsQuery
): Promise<{ logs: LogListItem[]; nextCursor: string | null }> {
  if (!UUID_RE.test(adapterId)) return { logs: [], nextCursor: null };
  const user = await getCurrentUser();
  if (!user) return { logs: [], nextCursor: null };

  const adapter = await db.adapter.findFirst({
    where: { id: adapterId, userId: user.id },
    select: { id: true },
  });
  if (!adapter) return { logs: [], nextCursor: null };

  const parsed = getLogsQuerySchema.safeParse(query ?? {});
  if (!parsed.success) return { logs: [], nextCursor: null };
  const q = parsed.data;

  const where = {
    adapterId,
    ...(q.status === 'success' ? { success: true } : {}),
    ...(q.status === 'error' ? { success: false } : {}),
    ...(q.from || q.to
      ? { createdAt: { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lte: q.to } : {}) } }
      : {}),
    ...(q.traceId ? { id: q.traceId } : {}),
    ...(q.includeTests ? {} : { isTest: false }),
  };

  const rows = await db.transformationLog.findMany({
    where,
    take: q.take + 1,
    ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: {
      id: true,
      adapterId: true,
      success: true,
      error: true,
      forwardingSuccess: true,
      forwardingStatus: true,
      transformDuration: true,
      forwardDuration: true,
      totalDuration: true,
      provider: true,
      modelName: true,
      inputTokens: true,
      outputTokens: true,
      isTest: true,
      replayOfId: true,
      sourceIp: true,
      inputFormat: true,
      createdAt: true,
    },
  });

  const hasMore = rows.length > q.take;
  const logs = hasMore ? rows.slice(0, q.take) : rows;

  return {
    logs,
    nextCursor: hasMore ? logs[logs.length - 1].id : null,
  };
}

/**
 * Full log detail (input/output/forwarding payloads) for the drawer.
 */
export async function getLogById(logId: string) {
  const user = await getCurrentUser();
  if (!user) return null;

  const log = await db.transformationLog.findFirst({
    where: { id: logId, adapter: { userId: user.id } },
  });

  return log;
}

/**
 * Replay a logged transformation with the adapter's CURRENT schema and
 * provider. Never forwards unless explicitly asked.
 */
export async function replayTransformation(
  logId: string,
  opts?: { forward?: boolean }
) {
  try {
    const user = await requireAuth();

    const log = await db.transformationLog.findFirst({
      where: { id: logId, adapter: { userId: user.id } },
      include: { adapter: true },
    });

    if (!log) {
      return { success: false as const, error: 'Log not found' };
    }

    let inputJson: unknown;
    try {
      inputJson = JSON.parse(log.inputJson);
    } catch {
      return { success: false as const, error: 'Original input is not valid JSON' };
    }

    const result = await runTransformation({
      adapter: log.adapter,
      inputJson,
      forward: opts?.forward ?? false,
      isTest: false,
      replayOfId: log.id,
      replayOriginalFailed: !log.success,
      sourceIp: 'replay',
      userAgent: 'GIGO Replay',
    });

    revalidatePath(`/adapters/${log.adapterId}/logs`);

    if (!result.ok) {
      return {
        success: false as const,
        error: result.transform.error || 'Replay failed',
        traceId: result.traceId,
      };
    }

    return {
      success: true as const,
      traceId: result.traceId,
      data: result.transform.data,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to replay transformation';
    return { success: false as const, error: message };
  }
}

// =============================================================================
// SCHEMA GENERATION ACTIONS
// =============================================================================

export async function generateSchema(documentationText: string) {
  const user = await requireAuth();
  const apiKey = await resolveApiKey(user.id, 'openai');
  return await generateSchemaFromDocs(documentationText, apiKey ?? undefined);
}

export async function generateSchemaFromDocUrl(url: string) {
  const user = await requireAuth();
  const apiKey = await resolveApiKey(user.id, 'openai');
  return await generateSchemaFromUrl(url, apiKey ?? undefined);
}

// =============================================================================
// LEARNING LOOP
// =============================================================================

/** The adapter's stored learnings, owner-scoped, newest first. */
export async function getAdapterLearnings(adapterId: string) {
  if (!UUID_RE.test(adapterId)) return [];
  const user = await getCurrentUser();
  if (!user) return [];

  const owned = await db.adapter.findFirst({
    where: { id: adapterId, userId: user.id },
    select: { id: true },
  });
  if (!owned) return [];

  return db.adapterLearning.findMany({
    where: { adapterId },
    orderBy: { createdAt: 'desc' },
  });
}

/** Enable/disable the learning loop for an adapter. */
export async function setAdapterLearningEnabled(adapterId: string, enabled: boolean) {
  try {
    const user = await requireAuth();

    const { count } = await db.adapter.updateMany({
      where: { id: adapterId, userId: user.id },
      data: { learningEnabled: enabled },
    });
    if (count === 0) return { success: false as const, error: 'Adapter not found' };

    revalidatePath(`/adapters/${adapterId}`);
    return { success: true as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update learning';
    return { success: false as const, error: message };
  }
}

/** Toggle a single learning on/off (kept but excluded from prompts). */
export async function setLearningEnabled(learningId: string, enabled: boolean) {
  try {
    const user = await requireAuth();

    const { count } = await db.adapterLearning.updateMany({
      where: { id: learningId, adapter: { userId: user.id } },
      data: { enabled },
    });
    if (count === 0) return { success: false as const, error: 'Learning not found' };

    return { success: true as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update learning';
    return { success: false as const, error: message };
  }
}

/** Delete a learning. */
export async function deleteLearning(learningId: string) {
  try {
    const user = await requireAuth();

    const { count } = await db.adapterLearning.deleteMany({
      where: { id: learningId, adapter: { userId: user.id } },
    });
    if (count === 0) return { success: false as const, error: 'Learning not found' };

    return { success: true as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete learning';
    return { success: false as const, error: message };
  }
}

/**
 * Promote a successful log to a reference example (manual curation from
 * the log drawer).
 */
export async function saveLogAsExample(logId: string) {
  try {
    const user = await requireAuth();

    const log = await db.transformationLog.findFirst({
      where: { id: logId, adapter: { userId: user.id } },
      select: { adapterId: true, success: true, error: true, inputJson: true, outputJson: true },
    });
    if (!log) return { success: false as const, error: 'Log not found' };
    // `error` is non-null on a successful log only for validation warnings
    // (hallucinated keys): that output violates the schema and must not
    // be taught as a CORRECT example.
    if (!log.success || !log.outputJson || log.error) {
      return {
        success: false as const,
        error: 'Only clean successful transformations (no warnings) can become examples',
        code: 'not_clean' as const,
      };
    }

    const result = await saveExample(log.adapterId, log.inputJson, log.outputJson, 'manual');
    if (!result.saved) {
      return { success: false as const, error: result.reason ?? 'error', code: result.reason };
    }

    revalidatePath(`/adapters/${log.adapterId}`);
    return { success: true as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save example';
    return { success: false as const, error: message };
  }
}

// =============================================================================
// USER API KEYS (bring your own key)
// =============================================================================

export interface UserApiKeyInfo {
  provider: string;
  maskedKey: string;
  updatedAt: Date;
}

/**
 * The authenticated user's stored LLM keys, masked for display, plus
 * whether a server-level fallback key exists per provider.
 */
export async function getUserApiKeys(): Promise<{
  keys: UserApiKeyInfo[];
  serverFallback: Record<string, boolean>;
}> {
  const user = await requireAuth();

  const rows = await db.userApiKey.findMany({
    where: { userId: user.id },
    orderBy: { provider: 'asc' },
  });

  const keys = rows.map((row) => {
    let masked = '••••••••';
    try {
      masked = maskSensitive(decrypt(row.encryptedKey));
    } catch {
      // undecryptable (e.g. rotated ENCRYPTION_KEY) — still listed so it can be replaced
    }
    return { provider: row.provider, maskedKey: masked, updatedAt: row.updatedAt };
  });

  return {
    keys,
    serverFallback: Object.fromEntries(
      KEYABLE_PROVIDERS.map((p) => [p, envApiKey(p) !== null])
    ),
  };
}

/**
 * Store (or replace) the authenticated user's API key for a provider.
 * The key is encrypted at rest and only ever shown masked afterwards.
 */
export async function saveUserApiKey(provider: string, apiKey: string) {
  try {
    const user = await requireAuth();

    if (!(KEYABLE_PROVIDERS as string[]).includes(provider)) {
      return { success: false as const, error: 'Unknown provider' };
    }
    const trimmed = apiKey.trim();
    if (trimmed.length < 20 || trimmed.length > 400 || /\s/.test(trimmed)) {
      return { success: false as const, error: 'This does not look like a valid API key' };
    }

    await db.userApiKey.upsert({
      where: { userId_provider: { userId: user.id, provider } },
      create: { userId: user.id, provider, encryptedKey: encrypt(trimmed) },
      update: { encryptedKey: encrypt(trimmed) },
    });

    revalidatePath('/settings');
    return { success: true as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save API key';
    return { success: false as const, error: message };
  }
}

/** Remove the authenticated user's stored key for a provider. */
export async function deleteUserApiKey(provider: string) {
  try {
    const user = await requireAuth();

    await db.userApiKey.deleteMany({
      where: { userId: user.id, provider },
    });

    revalidatePath('/settings');
    return { success: true as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete API key';
    return { success: false as const, error: message };
  }
}

// =============================================================================
// OUTPUT FORMAT AND DETERMINISTIC MAPPING
// =============================================================================

/** Change what the adapter writes back and forwards: JSON, XML or CSV. */
export async function setOutputFormat(adapterId: string, format: string) {
  try {
    const user = await requireAuth();
    if (!UUID_RE.test(adapterId)) return { success: false as const, error: 'Adapter not found' };
    if (!DATA_FORMATS.includes(format as DataFormat)) {
      return { success: false as const, error: 'Unsupported output format' };
    }

    const { count } = await db.adapter.updateMany({
      where: { id: adapterId, userId: user.id },
      data: { outputFormat: format },
    });
    if (count === 0) return { success: false as const, error: 'Adapter not found' };

    revalidatePath(`/adapters/${adapterId}`);
    return { success: true as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to set output format';
    return { success: false as const, error: message };
  }
}

/**
 * Ask the model to write the mapping once, verify it on the adapter's own
 * sample, and store it only if it reproduces the expected output exactly.
 */
export async function generateJsonataRule(adapterId: string) {
  try {
    const user = await requireAuth();
    if (!UUID_RE.test(adapterId)) return { success: false as const, error: 'Adapter not found' };

    const adapter = await db.adapter.findFirst({
      where: { id: adapterId, userId: user.id },
    });
    if (!adapter) return { success: false as const, error: 'Adapter not found' };
    if (!adapter.samplePayload) {
      return {
        success: false as const,
        error: 'This adapter has no sample payload: add one, the rule is verified against it',
        code: 'no_sample' as const,
      };
    }

    const provider = adapter.modelProvider === 'anthropic' ? 'anthropic' : 'openai';
    const apiKey = await resolveApiKey(user.id, provider);
    if (!apiKey) {
      return {
        success: false as const,
        error: `No ${provider} API key configured, add yours in Settings`,
      };
    }

    const generated = await generateRule({
      targetSchema: adapter.targetSchema,
      samplePayload: adapter.samplePayload,
      provider,
      apiKey,
      modelName: adapter.modelName ?? undefined,
    });

    if (!generated.success || !generated.expression) {
      return {
        success: false as const,
        // surfaced so the user sees WHY the rule was refused, not just that it was
        error: generated.verification?.error ?? generated.error ?? 'Rule generation failed',
        missingKeys: generated.verification?.missingKeys ?? [],
        differingKeys: generated.verification?.differingKeys ?? [],
      };
    }

    await db.adapter.update({
      where: { id: adapter.id },
      data: { jsonataExpression: generated.expression, jsonataEnabled: false },
    });

    revalidatePath(`/adapters/${adapterId}`);
    return { success: true as const, expression: generated.expression };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate the rule';
    return { success: false as const, error: message };
  }
}

/**
 * Switch the deterministic path on or off. Turning it on re-verifies the rule
 * first: a schema edited since generation would otherwise silently break
 * every run.
 */
export async function setJsonataEnabled(adapterId: string, enabled: boolean) {
  try {
    const user = await requireAuth();
    if (!UUID_RE.test(adapterId)) return { success: false as const, error: 'Adapter not found' };

    const adapter = await db.adapter.findFirst({
      where: { id: adapterId, userId: user.id },
    });
    if (!adapter) return { success: false as const, error: 'Adapter not found' };

    if (enabled) {
      if (!adapter.jsonataExpression) {
        return { success: false as const, error: 'No rule to enable yet' };
      }
      if (adapter.samplePayload) {
        try {
          const check = await verifyRule(
            adapter.jsonataExpression,
            JSON.parse(adapter.samplePayload),
            JSON.parse(adapter.targetSchema)
          );
          if (!check.ok) {
            return {
              success: false as const,
              error:
                'The stored rule no longer reproduces the target on the sample, generate it again',
              missingKeys: check.missingKeys,
              differingKeys: check.differingKeys,
            };
          }
        } catch {
          return { success: false as const, error: 'Sample or target schema is not valid JSON' };
        }
      }
    }

    await db.adapter.update({
      where: { id: adapter.id },
      data: { jsonataEnabled: enabled },
    });

    revalidatePath(`/adapters/${adapterId}`);
    return { success: true as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to switch the rule';
    return { success: false as const, error: message };
  }
}

/** Drop the stored mapping and fall back to the model. */
export async function deleteJsonataRule(adapterId: string) {
  try {
    const user = await requireAuth();
    if (!UUID_RE.test(adapterId)) return { success: false as const, error: 'Adapter not found' };

    const { count } = await db.adapter.updateMany({
      where: { id: adapterId, userId: user.id },
      data: { jsonataExpression: null, jsonataEnabled: false },
    });
    if (count === 0) return { success: false as const, error: 'Adapter not found' };

    revalidatePath(`/adapters/${adapterId}`);
    return { success: true as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete the rule';
    return { success: false as const, error: message };
  }
}
