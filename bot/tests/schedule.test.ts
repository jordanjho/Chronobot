import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';
import { createMockInteraction } from './helpers/interaction.js';

// Mock the logger
vi.mock('../src/utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock JobRepository (still used for countByUserId in schedule command)
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

// Mock JobService
const mockJobService = {
  createJob: vi.fn(),
  cancelJob: vi.fn(),
  restoreJobs: vi.fn(),
};
vi.mock('../src/services/JobService.js', () => ({
  jobService: mockJobService,
}));

const { default: scheduleCommand } = await import('../src/commands/schedule.js');

describe('schedule command', () => {
  let interaction: ReturnType<typeof createMockInteraction>;

  beforeEach(() => {
    vi.clearAllMocks();
    interaction = createMockInteraction({ commandName: 'schedule' });
    interaction.options.getString.mockImplementation((name: string) => {
      if (name === 'frequency') return 'once';
      if (name === 'timestamp') return '2099-12-31 23:59';
      if (name === 'content') return 'Test message';
      return null;
    });
    interaction.options.getAttachment.mockReturnValue(null);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should have the correct command name', () => {
    expect(scheduleCommand.data.name).toBe('schedule');
  });

  it('should have a description', () => {
    expect(scheduleCommand.data.description).toBe('Schedule a message');
  });

  it('should reject invalid frequency', async () => {
    interaction.options.getString.mockImplementation((name: string) => {
      if (name === 'frequency') return 'monthly';
      if (name === 'timestamp') return '2099-12-31 23:59';
      return null;
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await scheduleCommand.execute(interaction as any);

    expect(interaction.editReply).toHaveBeenCalledWith(
      'Invalid frequency. Use once, daily, or weekly.',
    );
  });

  it('should reject past timestamp', async () => {
    interaction.options.getString.mockImplementation((name: string) => {
      if (name === 'frequency') return 'once';
      if (name === 'timestamp') return '2000-01-01 00:00';
      return null;
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await scheduleCommand.execute(interaction as any);

    expect(interaction.editReply).toHaveBeenCalledWith(
      'Invalid or distant timestamp. Format: YYYY-MM-DD HH:mm UTC.',
    );
  });

  it('should reject invalid timestamp format', async () => {
    interaction.options.getString.mockImplementation((name: string) => {
      if (name === 'frequency') return 'once';
      if (name === 'timestamp') return 'not-a-date';
      return null;
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await scheduleCommand.execute(interaction as any);

    expect(interaction.editReply).toHaveBeenCalledWith(
      'Invalid or distant timestamp. Format: YYYY-MM-DD HH:mm UTC.',
    );
  });

  it('should reply with error if user already has 5 messages', async () => {
    mockRepo.countByUserId.mockResolvedValue(5);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await scheduleCommand.execute(interaction as any);

    expect(interaction.editReply).toHaveBeenCalledWith(
      'You can only have 5 scheduled messages at a time.',
    );
  });

  it('should succeed when user has exactly 4 scheduled messages (at limit boundary)', async () => {
    mockRepo.countByUserId.mockResolvedValue(4);
    mockJobService.createJob.mockResolvedValue({ id: 'uuid-slot5', sendTimes: ['2099-12-31T23:59:00.000Z'] });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await scheduleCommand.execute(interaction as any);

    expect(interaction.editReply).toHaveBeenCalledWith('Message scheduled with ID uuid-slot5');
  });

  it('should schedule a once message successfully', async () => {
    mockRepo.countByUserId.mockResolvedValue(0);
    mockJobService.createJob.mockResolvedValue({ id: 'uuid-1', sendTimes: ['2099-12-31T23:59:00.000Z'] });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await scheduleCommand.execute(interaction as any);

    expect(interaction.editReply).toHaveBeenCalledWith('Message scheduled with ID uuid-1');
    expect(mockJobService.createJob).toHaveBeenCalledTimes(1);
  });

  it('should pass daily sendTimes (7) to createJob', async () => {
    interaction.options.getString.mockImplementation((name: string) => {
      if (name === 'frequency') return 'daily';
      if (name === 'timestamp') return '2099-12-25 10:00';
      if (name === 'content') return 'Daily msg';
      return null;
    });

    mockRepo.countByUserId.mockResolvedValue(0);
    mockJobService.createJob.mockImplementation((data: { sendTimes: string[] }) => {
      expect(data.sendTimes).toHaveLength(7);
      return Promise.resolve({ id: 'uuid-2', sendTimes: data.sendTimes });
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await scheduleCommand.execute(interaction as any);
  });

  it('should pass weekly sendTimes (4) to createJob', async () => {
    interaction.options.getString.mockImplementation((name: string) => {
      if (name === 'frequency') return 'weekly';
      if (name === 'timestamp') return '2099-12-25 10:00';
      if (name === 'content') return 'Weekly msg';
      return null;
    });

    mockRepo.countByUserId.mockResolvedValue(0);
    mockJobService.createJob.mockImplementation((data: { sendTimes: string[] }) => {
      expect(data.sendTimes).toHaveLength(4);
      return Promise.resolve({ id: 'uuid-3', sendTimes: data.sendTimes });
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await scheduleCommand.execute(interaction as any);
  });

  it('should propagate createJob errors', async () => {
    mockRepo.countByUserId.mockResolvedValue(0);
    mockJobService.createJob.mockRejectedValue(new Error('Queue failed'));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(scheduleCommand.execute(interaction as any)).rejects.toThrow('Queue failed');
  });

  it('should pass attachment url to createJob', async () => {
    interaction.options.getAttachment.mockReturnValue({ url: 'https://cdn.example.com/img.png' });

    mockRepo.countByUserId.mockResolvedValue(0);
    mockJobService.createJob.mockImplementation((data: { attachmentUrl: string | null }) => {
      expect(data.attachmentUrl).toBe('https://cdn.example.com/img.png');
      return Promise.resolve({ id: 'uuid-5', sendTimes: ['2099-12-31T23:59:00.000Z'] });
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await scheduleCommand.execute(interaction as any);
  });

  it('should use empty string for content when not provided', async () => {
    interaction.options.getString.mockImplementation((name: string) => {
      if (name === 'frequency') return 'once';
      if (name === 'timestamp') return '2099-12-31 23:59';
      if (name === 'content') return null;
      return null;
    });

    mockRepo.countByUserId.mockResolvedValue(0);
    mockJobService.createJob.mockImplementation((data: { content: string }) => {
      expect(data.content).toBe('');
      return Promise.resolve({ id: 'uuid-6', sendTimes: ['2099-12-31T23:59:00.000Z'] });
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await scheduleCommand.execute(interaction as any);
  });

  it('should pass correct channelId to createJob', async () => {
    mockRepo.countByUserId.mockResolvedValue(0);
    mockJobService.createJob.mockImplementation((data: { channelId: string }) => {
      expect(data.channelId).toBe('channel-456');
      return Promise.resolve({ id: 'uuid-7', sendTimes: ['2099-12-31T23:59:00.000Z'] });
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await scheduleCommand.execute(interaction as any);
  });

  it('should pass correct userId to countByUserId', async () => {
    interaction.user = { id: 'specific-user-abc' };
    mockRepo.countByUserId.mockImplementation((userId: string) => {
      expect(userId).toBe('specific-user-abc');
      return Promise.resolve(0);
    });
    mockJobService.createJob.mockResolvedValue({ id: 'uuid-8', sendTimes: ['2099-12-31T23:59:00.000Z'] });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await scheduleCommand.execute(interaction as any);
  });

  it('should allow scheduling when user has 4 messages (just below 5-slot limit)', async () => {
    mockRepo.countByUserId.mockResolvedValue(4);
    mockJobService.createJob.mockResolvedValue({ id: 'uuid-at-4', sendTimes: ['2099-12-31T23:59:00.000Z'] });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await scheduleCommand.execute(interaction as any);

    expect(mockJobService.createJob).toHaveBeenCalledOnce();
    expect(interaction.editReply).toHaveBeenCalledWith('Message scheduled with ID uuid-at-4');
  });

  it('should pass userId to createJob correctly', async () => {
    interaction.user = { id: 'owner-user-99' };
    mockRepo.countByUserId.mockResolvedValue(0);
    mockJobService.createJob.mockImplementation((data: { userId: string }) => {
      expect(data.userId).toBe('owner-user-99');
      return Promise.resolve({ id: 'uuid-uid', sendTimes: ['2099-12-31T23:59:00.000Z'] });
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await scheduleCommand.execute(interaction as any);
  });

  it('should pass null attachmentUrl when no attachment provided', async () => {
    interaction.options.getAttachment.mockReturnValue(null);
    mockRepo.countByUserId.mockResolvedValue(0);
    mockJobService.createJob.mockImplementation((data: { attachmentUrl: string | null }) => {
      expect(data.attachmentUrl).toBeNull();
      return Promise.resolve({ id: 'uuid-null-att', sendTimes: ['2099-12-31T23:59:00.000Z'] });
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await scheduleCommand.execute(interaction as any);
  });
});

describe('schedule — timestamp boundary (10-second guard)', () => {
  let interaction: ReturnType<typeof createMockInteraction>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // "now" is at 55 seconds into the minute
    vi.setSystemTime(new Date('2099-06-01T10:00:55.000Z'));
    interaction = createMockInteraction({ commandName: 'schedule' });
    interaction.options.getAttachment.mockReturnValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('rejects timestamp that is only 5 seconds in the future (within 10s guard)', async () => {
    // 10:01:00 is only 5 seconds after 10:00:55
    interaction.options.getString.mockImplementation((name: string) => {
      if (name === 'frequency') return 'once';
      if (name === 'timestamp') return '2099-06-01 10:01';
      return null;
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await scheduleCommand.execute(interaction as any);

    expect(interaction.editReply).toHaveBeenCalledWith(
      'Invalid or distant timestamp. Format: YYYY-MM-DD HH:mm UTC.',
    );
  });

  it('accepts timestamp that is 65 seconds in the future (beyond 10s guard)', async () => {
    // 10:02:00 is 65 seconds after 10:00:55
    interaction.options.getString.mockImplementation((name: string) => {
      if (name === 'frequency') return 'once';
      if (name === 'timestamp') return '2099-06-01 10:02';
      return null;
    });
    mockRepo.countByUserId.mockResolvedValue(0);
    mockJobService.createJob.mockResolvedValue({ id: 'future-id', sendTimes: ['2099-06-01T10:02:00.000Z'] });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await scheduleCommand.execute(interaction as any);

    expect(interaction.editReply).toHaveBeenCalledWith('Message scheduled with ID future-id');
  });
});

describe('schedule — sendTime interval correctness', () => {
  let interaction: ReturnType<typeof createMockInteraction>;

  beforeEach(() => {
    vi.clearAllMocks();
    interaction = createMockInteraction({ commandName: 'schedule' });
    interaction.options.getAttachment.mockReturnValue(null);
    mockRepo.countByUserId.mockResolvedValue(0);
  });

  it('daily: all 7 sendTimes are exactly 24 hours apart', async () => {
    interaction.options.getString.mockImplementation((name: string) => {
      if (name === 'frequency') return 'daily';
      if (name === 'timestamp') return '2099-12-25 10:00';
      return null;
    });

    let capturedTimes: string[] = [];
    mockJobService.createJob.mockImplementation((data: { sendTimes: string[] }) => {
      capturedTimes = data.sendTimes;
      return Promise.resolve({ id: 'daily-id', sendTimes: data.sendTimes });
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await scheduleCommand.execute(interaction as any);

    expect(capturedTimes).toHaveLength(7);
    for (let i = 1; i < capturedTimes.length; i++) {
      const diffMs = new Date(capturedTimes[i]!).getTime() - new Date(capturedTimes[i - 1]!).getTime();
      expect(diffMs).toBe(24 * 60 * 60 * 1000);
    }
  });

  it('daily: first sendTime matches the requested base timestamp', async () => {
    interaction.options.getString.mockImplementation((name: string) => {
      if (name === 'frequency') return 'daily';
      if (name === 'timestamp') return '2099-12-25 10:00';
      return null;
    });

    let capturedTimes: string[] = [];
    mockJobService.createJob.mockImplementation((data: { sendTimes: string[] }) => {
      capturedTimes = data.sendTimes;
      return Promise.resolve({ id: 'daily-id', sendTimes: data.sendTimes });
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await scheduleCommand.execute(interaction as any);

    expect(new Date(capturedTimes[0]!).toISOString()).toBe('2099-12-25T10:00:00.000Z');
  });

  it('weekly: all 4 sendTimes are exactly 7 days apart', async () => {
    interaction.options.getString.mockImplementation((name: string) => {
      if (name === 'frequency') return 'weekly';
      if (name === 'timestamp') return '2099-12-25 10:00';
      return null;
    });

    let capturedTimes: string[] = [];
    mockJobService.createJob.mockImplementation((data: { sendTimes: string[] }) => {
      capturedTimes = data.sendTimes;
      return Promise.resolve({ id: 'weekly-id', sendTimes: data.sendTimes });
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await scheduleCommand.execute(interaction as any);

    expect(capturedTimes).toHaveLength(4);
    for (let i = 1; i < capturedTimes.length; i++) {
      const diffMs = new Date(capturedTimes[i]!).getTime() - new Date(capturedTimes[i - 1]!).getTime();
      expect(diffMs).toBe(7 * 24 * 60 * 60 * 1000);
    }
  });

  it('once: generates exactly 1 sendTime matching the timestamp', async () => {
    interaction.options.getString.mockImplementation((name: string) => {
      if (name === 'frequency') return 'once';
      if (name === 'timestamp') return '2099-12-25 10:00';
      return null;
    });

    let capturedTimes: string[] = [];
    mockJobService.createJob.mockImplementation((data: { sendTimes: string[] }) => {
      capturedTimes = data.sendTimes;
      return Promise.resolve({ id: 'once-id', sendTimes: data.sendTimes });
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await scheduleCommand.execute(interaction as any);

    expect(capturedTimes).toHaveLength(1);
    expect(new Date(capturedTimes[0]!).toISOString()).toBe('2099-12-25T10:00:00.000Z');
  });
});
