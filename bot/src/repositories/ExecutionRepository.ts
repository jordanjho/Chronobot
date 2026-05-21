import type { Execution } from '@prisma/client';
import { prisma } from '../db/prisma.js';

export class ExecutionRepository {
  async create(jobId: string, attempt: number, bullmqJobId: string): Promise<Execution> {
    // Upsert so retries with the same BullMQ job ID reset the record rather than
    // violating the unique constraint on bullmq_job_id.
    return prisma.execution.upsert({
      where: { bullmqJobId },
      update: {
        attempt,
        status: 'STARTED',
        startedAt: new Date(),
        completedAt: null,
        error: null,
      },
      create: {
        jobId,
        bullmqJobId,
        attempt,
        status: 'STARTED',
        startedAt: new Date(),
      },
    });
  }

  async findByBullmqJobId(bullmqJobId: string): Promise<Execution | null> {
    return prisma.execution.findUnique({ where: { bullmqJobId } });
  }

  async complete(id: string): Promise<Execution> {
    return prisma.execution.update({
      where: { id },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
  }

  async fail(id: string, error: string): Promise<Execution> {
    return prisma.execution.update({
      where: { id },
      data: { status: 'FAILED', completedAt: new Date(), error },
    });
  }

  async findByJobId(jobId: string): Promise<Execution[]> {
    return prisma.execution.findMany({ where: { jobId } });
  }
}

export const executionRepository = new ExecutionRepository();
