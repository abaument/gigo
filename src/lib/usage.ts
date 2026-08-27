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

export interface QuotaCheck {
  allowed: boolean;
  used: number;
  quota: number;
}

/**
 * Monthly per-user token quota, read from MONTHLY_TOKEN_QUOTA.
 * 0 / unset = unlimited (self-host default). Set it on shared/demo
 * deployments so a single user cannot drain the AI credits.
 */
export function getMonthlyTokenQuota(): number {
  const raw = Number(process.env.MONTHLY_TOKEN_QUOTA ?? 0);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
}

export async function checkMonthlyQuota(userId: string): Promise<QuotaCheck> {
  const quota = getMonthlyTokenQuota();
  if (quota === 0) {
    return { allowed: true, used: 0, quota: 0 };
  }

  const now = new Date();
  const record = await db.usageRecord.findUnique({
    where: {
      userId_year_month: {
        userId,
        year: now.getUTCFullYear(),
        month: now.getUTCMonth() + 1,
      },
    },
    select: { tokensUsed: true },
  });

  const used = record?.tokensUsed ?? 0;
  return { allowed: used < quota, used, quota };
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
