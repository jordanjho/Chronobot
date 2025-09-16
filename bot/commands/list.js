import { SlashCommandBuilder } from "discord.js";
import db from "../db/database.js";

export default {
  data: new SlashCommandBuilder()
    .setName("list")
    .setDescription("List all scheduled messages"),
  async execute(interaction) {
    const userId = interaction.user.id;
    db.all(
      `SELECT * FROM messages WHERE user_id = ?`,
      [userId],
      (err, rows) => {
        if (err || rows.length === 0)
          return interaction.editReply("No messages scheduled.");
        console.log("Listing messages for user:", userId);
        const formatted = rows
          .map(
            (r) =>
              `ID: ${r.id}\nChannel: <#${r.channel_id}>\nTimes: ${JSON.parse(
                r.send_times
              ).join(", ")}\nContent: ${
                r.content || "[media only]"
              }\nAttachment: ${r.attachment_url || "None"}\n`
          )
          .join("\n---\n");

        interaction.editReply(`**Your Scheduled Messages:**\n\n${formatted}`);
      }
    );
  },
};
