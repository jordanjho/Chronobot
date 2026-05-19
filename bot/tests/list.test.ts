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
    mockRepo.findAllByUserId.mockResolvedValue([]);

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

    mockRepo.findAllByUserId.mockResolvedValue(jobs);

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

    mockRepo.findAllByUserId.mockResolvedValue(jobs);

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

    mockRepo.findAllByUserId.mockResolvedValue(jobs);

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

    mockRepo.findAllByUserId.mockResolvedValue(jobs);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await listCommand.execute(interaction as any);

    const reply = interaction.editReply.mock.calls[0][0] as string;
    expect(reply).toContain('---');
    expect(reply).toContain('Message 1');
    expect(reply).toContain('Message 2');
  });

  it('should query messages by user id', async () => {
    interaction.user = { id: 'my-user-id' };
    mockRepo.findAllByUserId.mockImplementation((userId: string) => {
      expect(userId).toBe('my-user-id');
      return Promise.resolve([]);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await listCommand.execute(interaction as any);
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

    mockRepo.findAllByUserId.mockResolvedValue(jobs);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await listCommand.execute(interaction as any);

    const reply = interaction.editReply.mock.calls[0][0] as string;
    expect(reply).toContain('https://cdn.example.com/file.gif');
  });
});
