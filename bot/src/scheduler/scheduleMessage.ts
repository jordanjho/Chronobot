import schedule from 'node-schedule';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter.js';
import type { Client, TextChannel, NewsChannel, ThreadChannel } from 'discord.js';
import { jobRepository } from '../repositories/JobRepository.js';
import logger from '../utils/logger.js';

dayjs.extend(utc);
dayjs.extend(isSameOrAfter);

export default function scheduleMessage(
  client: Client,
  id: string,
  channelId: string,
  isoTime: string,
  // content and attachmentUrl are intentionally unused here — the job always
  // re-fetches them from the DB at send time so edits are reflected.
  _content: string,
  _attachmentUrl?: string | null,
): void {
  const date = new Date(isoTime);
  schedule.scheduleJob(`${id}-${isoTime}`, date, async () => {
    try {
      const job = await jobRepository.findById(id);
      if (!job) return;

      const channel = await client.channels.fetch(channelId);
      // PartialGroupDMChannel does not have .send(); cast to a known sendable type
      const sendable = channel as TextChannel | NewsChannel | ThreadChannel | null;
      if (sendable && 'send' in sendable) {
        const payload: { content: string; files?: string[] } = { content: job.content };
        if (job.attachmentUrl) payload.files = [job.attachmentUrl];
        await sendable.send(payload);
      }

      const remaining = job.sendTimes.filter((t) => t !== isoTime);
      if (remaining.length === 0) {
        await jobRepository.markCompleted(id);
      }
      else {
        await jobRepository.updateSendTimes(id, remaining);
      }
    }
    catch (err) {
      logger.error({ err, jobId: `${id}-${isoTime}`, channelId }, `Failed to send scheduled message ${id}`);
    }
  });
}
