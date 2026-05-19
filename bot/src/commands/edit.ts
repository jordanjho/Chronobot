import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import db from '../db/database.js';
import logger from '../utils/logger.js';

interface MessageRow {
  content: string;
  attachment_url: string | null;
}

export default {
  data: new SlashCommandBuilder()
    .setName('edit')
    .setDescription('Edit a scheduled message')
    .addIntegerOption((opt) =>
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
    const id = options.getInteger('id') ?? 0;
    const newContent = options.getString('content');
    const newAttachment = options.getAttachment('attachment');
    const userId = interaction.user.id;

    // Fetch the current message first
    db.get(
      `SELECT content, attachment_url FROM messages WHERE id = ? AND user_id = ?`,
      [id, userId],
      (err: Error | null, row: MessageRow | undefined) => {
        if (err || !row) {
          void interaction.editReply(
            'Message not found or you do not have permission to edit this message.',
          );
          return;
        }

        const updatedContent = newContent !== null ? newContent : row.content;
        const updatedAttachment = newAttachment
          ? newAttachment.url
          : row.attachment_url;

        logger.info({ command: 'edit', userId, messageId: id, updatedContent, updatedAttachment }, `Updating message ${id} by user ${userId}`);

        db.run(
          `UPDATE messages SET content = ?, attachment_url = ? WHERE id = ? AND user_id = ?`,
          [updatedContent, updatedAttachment, id, userId],
          function(this: { changes: number }, err: Error | null) {
            if (err || this.changes === 0) {
              void interaction.editReply(
                'Failed to update message or no changes made.',
              );
              return;
            }
            void interaction.editReply(`Updated message ${id}`);
          },
        );
      },
    );
  },
};
