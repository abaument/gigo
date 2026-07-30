-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "avatar_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adapters" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "target_schema" TEXT NOT NULL,
    "schema_source_type" TEXT,
    "schema_source_url" TEXT,
    "destination_url" TEXT,
    "destination_method" TEXT NOT NULL DEFAULT 'POST',
    "auth_method" TEXT NOT NULL DEFAULT 'none',
    "auth_header_name" TEXT,
    "encrypted_auth_value" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "adapters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transformation_logs" (
    "id" UUID NOT NULL,
    "adapter_id" UUID NOT NULL,
    "input_json" TEXT NOT NULL,
    "output_json" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "forwarded_at" TIMESTAMP(3),
    "forwarding_success" BOOLEAN,
    "forwarding_response" TEXT,
    "forwarding_status" INTEGER,
    "transform_duration" INTEGER,
    "forward_duration" INTEGER,
    "total_duration" INTEGER,
    "source_ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transformation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_records" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "transformation_count" INTEGER NOT NULL DEFAULT 0,
    "forwarding_count" INTEGER NOT NULL DEFAULT 0,
    "tokens_used" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usage_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "adapters_user_id_idx" ON "adapters"("user_id");

-- CreateIndex
CREATE INDEX "adapters_created_at_idx" ON "adapters"("created_at");

-- CreateIndex
CREATE INDEX "transformation_logs_adapter_id_idx" ON "transformation_logs"("adapter_id");

-- CreateIndex
CREATE INDEX "transformation_logs_created_at_idx" ON "transformation_logs"("created_at");

-- CreateIndex
CREATE INDEX "transformation_logs_success_idx" ON "transformation_logs"("success");

-- CreateIndex
CREATE INDEX "usage_records_user_id_idx" ON "usage_records"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "usage_records_user_id_year_month_key" ON "usage_records"("user_id", "year", "month");

-- AddForeignKey
ALTER TABLE "adapters" ADD CONSTRAINT "adapters_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transformation_logs" ADD CONSTRAINT "transformation_logs_adapter_id_fkey" FOREIGN KEY ("adapter_id") REFERENCES "adapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

