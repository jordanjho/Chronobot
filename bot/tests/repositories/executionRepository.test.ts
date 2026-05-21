import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockPrismaExecution = {
  upsert: vi.fn(),
  update: vi.fn(),
  findMany: vi.fn(),
  findUnique: vi.fn(),
};
vi.mock('../../src/db/prisma.js', () => ({
  prisma: { execution: mockPrismaExecution },
}));

const { executionRepository } = await import('../../src/repositories/ExecutionRepository.js');

const baseExecution = {
  id: 'exec-1',
  jobId: 'job-1',
  bullmqJobId: 'bullmq-id-1',
  attempt: 1,
  status: 'STARTED' as const,
  startedAt: new Date('2099-01-01T00:00:00.000Z'),
  completedAt: null,
  error: null,
};

describe('ExecutionRepository', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('create', () => {
    it('inserts with STARTED status and current time', async () => {
      mockPrismaExecution.upsert.mockResolvedValue(baseExecution);

      await executionRepository.create('job-1', 1, 'bullmq-id-1');

      expect(mockPrismaExecution.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { bullmqJobId: 'bullmq-id-1' },
          create: expect.objectContaining({ jobId: 'job-1', attempt: 1, status: 'STARTED' }),
        }),
      );
    });

    it('includes startedAt timestamp in create and update', async () => {
      mockPrismaExecution.upsert.mockResolvedValue(baseExecution);

      await executionRepository.create('job-1', 2, 'bullmq-id-2');

      const call = mockPrismaExecution.upsert.mock.calls[0]![0];
      expect(call.create.startedAt).toBeInstanceOf(Date);
      expect(call.update.startedAt).toBeInstanceOf(Date);
    });

    it('returns the created execution', async () => {
      mockPrismaExecution.upsert.mockResolvedValue(baseExecution);

      const result = await executionRepository.create('job-1', 1, 'bullmq-id-1');

      expect(result).toEqual(baseExecution);
    });

    it('tracks attempt number correctly for retries', async () => {
      mockPrismaExecution.upsert.mockResolvedValue({ ...baseExecution, attempt: 3 });

      await executionRepository.create('job-1', 3, 'bullmq-id-3');

      expect(mockPrismaExecution.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ attempt: 3 }),
          update: expect.objectContaining({ attempt: 3 }),
        }),
      );
    });

    it('resets completedAt and error to null on retry upsert', async () => {
      mockPrismaExecution.upsert.mockResolvedValue(baseExecution);

      await executionRepository.create('job-1', 2, 'bullmq-id-1');

      const call = mockPrismaExecution.upsert.mock.calls[0]![0];
      expect(call.update.completedAt).toBeNull();
      expect(call.update.error).toBeNull();
    });
  });

  describe('complete', () => {
    it('updates status to COMPLETED with a completedAt timestamp', async () => {
      mockPrismaExecution.update.mockResolvedValue({ ...baseExecution, status: 'COMPLETED', completedAt: new Date() });

      await executionRepository.complete('exec-1');

      expect(mockPrismaExecution.update).toHaveBeenCalledWith({
        where: { id: 'exec-1' },
        data: expect.objectContaining({ status: 'COMPLETED', completedAt: expect.any(Date) }),
      });
    });

    it('does not set an error field on completion', async () => {
      mockPrismaExecution.update.mockResolvedValue({ ...baseExecution, status: 'COMPLETED' });

      await executionRepository.complete('exec-1');

      const call = mockPrismaExecution.update.mock.calls[0]![0];
      expect(call.data.error).toBeUndefined();
    });
  });

  describe('fail', () => {
    it('updates status to FAILED with error message and completedAt', async () => {
      mockPrismaExecution.update.mockResolvedValue({ ...baseExecution, status: 'FAILED', error: 'Channel not found', completedAt: new Date() });

      await executionRepository.fail('exec-1', 'Channel not found');

      expect(mockPrismaExecution.update).toHaveBeenCalledWith({
        where: { id: 'exec-1' },
        data: expect.objectContaining({
          status: 'FAILED',
          error: 'Channel not found',
          completedAt: expect.any(Date),
        }),
      });
    });

    it('preserves the exact error string passed in', async () => {
      mockPrismaExecution.update.mockResolvedValue({});
      const errorMsg = 'BullMQ job timed out after 30000ms';

      await executionRepository.fail('exec-2', errorMsg);

      const call = mockPrismaExecution.update.mock.calls[0]![0];
      expect(call.data.error).toBe(errorMsg);
    });
  });

  describe('findByJobId', () => {
    it('returns all executions for a given jobId', async () => {
      const executions = [baseExecution, { ...baseExecution, id: 'exec-2', attempt: 2 }];
      mockPrismaExecution.findMany.mockResolvedValue(executions);

      const result = await executionRepository.findByJobId('job-1');

      expect(mockPrismaExecution.findMany).toHaveBeenCalledWith({ where: { jobId: 'job-1' } });
      expect(result).toHaveLength(2);
    });

    it('returns empty array when no executions exist for job', async () => {
      mockPrismaExecution.findMany.mockResolvedValue([]);

      const result = await executionRepository.findByJobId('job-no-executions');

      expect(result).toEqual([]);
    });
  });
});
