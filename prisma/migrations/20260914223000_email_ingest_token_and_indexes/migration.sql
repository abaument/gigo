-- Email ingress becomes opt-in per adapter: the plus-address must carry
-- this token, so a leaked adapter UUID alone cannot inject data by email.
ALTER TABLE "adapters" ADD COLUMN "email_ingest_token" TEXT;

-- Self-referential FK replay_of_id had no index: adapter/log deletions
-- trigger a full-table scan per SetNull cascade.
CREATE INDEX "transformation_logs_replay_of_id_idx" ON "transformation_logs"("replay_of_id");
