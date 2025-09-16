import { SlashCommandBuilder } from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Show all commands"),
  async execute(interaction) {
    interaction.editReply(`**Chronobot Commands:**

/schedule <frequency> <timestamp> <content> [attachment] – Schedule a message. Frequency: once, daily, weekly. Timestamp format: YYYY-MM-DD HH:mm (UTC).
/list – List all scheduled messages.
/edit <id> <content> – Edit a message’s content.
/delete <id> – Delete a scheduled message.
/help – Show this help message.`);
  },
};
