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

// Mock cancel scheduler
vi.mock('../src/scheduler/cancel.js', () => ({
  default: vi.fn(),
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

const { default: deleteCommand } = await import('../src/commands/delete.js');
const { default: cancelScheduledMessage } = await import('../src/scheduler/cancel.js');

describe('delete command', () => {
  let interaction: ReturnType<typeof createMockInteraction>;

  beforeEach(() => {
    vi.clearAllMocks();
    interaction = createMockInteraction({ commandName: 'delete' });
    interaction.options.getString.mockReturnValue('uuid-42');
  });

  it('should have the correct command name', () => {
    expect(deleteCommand.data.name).toBe('delete');
  });

  it('should have a description', () => {
    expect(deleteCommand.data.description).toBe('Delete a scheduled message');
  });

  it('should reply with error if message not found', async () => {
    mockRepo.delete.mockResolvedValue(false);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await deleteCommand.execute(interaction as any);

    expect(interaction.editReply).toHaveBeenCalledWith(
      'Message not found or you do not have permission to delete this message.',
    );
  });

  it('should cancel the scheduled job on successful delete', async () => {
    mockRepo.delete.mockResolvedValue(true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await deleteCommand.execute(interaction as any);

    expect(cancelScheduledMessage).toHaveBeenCalledWith('uuid-42');
  });

  it('should reply with success message after deleting', async () => {
    mockRepo.delete.mockResolvedValue(true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await deleteCommand.execute(interaction as any);

    expect(interaction.editReply).toHaveBeenCalledWith('Deleted message uuid-42');
  });

  it('should not cancel job if delete failed', async () => {
    mockRepo.delete.mockResolvedValue(false);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await deleteCommand.execute(interaction as any);

    expect(cancelScheduledMessage).not.toHaveBeenCalled();
  });

  it('should use the user id from interaction', async () => {
    interaction.user = { id: 'specific-user-789' };

    mockRepo.delete.mockImplementation((id: string, userId: string) => {
      expect(userId).toBe('specific-user-789');
      return Promise.resolve(true);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await deleteCommand.execute(interaction as any);
  });

  it('should use the message id from options', async () => {
    interaction.options.getString.mockReturnValue('uuid-99');

    mockRepo.delete.mockImplementation((id: string) => {
      expect(id).toBe('uuid-99');
      return Promise.resolve(true);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await deleteCommand.execute(interaction as any);
  });

  it('should pass both id and userId to repository delete', async () => {
    interaction.user = { id: 'user-abc' };
    interaction.options.getString.mockReturnValue('uuid-delete-test');

    mockRepo.delete.mockImplementation((id: string, userId: string) => {
      expect(id).toBe('uuid-delete-test');
      expect(userId).toBe('user-abc');
      return Promise.resolve(true);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await deleteCommand.execute(interaction as any);
  });
});
