import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import { jobRepository } from '../repositories/JobRepository.js';
import logger from '../utils/logger.js';

dayjs.extend(utc);

export default {
  data: new SlashCommandBuilder()
    .setName('list')
    .setDescription('List all scheduled messages'),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const userId = interaction.user.id;
    const now = dayjs.utc();
    const queued = await jobRepository.findQueuedByUserId(userId);
    const rows = queued.filter((r) => r.sendTimes.some((t) => dayjs.utc(t).isAfter(now)));

    if (rows.length === 0) {
      await interaction.editReply('No messages scheduled.');
      return;
    }

    logger.info({ command: 'list', userId }, `Listing messages for user ${userId}`);

    const formatted = rows
      .map((r) => {
        const futureTimes = r.sendTimes.filter((t) => dayjs.utc(t).isAfter(now));
        return `ID: ${r.id}\nChannel: <#${r.channelId}>\nTimes: ${futureTimes.join(', ')}\nContent: ${
          r.content || '[media only]'
        }\nAttachment: ${r.attachmentUrl ?? 'None'}\n`;
      })
      .join('\n---\n');

    await interaction.editReply(`**Your Scheduled Messages:**\n\n${formatted}`);
  },
};
