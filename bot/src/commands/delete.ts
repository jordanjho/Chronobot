import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import cancelScheduledMessage from '../scheduler/cancel.js';
import { jobRepository } from '../repositories/JobRepository.js';
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

    const deleted = await jobRepository.delete(id, userId);
    if (!deleted) {
      await interaction.editReply(
        'Message not found or you do not have permission to delete this message.',
      );
      return;
    }

    cancelScheduledMessage(id);
    logger.info({ command: 'delete', userId, messageId: id }, `Deleted message ${id}`);
    await interaction.editReply(`Deleted message ${id}`);
  },
};
