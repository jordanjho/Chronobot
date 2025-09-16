import { SlashCommandBuilder } from "discord.js";
import dayjs from "dayjs";
import scheduleMessage from "../scheduler/scheduleMessage.js"
import db from "../db/database.js";

const frequencies = ["once", "daily", "weekly"];

export default {
  data: new SlashCommandBuilder()
    .setName("schedule")
    .setDescription("Schedule a message")
    .addStringOption((opt) =>
      opt
        .setName("frequency")
        .setDescription("once/daily/weekly")
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName("timestamp")
        .setDescription("Format: YYYY-MM-DD HH:mm (UTC)")
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName("content")
        .setDescription("The message content")
        .setRequired(false)
    )
    .addAttachmentOption((opt) =>
      opt.setName("attachment").setDescription("Optional image/video/gif")
    ),
  async execute(interaction) {
    const { options } = interaction;

    const frequency = options.getString("frequency");
    const timestamp = options.getString("timestamp");
    const content = options.getString("content") || "";
    const attachment = options.getAttachment("attachment");
    const userId = interaction.user.id;
    const channelId = interaction.channelId;

    if (!frequencies.includes(frequency)) {
      return interaction.editReply(
        "Invalid frequency. Use once, daily, or weekly."
      );
    }

    const baseTime = dayjs.utc(timestamp, "YYYY-MM-DD HH:mm");
    const now = dayjs.utc();

    console.log(`Scheduling message for ${baseTime.format()}`);
    console.log(`Current time is ${now.format()}`);
    if (!baseTime.isValid() || baseTime.isBefore(now.add(10, "second"))) {
      console.log(
        `Valid: ${baseTime.isValid()}, Before now: ${baseTime.isBefore(
          now.add(10, "second")
        )}`
      );
      return interaction.editReply(
        "Invalid or distant timestamp. Format: YYYY-MM-DD HH:mm UTC."
      );
    }

    db.get(
      `SELECT COUNT(*) as count FROM messages WHERE user_id = ?`,
      [userId],
      (err, row) => {
        if (err) return interaction.editReply("Database error.");
        if (row.count >= 5) {
          return interaction.editReply(
            "You can only have 5 scheduled messages at a time."
          );
        }

        let times = [];
        if (frequency === "once") times.push(baseTime.toISOString());
        else if (frequency === "daily") {
          for (let i = 0; i < 7; i++)
            times.push(baseTime.add(i, "day").toISOString());
        } else if (frequency === "weekly") {
          for (let i = 0; i < 4; i++)
            times.push(baseTime.add(i, "week").toISOString());
        }

        let finalContent = content;

        db.run(
          `INSERT INTO messages (channel_id, send_times, content, frequency, attachment_url, user_id) VALUES (?, ?, ?, ?, ?, ?)`,
          [
            channelId,
            JSON.stringify(times),
            finalContent,
            frequency,
            attachment?.url || null,
            userId,
          ],
          function (err) {
            if (err)
              return interaction.editReply(
                "Failed to schedule message: " + err.message
              );
            times.forEach((time) =>
              scheduleMessage(
                this.lastID,
                channelId,
                time,
                finalContent,
                attachment?.url,
                userId
              )
            );
            interaction.editReply(`Message scheduled with ID ${this.lastID}`);
          }
        );
      }
    );
  },
};
