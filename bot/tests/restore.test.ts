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

// Mock scheduleMessage
const mockScheduleMessage = vi.fn();
vi.mock('../src/scheduler/scheduleMessage.js', () => ({
  default: mockScheduleMessage,
}));

// Mock JobRepository
const mockRepo = {
  countByUserId: vi.fn(),
  create: vi.fn(),
  findById: vi.fn(),
  findAllByUserId: vi.fn(),
  findAll: vi.fn(),
  updateSendTimes: vi.fn(),
  updateContent: vi.fn(),
  delete: vi.fn(),
  markCompleted: vi.fn(),
};
vi.mock('../src/repositories/JobRepository.js', () => ({
  jobRepository: mockRepo,
}));

const { default: restoreScheduledMessages } = await import('../src/scheduler/restore.js');
const mockClient = {} as Parameters<typeof restoreScheduledMessages>[0];

describe('restoreScheduledMessages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call scheduleMessage for each future time', async () => {
    const futureDate = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const jobs = [
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
    ];

    mockRepo.findAll.mockResolvedValue(jobs);

    await restoreScheduledMessages(mockClient);

    expect(mockScheduleMessage).toHaveBeenCalledTimes(1);
    expect(mockScheduleMessage).toHaveBeenCalledWith(
      mockClient,
      'uuid-1',
      'chan-1',
      futureDate,
      'Hello',
      null,
    );
  });

  it('should skip times in the past (Bug 1 fix)', async () => {
    const pastDate = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const jobs = [
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
    ];

    mockRepo.findAll.mockResolvedValue(jobs);

    await restoreScheduledMessages(mockClient);

    expect(mockScheduleMessage).not.toHaveBeenCalled();
  });

  it('should only schedule future times from a mixed array', async () => {
    const pastDate = new Date(Date.now() - 1000).toISOString();
    const futureDate = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const jobs = [
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
    ];

    mockRepo.findAll.mockResolvedValue(jobs);

    await restoreScheduledMessages(mockClient);

    expect(mockScheduleMessage).toHaveBeenCalledTimes(1);
    expect(mockScheduleMessage).toHaveBeenCalledWith(
      mockClient,
      'uuid-3',
      'chan-3',
      futureDate,
      'Mixed',
      null,
    );
  });

  it('should log error when repository fails', async () => {
    mockRepo.findAll.mockRejectedValue(new Error('DB failure'));

    await restoreScheduledMessages(mockClient);

    expect(mockScheduleMessage).not.toHaveBeenCalled();
  });

  it('should handle multiple rows correctly', async () => {
    const future1 = new Date(Date.now() + 3600000).toISOString();
    const future2 = new Date(Date.now() + 7200000).toISOString();
    const jobs = [
      {
        id: 'uuid-10',
        channelId: 'chan-a',
        sendTimes: [future1],
        content: 'Msg A',
        frequency: 'once',
        attachmentUrl: 'https://cdn.example.com/a.png',
        userId: 'user-a',
        status: 'QUEUED',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'uuid-11',
        channelId: 'chan-b',
        sendTimes: [future2],
        content: 'Msg B',
        frequency: 'once',
        attachmentUrl: null,
        userId: 'user-b',
        status: 'QUEUED',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    mockRepo.findAll.mockResolvedValue(jobs);

    await restoreScheduledMessages(mockClient);

    expect(mockScheduleMessage).toHaveBeenCalledTimes(2);
    expect(mockScheduleMessage).toHaveBeenCalledWith(mockClient, 'uuid-10', 'chan-a', future1, 'Msg A', 'https://cdn.example.com/a.png');
    expect(mockScheduleMessage).toHaveBeenCalledWith(mockClient, 'uuid-11', 'chan-b', future2, 'Msg B', null);
  });

  it('should handle empty result set gracefully', async () => {
    mockRepo.findAll.mockResolvedValue([]);

    await restoreScheduledMessages(mockClient);

    expect(mockScheduleMessage).not.toHaveBeenCalled();
  });

  it('should pass attachmentUrl to scheduleMessage', async () => {
    const futureDate = new Date(Date.now() + 3600000).toISOString();
    const jobs = [
      {
        id: 'uuid-20',
        channelId: 'chan-x',
        sendTimes: [futureDate],
        content: 'With attachment',
        frequency: 'once',
        attachmentUrl: 'https://cdn.example.com/img.jpg',
        userId: 'user-x',
        status: 'QUEUED',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    mockRepo.findAll.mockResolvedValue(jobs);

    await restoreScheduledMessages(mockClient);

    expect(mockScheduleMessage).toHaveBeenCalledWith(
      mockClient,
      'uuid-20',
      'chan-x',
      futureDate,
      'With attachment',
      'https://cdn.example.com/img.jpg',
    );
  });

  it('should only schedule QUEUED jobs', async () => {
    const futureDate = new Date(Date.now() + 3600000).toISOString();
    const jobs = [
      {
        id: 'uuid-30',
        channelId: 'chan-q',
        sendTimes: [futureDate],
        content: 'Queued',
        frequency: 'once',
        attachmentUrl: null,
        userId: 'user-q',
        status: 'QUEUED',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'uuid-31',
        channelId: 'chan-c',
        sendTimes: [futureDate],
        content: 'Completed',
        frequency: 'once',
        attachmentUrl: null,
        userId: 'user-c',
        status: 'COMPLETED',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    mockRepo.findAll.mockResolvedValue(jobs);

    await restoreScheduledMessages(mockClient);

    expect(mockScheduleMessage).toHaveBeenCalledTimes(1);
    expect(mockScheduleMessage).toHaveBeenCalledWith(mockClient, 'uuid-30', 'chan-q', futureDate, 'Queued', null);
  });
});
