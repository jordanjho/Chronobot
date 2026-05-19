import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import { jobRepository } from '../repositories/JobRepository.js';
import logger from '../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('edit')
    .setDescription('Edit a scheduled message')
    .addStringOption((opt) =>
      opt.setName('id').setDescription('Message ID').setRequired(true),
    )
    .addStringOption((opt) =>
      opt
        .setName('content')
        .setDescription('New message content')
        .setRequired(false),
    )
    .addAttachmentOption((opt) =>
      opt.setName('attachment').setDescription('Optional image/video/gif'),
    ),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const { options } = interaction;
    const id = options.getString('id') ?? '';
    const newContent = options.getString('content');
    const newAttachment = options.getAttachment('attachment');
    const userId = interaction.user.id;

    // Fetch the current job first to get existing values
    const existing = await jobRepository.findById(id);
    if (!existing || existing.userId !== userId) {
      await interaction.editReply(
        'Message not found or you do not have permission to edit this message.',
      );
      return;
    }

    const updatedContent = newContent !== null ? newContent : existing.content;
    const updatedAttachment = newAttachment ? newAttachment.url : existing.attachmentUrl;

    logger.info({ command: 'edit', userId, messageId: id, updatedContent, updatedAttachment }, `Updating message ${id} by user ${userId}`);

    const updated = await jobRepository.updateContent(id, userId, updatedContent, updatedAttachment ?? null);
    if (!updated) {
      await interaction.editReply('Failed to update message or no changes made.');
      return;
    }

    await interaction.editReply(`Updated message ${id}`);
  },
};
