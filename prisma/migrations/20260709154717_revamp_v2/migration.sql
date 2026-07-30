-- AlterTable
ALTER TABLE "adapters" ADD COLUMN     "forward_timeout_ms" INTEGER NOT NULL DEFAULT 15000,
ADD COLUMN     "model_name" TEXT,
ADD COLUMN     "model_provider" TEXT NOT NULL DEFAULT 'openai',
ADD COLUMN     "rate_limit_per_min" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "webhook_secret" TEXT;

-- AlterTable
ALTER TABLE "transformation_logs" ADD COLUMN     "input_tokens" INTEGER,
ADD COLUMN     "is_test" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "model_name" TEXT,
ADD COLUMN     "output_tokens" INTEGER,
ADD COLUMN     "provider" TEXT,
ADD COLUMN     "replay_of_id" UUID;

-- CreateTable
CREATE TABLE "rate_limit_windows" (
    "id" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_limit_windows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rate_limit_windows_expires_at_idx" ON "rate_limit_windows"("expires_at");

-- CreateIndex
CREATE INDEX "transformation_logs_adapter_id_created_at_idx" ON "transformation_logs"("adapter_id", "created_at");

-- AddForeignKey
ALTER TABLE "transformation_logs" ADD CONSTRAINT "transformation_logs_replay_of_id_fkey" FOREIGN KEY ("replay_of_id") REFERENCES "transformation_logs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

