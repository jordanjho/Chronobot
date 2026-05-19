import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Client } from 'discord.js';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import scheduleMessage from '../scheduler/scheduleMessage.js';
import { jobRepository } from '../repositories/JobRepository.js';
import logger from '../utils/logger.js';

// Bug 3 fix: extend dayjs plugins locally in every file that uses them
dayjs.extend(utc);

const frequencies = ['once', 'daily', 'weekly'] as const;

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
        .setDescription('Format: YYYY-MM-DD HH:mm (UTC)')
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

    const baseTime = dayjs.utc(timestamp, 'YYYY-MM-DD HH:mm');
    const now = dayjs.utc();

    logger.info({ command: 'schedule', userId, channelId, timestamp }, `Scheduling message for ${baseTime.format()}`);

    if (!baseTime.isValid() || baseTime.isBefore(now.add(10, 'second'))) {
      logger.warn(
        { command: 'schedule', userId, valid: baseTime.isValid(), beforeNow: baseTime.isBefore(now.add(10, 'second')) },
        'Invalid or past timestamp provided',
      );
      await interaction.editReply('Invalid or distant timestamp. Format: YYYY-MM-DD HH:mm UTC.');
      return;
    }

    const count = await jobRepository.countByUserId(userId);
    if (count >= 5) {
      await interaction.editReply('You can only have 5 scheduled messages at a time.');
      return;
    }

    const times: string[] = [];
    if (frequency === 'once') times.push(baseTime.toISOString());
    else if (frequency === 'daily') {
      for (let i = 0; i < 7; i++)
        times.push(baseTime.add(i, 'day').toISOString());
    }
    else if (frequency === 'weekly') {
      for (let i = 0; i < 4; i++)
        times.push(baseTime.add(i, 'week').toISOString());
    }

    const job = await jobRepository.create({
      channelId,
      userId,
      content,
      frequency,
      sendTimes: times,
      attachmentUrl: attachment?.url ?? null,
    });

    times.forEach((time) =>
      scheduleMessage(
        client,
        job.id,
        channelId,
        time,
        content,
        attachment?.url,
      ),
    );

    logger.info({ command: 'schedule', userId, channelId, messageId: job.id }, `Message scheduled with ID ${job.id}`);
    await interaction.editReply(`Message scheduled with ID ${job.id}`);
  },
};
