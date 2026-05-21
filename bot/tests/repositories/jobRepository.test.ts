import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Prisma client before importing repository
const mockPrismaJob = {
  create: vi.fn(),
  findUnique: vi.fn(),
  findMany: vi.fn(),
  findFirst: vi.fn(),
  count: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  deleteMany: vi.fn(),
};
vi.mock('../../src/db/prisma.js', () => ({
  prisma: { job: mockPrismaJob },
}));

const { jobRepository } = await import('../../src/repositories/JobRepository.js');

const baseJob = {
  id: 'job-1',
  channelId: 'chan-1',
  userId: 'user-1',
  content: 'Hello',
  frequency: 'once',
  sendTimes: ['2099-01-01T12:00:00.000Z'],
  attachmentUrl: null,
  status: 'QUEUED' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('JobRepository', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('create', () => {
    it('passes all fields to prisma.job.create', async () => {
      mockPrismaJob.create.mockResolvedValue(baseJob);

      await jobRepository.create({
        channelId: 'chan-1',
        userId: 'user-1',
        content: 'Hello',
        frequency: 'once',
        sendTimes: ['2099-01-01T12:00:00.000Z'],
        attachmentUrl: null,
      });

      expect(mockPrismaJob.create).toHaveBeenCalledWith({
        data: {
          channelId: 'chan-1',
          userId: 'user-1',
          content: 'Hello',
          frequency: 'once',
          sendTimes: ['2099-01-01T12:00:00.000Z'],
          attachmentUrl: null,
        },
      });
    });

    it('coerces undefined attachmentUrl to null', async () => {
      mockPrismaJob.create.mockResolvedValue(baseJob);

      await jobRepository.create({
        channelId: 'chan-1',
        userId: 'user-1',
        content: 'Hello',
        frequency: 'once',
        sendTimes: ['2099-01-01T12:00:00.000Z'],
      });

      expect(mockPrismaJob.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ attachmentUrl: null }) }),
      );
    });
  });

  describe('findById', () => {
    it('looks up job by id', async () => {
      mockPrismaJob.findUnique.mockResolvedValue(baseJob);

      const result = await jobRepository.findById('job-1');

      expect(mockPrismaJob.findUnique).toHaveBeenCalledWith({ where: { id: 'job-1' } });
      expect(result).toEqual(baseJob);
    });

    it('returns null when job does not exist', async () => {
      mockPrismaJob.findUnique.mockResolvedValue(null);

      const result = await jobRepository.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('countByUserId', () => {
    it('counts only QUEUED jobs for the user', async () => {
      mockPrismaJob.count.mockResolvedValue(3);

      const result = await jobRepository.countByUserId('user-1');

      expect(mockPrismaJob.count).toHaveBeenCalledWith({
        where: { userId: 'user-1', status: 'QUEUED' },
      });
      expect(result).toBe(3);
    });

    it('returns 0 when user has no queued jobs', async () => {
      mockPrismaJob.count.mockResolvedValue(0);

      const result = await jobRepository.countByUserId('no-jobs-user');

      expect(result).toBe(0);
    });
  });

  describe('findQueuedByUserId', () => {
    it('queries by userId AND status=QUEUED', async () => {
      mockPrismaJob.findMany.mockResolvedValue([baseJob]);

      await jobRepository.findQueuedByUserId('user-1');

      expect(mockPrismaJob.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', status: 'QUEUED' },
      });
    });

    it('returns empty array when user has no queued jobs', async () => {
      mockPrismaJob.findMany.mockResolvedValue([]);

      const result = await jobRepository.findQueuedByUserId('user-x');

      expect(result).toEqual([]);
    });
  });

  describe('findQueued', () => {
    it('returns all QUEUED jobs across all users', async () => {
      mockPrismaJob.findMany.mockResolvedValue([baseJob]);

      await jobRepository.findQueued();

      expect(mockPrismaJob.findMany).toHaveBeenCalledWith({
        where: { status: 'QUEUED' },
      });
    });
  });

  describe('findTerminal', () => {
    it('queries COMPLETED, FAILED, and DEAD statuses', async () => {
      mockPrismaJob.findMany.mockResolvedValue([]);

      await jobRepository.findTerminal();

      expect(mockPrismaJob.findMany).toHaveBeenCalledWith({
        where: { status: { in: ['COMPLETED', 'FAILED', 'DEAD'] } },
      });
    });

    it('does not include QUEUED jobs', async () => {
      mockPrismaJob.findMany.mockResolvedValue([]);

      await jobRepository.findTerminal();

      const call = mockPrismaJob.findMany.mock.calls[0]![0];
      expect(call.where.status.in).not.toContain('QUEUED');
    });
  });

  describe('updateSendTimes', () => {
    it('updates sendTimes for the given id', async () => {
      const newTimes = ['2099-02-01T00:00:00.000Z'];
      mockPrismaJob.update.mockResolvedValue({ ...baseJob, sendTimes: newTimes });

      await jobRepository.updateSendTimes('job-1', newTimes);

      expect(mockPrismaJob.update).toHaveBeenCalledWith({
        where: { id: 'job-1' },
        data: { sendTimes: newTimes },
      });
    });
  });

  describe('updateContent', () => {
    it('returns null when job is not found or belongs to different user', async () => {
      mockPrismaJob.findFirst.mockResolvedValue(null);

      const result = await jobRepository.updateContent('job-1', 'other-user', 'new content', null);

      expect(result).toBeNull();
      expect(mockPrismaJob.update).not.toHaveBeenCalled();
    });

    it('updates content and attachmentUrl when job belongs to user', async () => {
      mockPrismaJob.findFirst.mockResolvedValue(baseJob);
      mockPrismaJob.update.mockResolvedValue({ ...baseJob, content: 'updated' });

      const result = await jobRepository.updateContent('job-1', 'user-1', 'updated', 'https://example.com/img.png');

      expect(mockPrismaJob.update).toHaveBeenCalledWith({
        where: { id: 'job-1' },
        data: { content: 'updated', attachmentUrl: 'https://example.com/img.png' },
      });
      expect(result).not.toBeNull();
    });

    it('can update content to empty string (clears message text)', async () => {
      mockPrismaJob.findFirst.mockResolvedValue(baseJob);
      mockPrismaJob.update.mockResolvedValue({ ...baseJob, content: '' });

      await jobRepository.updateContent('job-1', 'user-1', '', null);

      expect(mockPrismaJob.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ content: '' }) }),
      );
    });
  });

  describe('delete', () => {
    it('returns true when a row was deleted', async () => {
      mockPrismaJob.deleteMany.mockResolvedValue({ count: 1 });

      const result = await jobRepository.delete('job-1', 'user-1');

      expect(result).toBe(true);
      expect(mockPrismaJob.deleteMany).toHaveBeenCalledWith({ where: { id: 'job-1', userId: 'user-1' } });
    });

    it('returns false when no rows were deleted (wrong user or missing job)', async () => {
      mockPrismaJob.deleteMany.mockResolvedValue({ count: 0 });

      const result = await jobRepository.delete('job-1', 'wrong-user');

      expect(result).toBe(false);
    });
  });

  describe('hardDelete', () => {
    it('deletes by id without user check', async () => {
      mockPrismaJob.delete.mockResolvedValue(baseJob);

      await jobRepository.hardDelete('job-1');

      expect(mockPrismaJob.delete).toHaveBeenCalledWith({ where: { id: 'job-1' } });
    });
  });

  describe('markFailed', () => {
    it('sets status to FAILED', async () => {
      mockPrismaJob.update.mockResolvedValue({ ...baseJob, status: 'FAILED' });

      await jobRepository.markFailed('job-1');

      expect(mockPrismaJob.update).toHaveBeenCalledWith({
        where: { id: 'job-1' },
        data: { status: 'FAILED' },
      });
    });
  });

  describe('markCompleted', () => {
    it('sets status to COMPLETED', async () => {
      mockPrismaJob.update.mockResolvedValue({ ...baseJob, status: 'COMPLETED' });

      await jobRepository.markCompleted('job-1');

      expect(mockPrismaJob.update).toHaveBeenCalledWith({
        where: { id: 'job-1' },
        data: { status: 'COMPLETED' },
      });
    });
  });
});
