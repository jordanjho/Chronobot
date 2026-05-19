import { Events } from 'discord.js';
import type { Client } from 'discord.js';
import logger from '../utils/logger.js';

export default {
  name: Events.ClientReady,
  once: true,
  execute(client: Client): void {
    logger.info({ tag: client.user?.tag }, `Chronobot is online as ${client.user?.tag}`);
  },
};
