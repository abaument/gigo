-- A single environment-wide budget cannot fit every account on a shared
-- instance: the one running demonstrations needs a different ceiling from a
-- stranger who just signed up.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "monthly_token_quota" INTEGER;
