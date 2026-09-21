-- Keep what the caller actually sent: a log that only shows the converted JSON
-- hides the very thing multi-format input is about.
ALTER TABLE "transformation_logs"
  ADD COLUMN IF NOT EXISTS "input_format" TEXT,
  ADD COLUMN IF NOT EXISTS "input_raw" TEXT;
