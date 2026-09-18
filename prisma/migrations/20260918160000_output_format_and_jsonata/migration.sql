-- Output format at the edges (the engine keeps reasoning in JSON) and an
-- optional deterministic mapping that replaces the model call when enabled.
ALTER TABLE "adapters"
  ADD COLUMN IF NOT EXISTS "output_format" TEXT NOT NULL DEFAULT 'json',
  ADD COLUMN IF NOT EXISTS "jsonata_expression" TEXT,
  ADD COLUMN IF NOT EXISTS "jsonata_enabled" BOOLEAN NOT NULL DEFAULT false;

-- Guard the enum-like column at the database level: a bad value would only
-- surface at serialisation time otherwise.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'adapters_output_format_check'
  ) THEN
    ALTER TABLE "adapters"
      ADD CONSTRAINT "adapters_output_format_check"
      CHECK ("output_format" IN ('json', 'xml', 'csv'));
  END IF;
END $$;
