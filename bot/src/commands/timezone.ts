import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import { userPreferenceRepository } from '../repositories/UserPreferenceRepository.js';

function isValidIanaTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export default {
  data: new SlashCommandBuilder()
    .setName('timezone')
    .setDescription('Set your timezone for /schedule timestamps')
    .addSubcommand((sub) =>
      sub
        .setName('set')
        .setDescription('Set your IANA timezone (e.g. America/New_York)')
        .addStringOption((opt) =>
          opt
            .setName('tz')
            .setDescription('IANA timezone name (e.g. America/New_York, Europe/London, Asia/Tokyo)')
            .setRequired(true),
        ),
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const sub = interaction.options.getSubcommand();

    if (sub === 'set') {
      const tz = interaction.options.getString('tz', true).trim();

      if (!isValidIanaTimezone(tz)) {
        await interaction.editReply(
          `Unknown timezone: \`${tz}\`. Use an IANA name like \`America/New_York\`, \`Europe/London\`, or \`Asia/Tokyo\`.`,
        );
        return;
      }

      await userPreferenceRepository.upsert(interaction.user.id, tz);
      await interaction.editReply(
        `Timezone set to \`${tz}\`. Future /schedule timestamps will be interpreted in this timezone.`,
      );
    }
  },
};
