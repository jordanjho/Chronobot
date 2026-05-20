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

const { default: editCommand } = await import('../src/commands/edit.js');

describe('edit command', () => {
  let interaction: ReturnType<typeof createMockInteraction>;

  beforeEach(() => {
    vi.clearAllMocks();
    interaction = createMockInteraction({ commandName: 'edit' });
    interaction.options.getString.mockImplementation((name: string) => {
      if (name === 'id') return 'uuid-10';
      return null;
    });
    interaction.options.getAttachment.mockReturnValue(null);
  });

  it('should have the correct command name', () => {
    expect(editCommand.data.name).toBe('edit');
  });

  it('should have a description', () => {
    expect(editCommand.data.description).toBe('Edit a scheduled message');
  });

  it('should reply with error if message not found', async () => {
    mockRepo.findById.mockResolvedValue(null);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await editCommand.execute(interaction as any);

    expect(interaction.editReply).toHaveBeenCalledWith(
      'Message not found or you do not have permission to edit this message.',
    );
  });

  it('should reply with error if wrong user', async () => {
    mockRepo.findById.mockResolvedValue({ id: 'uuid-10', userId: 'other-user', content: 'old', attachmentUrl: null });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await editCommand.execute(interaction as any);

    expect(interaction.editReply).toHaveBeenCalledWith(
      'Message not found or you do not have permission to edit this message.',
    );
  });

  it('should update message with new content', async () => {
    const existingJob = { id: 'uuid-10', userId: 'user-123', content: 'old content', attachmentUrl: null };
    mockRepo.findById.mockResolvedValue(existingJob);
    mockRepo.updateContent.mockResolvedValue({ ...existingJob, content: 'new content' });

    interaction.options.getString.mockImplementation((name: string) => {
      if (name === 'id') return 'uuid-10';
      if (name === 'content') return 'new content';
      return null;
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await editCommand.execute(interaction as any);

    expect(interaction.editReply).toHaveBeenCalledWith('Updated message uuid-10');
  });

  it('should keep old content when no new content provided', async () => {
    const existingJob = { id: 'uuid-10', userId: 'user-123', content: 'original content', attachmentUrl: null };
    mockRepo.findById.mockResolvedValue(existingJob);
    mockRepo.updateContent.mockImplementation((_id: string, _userId: string, content: string) => {
      expect(content).toBe('original content');
      return Promise.resolve({ ...existingJob, content });
    });

    interaction.options.getString.mockImplementation((name: string) => {
      if (name === 'id') return 'uuid-10';
      return null;
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await editCommand.execute(interaction as any);
  });

  it('should update attachment when new one provided', async () => {
    const existingJob = { id: 'uuid-10', userId: 'user-123', content: 'content', attachmentUrl: 'https://old.example.com/img.png' };
    mockRepo.findById.mockResolvedValue(existingJob);
    mockRepo.updateContent.mockImplementation((_id: string, _userId: string, _content: string, attachmentUrl: string) => {
      expect(attachmentUrl).toBe('https://new.example.com/img.png');
      return Promise.resolve({ ...existingJob, attachmentUrl });
    });

    interaction.options.getAttachment.mockReturnValue({ url: 'https://new.example.com/img.png' });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await editCommand.execute(interaction as any);
  });

  it('should reply with error when updateContent returns null', async () => {
    const existingJob = { id: 'uuid-10', userId: 'user-123', content: 'content', attachmentUrl: null };
    mockRepo.findById.mockResolvedValue(existingJob);
    mockRepo.updateContent.mockResolvedValue(null);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await editCommand.execute(interaction as any);

    expect(interaction.editReply).toHaveBeenCalledWith('Failed to update message or no changes made.');
  });

  it('should query by both message id and user id', async () => {
    interaction.user = { id: 'owner-456' };
    interaction.options.getString.mockImplementation((name: string) => {
      if (name === 'id') return 'uuid-77';
      return null;
    });

    mockRepo.findById.mockImplementation((id: string) => {
      expect(id).toBe('uuid-77');
      return Promise.resolve(null);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await editCommand.execute(interaction as any);

    expect(interaction.editReply).toHaveBeenCalledWith(
      'Message not found or you do not have permission to edit this message.',
    );
  });

  it('should keep old attachment when no new one provided', async () => {
    const existingJob = { id: 'uuid-10', userId: 'user-123', content: 'content', attachmentUrl: 'https://old.example.com/keep.png' };
    mockRepo.findById.mockResolvedValue(existingJob);
    mockRepo.updateContent.mockImplementation((_id: string, _userId: string, _content: string, attachmentUrl: string) => {
      expect(attachmentUrl).toBe('https://old.example.com/keep.png');
      return Promise.resolve({ ...existingJob, attachmentUrl });
    });

    interaction.options.getAttachment.mockReturnValue(null);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await editCommand.execute(interaction as any);

    expect(interaction.editReply).toHaveBeenCalledWith('Updated message uuid-10');
  });

  it('should clear content to empty string when empty string explicitly provided', async () => {
    const existingJob = { id: 'uuid-10', userId: 'user-123', content: 'old content', attachmentUrl: 'https://cdn.example.com/img.png' };
    mockRepo.findById.mockResolvedValue(existingJob);
    mockRepo.updateContent.mockImplementation((_id: string, _userId: string, content: string) => {
      expect(content).toBe('');
      return Promise.resolve({ ...existingJob, content: '' });
    });

    interaction.options.getString.mockImplementation((name: string) => {
      if (name === 'id') return 'uuid-10';
      if (name === 'content') return '';
      return null;
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await editCommand.execute(interaction as any);

    expect(interaction.editReply).toHaveBeenCalledWith('Updated message uuid-10');
  });

  it('should update both content and attachment simultaneously', async () => {
    const existingJob = { id: 'uuid-10', userId: 'user-123', content: 'old', attachmentUrl: 'https://old.example.com/img.png' };
    mockRepo.findById.mockResolvedValue(existingJob);
    mockRepo.updateContent.mockImplementation((_id: string, _userId: string, content: string, attachmentUrl: string) => {
      expect(content).toBe('new content');
      expect(attachmentUrl).toBe('https://new.example.com/img.png');
      return Promise.resolve({ ...existingJob, content: 'new content', attachmentUrl: 'https://new.example.com/img.png' });
    });

    interaction.options.getString.mockImplementation((name: string) => {
      if (name === 'id') return 'uuid-10';
      if (name === 'content') return 'new content';
      return null;
    });
    interaction.options.getAttachment.mockReturnValue({ url: 'https://new.example.com/img.png' });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await editCommand.execute(interaction as any);

    expect(interaction.editReply).toHaveBeenCalledWith('Updated message uuid-10');
  });
});
