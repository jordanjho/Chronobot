-- DropForeignKey
ALTER TABLE "executions" DROP CONSTRAINT "executions_job_id_fkey";

-- AddForeignKey with cascade so deleting a job removes its execution history
ALTER TABLE "executions" ADD CONSTRAINT "executions_job_id_fkey"
  FOREIGN KEY ("job_id") REFERENCES "jobs"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
