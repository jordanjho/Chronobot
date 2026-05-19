import { Client, Collection, GatewayIntentBits, Partials } from 'discord.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import db from './db/database.js';
import restoreScheduledMessages from './scheduler/restore.js';
import logger from './utils/logger.js';
import type { CommandModule } from './types.js';
import './discord.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Channel],
});

client.commands = new Collection<string, CommandModule>();

async function loadCommands(): Promise<void> {
  const commandsPath = path.join(__dirname, 'commands');
  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file) => file.endsWith('.ts') || file.endsWith('.js'));

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = await import(filePath) as CommandModule;

    if ('data' in command.default && 'execute' in command.default) {
      client.commands.set(command.default.data.name, command);
    }
    else {
      logger.warn({ filePath }, `The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
  }
}

async function loadEvents(): Promise<void> {
  const eventsPath = path.join(__dirname, 'events');
  const eventFiles = fs
    .readdirSync(eventsPath)
    .filter((file) => file.endsWith('.ts') || file.endsWith('.js'));

  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = await import(filePath) as { default: { name: string; once?: boolean; execute: (...args: unknown[]) => unknown } };

    if (event.default.once) {
      client.once(event.default.name, (...args: unknown[]) => event.default.execute(...args));
    }
    else {
      client.on(event.default.name, (...args: unknown[]) => event.default.execute(...args));
    }
  }
}

client.once('ready', () => {
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
    (err: Error | null) => {
      if (err) {
        logger.error({ err }, 'Failed to create messages table');
        return;
      }
      restoreScheduledMessages(client);
    },
  );

  db.run(`CREATE INDEX IF NOT EXISTS idx_user_id ON messages(user_id)`);
});

(async () => {
  await loadCommands();
  await loadEvents();
  await client.login(config.DISCORD_TOKEN);
})();
