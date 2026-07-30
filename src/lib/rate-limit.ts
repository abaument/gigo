/**
 * Fixed-window rate limiting backed by Postgres.
 *
 * Serverless-safe (no in-memory state) and adds no new infrastructure:
 * one atomic UPSERT per request, which is negligible next to the LLM
 * call each webhook already makes. Swap the implementation for Upstash
 * behind the same signature if volume ever demands it.
 */

import { db } from '@/lib/db';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

export async function checkRateLimit(
  key: string,
  limitPerMin: number
): Promise<RateLimitResult> {
  const nowMs = Date.now();
  const windowEpoch = Math.floor(nowMs / 60_000);
  const id = `${key}:${windowEpoch}`;
  // Keep the row one extra minute so a clock-skewed cleanup never
  // deletes the active window.
  const expiresAt = new Date((windowEpoch + 2) * 60_000);

  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO rate_limit_windows (id, count, expires_at)
    VALUES (${id}, 1, ${expiresAt})
    ON CONFLICT (id) DO UPDATE SET count = rate_limit_windows.count + 1
    RETURNING count
  `;
  const count = rows[0]?.count ?? 1;

  // Lazy cleanup of expired windows, ~1 request in 100.
  if (Math.random() < 0.01) {
    db.$executeRaw`DELETE FROM rate_limit_windows WHERE expires_at < now()`.catch(() => {});
  }

  return {
    allowed: count <= limitPerMin,
    remaining: Math.max(0, limitPerMin - count),
    retryAfterSec: 60 - Math.floor((nowMs % 60_000) / 1000),
  };
}
