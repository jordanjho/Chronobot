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

// Mock JobRepository
const mockRepo = {
  findById: vi.fn(),
};
vi.mock('../../src/repositories/JobRepository.js', () => ({
  jobRepository: mockRepo,
}));

const { DiscordAdapter } = await import('../../src/adapters/DiscordAdapter.js');

describe('DiscordAdapter', () => {
  const mockSend = vi.fn();
  const mockFetch = vi.fn();
  const mockClient = {
    channels: { fetch: mockFetch },
  } as never;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSend.mockResolvedValue({ id: 'msg-123' });
    mockFetch.mockResolvedValue({ send: mockSend });
  });

  it('should return failure when job is not found', async () => {
    mockRepo.findById.mockResolvedValue(null);

    const adapter = new DiscordAdapter(mockClient);
    const result = await adapter.execute({ jobId: 'job-1', channelId: 'chan-1', isoTime: '2099-01-01T00:00:00.000Z' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('job-1');
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('should return failure when channel is not sendable', async () => {
    mockRepo.findById.mockResolvedValue({ id: 'job-1', content: 'Hello', attachmentUrl: null });
    mockFetch.mockResolvedValue(null);

    const adapter = new DiscordAdapter(mockClient);
    const result = await adapter.execute({ jobId: 'job-1', channelId: 'chan-1', isoTime: '2099-01-01T00:00:00.000Z' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('chan-1');
  });

  it('should send message and return success with messageId', async () => {
    mockRepo.findById.mockResolvedValue({ id: 'job-1', content: 'Hello', attachmentUrl: null });

    const adapter = new DiscordAdapter(mockClient);
    const result = await adapter.execute({ jobId: 'job-1', channelId: 'chan-1', isoTime: '2099-01-01T00:00:00.000Z' });

    expect(result.success).toBe(true);
    expect(result.messageId).toBe('msg-123');
    expect(mockSend).toHaveBeenCalledWith({ content: 'Hello' });
  });

  it('should include attachment in send payload when present', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 'job-2',
      content: 'With attachment',
      attachmentUrl: 'https://cdn.example.com/img.png',
    });

    const adapter = new DiscordAdapter(mockClient);
    await adapter.execute({ jobId: 'job-2', channelId: 'chan-1', isoTime: '2099-01-01T00:00:00.000Z' });

    expect(mockSend).toHaveBeenCalledWith({
      content: 'With attachment',
      files: ['https://cdn.example.com/img.png'],
    });
  });

  it('should not include files in payload when no attachment', async () => {
    mockRepo.findById.mockResolvedValue({ id: 'job-3', content: 'No attachment', attachmentUrl: null });

    const adapter = new DiscordAdapter(mockClient);
    await adapter.execute({ jobId: 'job-3', channelId: 'chan-1', isoTime: '2099-01-01T00:00:00.000Z' });

    const payload = mockSend.mock.calls[0]![0];
    expect(payload.files).toBeUndefined();
  });

  it('should send empty-content message without error (media-only job)', async () => {
    mockRepo.findById.mockResolvedValue({ id: 'job-4', content: '', attachmentUrl: 'https://cdn.example.com/vid.mp4' });

    const adapter = new DiscordAdapter(mockClient);
    const result = await adapter.execute({ jobId: 'job-4', channelId: 'chan-1', isoTime: '2099-01-01T00:00:00.000Z' });

    expect(result.success).toBe(true);
    expect(mockSend).toHaveBeenCalledWith({ content: '', files: ['https://cdn.example.com/vid.mp4'] });
  });

  it('should return failure when channel has no send method (e.g. category channel)', async () => {
    mockRepo.findById.mockResolvedValue({ id: 'job-5', content: 'Hello', attachmentUrl: null });
    // Channel exists but is not a text channel (no send method)
    mockFetch.mockResolvedValue({ id: 'category-channel' });

    const adapter = new DiscordAdapter(mockClient);
    const result = await adapter.execute({ jobId: 'job-5', channelId: 'category-1', isoTime: '2099-01-01T00:00:00.000Z' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('category-1');
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('should propagate error when channel.fetch throws (Discord API down)', async () => {
    mockRepo.findById.mockResolvedValue({ id: 'job-6', content: 'Hello', attachmentUrl: null });
    mockFetch.mockRejectedValue(new Error('Discord API unavailable'));

    const adapter = new DiscordAdapter(mockClient);
    await expect(
      adapter.execute({ jobId: 'job-6', channelId: 'chan-1', isoTime: '2099-01-01T00:00:00.000Z' }),
    ).rejects.toThrow('Discord API unavailable');
  });

  it('should propagate error when channel.send throws (message delivery failure)', async () => {
    mockRepo.findById.mockResolvedValue({ id: 'job-7', content: 'Hello', attachmentUrl: null });
    mockSend.mockRejectedValue(new Error('Missing Permissions'));

    const adapter = new DiscordAdapter(mockClient);
    await expect(
      adapter.execute({ jobId: 'job-7', channelId: 'chan-1', isoTime: '2099-01-01T00:00:00.000Z' }),
    ).rejects.toThrow('Missing Permissions');
  });

  it('should return failure when fetch returns null (channel deleted)', async () => {
    mockRepo.findById.mockResolvedValue({ id: 'job-8', content: 'Hello', attachmentUrl: null });
    mockFetch.mockResolvedValue(null);

    const adapter = new DiscordAdapter(mockClient);
    const result = await adapter.execute({ jobId: 'job-8', channelId: 'deleted-chan', isoTime: '2099-01-01T00:00:00.000Z' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('deleted-chan');
  });
});
