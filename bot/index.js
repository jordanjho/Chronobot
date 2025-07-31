import {
  Client,
  GatewayIntentBits,
  Partials,
  Routes,
  SlashCommandBuilder,
  REST,
  AttachmentBuilder,
} from "discord.js";
import schedule from "node-schedule";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter.js";
import sqlite3 from "sqlite3";
import dotenv from "dotenv";
dotenv.config({ path: ".env" });

const { token, clientId, guildId } = process.env;

dayjs.extend(utc);
dayjs.extend(isSameOrAfter);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Channel],
});

const db = new sqlite3.Database("../shared/messages.db");

const frequencies = ["once", "daily", "weekly"];

const commands = [
  new SlashCommandBuilder()
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

  new SlashCommandBuilder()
    .setName("list")
    .setDescription("List all scheduled messages"),

  new SlashCommandBuilder()
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

  new SlashCommandBuilder()
    .setName("delete")
    .setDescription("Delete a scheduled message")
    .addIntegerOption((opt) =>
      opt.setName("id").setDescription("Message ID").setRequired(true)
    ),

  new SlashCommandBuilder().setName("help").setDescription("Show all commands"),
];

const rest = new REST({ version: "10" }).setToken(token);

(async () => {
  try {
    console.log("Registering slash commands...");
    if (guildId) {
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
        body: commands,
      });
      console.log(`Registered commands for guild ${guildId}`);
    } else {
      await rest.put(Routes.applicationCommands(clientId), { body: commands });
      console.log(`Registered global commands`);
    }
  } catch (error) {
    console.error(error);
  }
})();

client.once("ready", () => {
  console.log(`Chronobot is online as ${client.user.tag}`);
  db.run(
    `CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id TEXT,
    send_times TEXT,
    content TEXT,
    frequency TEXT,
    attachment_url TEXT,
    user_id TEXT
  )`,
    restoreScheduledMessages
  );

  /*
    db.run(`ALTER TABLE messages ADD COLUMN attachment_url TEXT`, err => {
    if (err && !err.message.includes("duplicate column")) {
      console.error("Failed to add attachment_url column:", err.message);
    }
  });
  
  db.run(`ALTER TABLE messages ADD COLUMN user_id TEXT`, (err) => {
    if (err && !err.message.includes("duplicate column")) {
      console.error("Failed to add user_id column:", err.message);
    }
  });
  */

  db.run(`CREATE INDEX IF NOT EXISTS idx_user_id ON messages(user_id)`);
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  await interaction.deferReply({ flags: 64 });
  const { commandName, options } = interaction;

  if (commandName === "schedule") {
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
        // if (row.count >= 5) {
        //   return interaction.editReply(
        //     "You can only have 5 scheduled messages at a time."
        //   );
        // }

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
  } else if (commandName === "list") {
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
  } else if (commandName === "delete") {
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
  } else if (commandName === "edit") {
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
  } else if (commandName === "help") {
    interaction.editReply(`**Chronobot Commands:**

/schedule <frequency> <timestamp> <content> [attachment] – Schedule a message. Frequency: once, daily, weekly. Timestamp format: YYYY-MM-DD HH:mm (UTC).
/list – List all scheduled messages.
/edit <id> <content> – Edit a message’s content.
/delete <id> – Delete a scheduled message.
/help – Show this help message.`);
  }
});

function scheduleMessage(id, channelId, isoTime, content, attachmentUrl) {
  const date = new Date(isoTime);
  schedule.scheduleJob(`${id}-${isoTime}`, date, async () => {
    try {
      // Fetch the latest content and attachment from the DB
      db.get(
        `SELECT content, attachment_url FROM messages WHERE id = ?`,
        [id],
        async (err, row) => {
          if (err || !row) return;
          const channel = await client.channels.fetch(channelId);
          if (channel) {
            const payload = { content: row.content };
            if (row.attachment_url) payload.files = [row.attachment_url];
            await channel.send(payload);
          }
        }
      );
    } catch (err) {
      console.error(`Failed to send scheduled message ${id}:`, err);
    }

    db.get(`SELECT send_times FROM messages WHERE id = ?`, [id], (err, row) => {
      if (err || !row) return;
      let times = JSON.parse(row.send_times);
      times = times.filter((t) => t !== isoTime);
      if (times.length === 0) db.run(`DELETE FROM messages WHERE id = ?`, [id]);
      else
        db.run(`UPDATE messages SET send_times = ? WHERE id = ?`, [
          JSON.stringify(times),
          id,
        ]);
    });
  });
}

function restoreScheduledMessages() {
  db.all(`SELECT * FROM messages`, [], (err, rows) => {
    if (err) return console.error("Failed to restore messages:", err);
    for (const row of rows) {
      const times = JSON.parse(row.send_times);
      times.forEach((time) =>
        scheduleMessage(
          row.id,
          row.channel_id,
          time,
          row.content,
          row.attachment_url
        )
      );
    }
  });
}

function cancelScheduledMessage(id) {
  const jobs = schedule.scheduledJobs;
  Object.keys(jobs).forEach((key) => {
    if (key.startsWith(`${id}-`)) jobs[key].cancel();
  });
}

client.login(token);
/*
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const schedule = require('node-schedule');
const dayjs = require('dayjs');
const sqlite3 = require('sqlite3').verbose();
const { token } = require("./config.json");

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Channel],
});

const db = new sqlite3.Database('./schedule.db');

db.run(`CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id TEXT,
  send_time TEXT,
  content TEXT
)`);

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  restoreScheduledMessages();
});

client.on('messageCreate', async (msg) => {
  if (msg.content.startsWith('!schedule')) {
    const args = msg.content.split(' ');
    const time = args[1]; // Format: YYYY-MM-DD_HH:mm
    const content = args.slice(2).join(' ');
    const sendTime = dayjs(time.replace('_', ' '));

    if (!sendTime.isValid()) {
      return msg.reply('Invalid time format. Use `YYYY-MM-DD_HH:mm`');
    }

    db.run(
      `INSERT INTO messages (channel_id, send_time, content) VALUES (?, ?, ?)`,
      [msg.channel.id, sendTime.toISOString(), content],
      function (err) {
        if (err) return msg.reply('Error saving message.');
        scheduleMessage(this.lastID, msg.channel.id, sendTime.toDate(), content);
        msg.reply(`Scheduled message #${this.lastID} for ${sendTime.format('YYYY-MM-DD HH:mm')}`);
      }
    );
  }
});

function scheduleMessage(id, channelId, date, content) {
  schedule.scheduleJob(`msg-${id}`, date, async () => {
    const channel = await client.channels.fetch(channelId);
    if (channel) channel.send(content);

    // Remove from DB after sending
    db.run(`DELETE FROM messages WHERE id = ?`, [id]);
  });
}

function restoreScheduledMessages() {
  db.all(`SELECT * FROM messages`, [], (err, rows) => {
    if (err) return console.error(err);
    for (const row of rows) {
      const date = new Date(row.send_time);
      if (date > new Date()) {
        scheduleMessage(row.id, row.channel_id, date, row.content);
      }
    }
  });
}
  */

/*
const fs = require("node:fs");
const path = require("node:path");
const { Client, Collection, GatewayIntentBits } = require("discord.js");
const schedule = require("node-schedule");
const dayjs = require("dayjs");
const sqlite3 = require("sqlite3").verbose();

const { token } = require("./config.json");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

const db = new sqlite3.Database('./schedule.db');

db.run(`CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id TEXT,
  send_time TEXT,
  content TEXT
)`);


client.cooldowns = new Collection();
client.commands = new Collection();
const foldersPath = path.join(__dirname, "commands");
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
  const commandsPath = path.join(foldersPath, folder);
  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file) => file.endsWith(".js"));
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ("data" in command && "execute" in command) {
      client.commands.set(command.data.name, command);
    } else {
      console.log(
        `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`
      );
    }
  }
}

const eventsPath = path.join(__dirname, "events");
const eventFiles = fs
  .readdirSync(eventsPath)
  .filter((file) => file.endsWith(".js"));

for (const file of eventFiles) {
  const filePath = path.join(eventsPath, file);
  const event = require(filePath);
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }
}
*/

/*
import dotenv from "dotenv";
dotenv.config();

import {
  Client,
  GatewayIntentBits,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
  ],
});

client.on(
  "messageCreate",
  async((message) => {
    console.log(message);

    if (!message?.author.bot) {
      message.author.send({
        content: "Push my btns!",
        components: [btn],
      });
    }
  })
);

client.on("interactionCreate", async (interaction) => {
  if (interaction.customId === "hiMom") {
    await interaction.reply({
      content: "Mom says hi back!",
      ephemeral: true,
    });
  }
});
*/
