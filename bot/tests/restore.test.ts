import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock logger
vi.mock('../src/utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock config (must be before queue import)
vi.mock('../src/config.js', () => ({
  config: {
    DISCORD_TOKEN: 'test-token',
    CLIENT_ID: 'test-client',
    DATABASE_URL: 'postgresql://test',
    REDIS_URL: 'redis://localhost:6379',
    LOG_LEVEL: 'info',
  },
}));

// Mock JobRepository
const mockRepo = {
  countByUserId: vi.fn(),
  create: vi.fn(),
  findById: vi.fn(),
  findAllByUserId: vi.fn(),
  findAll: vi.fn(),
  findQueued: vi.fn(),
  findTerminal: vi.fn(),
  updateSendTimes: vi.fn(),
  updateContent: vi.fn(),
  delete: vi.fn(),
  hardDelete: vi.fn(),
  markCompleted: vi.fn(),
  markFailed: vi.fn(),
};
vi.mock('../src/repositories/JobRepository.js', () => ({
  jobRepository: mockRepo,
}));

// Mock BullMQ jobQueue
const mockQueueJob = { remove: vi.fn() };
const mockQueue = {
  add: vi.fn(),
  getJob: vi.fn(),
};
vi.mock('../src/queue/queues.js', () => ({
  jobQueue: mockQueue,
}));

const { jobService } = await import('../src/services/JobService.js');
const mockClient = {} as Parameters<typeof jobService.restoreJobs>[0];

describe('jobService.restoreJobs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueueJob.remove.mockResolvedValue(undefined);
    mockQueue.add.mockResolvedValue(undefined);
    mockQueue.getJob.mockResolvedValue(null);
    mockRepo.findTerminal.mockResolvedValue([]);
  });

  it('should enqueue each future time for queued jobs', async () => {
    const futureDate = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    mockRepo.findQueued.mockResolvedValue([
      {
        id: 'uuid-1',
        channelId: 'chan-1',
        sendTimes: [futureDate],
        content: 'Hello',
        frequency: 'once',
        attachmentUrl: null,
        userId: 'user-1',
        status: 'QUEUED',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    await jobService.restoreJobs(mockClient);

    expect(mockQueue.add).toHaveBeenCalledTimes(1);
    expect(mockQueue.add).toHaveBeenCalledWith(
      'send',
      expect.objectContaining({ jobId: 'uuid-1', channelId: 'chan-1', isoTime: futureDate }),
      expect.objectContaining({ jobId: `uuid-1_${futureDate.replace(/:/g, '_')}` }),
    );
  });

  it('should hard-delete job and not enqueue when all sendTimes are past', async () => {
    const pastDate = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    mockRepo.findQueued.mockResolvedValue([
      {
        id: 'uuid-2',
        channelId: 'chan-2',
        sendTimes: [pastDate],
        content: 'Past message',
        frequency: 'once',
        attachmentUrl: null,
        userId: 'user-2',
        status: 'QUEUED',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    mockRepo.hardDelete.mockResolvedValue(undefined);

    await jobService.restoreJobs(mockClient);

    expect(mockRepo.hardDelete).toHaveBeenCalledWith('uuid-2');
    expect(mockQueue.add).not.toHaveBeenCalled();
  });

  it('should prune past times and enqueue only future times from a mixed array', async () => {
    const pastDate = new Date(Date.now() - 1000).toISOString();
    const futureDate = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    mockRepo.findQueued.mockResolvedValue([
      {
        id: 'uuid-3',
        channelId: 'chan-3',
        sendTimes: [pastDate, futureDate],
        content: 'Mixed',
        frequency: 'daily',
        attachmentUrl: null,
        userId: 'user-3',
        status: 'QUEUED',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    mockRepo.updateSendTimes.mockResolvedValue({});

    await jobService.restoreJobs(mockClient);

    expect(mockRepo.updateSendTimes).toHaveBeenCalledWith('uuid-3', [futureDate]);
    expect(mockQueue.add).toHaveBeenCalledTimes(1);
    expect(mockQueue.add).toHaveBeenCalledWith(
      'send',
      expect.objectContaining({ isoTime: futureDate }),
      expect.anything(),
    );
  });

  it('should handle empty result set gracefully', async () => {
    mockRepo.findQueued.mockResolvedValue([]);

    await jobService.restoreJobs(mockClient);

    expect(mockQueue.add).not.toHaveBeenCalled();
  });

  it('should skip times already in the queue', async () => {
    const futureDate = new Date(Date.now() + 3600000).toISOString();
    mockRepo.findQueued.mockResolvedValue([
      {
        id: 'uuid-10',
        channelId: 'chan-a',
        sendTimes: [futureDate],
        content: 'Msg',
        frequency: 'once',
        attachmentUrl: null,
        userId: 'user-a',
        status: 'QUEUED',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    // Simulate the job already exists in BullMQ
    mockQueue.getJob.mockResolvedValue({ id: `uuid-10_${futureDate.replace(/:/g, '_')}` });

    await jobService.restoreJobs(mockClient);

    expect(mockQueue.add).not.toHaveBeenCalled();
  });

  it('should enqueue multiple jobs', async () => {
    const future1 = new Date(Date.now() + 3600000).toISOString();
    const future2 = new Date(Date.now() + 7200000).toISOString();
    mockRepo.findQueued.mockResolvedValue([
      {
        id: 'uuid-20',
        channelId: 'chan-x',
        sendTimes: [future1],
        content: 'Msg A',
        frequency: 'once',
        attachmentUrl: null,
        userId: 'user-x',
        status: 'QUEUED',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'uuid-21',
        channelId: 'chan-y',
        sendTimes: [future2],
        content: 'Msg B',
        frequency: 'once',
        attachmentUrl: null,
        userId: 'user-y',
        status: 'QUEUED',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    await jobService.restoreJobs(mockClient);

    expect(mockQueue.add).toHaveBeenCalledTimes(2);
  });

  it('should use correct BullMQ job ID format', async () => {
    const futureDate = new Date(Date.now() + 3600000).toISOString();
    mockRepo.findQueued.mockResolvedValue([
      {
        id: 'job-uuid-1',
        channelId: 'chan-1',
        sendTimes: [futureDate],
        content: 'Test',
        frequency: 'once',
        attachmentUrl: null,
        userId: 'user-1',
        status: 'QUEUED',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    await jobService.restoreJobs(mockClient);

    expect(mockQueue.add).toHaveBeenCalledWith(
      'send',
      expect.anything(),
      expect.objectContaining({ jobId: `job-uuid-1_${futureDate.replace(/:/g, '_')}` }),
    );
  });

  it('should hard-delete terminal (COMPLETED/FAILED) records on startup', async () => {
    mockRepo.findTerminal.mockResolvedValue([
      { id: 'old-completed', sendTimes: [], status: 'COMPLETED' },
      { id: 'old-failed', sendTimes: [], status: 'FAILED' },
    ]);
    mockRepo.findQueued.mockResolvedValue([]);
    mockRepo.hardDelete.mockResolvedValue(undefined);

    await jobService.restoreJobs(mockClient);

    expect(mockRepo.hardDelete).toHaveBeenCalledWith('old-completed');
    expect(mockRepo.hardDelete).toHaveBeenCalledWith('old-failed');
  });

  it('should hard-delete DEAD jobs on startup', async () => {
    mockRepo.findTerminal.mockResolvedValue([
      { id: 'dead-job', sendTimes: [], status: 'DEAD' },
    ]);
    mockRepo.findQueued.mockResolvedValue([]);
    mockRepo.hardDelete.mockResolvedValue(undefined);

    await jobService.restoreJobs(mockClient);

    expect(mockRepo.hardDelete).toHaveBeenCalledWith('dead-job');
  });

  it('should not enqueue jobs with no sendTimes', async () => {
    mockRepo.findQueued.mockResolvedValue([
      { id: 'uuid-empty', channelId: 'chan-e', sendTimes: [], content: 'no times', frequency: 'once', attachmentUrl: null, userId: 'u', status: 'QUEUED', createdAt: new Date(), updatedAt: new Date() },
    ]);

    await jobService.restoreJobs(mockClient);
    expect(mockQueue.add).not.toHaveBeenCalled();
  });
});
