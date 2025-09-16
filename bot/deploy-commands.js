import { REST, Routes } from "discord.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
dotenv.config({ path: ".env", quiet: true });

const { token, clientId, guildId } = process.env;
console.log("Environment variables:", {
  token: token ? "✓" : "✗",
  clientId: clientId ? "✓" : "✗",
  guildId,
});
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("Starting command deployment...");
(async () => {
  const commands = [];
  const commandsPath = path.join(__dirname, "commands");
  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file) => file.endsWith(".js"));
  console.log("Command files found:", commandFiles);

  for (const file of commandFiles) {
    console.log("test");
    try {
      console.log(`Loading command: ${file}`);
      const filePath = path.join(commandsPath, file);
      console.log(filePath);
      
      const command = await import(filePath);
      console.log(command);

      if ("data" in command.default && "execute" in command.default) {
        commands.push(command.default.data.toJSON());
        console.log(`✓ Successfully loaded: ${command.default.data.name}`);
      } else {
        console.log(
          `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`
        );
      }
    } catch (error) {
      console.error(`[ERROR] Failed to load command ${file}:`, error.message);
    }
  }

  console.log(`Total commands loaded: ${commands.length}`);
  // Construct and prepare an instance of the REST module
  const rest = new REST().setToken(token);

  try {
    console.log(`Registering ${commands.length} application (/) commands...`);

    let data;
    if (guildId) {
      data = await rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        {
          body: commands,
        }
      );
      console.log(
        `Registered ${data.length} application (/) commands for guild ${guildId}`
      );
    } else {
      data = await rest.put(Routes.applicationCommands(clientId), {
        body: commands,
      });
      console.log(`Registered ${data.length} global application (/) commands`);
    }
  } catch (error) {
    console.error("Deployment error:", error);
  }
})();
