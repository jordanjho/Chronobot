import schedule from 'node-schedule';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter.js';
import type { Client, TextChannel, NewsChannel, ThreadChannel } from 'discord.js';
import db from '../db/database.js';
import logger from '../utils/logger.js';

dayjs.extend(utc);
dayjs.extend(isSameOrAfter);

export default function scheduleMessage(
  client: Client,
  id: number,
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
      // Fetch the latest content and attachment from the DB
      db.get(
        `SELECT content, attachment_url FROM messages WHERE id = ?`,
        [id],
        async (err: Error | null, row: { content: string; attachment_url: string | null } | undefined) => {
          if (err || !row) return;
          const channel = await client.channels.fetch(channelId);
          // PartialGroupDMChannel does not have .send(); cast to a known sendable type
          const sendable = channel as TextChannel | NewsChannel | ThreadChannel | null;
          if (sendable && 'send' in sendable) {
            const payload: { content: string; files?: string[] } = { content: row.content };
            if (row.attachment_url) payload.files = [row.attachment_url];
            await sendable.send(payload);
          }
        },
      );
    }
    catch (err) {
      logger.error({ err, jobId: `${id}-${isoTime}`, channelId }, `Failed to send scheduled message ${id}`);
    }

    db.get(`SELECT send_times FROM messages WHERE id = ?`, [id], (err: Error | null, row: { send_times: string } | undefined) => {
      if (err || !row) return;
      let times: string[] = JSON.parse(row.send_times) as string[];
      times = times.filter((t) => t !== isoTime);
      if (times.length === 0) db.run(`DELETE FROM messages WHERE id = ?`, [id]);
      else
        db.run(`UPDATE messages SET send_times = ? WHERE id = ?`, [
          JSON.stringify(times),
          id,
        ]);
    });
  });
}
