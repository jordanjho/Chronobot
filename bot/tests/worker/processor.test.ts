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
const mockJobRepo = {
  findById: vi.fn(),
  updateSendTimes: vi.fn(),
  hardDelete: vi.fn(),
  markFailed: vi.fn(),
  markDead: vi.fn(),
};
vi.mock('../../src/repositories/JobRepository.js', () => ({
  jobRepository: mockJobRepo,
}));

// Mock ExecutionRepository
const mockExecRepo = {
  create: vi.fn(),
  complete: vi.fn(),
  fail: vi.fn(),
  findByJobId: vi.fn(),
  findByBullmqJobId: vi.fn(),
};
vi.mock('../../src/repositories/ExecutionRepository.js', () => ({
  executionRepository: mockExecRepo,
}));

// Mock DiscordAdapter
const mockAdapterExecute = vi.fn();
vi.mock('../../src/adapters/DiscordAdapter.js', () => ({
  DiscordAdapter: vi.fn().mockImplementation(() => ({
    execute: mockAdapterExecute,
  })),
}));

// Mock metrics
const mockMetrics = {
  jobsCompleted: { inc: vi.fn() },
  jobsFailed: { labels: vi.fn().mockReturnValue({ inc: vi.fn() }) },
  jobsDead: { inc: vi.fn() },
  jobDurationMs: { observe: vi.fn() },
  jobScheduleDelayMs: { observe: vi.fn() },
  activeWorkers: { inc: vi.fn(), dec: vi.fn() },
};
vi.mock('../../src/metrics/metrics.js', () => mockMetrics);

// Mock BullMQ Worker
const mockWorkerOn = vi.fn();
vi.mock('bullmq', () => ({
  Worker: vi.fn().mockImplementation((_queue: string, processor: Function, _opts: unknown) => {
    return {
      on: mockWorkerOn,
      _processor: processor,
    };
  }),
}));

const { createWorker } = await import('../../src/worker/processor.js');
const { Worker } = await import('bullmq');

const mockChannelSend = vi.fn().mockResolvedValue(undefined);
const mockFetchChannel = vi.fn().mockResolvedValue({
  isTextBased: () => true,
  send: mockChannelSend,
});
const mockClient = {
  channels: { fetch: mockFetchChannel },
} as never;

describe('createWorker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a Worker on the "jobs" queue', () => {
    createWorker(mockClient);
    expect(Worker).toHaveBeenCalledWith('jobs', expect.any(Function), expect.any(Object));
  });

  it('should register a "failed" event handler', () => {
    createWorker(mockClient);
    expect(mockWorkerOn).toHaveBeenCalledWith('failed', expect.any(Function));
  });
});

describe('worker processor function', () => {
  let processorFn: Function;

  beforeEach(() => {
    vi.clearAllMocks();
    mockExecRepo.findByBullmqJobId.mockResolvedValue(null);
    const worker = createWorker(mockClient) as { _processor: Function };
    processorFn = worker._processor;
  });

  it('should create execution, call adapter, and complete on success', async () => {
    const execution = { id: 'exec-1', jobId: 'job-1', attempt: 1, status: 'STARTED', startedAt: new Date(), completedAt: null, error: null };
    mockExecRepo.create.mockResolvedValue(execution);
    mockAdapterExecute.mockResolvedValue({ success: true, messageId: 'msg-1' });
    mockJobRepo.findById.mockResolvedValue({ id: 'job-1', sendTimes: ['2099-01-01T00:00:00.000Z'] });
    mockJobRepo.hardDelete.mockResolvedValue(undefined);
    mockExecRepo.complete.mockResolvedValue({});

    const bullmqId = 'job-1_2099-01-01T00_00_00.000Z';
    const job = {
      id: bullmqId,
      data: { jobId: 'job-1', channelId: 'chan-1', isoTime: '2099-01-01T00:00:00.000Z' },
      attemptsMade: 0,
    };

    await processorFn(job);

    expect(mockExecRepo.create).toHaveBeenCalledWith('job-1', 1, bullmqId);
    expect(mockAdapterExecute).toHaveBeenCalledWith({
      jobId: 'job-1',
      channelId: 'chan-1',
      isoTime: '2099-01-01T00:00:00.000Z',
    });
    expect(mockExecRepo.complete).toHaveBeenCalledWith('exec-1');
  });

  it('should fail execution and throw when adapter returns failure', async () => {
    const execution = { id: 'exec-2', jobId: 'job-1', attempt: 1, status: 'STARTED', startedAt: new Date(), completedAt: null, error: null };
    mockExecRepo.create.mockResolvedValue(execution);
    mockAdapterExecute.mockResolvedValue({ success: false, error: 'Channel not found' });
    mockExecRepo.fail.mockResolvedValue({});

    const job = {
      id: 'job-1_2099-01-01T00_00_00.000Z',
      data: { jobId: 'job-1', channelId: 'chan-1', isoTime: '2099-01-01T00:00:00.000Z' },
      attemptsMade: 0,
    };

    await expect(processorFn(job)).rejects.toThrow('Channel not found');
    expect(mockExecRepo.fail).toHaveBeenCalledWith('exec-2', 'Channel not found');
    expect(mockExecRepo.complete).not.toHaveBeenCalled();
  });

  it('should hard-delete job when no remaining sendTimes', async () => {
    const isoTime = '2099-01-01T00:00:00.000Z';
    mockExecRepo.create.mockResolvedValue({ id: 'exec-3' });
    mockAdapterExecute.mockResolvedValue({ success: true, messageId: 'msg-1' });
    mockJobRepo.findById.mockResolvedValue({ id: 'job-1', sendTimes: [isoTime] });
    mockJobRepo.hardDelete.mockResolvedValue(undefined);
    mockExecRepo.complete.mockResolvedValue({});

    const job = {
      id: `job-1_${isoTime.replace(/:/g, '_')}`,
      data: { jobId: 'job-1', channelId: 'chan-1', isoTime },
      attemptsMade: 0,
    };

    await processorFn(job);

    expect(mockJobRepo.hardDelete).toHaveBeenCalledWith('job-1');
    expect(mockJobRepo.updateSendTimes).not.toHaveBeenCalled();
  });

  it('should complete without error when findById returns null (job already cleaned up)', async () => {
    const isoTime = '2099-01-01T00:00:00.000Z';
    mockExecRepo.create.mockResolvedValue({ id: 'exec-null' });
    mockAdapterExecute.mockResolvedValue({ success: true, messageId: 'msg-1' });
    // Job was hard-deleted by a concurrent process before we can update sendTimes
    mockJobRepo.findById.mockResolvedValue(null);
    mockExecRepo.complete.mockResolvedValue({});

    const job = {
      id: `job-null_${isoTime.replace(/:/g, '_')}`,
      data: { jobId: 'job-null', channelId: 'chan-1', isoTime },
      attemptsMade: 0,
    };

    // Should not throw — just completes silently
    await expect(processorFn(job)).resolves.toBeUndefined();
    expect(mockExecRepo.complete).toHaveBeenCalledWith('exec-null');
    expect(mockJobRepo.updateSendTimes).not.toHaveBeenCalled();
    expect(mockJobRepo.hardDelete).not.toHaveBeenCalled();
  });

  it('should update remaining sendTimes when more times left', async () => {
    const isoTime1 = '2099-01-01T00:00:00.000Z';
    const isoTime2 = '2099-01-08T00:00:00.000Z';
    mockExecRepo.create.mockResolvedValue({ id: 'exec-4' });
    mockAdapterExecute.mockResolvedValue({ success: true, messageId: 'msg-1' });
    mockJobRepo.findById.mockResolvedValue({ id: 'job-1', sendTimes: [isoTime1, isoTime2] });
    mockJobRepo.updateSendTimes.mockResolvedValue({});
    mockExecRepo.complete.mockResolvedValue({});

    const job = {
      id: `job-1_${isoTime1.replace(/:/g, '_')}`,
      data: { jobId: 'job-1', channelId: 'chan-1', isoTime: isoTime1 },
      attemptsMade: 0,
    };

    await processorFn(job);

    expect(mockJobRepo.updateSendTimes).toHaveBeenCalledWith('job-1', [isoTime2]);
    expect(mockJobRepo.hardDelete).not.toHaveBeenCalled();
  });

  it('should skip adapter when duplicate delivery with COMPLETED execution', async () => {
    const bullmqId = 'job-1_2099-01-01T00_00_00.000Z';
    mockExecRepo.findByBullmqJobId.mockResolvedValue({ id: 'exec-old', status: 'COMPLETED' });

    const job = {
      id: bullmqId,
      data: { jobId: 'job-1', channelId: 'chan-1', isoTime: '2099-01-01T00:00:00.000Z' },
      attemptsMade: 0,
    };

    await processorFn(job);

    expect(mockAdapterExecute).not.toHaveBeenCalled();
    expect(mockExecRepo.create).not.toHaveBeenCalled();
    expect(mockExecRepo.complete).not.toHaveBeenCalled();
  });

  it('should re-execute when prior attempt crashed mid-flight (STARTED execution exists)', async () => {
    const bullmqId = 'job-1_2099-01-01T00_00_00.000Z';
    mockExecRepo.findByBullmqJobId.mockResolvedValue({ id: 'exec-stale', status: 'STARTED' });
    mockExecRepo.create.mockResolvedValue({ id: 'exec-new' });
    mockAdapterExecute.mockResolvedValue({ success: true, messageId: 'msg-1' });
    mockJobRepo.findById.mockResolvedValue({ id: 'job-1', sendTimes: ['2099-01-01T00:00:00.000Z'] });
    mockJobRepo.hardDelete.mockResolvedValue(undefined);
    mockExecRepo.complete.mockResolvedValue({});

    const job = {
      id: bullmqId,
      data: { jobId: 'job-1', channelId: 'chan-1', isoTime: '2099-01-01T00:00:00.000Z' },
      attemptsMade: 1,
    };

    await processorFn(job);

    expect(mockAdapterExecute).toHaveBeenCalled();
    expect(mockExecRepo.create).toHaveBeenCalledWith('job-1', 2, bullmqId);
    expect(mockExecRepo.complete).toHaveBeenCalledWith('exec-new');
  });

  it('should propagate error and not call complete when adapter throws directly', async () => {
    mockExecRepo.create.mockResolvedValue({ id: 'exec-throw' });
    mockAdapterExecute.mockRejectedValue(new Error('Discord API error'));

    const job = {
      id: 'job-1_2099-01-01T00_00_00.000Z',
      data: { jobId: 'job-1', channelId: 'chan-1', isoTime: '2099-01-01T00:00:00.000Z' },
      attemptsMade: 0,
    };

    await expect(processorFn(job)).rejects.toThrow('Discord API error');
    expect(mockExecRepo.fail).not.toHaveBeenCalled();
    expect(mockExecRepo.complete).not.toHaveBeenCalled();
  });

  it('should complete successfully when job is not found after send (orphaned BullMQ job)', async () => {
    mockExecRepo.create.mockResolvedValue({ id: 'exec-orphan' });
    mockAdapterExecute.mockResolvedValue({ success: true, messageId: 'msg-1' });
    mockJobRepo.findById.mockResolvedValue(null);
    mockExecRepo.complete.mockResolvedValue({});

    const job = {
      id: 'job-1_2099-01-01T00_00_00.000Z',
      data: { jobId: 'job-1', channelId: 'chan-1', isoTime: '2099-01-01T00:00:00.000Z' },
      attemptsMade: 0,
    };

    await processorFn(job);

    expect(mockExecRepo.complete).toHaveBeenCalledWith('exec-orphan');
    expect(mockJobRepo.hardDelete).not.toHaveBeenCalled();
    expect(mockJobRepo.updateSendTimes).not.toHaveBeenCalled();
  });

  it('should pass bullmqJobId to create on first delivery', async () => {
    const bullmqId = 'job-1_2099-01-01T00_00_00.000Z';
    mockExecRepo.create.mockResolvedValue({ id: 'exec-5' });
    mockAdapterExecute.mockResolvedValue({ success: true, messageId: 'msg-1' });
    mockJobRepo.findById.mockResolvedValue({ id: 'job-1', sendTimes: ['2099-01-01T00:00:00.000Z'] });
    mockJobRepo.hardDelete.mockResolvedValue(undefined);
    mockExecRepo.complete.mockResolvedValue({});

    const job = {
      id: bullmqId,
      data: { jobId: 'job-1', channelId: 'chan-1', isoTime: '2099-01-01T00:00:00.000Z' },
      attemptsMade: 0,
    };

    await processorFn(job);

    expect(mockExecRepo.create).toHaveBeenCalledWith('job-1', 1, bullmqId);
  });
});

describe('worker failed event handler', () => {
  let failedHandler: Function;

  beforeEach(() => {
    vi.clearAllMocks();
    mockMetrics.jobsFailed.labels.mockReturnValue({ inc: vi.fn() });
    createWorker(mockClient);
    const failedCall = mockWorkerOn.mock.calls.find(c => c[0] === 'failed');
    failedHandler = failedCall![1];
  });

  it('should mark job DEAD when attempts exhausted', async () => {
    mockJobRepo.markDead.mockResolvedValue({});
    const job = {
      data: { jobId: 'job-1', channelId: 'chan-1' },
      attemptsMade: 3,
      opts: { attempts: 3 },
    };

    await failedHandler(job, new Error('Adapter error'));

    expect(mockJobRepo.markDead).toHaveBeenCalledWith('job-1');
    expect(mockJobRepo.markFailed).not.toHaveBeenCalled();
  });

  it('should NOT mark job DEAD when retries remain', async () => {
    const job = {
      data: { jobId: 'job-1', channelId: 'chan-1' },
      attemptsMade: 1,
      opts: { attempts: 3 },
    };

    await failedHandler(job, new Error('Transient error'));

    expect(mockJobRepo.markDead).not.toHaveBeenCalled();
    expect(mockJobRepo.markFailed).not.toHaveBeenCalled();
  });

  it('should notify the channel when a job is marked DEAD', async () => {
    mockJobRepo.markDead.mockResolvedValue({});
    const job = {
      data: { jobId: 'job-dead-notify', channelId: 'chan-dead' },
      attemptsMade: 3,
      opts: { attempts: 3 },
    };

    await failedHandler(job, new Error('Exhausted'));

    expect(mockFetchChannel).toHaveBeenCalledWith('chan-dead');
    expect(mockChannelSend).toHaveBeenCalledWith(
      expect.stringContaining('job-dead-notify'),
    );
  });

  it('should silently swallow notification errors so markDead still succeeds', async () => {
    mockJobRepo.markDead.mockResolvedValue({});
    mockFetchChannel.mockRejectedValueOnce(new Error('Channel not found'));
    const job = {
      data: { jobId: 'job-notify-fail', channelId: 'chan-gone' },
      attemptsMade: 3,
      opts: { attempts: 3 },
    };

    await expect(failedHandler(job, new Error('Exhausted'))).resolves.toBeUndefined();
    expect(mockJobRepo.markDead).toHaveBeenCalledWith('job-notify-fail');
  });

  it('should not notify when channel is not text-based', async () => {
    mockJobRepo.markDead.mockResolvedValue({});
    mockFetchChannel.mockResolvedValueOnce({ isTextBased: () => false });
    const job = {
      data: { jobId: 'job-no-text', channelId: 'chan-voice' },
      attemptsMade: 3,
      opts: { attempts: 3 },
    };

    await failedHandler(job, new Error('Exhausted'));

    expect(mockChannelSend).not.toHaveBeenCalled();
    expect(mockJobRepo.markDead).toHaveBeenCalledWith('job-no-text');
  });

  it('should handle null job gracefully', async () => {
    await expect(failedHandler(null, new Error('Unknown'))).resolves.toBeUndefined();
  });
});

describe('worker metrics instrumentation', () => {
  let processorFn: Function;

  beforeEach(() => {
    vi.clearAllMocks();
    mockMetrics.jobsFailed.labels.mockReturnValue({ inc: vi.fn() });
    const worker = createWorker(mockClient) as { _processor: Function };
    processorFn = worker._processor;
  });

  it('increments jobsCompleted on success', async () => {
    mockExecRepo.create.mockResolvedValue({ id: 'exec-m1' });
    mockAdapterExecute.mockResolvedValue({ success: true, messageId: 'msg-1' });
    mockJobRepo.findById.mockResolvedValue({ id: 'job-1', sendTimes: ['2099-01-01T00:00:00.000Z'] });
    mockJobRepo.hardDelete.mockResolvedValue(undefined);
    mockExecRepo.complete.mockResolvedValue({});

    await processorFn({ id: 'j1', data: { jobId: 'job-1', channelId: 'c1', isoTime: '2099-01-01T00:00:00.000Z' }, attemptsMade: 0 });

    expect(mockMetrics.jobsCompleted.inc).toHaveBeenCalledTimes(1);
  });

  it('increments jobsFailed with final=false on adapter failure', async () => {
    const mockInc = vi.fn();
    mockMetrics.jobsFailed.labels.mockReturnValue({ inc: mockInc });
    mockExecRepo.create.mockResolvedValue({ id: 'exec-m2' });
    mockAdapterExecute.mockResolvedValue({ success: false, error: 'Channel not found' });
    mockExecRepo.fail.mockResolvedValue({});

    await expect(processorFn({ id: 'j2', data: { jobId: 'job-1', channelId: 'c1', isoTime: '2099-01-01T00:00:00.000Z' }, attemptsMade: 0 })).rejects.toThrow();

    expect(mockMetrics.jobsFailed.labels).toHaveBeenCalledWith({ final: 'false' });
    expect(mockInc).toHaveBeenCalledTimes(1);
  });

  it('activeWorkers returns to 0 after job completes (inc then dec)', async () => {
    mockExecRepo.create.mockResolvedValue({ id: 'exec-m3' });
    mockAdapterExecute.mockResolvedValue({ success: true, messageId: 'msg-1' });
    mockJobRepo.findById.mockResolvedValue({ id: 'job-1', sendTimes: ['2099-01-01T00:00:00.000Z'] });
    mockJobRepo.hardDelete.mockResolvedValue(undefined);
    mockExecRepo.complete.mockResolvedValue({});

    await processorFn({ id: 'j3', data: { jobId: 'job-1', channelId: 'c1', isoTime: '2099-01-01T00:00:00.000Z' }, attemptsMade: 0 });

    expect(mockMetrics.activeWorkers.inc).toHaveBeenCalledTimes(1);
    expect(mockMetrics.activeWorkers.dec).toHaveBeenCalledTimes(1);
  });

  it('activeWorkers.dec fires even when adapter throws', async () => {
    mockExecRepo.create.mockResolvedValue({ id: 'exec-m4' });
    mockAdapterExecute.mockResolvedValue({ success: false, error: 'oops' });
    mockExecRepo.fail.mockResolvedValue({});

    await expect(processorFn({ id: 'j4', data: { jobId: 'job-1', channelId: 'c1', isoTime: '2099-01-01T00:00:00.000Z' }, attemptsMade: 0 })).rejects.toThrow();

    expect(mockMetrics.activeWorkers.dec).toHaveBeenCalledTimes(1);
  });
});

describe('worker failed event handler — metrics', () => {
  let failedHandler: Function;
  let mockInc: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockInc = vi.fn();
    mockMetrics.jobsFailed.labels.mockReturnValue({ inc: mockInc });
    createWorker(mockClient);
    const failedCall = mockWorkerOn.mock.calls.find(c => c[0] === 'failed');
    failedHandler = failedCall![1];
  });

  it('increments jobsFailed final=true and jobsDead on retry exhaustion', async () => {
    mockJobRepo.markDead.mockResolvedValue({});
    const job = { data: { jobId: 'job-1', channelId: 'chan-1' }, attemptsMade: 3, opts: { attempts: 3 } };

    await failedHandler(job, new Error('Exhausted'));

    expect(mockMetrics.jobsFailed.labels).toHaveBeenCalledWith({ final: 'true' });
    expect(mockInc).toHaveBeenCalledTimes(1);
    expect(mockMetrics.jobsDead.inc).toHaveBeenCalledTimes(1);
  });
});
