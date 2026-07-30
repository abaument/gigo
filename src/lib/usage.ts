/**
 * Monthly usage tracking (transformations, forwardings, tokens).
 *
 * Called fire-and-forget from the webhook/test/replay paths — a usage
 * write must never fail a transformation, so callers should
 * `.catch(console.error)` rather than await-throw.
 */

import { db } from '@/lib/db';

export interface UsageDelta {
  transformations?: number;
  forwardings?: number;
  tokens?: number;
}

export async function recordUsage(userId: string, delta: UsageDelta): Promise<void> {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;

  await db.usageRecord.upsert({
    where: { userId_year_month: { userId, year, month } },
    update: {
      transformationCount: { increment: delta.transformations ?? 0 },
      forwardingCount: { increment: delta.forwardings ?? 0 },
      tokensUsed: { increment: delta.tokens ?? 0 },
    },
    create: {
      userId,
      year,
      month,
      transformationCount: delta.transformations ?? 0,
      forwardingCount: delta.forwardings ?? 0,
      tokensUsed: delta.tokens ?? 0,
    },
  });
}
