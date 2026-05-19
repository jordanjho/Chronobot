import type { Client } from 'discord.js';
import scheduleMessage from './scheduleMessage.js';
import { jobRepository } from '../repositories/JobRepository.js';
import logger from '../utils/logger.js';

export default async function restoreScheduledMessages(client: Client): Promise<void> {
  try {
    const jobs = await jobRepository.findAll();
    const queuedJobs = jobs.filter((job) => job.status === 'QUEUED');

    for (const job of queuedJobs) {
      job.sendTimes.forEach((time) => {
        // Bug 1 fix: skip times already in the past
        if (new Date(time) <= new Date()) return;
        scheduleMessage(
          client,
          job.id,
          job.channelId,
          time,
          job.content,
          job.attachmentUrl,
        );
      });
    }
  }
  catch (err) {
    logger.error({ err }, 'Failed to restore messages');
  }
}
