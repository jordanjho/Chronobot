import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock logger
vi.mock('../../src/utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock config
vi.mock('../../src/config.js', () => ({
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
  updateSendTimes: vi.fn(),
  updateContent: vi.fn(),
  delete: vi.fn(),
  markCompleted: vi.fn(),
  markFailed: vi.fn(),
};
vi.mock('../../src/repositories/JobRepository.js', () => ({
  jobRepository: mockRepo,
}));

// Mock BullMQ jobQueue
const mockQueueJob = { remove: vi.fn() };
const mockQueue = {
  add: vi.fn(),
  getJob: vi.fn(),
};
vi.mock('../../src/queue/queues.js', () => ({
  jobQueue: mockQueue,
}));

const { jobService } = await import('../../src/services/JobService.js');
const mockClient = {} as Parameters<typeof jobService.createJob>[1];

describe('jobService.createJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueue.add.mockResolvedValue(undefined);
    mockQueue.getJob.mockResolvedValue(null);
    mockQueueJob.remove.mockResolvedValue(undefined);
  });

  it('should create a DB job and enqueue BullMQ job', async () => {
    const futureTime = new Date(Date.now() + 3600000).toISOString();
    const createdJob = {
      id: 'job-uuid-1',
      channelId: 'chan-1',
      userId: 'user-1',
      content: 'Hello',
      frequency: 'once',
      sendTimes: [futureTime],
      attachmentUrl: null,
      status: 'QUEUED',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockRepo.create.mockResolvedValue(createdJob);

    const result = await jobService.createJob(
      { channelId: 'chan-1', userId: 'user-1', content: 'Hello', frequency: 'once', sendTimes: [futureTime] },
      mockClient,
    );

    expect(result.id).toBe('job-uuid-1');
    expect(mockQueue.add).toHaveBeenCalledTimes(1);
    expect(mockQueue.add).toHaveBeenCalledWith(
      'send',
      expect.objectContaining({ jobId: 'job-uuid-1', channelId: 'chan-1', isoTime: futureTime }),
      expect.objectContaining({ jobId: `job-uuid-1:${futureTime}`, attempts: 3 }),
    );
  });

  it('should skip past sendTimes when enqueueing', async () => {
    const pastTime = new Date(Date.now() - 3600000).toISOString();
    const futureTime = new Date(Date.now() + 3600000).toISOString();
    const createdJob = {
      id: 'job-uuid-2',
      channelId: 'chan-1',
      userId: 'user-1',
      content: 'Hello',
      frequency: 'daily',
      sendTimes: [pastTime, futureTime],
      attachmentUrl: null,
      status: 'QUEUED',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockRepo.create.mockResolvedValue(createdJob);

    await jobService.createJob(
      { channelId: 'chan-1', userId: 'user-1', content: 'Hello', frequency: 'daily', sendTimes: [pastTime, futureTime] },
      mockClient,
    );

    expect(mockQueue.add).toHaveBeenCalledTimes(1);
    expect(mockQueue.add).toHaveBeenCalledWith(
      'send',
      expect.objectContaining({ isoTime: futureTime }),
      expect.anything(),
    );
  });

  it('should return the created job', async () => {
    const futureTime = new Date(Date.now() + 3600000).toISOString();
    const createdJob = {
      id: 'job-uuid-3',
      channelId: 'chan-1',
      userId: 'user-1',
      content: 'Test',
      frequency: 'once',
      sendTimes: [futureTime],
      attachmentUrl: null,
      status: 'QUEUED',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockRepo.create.mockResolvedValue(createdJob);

    const result = await jobService.createJob(
      { channelId: 'chan-1', userId: 'user-1', content: 'Test', frequency: 'once', sendTimes: [futureTime] },
      mockClient,
    );

    expect(result).toEqual(createdJob);
  });

  it('should use exponential backoff in queue options', async () => {
    const futureTime = new Date(Date.now() + 3600000).toISOString();
    mockRepo.create.mockResolvedValue({
      id: 'job-uuid-4',
      channelId: 'chan-1',
      userId: 'user-1',
      content: 'Test',
      frequency: 'once',
      sendTimes: [futureTime],
      attachmentUrl: null,
      status: 'QUEUED',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await jobService.createJob(
      { channelId: 'chan-1', userId: 'user-1', content: 'Test', frequency: 'once', sendTimes: [futureTime] },
      mockClient,
    );

    expect(mockQueue.add).toHaveBeenCalledWith(
      'send',
      expect.anything(),
      expect.objectContaining({
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      }),
    );
  });
});
