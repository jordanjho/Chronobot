import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockPrismaExecution = {
  create: vi.fn(),
  update: vi.fn(),
  findMany: vi.fn(),
  findUnique: vi.fn(),
};

vi.mock('../../src/db/prisma.js', () => ({
  prisma: {
    execution: mockPrismaExecution,
  },
}));

const { ExecutionRepository } = await import('../../src/repositories/ExecutionRepository.js');

describe('ExecutionRepository', () => {
  let repo: InstanceType<typeof ExecutionRepository>;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new ExecutionRepository();
  });

  describe('create()', () => {
    it('persists bullmqJobId on creation', async () => {
      const now = new Date();
      const record = { id: 'exec-1', jobId: 'job-1', bullmqJobId: 'bq-1', attempt: 1, status: 'STARTED', startedAt: now, completedAt: null, error: null };
      mockPrismaExecution.create.mockResolvedValue(record);

      const result = await repo.create('job-1', 1, 'bq-1');

      expect(mockPrismaExecution.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ jobId: 'job-1', bullmqJobId: 'bq-1', attempt: 1, status: 'STARTED' }),
      });
      expect(result.bullmqJobId).toBe('bq-1');
    });
  });

  describe('findByBullmqJobId()', () => {
    it('returns null when not found', async () => {
      mockPrismaExecution.findUnique.mockResolvedValue(null);

      const result = await repo.findByBullmqJobId('unknown-id');

      expect(result).toBeNull();
      expect(mockPrismaExecution.findUnique).toHaveBeenCalledWith({ where: { bullmqJobId: 'unknown-id' } });
    });

    it('returns record when found', async () => {
      const record = { id: 'exec-1', jobId: 'job-1', bullmqJobId: 'bq-1', attempt: 1, status: 'STARTED', startedAt: new Date(), completedAt: null, error: null };
      mockPrismaExecution.findUnique.mockResolvedValue(record);

      const result = await repo.findByBullmqJobId('bq-1');

      expect(result).toEqual(record);
    });

    it('returns COMPLETED record correctly', async () => {
      const record = { id: 'exec-1', jobId: 'job-1', bullmqJobId: 'bq-1', attempt: 1, status: 'COMPLETED', startedAt: new Date(), completedAt: new Date(), error: null };
      mockPrismaExecution.findUnique.mockResolvedValue(record);

      const result = await repo.findByBullmqJobId('bq-1');

      expect(result?.status).toBe('COMPLETED');
    });

    it('returns STARTED record correctly', async () => {
      const record = { id: 'exec-1', jobId: 'job-1', bullmqJobId: 'bq-1', attempt: 1, status: 'STARTED', startedAt: new Date(), completedAt: null, error: null };
      mockPrismaExecution.findUnique.mockResolvedValue(record);

      const result = await repo.findByBullmqJobId('bq-1');

      expect(result?.status).toBe('STARTED');
    });
  });
});
