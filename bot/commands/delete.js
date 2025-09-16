import { SlashCommandBuilder } from "discord.js";
import cancelScheduledMessage from "../scheduler/cancel.js";
import db from "../db/database.js";

export default {
  data: new SlashCommandBuilder()
    .setName("delete")
    .setDescription("Delete a scheduled message")
    .addIntegerOption((opt) =>
      opt.setName("id").setDescription("Message ID").setRequired(true)
    ),
  async execute(interaction) {
    const { options } = interaction;

    const id = options.getInteger("id");
    const userId = interaction.user.id;
    db.run(
      `DELETE FROM messages WHERE id = ? AND user_id = ?`,
      [id, userId],
      function (err) {
        if (err || this.changes === 0)
          return interaction.editReply(
            "Message not found or you do not have permission to delete this message."
          );
        cancelScheduledMessage(id);
        interaction.editReply(`Deleted message ${id}`);
      }
    );
  },
};
