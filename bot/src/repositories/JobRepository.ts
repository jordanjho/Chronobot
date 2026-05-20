import type { Job, JobStatus } from '@prisma/client';
import { prisma } from '../db/prisma.js';

export interface CreateJobInput {
  channelId: string;
  userId: string;
  content: string;
  frequency: string;
  sendTimes: string[];
  attachmentUrl?: string | null;
}

export class JobRepository {
  async create(data: CreateJobInput): Promise<Job> {
    return prisma.job.create({
      data: {
        channelId: data.channelId,
        userId: data.userId,
        content: data.content,
        frequency: data.frequency,
        sendTimes: data.sendTimes,
        attachmentUrl: data.attachmentUrl ?? null,
      },
    });
  }

  async findById(id: string): Promise<Job | null> {
    return prisma.job.findUnique({ where: { id } });
  }

  async findAllByUserId(userId: string): Promise<Job[]> {
    return prisma.job.findMany({ where: { userId } });
  }

  async findAll(): Promise<Job[]> {
    return prisma.job.findMany();
  }

  async countByUserId(userId: string): Promise<number> {
    return prisma.job.count({ where: { userId } });
  }

  async updateSendTimes(id: string, sendTimes: string[]): Promise<Job> {
    return prisma.job.update({
      where: { id },
      data: { sendTimes },
    });
  }

  async updateContent(
    id: string,
    userId: string,
    content: string,
    attachmentUrl: string | null,
  ): Promise<Job | null> {
    const job = await prisma.job.findFirst({ where: { id, userId } });
    if (!job) return null;
    return prisma.job.update({
      where: { id },
      data: { content, attachmentUrl },
    });
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const result = await prisma.job.deleteMany({ where: { id, userId } });
    return result.count > 0;
  }

  async findQueued(): Promise<Job[]> {
    return prisma.job.findMany({ where: { status: 'QUEUED' } });
  }

  async markCompleted(id: string): Promise<Job> {
    return prisma.job.update({
      where: { id },
      data: { status: 'COMPLETED' as JobStatus },
    });
  }

  async markFailed(id: string): Promise<Job> {
    return prisma.job.update({
      where: { id },
      data: { status: 'FAILED' as JobStatus },
    });
  }
}

export const jobRepository = new JobRepository();
