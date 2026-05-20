import { REST, Routes } from 'discord.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './src/config.js';
import type { CommandModule } from './src/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const commands = [];
const commandsPath = path.join(__dirname, 'src', 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.ts') || f.endsWith('.js'));

for (const file of commandFiles) {
  const mod = await import(path.join(commandsPath, file)) as CommandModule;
  commands.push(mod.default.data.toJSON());
}

const rest = new REST().setToken(config.DISCORD_TOKEN);

const route = config.GUILD_ID
  ? Routes.applicationGuildCommands(config.CLIENT_ID, config.GUILD_ID)
  : Routes.applicationCommands(config.CLIENT_ID);

await rest.put(route, { body: commands });
console.log(`Deployed ${commands.length} commands${config.GUILD_ID ? ` to guild ${config.GUILD_ID}` : ' globally'}.`);
