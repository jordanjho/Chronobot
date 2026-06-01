import { describe, it, expect, beforeEach, vi } from 'vitest';
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

// Mock JobRepository
const mockRepo = {
  countByUserId: vi.fn(),
  create: vi.fn(),
  findById: vi.fn(),
  findQueuedByUserId: vi.fn(),
  findAll: vi.fn(),
  updateSendTimes: vi.fn(),
  updateContent: vi.fn(),
  delete: vi.fn(),
  markCompleted: vi.fn(),
};
vi.mock('../src/repositories/JobRepository.js', () => ({
  jobRepository: mockRepo,
}));

const { default: listCommand } = await import('../src/commands/list.js');

describe('list command', () => {
  let interaction: ReturnType<typeof createMockInteraction>;

  beforeEach(() => {
    vi.clearAllMocks();
    interaction = createMockInteraction({ commandName: 'list' });
  });

  it('should have the correct command name', () => {
    expect(listCommand.data.name).toBe('list');
  });

  it('should have a description', () => {
    expect(listCommand.data.description).toBe('List all scheduled messages');
  });

  it('should reply with no messages when db returns empty array', async () => {
    mockRepo.findQueuedByUserId.mockResolvedValue([]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await listCommand.execute(interaction as any);

    expect(interaction.editReply).toHaveBeenCalledWith('No messages scheduled.');
  });

  it('should list scheduled messages when rows are returned', async () => {
    const jobs = [
      {
        id: 'uuid-1',
        channelId: 'chan-1',
        sendTimes: ['2030-01-01T12:00:00.000Z'],
        content: 'Hello world',
        frequency: 'once',
        attachmentUrl: null,
        userId: 'user-123',
        status: 'QUEUED',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    mockRepo.findQueuedByUserId.mockResolvedValue(jobs);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await listCommand.execute(interaction as any);

    expect(interaction.editReply).toHaveBeenCalledOnce();
    const reply = interaction.editReply.mock.calls[0][0] as string;
    expect(reply).toContain('**Your Scheduled Messages:**');
    expect(reply).toContain('ID: uuid-1');
    expect(reply).toContain('Hello world');
    expect(reply).toContain('<#chan-1>');
  });

  it('should show [media only] when content is empty string', async () => {
    const jobs = [
      {
        id: 'uuid-2',
        channelId: 'chan-2',
        sendTimes: ['2030-06-01T00:00:00.000Z'],
        content: '',
        frequency: 'once',
        attachmentUrl: 'https://example.com/image.png',
        userId: 'user-123',
        status: 'QUEUED',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    mockRepo.findQueuedByUserId.mockResolvedValue(jobs);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await listCommand.execute(interaction as any);

    const reply = interaction.editReply.mock.calls[0][0] as string;
    expect(reply).toContain('[media only]');
  });

  it('should show None when attachmentUrl is null', async () => {
    const jobs = [
      {
        id: 'uuid-3',
        channelId: 'chan-3',
        sendTimes: ['2030-06-01T00:00:00.000Z'],
        content: 'Test message',
        frequency: 'once',
        attachmentUrl: null,
        userId: 'user-123',
        status: 'QUEUED',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    mockRepo.findQueuedByUserId.mockResolvedValue(jobs);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await listCommand.execute(interaction as any);

    const reply = interaction.editReply.mock.calls[0][0] as string;
    expect(reply).toContain('Attachment: None');
  });

  it('should show separator between multiple messages', async () => {
    const jobs = [
      {
        id: 'uuid-1',
        channelId: 'chan-1',
        sendTimes: ['2030-01-01T12:00:00.000Z'],
        content: 'Message 1',
        frequency: 'once',
        attachmentUrl: null,
        userId: 'user-123',
        status: 'QUEUED',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'uuid-2',
        channelId: 'chan-2',
        sendTimes: ['2030-02-01T12:00:00.000Z'],
        content: 'Message 2',
        frequency: 'once',
        attachmentUrl: null,
        userId: 'user-123',
        status: 'QUEUED',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    mockRepo.findQueuedByUserId.mockResolvedValue(jobs);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await listCommand.execute(interaction as any);

    const reply = interaction.editReply.mock.calls[0][0] as string;
    expect(reply).toContain('---');
    expect(reply).toContain('Message 1');
    expect(reply).toContain('Message 2');
  });

  it('should query messages by user id', async () => {
    interaction.user = { id: 'my-user-id' };
    mockRepo.findQueuedByUserId.mockImplementation((userId: string) => {
      expect(userId).toBe('my-user-id');
      return Promise.resolve([]);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await listCommand.execute(interaction as any);
  });

  it('should propagate db error from findQueuedByUserId', async () => {
    mockRepo.findQueuedByUserId.mockRejectedValue(new Error('DB unreachable'));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(listCommand.execute(interaction as any)).rejects.toThrow('DB unreachable');
  });

  it('should reply with no messages when all sendTimes are in the past', async () => {
    // PR3A adds client-side filtering: jobs whose only sendTimes are past are hidden
    const pastTime = '2000-01-01T00:00:00.000Z';
    const jobs = [
      {
        id: 'uuid-past',
        channelId: 'chan-1',
        sendTimes: [pastTime],
        content: 'Past message',
        frequency: 'once',
        attachmentUrl: null,
        userId: 'user-123',
        status: 'QUEUED',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    mockRepo.findQueuedByUserId.mockResolvedValue(jobs);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await listCommand.execute(interaction as any);

    expect(interaction.editReply).toHaveBeenCalledWith('No messages scheduled.');
  });

  it('should show all fields for a job with frequency and multiple send times', async () => {
    const t1 = '2030-01-01T10:00:00.000Z';
    const t2 = '2030-01-02T10:00:00.000Z';
    const jobs = [
      {
        id: 'uuid-multi',
        channelId: 'chan-multi',
        sendTimes: [t1, t2],
        content: 'Daily reminder',
        frequency: 'daily',
        attachmentUrl: null,
        userId: 'user-123',
        status: 'QUEUED',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    mockRepo.findQueuedByUserId.mockResolvedValue(jobs);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await listCommand.execute(interaction as any);

    const reply = interaction.editReply.mock.calls[0][0] as string;
    expect(reply).toContain(t1);
    expect(reply).toContain(t2);
  });

  it('should show attachment url when present', async () => {
    const jobs = [
      {
        id: 'uuid-4',
        channelId: 'chan-4',
        sendTimes: ['2030-06-01T00:00:00.000Z'],
        content: 'Has attachment',
        frequency: 'once',
        attachmentUrl: 'https://cdn.example.com/file.gif',
        userId: 'user-123',
        status: 'QUEUED',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    mockRepo.findQueuedByUserId.mockResolvedValue(jobs);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await listCommand.execute(interaction as any);

    const reply = interaction.editReply.mock.calls[0][0] as string;
    expect(reply).toContain('https://cdn.example.com/file.gif');
  });

  it('should hide stale QUEUED jobs whose sendTimes are all in the past', async () => {
    const pastTime = new Date(Date.now() - 3600000).toISOString();
    mockRepo.findQueuedByUserId.mockResolvedValue([
      {
        id: 'uuid-stale',
        channelId: 'chan-1',
        sendTimes: [pastTime],
        content: 'Old message',
        frequency: 'once',
        attachmentUrl: null,
        userId: 'user-123',
        status: 'QUEUED',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await listCommand.execute(interaction as any);

    expect(interaction.editReply).toHaveBeenCalledWith('No messages scheduled.');
  });

  it('should show a job with mixed times when at least one sendTime is future', async () => {
    const pastTime = new Date(Date.now() - 3600000).toISOString();
    const futureTime = new Date(Date.now() + 3600000).toISOString();
    mockRepo.findQueuedByUserId.mockResolvedValue([
      {
        id: 'uuid-mixed',
        channelId: 'chan-1',
        sendTimes: [pastTime, futureTime],
        content: 'Mixed message',
        frequency: 'daily',
        attachmentUrl: null,
        userId: 'user-123',
        status: 'QUEUED',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await listCommand.execute(interaction as any);

    const reply = interaction.editReply.mock.calls[0][0] as string;
    expect(reply).toContain('uuid-mixed');
  });

  it('should exclude stale sendTimes from the display even when job is shown', async () => {
    const pastTime = new Date(Date.now() - 3600000).toISOString();
    const futureTime = new Date(Date.now() + 3600000).toISOString();
    mockRepo.findQueuedByUserId.mockResolvedValue([
      {
        id: 'uuid-stale-display',
        channelId: 'chan-1',
        sendTimes: [pastTime, futureTime],
        content: 'Daily job',
        frequency: 'daily',
        attachmentUrl: null,
        userId: 'user-123',
        status: 'QUEUED',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await listCommand.execute(interaction as any);

    const reply = interaction.editReply.mock.calls[0][0] as string;
    expect(reply).toContain(futureTime);
    expect(reply).not.toContain(pastTime);
  });
});
