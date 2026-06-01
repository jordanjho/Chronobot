import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Client } from 'discord.js';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import { jobRepository } from '../repositories/JobRepository.js';
import { userPreferenceRepository } from '../repositories/UserPreferenceRepository.js';
import { jobService } from '../services/JobService.js';
import logger from '../utils/logger.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const frequencies = ['once', 'daily', 'weekly'] as const;

function expandSendTimes(
  timestamp: string,
  frequency: (typeof frequencies)[number],
  tz: string | null,
): string[] {
  const times: string[] = [];
  if (frequency === 'once') {
    const t = tz
      ? dayjs.tz(timestamp, 'YYYY-MM-DD HH:mm', tz)
      : dayjs.utc(timestamp, 'YYYY-MM-DD HH:mm');
    times.push(t.toISOString());
  } else if (frequency === 'daily') {
    for (let i = 0; i < 7; i++) {
      // Adding calendar days in local timezone is DST-safe: 9am ET stays 9am ET after DST
      const t = tz
        ? dayjs.tz(timestamp, 'YYYY-MM-DD HH:mm', tz).add(i, 'day')
        : dayjs.utc(timestamp, 'YYYY-MM-DD HH:mm').add(i, 'day');
      times.push(t.toISOString());
    }
  } else {
    for (let i = 0; i < 4; i++) {
      const t = tz
        ? dayjs.tz(timestamp, 'YYYY-MM-DD HH:mm', tz).add(i, 'week')
        : dayjs.utc(timestamp, 'YYYY-MM-DD HH:mm').add(i, 'week');
      times.push(t.toISOString());
    }
  }
  return times;
}

export default {
  data: new SlashCommandBuilder()
    .setName('schedule')
    .setDescription('Schedule a message')
    .addStringOption((opt) =>
      opt
        .setName('frequency')
        .setDescription('once/daily/weekly')
        .setRequired(true),
    )
    .addStringOption((opt) =>
      opt
        .setName('timestamp')
        .setDescription('Format: YYYY-MM-DD HH:mm (in your stored timezone, or UTC if none set)')
        .setRequired(true),
    )
    .addStringOption((opt) =>
      opt
        .setName('content')
        .setDescription('The message content')
        .setRequired(false),
    )
    .addAttachmentOption((opt) =>
      opt.setName('attachment').setDescription('Optional image/video/gif'),
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const { options } = interaction;
    const client = interaction.client as Client;

    const frequency = options.getString('frequency') ?? '';
    const timestamp = options.getString('timestamp') ?? '';
    const content = options.getString('content') ?? '';
    const attachment = options.getAttachment('attachment');
    const userId = interaction.user.id;
    const channelId = interaction.channelId;

    if (!frequencies.includes(frequency as (typeof frequencies)[number])) {
      await interaction.editReply('Invalid frequency. Use once, daily, or weekly.');
      return;
    }

    const pref = await userPreferenceRepository.findByUserId(userId);
    const tz = pref?.timezone ?? null;

    const baseTime = tz
      ? dayjs.tz(timestamp, 'YYYY-MM-DD HH:mm', tz)
      : dayjs.utc(timestamp, 'YYYY-MM-DD HH:mm');
    const now = dayjs.utc();

    if (!baseTime.isValid()) {
      await interaction.editReply('Invalid timestamp format. Use: YYYY-MM-DD HH:mm.');
      return;
    }

    if (baseTime.toDate() <= now.add(10, 'second').toDate()) {
      await interaction.editReply('Timestamp must be at least 10 seconds in the future.');
      return;
    }

    if (content.length > 2000) {
      await interaction.editReply('Message content must be 2000 characters or fewer.');
      return;
    }

    const count = await jobRepository.countByUserId(userId);
    if (count >= 5) {
      await interaction.editReply('You can only have 5 scheduled messages at a time.');
      return;
    }

    const times = expandSendTimes(timestamp, frequency as (typeof frequencies)[number], tz);

    const job = await jobService.createJob(
      {
        channelId,
        userId,
        content,
        frequency,
        sendTimes: times,
        attachmentUrl: attachment?.url ?? null,
      },
      client,
    );

    const tzNote = tz ? ` (interpreted as ${tz})` : ' (UTC)';
    logger.info({ command: 'schedule', userId, channelId, messageId: job.id, tz }, `Message scheduled for ${baseTime.toISOString()}`);
    await interaction.editReply(`Message scheduled with ID ${job.id}${tzNote}`);
  },
};
