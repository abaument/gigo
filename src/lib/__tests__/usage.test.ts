import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { findUnique, userFindUnique } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  userFindUnique: vi.fn(),
}));
vi.mock('@/lib/db', () => ({
  db: { usageRecord: { findUnique }, user: { findUnique: userFindUnique } },
}));

import { checkMonthlyQuota, getMonthlyTokenQuota } from '../usage';

beforeEach(() => {
  findUnique.mockReset();
  userFindUnique.mockReset();
  // no per-account ceiling unless a test sets one
  userFindUnique.mockResolvedValue({ monthlyTokenQuota: null });
});

afterEach(() => {
  delete process.env.MONTHLY_TOKEN_QUOTA;
});

describe('getMonthlyTokenQuota', () => {
  it('defaults to unlimited (0) when unset or invalid', () => {
    delete process.env.MONTHLY_TOKEN_QUOTA;
    expect(getMonthlyTokenQuota()).toBe(0);
    process.env.MONTHLY_TOKEN_QUOTA = 'abc';
    expect(getMonthlyTokenQuota()).toBe(0);
    process.env.MONTHLY_TOKEN_QUOTA = '-5';
    expect(getMonthlyTokenQuota()).toBe(0);
  });

  it('parses a positive quota', () => {
    process.env.MONTHLY_TOKEN_QUOTA = '150000';
    expect(getMonthlyTokenQuota()).toBe(150000);
  });
});

describe('checkMonthlyQuota', () => {
  it('always allows when no quota is configured (no DB call)', async () => {
    const result = await checkMonthlyQuota('user-1');
    expect(result).toEqual({ allowed: true, used: 0, quota: 0 });
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('allows under quota and blocks at quota', async () => {
    process.env.MONTHLY_TOKEN_QUOTA = '1000';

    findUnique.mockResolvedValueOnce({ tokensUsed: 999 });
    expect((await checkMonthlyQuota('user-1')).allowed).toBe(true);

    findUnique.mockResolvedValueOnce({ tokensUsed: 1000 });
    expect((await checkMonthlyQuota('user-1')).allowed).toBe(false);

    findUnique.mockResolvedValueOnce({ tokensUsed: 5000 });
    const over = await checkMonthlyQuota('user-1');
    expect(over.allowed).toBe(false);
    expect(over.used).toBe(5000);
  });

  it('treats a missing usage record as zero usage', async () => {
    process.env.MONTHLY_TOKEN_QUOTA = '1000';
    findUnique.mockResolvedValueOnce(null);
    expect((await checkMonthlyQuota('user-1')).allowed).toBe(true);
  });

  it("lets an account's own ceiling override the environment", async () => {
    process.env.MONTHLY_TOKEN_QUOTA = '1000';
    userFindUnique.mockResolvedValue({ monthlyTokenQuota: 5000 });

    findUnique.mockResolvedValueOnce({ tokensUsed: 2000 });
    const under = await checkMonthlyQuota('user-1');
    expect(under.allowed).toBe(true);
    expect(under.quota).toBe(5000);

    findUnique.mockResolvedValueOnce({ tokensUsed: 5000 });
    expect((await checkMonthlyQuota('user-1')).allowed).toBe(false);
  });

  it('treats an account ceiling of zero as unlimited, whatever the environment', async () => {
    process.env.MONTHLY_TOKEN_QUOTA = '1000';
    userFindUnique.mockResolvedValue({ monthlyTokenQuota: 0 });

    const result = await checkMonthlyQuota('user-1');
    expect(result).toEqual({ allowed: true, used: 0, quota: 0 });
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('falls back to the environment when the account cannot be read', async () => {
    process.env.MONTHLY_TOKEN_QUOTA = '1000';
    userFindUnique.mockRejectedValue(new Error('base injoignable'));
    findUnique.mockResolvedValueOnce({ tokensUsed: 1500 });

    const result = await checkMonthlyQuota('user-1');
    expect(result.allowed).toBe(false);
    expect(result.quota).toBe(1000);
  });
});
