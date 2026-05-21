-- Add bullmq_job_id to executions for idempotency guard
ALTER TABLE "executions" ADD COLUMN "bullmq_job_id" TEXT;

-- Backfill existing rows (pre-idempotency rows get their own UUID as placeholder)
UPDATE "executions" SET "bullmq_job_id" = "id"::text WHERE "bullmq_job_id" IS NULL;

-- Enforce NOT NULL and uniqueness
ALTER TABLE "executions" ALTER COLUMN "bullmq_job_id" SET NOT NULL;
CREATE UNIQUE INDEX "executions_bullmq_job_id_key" ON "executions"("bullmq_job_id");
