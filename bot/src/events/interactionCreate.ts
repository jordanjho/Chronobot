import { Events, MessageFlags } from 'discord.js';
import type { Interaction } from 'discord.js';
import type { CommandModule } from '../types.js';
import logger from '../utils/logger.js';

export default {
  name: Events.InteractionCreate,
  async execute(interaction: Interaction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;
    const command = interaction.client.commands.get(interaction.commandName) as CommandModule | undefined;

    if (!command) {
      logger.error({ commandName: interaction.commandName }, `No command matching ${interaction.commandName} was found.`);
      return;
    }

    await interaction.deferReply({ flags: 64 });

    try {
      await command.default.execute(interaction);
    }
    catch (error) {
      logger.error({ err: error, command: interaction.commandName, userId: interaction.user.id }, 'Error executing command');
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: 'There was an error while executing this command!',
          flags: MessageFlags.Ephemeral,
        });
      }
      else {
        await interaction.reply({
          content: 'There was an error while executing this command!',
          flags: MessageFlags.Ephemeral,
        });
      }
    }
  },
};
