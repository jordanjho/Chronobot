import { Client, Collection, GatewayIntentBits, Partials } from 'discord.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { prisma } from './db/prisma.js';
import { jobService } from './services/JobService.js';
import { createWorker } from './worker/processor.js';
import { startMetricsServer } from './metrics/server.js';
import logger from './utils/logger.js';
import type { CommandModule } from './types.js';

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
  void jobService.restoreJobs(client);
});

let worker: ReturnType<typeof createWorker> | null = null;
let metricsServer: ReturnType<typeof startMetricsServer> | null = null;

const WORKER_DRAIN_TIMEOUT_MS = 30_000;

async function shutdown(): Promise<void> {
  await new Promise<void>((resolve) => {
    if (metricsServer) metricsServer.close(() => resolve());
    else resolve();
  });
  if (worker) {
    await Promise.race([
      worker.close(),
      new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error('Worker drain timed out')), WORKER_DRAIN_TIMEOUT_MS),
      ),
    ]).catch((err: unknown) => {
      logger.error({ error: (err as Error).message }, 'Worker drain timed out — forcing shutdown');
    });
  }
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());

(async () => {
  metricsServer = startMetricsServer();
  await loadCommands();
  await loadEvents();
  await client.login(config.DISCORD_TOKEN);
  worker = createWorker(client);
  logger.info('Worker started');
})();
