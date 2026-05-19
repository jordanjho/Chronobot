import type { Client } from 'discord.js';
import scheduleMessage from './scheduleMessage.js';
import db from '../db/database.js';
import logger from '../utils/logger.js';

interface MessageRow {
  id: number;
  channel_id: string;
  send_times: string;
  content: string;
  frequency: string;
  attachment_url: string | null;
  user_id: string;
}

export default function restoreScheduledMessages(client: Client): void {
  db.all(`SELECT * FROM messages`, [], (err: Error | null, rows: MessageRow[]) => {
    if (err) {
      logger.error({ err }, 'Failed to restore messages');
      return;
    }
    for (const row of rows) {
      const times: string[] = JSON.parse(row.send_times) as string[];
      times.forEach((time) => {
        // Bug 1 fix: skip times already in the past
        if (new Date(time) <= new Date()) return;
        scheduleMessage(
          client,
          row.id,
          row.channel_id,
          time,
          row.content,
          row.attachment_url,
        );
      });
    }
  });
}
