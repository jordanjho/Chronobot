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

// Mock config
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
  updateSendTimes: vi.fn(),
  updateContent: vi.fn(),
  delete: vi.fn(),
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

describe('jobService.cancelJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueueJob.remove.mockResolvedValue(undefined);
    mockQueue.add.mockResolvedValue(undefined);
    mockQueue.getJob.mockResolvedValue(null);
  });

  it('should return false when job does not exist', async () => {
    mockRepo.findById.mockResolvedValue(null);

    const result = await jobService.cancelJob('uuid-99', 'user-1');

    expect(result).toBe(false);
    expect(mockRepo.delete).not.toHaveBeenCalled();
  });

  it('should return false when job belongs to different user', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 'uuid-1',
      userId: 'user-other',
      channelId: 'chan-1',
      sendTimes: ['2099-01-01T00:00:00.000Z'],
      status: 'QUEUED',
    });

    const result = await jobService.cancelJob('uuid-1', 'user-1');

    expect(result).toBe(false);
    expect(mockRepo.delete).not.toHaveBeenCalled();
  });

  it('should remove BullMQ jobs and delete DB record on success', async () => {
    const isoTime = '2099-01-01T00:00:00.000Z';
    mockRepo.findById.mockResolvedValue({
      id: 'uuid-1',
      userId: 'user-1',
      channelId: 'chan-1',
      sendTimes: [isoTime],
      status: 'QUEUED',
    });
    mockQueue.getJob.mockResolvedValue(mockQueueJob);
    mockRepo.delete.mockResolvedValue(true);

    const result = await jobService.cancelJob('uuid-1', 'user-1');

    expect(result).toBe(true);
    expect(mockQueue.getJob).toHaveBeenCalledWith(`uuid-1:${isoTime}`);
    expect(mockQueueJob.remove).toHaveBeenCalledOnce();
    expect(mockRepo.delete).toHaveBeenCalledWith('uuid-1', 'user-1');
  });

  it('should cancel multiple BullMQ jobs when job has multiple send times', async () => {
    const time1 = '2099-01-01T00:00:00.000Z';
    const time2 = '2099-01-08T00:00:00.000Z';
    mockRepo.findById.mockResolvedValue({
      id: 'uuid-2',
      userId: 'user-1',
      channelId: 'chan-1',
      sendTimes: [time1, time2],
      status: 'QUEUED',
    });
    mockQueue.getJob.mockResolvedValue(mockQueueJob);
    mockRepo.delete.mockResolvedValue(true);

    await jobService.cancelJob('uuid-2', 'user-1');

    expect(mockQueue.getJob).toHaveBeenCalledWith(`uuid-2:${time1}`);
    expect(mockQueue.getJob).toHaveBeenCalledWith(`uuid-2:${time2}`);
    expect(mockQueueJob.remove).toHaveBeenCalledTimes(2);
  });

  it('should handle missing BullMQ job gracefully (already fired)', async () => {
    const isoTime = '2099-01-01T00:00:00.000Z';
    mockRepo.findById.mockResolvedValue({
      id: 'uuid-3',
      userId: 'user-1',
      channelId: 'chan-1',
      sendTimes: [isoTime],
      status: 'QUEUED',
    });
    mockQueue.getJob.mockResolvedValue(null);
    mockRepo.delete.mockResolvedValue(true);

    const result = await jobService.cancelJob('uuid-3', 'user-1');

    expect(result).toBe(true);
    expect(mockQueueJob.remove).not.toHaveBeenCalled();
  });

  it('should still delete DB record even when no BullMQ jobs found', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 'uuid-4',
      userId: 'user-1',
      channelId: 'chan-1',
      sendTimes: ['2099-01-01T00:00:00.000Z'],
      status: 'QUEUED',
    });
    mockQueue.getJob.mockResolvedValue(null);
    mockRepo.delete.mockResolvedValue(true);

    await jobService.cancelJob('uuid-4', 'user-1');

    expect(mockRepo.delete).toHaveBeenCalledWith('uuid-4', 'user-1');
  });
});
