import { Worker } from 'bullmq';
import type { Client } from 'discord.js';
import { config } from '../config.js';
import { DiscordAdapter } from '../adapters/DiscordAdapter.js';
import { jobRepository } from '../repositories/JobRepository.js';
import { executionRepository } from '../repositories/ExecutionRepository.js';
import type { QueuedJobData } from '../queue/jobTypes.js';
import logger from '../utils/logger.js';

export function createWorker(client: Client): Worker<QueuedJobData> {
  const adapter = new DiscordAdapter(client);
  const connection = { url: config.REDIS_URL };

  const worker = new Worker<QueuedJobData>(
    'jobs',
    async (job) => {
      const { jobId, channelId, isoTime } = job.data;
      const bullmqId = job.id!;

      logger.info({ jobId, bullmqJobId: bullmqId, attempt: job.attemptsMade + 1 }, 'Processing job');

      // Idempotency guard: skip if already COMPLETED for this bullmqJobId
      const existing = await executionRepository.findByBullmqJobId(bullmqId);
      if (existing?.status === 'COMPLETED') {
        logger.info({ jobId, bullmqJobId: bullmqId }, 'Duplicate delivery — skipping (already completed)');
        return;
      }

      const execution = await executionRepository.create(jobId, job.attemptsMade + 1, bullmqId);

      const result = await adapter.execute({ jobId, channelId, isoTime });

      if (!result.success) {
        await executionRepository.fail(execution.id, result.error ?? 'Unknown error');
        throw new Error(result.error ?? 'Adapter execution failed');
      }

      await executionRepository.complete(execution.id);

      // Update remaining send times
      const dbJob = await jobRepository.findById(jobId);
      if (dbJob) {
        const remaining = dbJob.sendTimes.filter((t) => t !== isoTime);
        if (remaining.length === 0) {
          await jobRepository.hardDelete(jobId);
        }
        else {
          await jobRepository.updateSendTimes(jobId, remaining);
        }
      }

      logger.info({ jobId, isoTime }, 'Job processed successfully');
    },
    {
      connection,
      concurrency: 5,
    },
  );

  worker.on('failed', async (job, err) => {
    if (!job) return;
    const { jobId } = job.data;
    if (job.attemptsMade >= (job.opts.attempts ?? 3)) {
      await jobRepository.markDead(jobId);
      logger.error({ jobId, error: err.message }, 'Job exhausted retries — marked DEAD');
    }
    else {
      logger.warn({ jobId, attempt: job.attemptsMade, error: err.message }, 'Job attempt failed, will retry');
    }
  });

  worker.on('error', (err) => {
    logger.error({ error: err.message }, 'Worker error');
  });

  return worker;
}
