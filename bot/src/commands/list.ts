import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import { jobRepository } from '../repositories/JobRepository.js';
import logger from '../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('list')
    .setDescription('List all scheduled messages'),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const userId = interaction.user.id;
    const rows = await jobRepository.findAllByUserId(userId);

    if (rows.length === 0) {
      await interaction.editReply('No messages scheduled.');
      return;
    }

    logger.info({ command: 'list', userId }, `Listing messages for user ${userId}`);

    const formatted = rows
      .map(
        (r) =>
          `ID: ${r.id}\nChannel: <#${r.channelId}>\nTimes: ${r.sendTimes.join(', ')}\nContent: ${
            r.content || '[media only]'
          }\nAttachment: ${r.attachmentUrl ?? 'None'}\n`,
      )
      .join('\n---\n');

    await interaction.editReply(`**Your Scheduled Messages:**\n\n${formatted}`);
  },
};
