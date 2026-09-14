-- Lock down the Supabase Data API (PostgREST).
--
-- All data access in GIGO goes through Prisma, connected as the table
-- owner (which bypasses non-FORCED RLS); supabase-js is only used for
-- Auth. Enabling RLS with no policies therefore denies everything to the
-- `anon` / `authenticated` REST roles without affecting the app.
-- Without this, the public anon key could read every table (adapters
-- with webhook secrets, logs, encrypted user API keys).

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "adapters" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "transformation_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "usage_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rate_limit_windows" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_api_keys" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;

-- Belt and braces on Supabase: also revoke the default table grants from
-- the REST roles, and stop future tables from receiving them. Guarded so
-- the migration stays portable to plain Postgres (docker-compose), where
-- these roles don't exist.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM authenticated;
  END IF;
END $$;
