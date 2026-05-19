import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import cancelScheduledMessage from '../scheduler/cancel.js';
import db from '../db/database.js';
import logger from '../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('delete')
    .setDescription('Delete a scheduled message')
    .addIntegerOption((opt) =>
      opt.setName('id').setDescription('Message ID').setRequired(true),
    ),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const { options } = interaction;

    const id = options.getInteger('id') ?? 0;
    const userId = interaction.user.id;
    db.run(
      `DELETE FROM messages WHERE id = ? AND user_id = ?`,
      [id, userId],
      function(this: { changes: number }, err: Error | null) {
        if (err || this.changes === 0) {
          void interaction.editReply(
            'Message not found or you do not have permission to delete this message.',
          );
          return;
        }
        cancelScheduledMessage(id);
        logger.info({ command: 'delete', userId, messageId: id }, `Deleted message ${id}`);
        void interaction.editReply(`Deleted message ${id}`);
      },
    );
  },
};
