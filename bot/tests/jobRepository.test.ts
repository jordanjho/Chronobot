import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Prisma client
const mockPrisma = {
  job: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
};
vi.mock('../src/db/prisma.js', () => ({ prisma: mockPrisma }));

const { JobRepository } = await import('../src/repositories/JobRepository.js');

describe('JobRepository', () => {
  let repo: InstanceType<typeof JobRepository>;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new JobRepository();
  });

  // --- create ---

  it('create passes correct fields to prisma', async () => {
    const job = { id: 'uuid-1', channelId: 'c1', userId: 'u1', content: 'hi', frequency: 'once', sendTimes: ['2099-01-01T00:00:00.000Z'], attachmentUrl: null, status: 'QUEUED', createdAt: new Date(), updatedAt: new Date() };
    mockPrisma.job.create.mockResolvedValue(job);

    const result = await repo.create({ channelId: 'c1', userId: 'u1', content: 'hi', frequency: 'once', sendTimes: ['2099-01-01T00:00:00.000Z'] });

    expect(mockPrisma.job.create).toHaveBeenCalledWith({
      data: { channelId: 'c1', userId: 'u1', content: 'hi', frequency: 'once', sendTimes: ['2099-01-01T00:00:00.000Z'], attachmentUrl: null },
    });
    expect(result).toBe(job);
  });

  it('create stores attachmentUrl when provided', async () => {
    mockPrisma.job.create.mockResolvedValue({});
    await repo.create({ channelId: 'c', userId: 'u', content: '', frequency: 'once', sendTimes: [], attachmentUrl: 'https://cdn.example.com/img.png' });

    const arg = mockPrisma.job.create.mock.calls[0][0];
    expect(arg.data.attachmentUrl).toBe('https://cdn.example.com/img.png');
  });

  it('create stores null attachmentUrl when not provided', async () => {
    mockPrisma.job.create.mockResolvedValue({});
    await repo.create({ channelId: 'c', userId: 'u', content: '', frequency: 'once', sendTimes: [] });

    const arg = mockPrisma.job.create.mock.calls[0][0];
    expect(arg.data.attachmentUrl).toBeNull();
  });

  // --- findById ---

  it('findById queries by id', async () => {
    const job = { id: 'uuid-2' };
    mockPrisma.job.findUnique.mockResolvedValue(job);

    const result = await repo.findById('uuid-2');
    expect(mockPrisma.job.findUnique).toHaveBeenCalledWith({ where: { id: 'uuid-2' } });
    expect(result).toBe(job);
  });

  it('findById returns null when job does not exist', async () => {
    mockPrisma.job.findUnique.mockResolvedValue(null);
    const result = await repo.findById('nonexistent');
    expect(result).toBeNull();
  });

  // --- findAllByUserId ---

  it('findAllByUserId queries by userId', async () => {
    const jobs = [{ id: 'j1' }, { id: 'j2' }];
    mockPrisma.job.findMany.mockResolvedValue(jobs);

    const result = await repo.findAllByUserId('user-abc');
    expect(mockPrisma.job.findMany).toHaveBeenCalledWith({ where: { userId: 'user-abc' } });
    expect(result).toBe(jobs);
  });

  it('findAllByUserId returns empty array when user has no jobs', async () => {
    mockPrisma.job.findMany.mockResolvedValue([]);
    const result = await repo.findAllByUserId('user-none');
    expect(result).toEqual([]);
  });

  // --- findAll ---

  it('findAll returns all jobs', async () => {
    const jobs = [{ id: 'j1' }, { id: 'j2' }, { id: 'j3' }];
    mockPrisma.job.findMany.mockResolvedValue(jobs);
    const result = await repo.findAll();
    expect(result).toBe(jobs);
  });

  // --- countByUserId ---

  it('countByUserId queries by userId', async () => {
    mockPrisma.job.count.mockResolvedValue(3);
    const count = await repo.countByUserId('user-xyz');
    expect(mockPrisma.job.count).toHaveBeenCalledWith({ where: { userId: 'user-xyz' } });
    expect(count).toBe(3);
  });

  it('countByUserId returns 0 when user has no jobs', async () => {
    mockPrisma.job.count.mockResolvedValue(0);
    expect(await repo.countByUserId('new-user')).toBe(0);
  });

  // --- updateSendTimes ---

  it('updateSendTimes updates the sendTimes array', async () => {
    const updated = { id: 'j1', sendTimes: ['2099-02-01T00:00:00.000Z'] };
    mockPrisma.job.update.mockResolvedValue(updated);

    const result = await repo.updateSendTimes('j1', ['2099-02-01T00:00:00.000Z']);
    expect(mockPrisma.job.update).toHaveBeenCalledWith({
      where: { id: 'j1' },
      data: { sendTimes: ['2099-02-01T00:00:00.000Z'] },
    });
    expect(result).toBe(updated);
  });

  // --- updateContent ---

  it('updateContent returns null when job does not belong to user', async () => {
    mockPrisma.job.findFirst.mockResolvedValue(null);
    const result = await repo.updateContent('j1', 'other-user', 'new content', null);
    expect(result).toBeNull();
    expect(mockPrisma.job.update).not.toHaveBeenCalled();
  });

  it('updateContent updates content and attachment when ownership verified', async () => {
    const existingJob = { id: 'j2', userId: 'user-a', content: 'old' };
    const updatedJob = { ...existingJob, content: 'new', attachmentUrl: 'https://cdn.example.com/img.png' };
    mockPrisma.job.findFirst.mockResolvedValue(existingJob);
    mockPrisma.job.update.mockResolvedValue(updatedJob);

    const result = await repo.updateContent('j2', 'user-a', 'new', 'https://cdn.example.com/img.png');
    expect(mockPrisma.job.findFirst).toHaveBeenCalledWith({ where: { id: 'j2', userId: 'user-a' } });
    expect(mockPrisma.job.update).toHaveBeenCalledWith({
      where: { id: 'j2' },
      data: { content: 'new', attachmentUrl: 'https://cdn.example.com/img.png' },
    });
    expect(result).toBe(updatedJob);
  });

  it('updateContent can clear content to empty string', async () => {
    mockPrisma.job.findFirst.mockResolvedValue({ id: 'j3', userId: 'u', content: 'old' });
    mockPrisma.job.update.mockResolvedValue({ id: 'j3', content: '' });

    const result = await repo.updateContent('j3', 'u', '', null);
    const updateArg = mockPrisma.job.update.mock.calls[0][0];
    expect(updateArg.data.content).toBe('');
    expect(result).toBeTruthy();
  });

  it('updateContent can set attachmentUrl to null (remove attachment)', async () => {
    mockPrisma.job.findFirst.mockResolvedValue({ id: 'j4', userId: 'u', attachmentUrl: 'https://old.example.com/img.png' });
    mockPrisma.job.update.mockResolvedValue({ id: 'j4', attachmentUrl: null });

    await repo.updateContent('j4', 'u', 'content', null);
    const updateArg = mockPrisma.job.update.mock.calls[0][0];
    expect(updateArg.data.attachmentUrl).toBeNull();
  });

  // --- delete ---

  it('delete returns true when job exists and belongs to user', async () => {
    mockPrisma.job.deleteMany.mockResolvedValue({ count: 1 });
    const result = await repo.delete('j5', 'user-b');
    expect(mockPrisma.job.deleteMany).toHaveBeenCalledWith({ where: { id: 'j5', userId: 'user-b' } });
    expect(result).toBe(true);
  });

  it('delete returns false when no matching row (wrong user or nonexistent)', async () => {
    mockPrisma.job.deleteMany.mockResolvedValue({ count: 0 });
    const result = await repo.delete('j6', 'wrong-user');
    expect(result).toBe(false);
  });

  it('delete enforces userId — cannot delete another user\'s job', async () => {
    mockPrisma.job.deleteMany.mockResolvedValue({ count: 0 });
    const result = await repo.delete('j7', 'attacker');
    expect(mockPrisma.job.deleteMany).toHaveBeenCalledWith({ where: { id: 'j7', userId: 'attacker' } });
    expect(result).toBe(false);
  });

  // --- markCompleted ---

  it('markCompleted sets status to COMPLETED', async () => {
    const updated = { id: 'j8', status: 'COMPLETED' };
    mockPrisma.job.update.mockResolvedValue(updated);

    const result = await repo.markCompleted('j8');
    expect(mockPrisma.job.update).toHaveBeenCalledWith({
      where: { id: 'j8' },
      data: { status: 'COMPLETED' },
    });
    expect(result).toBe(updated);
  });

  // --- hardDelete ---

  it('hardDelete deletes by id without userId check', async () => {
    mockPrisma.job.delete.mockResolvedValue(undefined);
    await repo.hardDelete('j9');
    expect(mockPrisma.job.delete).toHaveBeenCalledWith({ where: { id: 'j9' } });
  });

  // --- findQueued ---

  it('findQueued returns only QUEUED jobs', async () => {
    const queuedJobs = [{ id: 'j10', status: 'QUEUED' }];
    mockPrisma.job.findMany.mockResolvedValue(queuedJobs);

    const result = await repo.findQueued();
    expect(mockPrisma.job.findMany).toHaveBeenCalledWith({ where: { status: 'QUEUED' } });
    expect(result).toBe(queuedJobs);
  });

  it('findQueued returns empty array when no queued jobs', async () => {
    mockPrisma.job.findMany.mockResolvedValue([]);
    const result = await repo.findQueued();
    expect(result).toEqual([]);
  });

  // --- findQueuedByUserId ---

  it('findQueuedByUserId queries by both QUEUED status and userId', async () => {
    const jobs = [{ id: 'j12', status: 'QUEUED', userId: 'user-x' }];
    mockPrisma.job.findMany.mockResolvedValue(jobs);

    const result = await repo.findQueuedByUserId('user-x');
    expect(mockPrisma.job.findMany).toHaveBeenCalledWith({ where: { status: 'QUEUED', userId: 'user-x' } });
    expect(result).toBe(jobs);
  });

  it('findQueuedByUserId returns empty array when user has no queued jobs', async () => {
    mockPrisma.job.findMany.mockResolvedValue([]);
    const result = await repo.findQueuedByUserId('user-none');
    expect(result).toEqual([]);
  });

  // --- markFailed ---

  it('markFailed sets status to FAILED', async () => {
    const updated = { id: 'j11', status: 'FAILED' };
    mockPrisma.job.update.mockResolvedValue(updated);

    const result = await repo.markFailed('j11');
    expect(mockPrisma.job.update).toHaveBeenCalledWith({
      where: { id: 'j11' },
      data: { status: 'FAILED' },
    });
    expect(result).toBe(updated);
  });
});
