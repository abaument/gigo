-- Learning loop: per-adapter curated knowledge (validated examples and
-- learned pitfalls) injected into subsequent transformation prompts.

-- AlterTable
ALTER TABLE "adapters" ADD COLUMN "learning_enabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "adapter_learnings" (
    "id" UUID NOT NULL,
    "adapter_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "input_json" TEXT,
    "output_json" TEXT,
    "note" TEXT,
    "source" TEXT NOT NULL DEFAULT 'auto',
    "content_hash" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "adapter_learnings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "adapter_learnings_adapter_id_kind_idx" ON "adapter_learnings"("adapter_id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "adapter_learnings_adapter_id_content_hash_key" ON "adapter_learnings"("adapter_id", "content_hash");

-- AddForeignKey
ALTER TABLE "adapter_learnings" ADD CONSTRAINT "adapter_learnings_adapter_id_fkey" FOREIGN KEY ("adapter_id") REFERENCES "adapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Same posture as the rest of the schema: the Supabase Data API must not
-- see this table (owner-only access through Prisma).
ALTER TABLE "adapter_learnings" ENABLE ROW LEVEL SECURITY;
