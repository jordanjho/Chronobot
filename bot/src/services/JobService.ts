import type { Job } from '@prisma/client';
import type { Client } from 'discord.js';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import { jobRepository, type CreateJobInput } from '../repositories/JobRepository.js';
import { jobQueue } from '../queue/queues.js';
import logger from '../utils/logger.js';

dayjs.extend(utc);

export class JobService {
  async createJob(input: CreateJobInput, _client: Client): Promise<Job> {
    const job = await jobRepository.create(input);

    const now = dayjs.utc();
    for (const isoTime of job.sendTimes) {
      if (dayjs.utc(isoTime).isBefore(now)) continue;

      const delay = dayjs.utc(isoTime).diff(now);
      await jobQueue.add(
        'send',
        { jobId: job.id, channelId: job.channelId, isoTime },
        {
          jobId: `${job.id}:${isoTime}`,
          delay,
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
        },
      );
    }

    logger.info({ jobId: job.id, times: job.sendTimes.length }, 'Job created and enqueued');
    return job;
  }

  async cancelJob(id: string, userId: string): Promise<boolean> {
    const job = await jobRepository.findById(id);
    if (!job || job.userId !== userId) return false;

    // Remove pending BullMQ jobs for each send time
    for (const isoTime of job.sendTimes) {
      const bullmqId = `${id}:${isoTime}`;
      const queued = await jobQueue.getJob(bullmqId);
      if (queued) await queued.remove();
    }

    return jobRepository.delete(id, userId);
  }

  async restoreJobs(_client: Client): Promise<void> {
    const jobs = await jobRepository.findQueued();
    const now = dayjs.utc();
    let enqueued = 0;

    for (const job of jobs) {
      for (const isoTime of job.sendTimes) {
        if (dayjs.utc(isoTime).isBefore(now)) continue;

        const bullmqId = `${job.id}:${isoTime}`;
        const existing = await jobQueue.getJob(bullmqId);
        if (existing) continue;

        const delay = Math.max(0, dayjs.utc(isoTime).diff(now));
        await jobQueue.add(
          'send',
          { jobId: job.id, channelId: job.channelId, isoTime },
          {
            jobId: bullmqId,
            delay,
            attempts: 3,
            backoff: { type: 'exponential', delay: 5000 },
          },
        );
        enqueued++;
      }
    }

    logger.info({ jobsFound: jobs.length, enqueued }, 'Restored jobs to queue');
  }
}

export const jobService = new JobService();
