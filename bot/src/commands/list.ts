import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import db from '../db/database.js';
import logger from '../utils/logger.js';

interface MessageRow {
  id: number;
  channel_id: string;
  send_times: string;
  content: string | null;
  attachment_url: string | null;
}

export default {
  data: new SlashCommandBuilder()
    .setName('list')
    .setDescription('List all scheduled messages'),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const userId = interaction.user.id;
    db.all(
      `SELECT * FROM messages WHERE user_id = ?`,
      [userId],
      (err: Error | null, rows: MessageRow[]) => {
        if (err || rows.length === 0) {
          void interaction.editReply('No messages scheduled.');
          return;
        }
        logger.info({ command: 'list', userId }, `Listing messages for user ${userId}`);
        const formatted = rows
          .map(
            (r) =>
              `ID: ${r.id}\nChannel: <#${r.channel_id}>\nTimes: ${(JSON.parse(r.send_times) as string[]).join(', ')}\nContent: ${
                r.content ?? '[media only]'
              }\nAttachment: ${r.attachment_url ?? 'None'}\n`,
          )
          .join('\n---\n');

        void interaction.editReply(`**Your Scheduled Messages:**\n\n${formatted}`);
      },
    );
  },
};
