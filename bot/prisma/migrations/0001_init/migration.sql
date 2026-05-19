-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'COMPLETED', 'FAILED', 'DEAD');

-- CreateTable
CREATE TABLE "jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "channel_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "frequency" TEXT NOT NULL,
    "send_times" TEXT[],
    "attachment_url" TEXT,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "jobs_user_id_idx" ON "jobs"("user_id");
