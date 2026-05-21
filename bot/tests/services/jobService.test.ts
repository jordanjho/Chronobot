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
  hardDelete: vi.fn(),
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

const { jobService, bullmqJobId } = await import('../../src/services/JobService.js');
const { registry, jobsEnqueued } = await import('../../src/metrics/metrics.js');
const mockClient = {} as Parameters<typeof jobService.createJob>[1];

describe('jobService.createJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registry.resetMetrics();
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
      expect.objectContaining({ jobId: `job-uuid-1_${futureTime.replace(/:/g, '_')}`, attempts: 3 }),
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

  it('should hard-delete DB record and rethrow if BullMQ enqueue fails', async () => {
    const futureTime = new Date(Date.now() + 3600000).toISOString();
    const createdJob = {
      id: 'job-uuid-rollback',
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
    mockRepo.hardDelete.mockResolvedValue(undefined);
    mockQueue.add.mockRejectedValue(new Error('Custom Id cannot contain :'));

    await expect(
      jobService.createJob(
        { channelId: 'chan-1', userId: 'user-1', content: 'Test', frequency: 'once', sendTimes: [futureTime] },
        mockClient,
      ),
    ).rejects.toThrow('Custom Id cannot contain :');

    expect(mockRepo.hardDelete).toHaveBeenCalledWith('job-uuid-rollback');
  });

  it('should not call queue.add when all sendTimes are in the past', async () => {
    const pastTime1 = new Date(Date.now() - 7200000).toISOString();
    const pastTime2 = new Date(Date.now() - 3600000).toISOString();
    mockRepo.create.mockResolvedValue({
      id: 'job-allpast',
      channelId: 'chan-1',
      userId: 'user-1',
      content: 'Test',
      frequency: 'daily',
      sendTimes: [pastTime1, pastTime2],
      attachmentUrl: null,
      status: 'QUEUED',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await jobService.createJob(
      { channelId: 'chan-1', userId: 'user-1', content: 'Test', frequency: 'daily', sendTimes: [pastTime1, pastTime2] },
      mockClient,
    );

    expect(result.id).toBe('job-allpast');
    expect(mockQueue.add).not.toHaveBeenCalled();
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

  it('increments jobsEnqueued once per future sendTime', async () => {
    const futureTime = new Date(Date.now() + 3600000).toISOString();
    mockRepo.create.mockResolvedValue({
      id: 'job-metrics-1',
      channelId: 'chan-1',
      userId: 'user-1',
      content: 'Hello',
      frequency: 'once',
      sendTimes: [futureTime],
      attachmentUrl: null,
      status: 'QUEUED',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await jobService.createJob(
      { channelId: 'chan-1', userId: 'user-1', content: 'Hello', frequency: 'once', sendTimes: [futureTime] },
      mockClient,
    );

    const { values } = await jobsEnqueued.get();
    expect(values.find(v => v.labels.frequency === 'once')?.value).toBe(1);
  });

  it('enqueues all future sendTimes when job has multiple (daily)', async () => {
    const t1 = new Date(Date.now() + 1 * 3600000).toISOString();
    const t2 = new Date(Date.now() + 2 * 3600000).toISOString();
    const t3 = new Date(Date.now() + 3 * 3600000).toISOString();
    mockRepo.create.mockResolvedValue({
      id: 'job-multi',
      channelId: 'chan-1',
      userId: 'user-1',
      content: 'Daily',
      frequency: 'daily',
      sendTimes: [t1, t2, t3],
      attachmentUrl: null,
      status: 'QUEUED',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await jobService.createJob(
      { channelId: 'chan-1', userId: 'user-1', content: 'Daily', frequency: 'daily', sendTimes: [t1, t2, t3] },
      mockClient,
    );

    expect(mockQueue.add).toHaveBeenCalledTimes(3);
  });

  it('does not increment jobsEnqueued for past sendTimes', async () => {
    const pastTime = new Date(Date.now() - 3600000).toISOString();
    mockRepo.create.mockResolvedValue({
      id: 'job-metrics-2',
      channelId: 'chan-1',
      userId: 'user-1',
      content: 'Hello',
      frequency: 'once',
      sendTimes: [pastTime],
      attachmentUrl: null,
      status: 'QUEUED',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await jobService.createJob(
      { channelId: 'chan-1', userId: 'user-1', content: 'Hello', frequency: 'once', sendTimes: [pastTime] },
      mockClient,
    );

    const { values } = await jobsEnqueued.get();
    expect(values.length).toBe(0);
  });
});

describe('bullmqJobId helper', () => {
  it('formats as <jobId>_<isoTime with colons replaced by underscores>', () => {
    const result = bullmqJobId('abc-uuid', '2099-01-01T12:30:45.000Z');
    expect(result).toBe('abc-uuid_2099-01-01T12_30_45.000Z');
  });

  it('replaces ALL colons in isoTime (HH, mm, ss)', () => {
    const result = bullmqJobId('job-1', '2099-12-31T23:59:59.000Z');
    expect(result).not.toContain(':');
    expect(result).toBe('job-1_2099-12-31T23_59_59.000Z');
  });

  it('handles isoTime with no colons gracefully (no-op)', () => {
    const result = bullmqJobId('job-2', '2099-01-01T000000.000Z');
    expect(result).toBe('job-2_2099-01-01T000000.000Z');
  });
});

describe('bullmqJobId helper', () => {
  it('replaces colons with underscores', () => {
    expect(bullmqJobId('abc-uuid', '2026-05-20T12:30:00.000Z')).toBe('abc-uuid_2026-05-20T12_30_00.000Z');
  });

  it('produces an ID with no colons', () => {
    const id = bullmqJobId('some-uuid', '2026-01-01T00:00:00.000Z');
    expect(id).not.toContain(':');
  });
});
