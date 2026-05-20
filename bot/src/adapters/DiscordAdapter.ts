import type { Client, TextChannel, NewsChannel, ThreadChannel } from 'discord.js';
import type { Adapter, ExecutionResult } from './Adapter.js';
import type { JobPayload } from '../queue/jobTypes.js';
import { jobRepository } from '../repositories/JobRepository.js';
import logger from '../utils/logger.js';

export class DiscordAdapter implements Adapter {
  constructor(private readonly client: Client) {}

  async execute(payload: JobPayload): Promise<ExecutionResult> {
    const { jobId, channelId } = payload;

    const job = await jobRepository.findById(jobId);
    if (!job) {
      return { success: false, error: `Job ${jobId} not found` };
    }

    let channel;
    try {
      channel = await this.client.channels.fetch(channelId);
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to fetch channel';
      logger.error({ jobId, channelId, error }, 'Failed to fetch Discord channel');
      return { success: false, error };
    }

    const sendable = channel as TextChannel | NewsChannel | ThreadChannel | null;
    if (!sendable || !('send' in sendable)) {
      return { success: false, error: `Channel ${channelId} is not sendable` };
    }

    const msgPayload: { content: string; files?: string[] } = { content: job.content };
    if (job.attachmentUrl) msgPayload.files = [job.attachmentUrl];

    try {
      const message = await sendable.send(msgPayload);
      logger.info({ jobId, channelId, messageId: message.id }, 'Discord message sent');
      return { success: true, messageId: message.id };
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to send message';
      logger.error({ jobId, channelId, error }, 'Failed to send Discord message');
      return { success: false, error };
    }
  }
}
