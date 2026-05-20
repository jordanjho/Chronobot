import type { Execution } from '@prisma/client';
import { prisma } from '../db/prisma.js';

export class ExecutionRepository {
  // bullmqJobId stored in DB by PR3A migration; accepted here now to avoid merge conflict
  async create(jobId: string, attempt: number, bullmqJobId: string): Promise<Execution> {
    return prisma.execution.create({
      data: {
        jobId,
        attempt,
        status: 'STARTED',
        startedAt: new Date(),
      },
    });
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
