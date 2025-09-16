import { SlashCommandBuilder } from "discord.js";
import db from "../db/database.js";

export default {
  data: new SlashCommandBuilder()
    .setName("edit")
    .setDescription("Edit a scheduled message")
    .addIntegerOption((opt) =>
      opt.setName("id").setDescription("Message ID").setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName("content")
        .setDescription("New message content")
        .setRequired(false)
    )
    .addAttachmentOption((opt) =>
      opt.setName("attachment").setDescription("Optional image/video/gif")
    ),
  async execute(interaction) {
    const { options } = interaction;
    const id = options.getInteger("id");
    const newContent = options.getString("content");
    const newAttachment = options.getAttachment("attachment");
    const userId = interaction.user.id;

    // Fetch the current message first
    db.get(
      `SELECT content, attachment_url FROM messages WHERE id = ? AND user_id = ?`,
      [id, userId],
      (err, row) => {
        if (err || !row) {
          return interaction.editReply(
            "Message not found or you do not have permission to edit this message."
          );
        }

        const updatedContent = newContent !== null ? newContent : row.content;
        const updatedAttachment = newAttachment
          ? newAttachment.url
          : row.attachment_url;

        console.log("Updating message:", id, "by user:", userId);
        console.log("New content:", updatedContent);
        console.log("New attachment:", updatedAttachment);

        db.run(
          `UPDATE messages SET content = ?, attachment_url = ? WHERE id = ? AND user_id = ?`,
          [updatedContent, updatedAttachment, id, userId],
          function (err) {
            if (err || this.changes === 0)
              return interaction.editReply(
                "Failed to update message or no changes made."
              );
            interaction.editReply(`Updated message ${id}`);
          }
        );
      }
    );
  },
};
