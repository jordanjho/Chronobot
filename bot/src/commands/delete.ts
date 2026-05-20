import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import { jobService } from '../services/JobService.js';
import logger from '../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('delete')
    .setDescription('Delete a scheduled message')
    .addStringOption((opt) =>
      opt.setName('id').setDescription('Message ID').setRequired(true),
    ),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const { options } = interaction;

    const id = options.getString('id') ?? '';
    const userId = interaction.user.id;

    const deleted = await jobService.cancelJob(id, userId);
    if (!deleted) {
      await interaction.editReply(
        'Message not found or you do not have permission to delete this message.',
      );
      return;
    }

    logger.info({ command: 'delete', userId, messageId: id }, `Deleted message ${id}`);
    await interaction.editReply(`Deleted message ${id}`);
  },
};
