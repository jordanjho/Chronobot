import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Client } from 'discord.js';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import scheduleMessage from '../scheduler/scheduleMessage.js';
import db from '../db/database.js';
import logger from '../utils/logger.js';

// Bug 3 fix: extend dayjs plugins locally in every file that uses them
dayjs.extend(utc);

const frequencies = ['once', 'daily', 'weekly'] as const;

export default {
  data: new SlashCommandBuilder()
    .setName('schedule')
    .setDescription('Schedule a message')
    .addStringOption((opt) =>
      opt
        .setName('frequency')
        .setDescription('once/daily/weekly')
        .setRequired(true),
    )
    .addStringOption((opt) =>
      opt
        .setName('timestamp')
        .setDescription('Format: YYYY-MM-DD HH:mm (UTC)')
        .setRequired(true),
    )
    .addStringOption((opt) =>
      opt
        .setName('content')
        .setDescription('The message content')
        .setRequired(false),
    )
    .addAttachmentOption((opt) =>
      opt.setName('attachment').setDescription('Optional image/video/gif'),
    ),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const { options } = interaction;
    // The client is available on the interaction for passing to scheduleMessage
    const client = interaction.client as Client;

    const frequency = options.getString('frequency') ?? '';
    const timestamp = options.getString('timestamp') ?? '';
    const content = options.getString('content') ?? '';
    const attachment = options.getAttachment('attachment');
    const userId = interaction.user.id;
    const channelId = interaction.channelId;

    if (!frequencies.includes(frequency as (typeof frequencies)[number])) {
      await interaction.editReply('Invalid frequency. Use once, daily, or weekly.');
      return;
    }

    const baseTime = dayjs.utc(timestamp, 'YYYY-MM-DD HH:mm');
    const now = dayjs.utc();

    logger.info({ command: 'schedule', userId, channelId, timestamp }, `Scheduling message for ${baseTime.format()}`);

    if (!baseTime.isValid() || baseTime.isBefore(now.add(10, 'second'))) {
      logger.warn(
        { command: 'schedule', userId, valid: baseTime.isValid(), beforeNow: baseTime.isBefore(now.add(10, 'second')) },
        'Invalid or past timestamp provided',
      );
      await interaction.editReply('Invalid or distant timestamp. Format: YYYY-MM-DD HH:mm UTC.');
      return;
    }

    db.get(
      `SELECT COUNT(*) as count FROM messages WHERE user_id = ?`,
      [userId],
      (err: Error | null, row: { count: number } | undefined) => {
        if (err) {
          void interaction.editReply('Database error.');
          return;
        }
        if (!row || row.count >= 5) {
          void interaction.editReply('You can only have 5 scheduled messages at a time.');
          return;
        }

        const times: string[] = [];
        if (frequency === 'once') times.push(baseTime.toISOString());
        else if (frequency === 'daily') {
          for (let i = 0; i < 7; i++)
            times.push(baseTime.add(i, 'day').toISOString());
        }
        else if (frequency === 'weekly') {
          for (let i = 0; i < 4; i++)
            times.push(baseTime.add(i, 'week').toISOString());
        }

        const finalContent = content;

        db.run(
          `INSERT INTO messages (channel_id, send_times, content, frequency, attachment_url, user_id) VALUES (?, ?, ?, ?, ?, ?)`,
          [
            channelId,
            JSON.stringify(times),
            finalContent,
            frequency,
            attachment?.url ?? null,
            userId,
          ],
          function(this: { lastID: number }, err: Error | null) {
            if (err) {
              void interaction.editReply('Failed to schedule message: ' + err.message);
              return;
            }
            const newId = this.lastID;
            times.forEach((time) =>
              scheduleMessage(
                client,
                newId,
                channelId,
                time,
                finalContent,
                attachment?.url,
              ),
            );
            logger.info({ command: 'schedule', userId, channelId, messageId: newId }, `Message scheduled with ID ${newId}`);
            void interaction.editReply(`Message scheduled with ID ${newId}`);
          },
        );
      },
    );
  },
};
