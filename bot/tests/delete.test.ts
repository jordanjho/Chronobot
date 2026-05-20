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

// Mock JobService
const mockJobService = {
  createJob: vi.fn(),
  cancelJob: vi.fn(),
  restoreJobs: vi.fn(),
};
vi.mock('../src/services/JobService.js', () => ({
  jobService: mockJobService,
}));

const { default: deleteCommand } = await import('../src/commands/delete.js');

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
    mockJobService.cancelJob.mockResolvedValue(false);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await deleteCommand.execute(interaction as any);

    expect(interaction.editReply).toHaveBeenCalledWith(
      'Message not found or you do not have permission to delete this message.',
    );
  });

  it('should reply with success message after deleting', async () => {
    mockJobService.cancelJob.mockResolvedValue(true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await deleteCommand.execute(interaction as any);

    expect(interaction.editReply).toHaveBeenCalledWith('Deleted message uuid-42');
  });

  it('should not reply with success if delete failed', async () => {
    mockJobService.cancelJob.mockResolvedValue(false);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await deleteCommand.execute(interaction as any);

    expect(interaction.editReply).not.toHaveBeenCalledWith('Deleted message uuid-42');
  });

  it('should pass user id to cancelJob', async () => {
    interaction.user = { id: 'specific-user-789' };
    mockJobService.cancelJob.mockImplementation((id: string, userId: string) => {
      expect(userId).toBe('specific-user-789');
      return Promise.resolve(true);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await deleteCommand.execute(interaction as any);
  });

  it('should pass message id to cancelJob', async () => {
    interaction.options.getString.mockReturnValue('uuid-99');
    mockJobService.cancelJob.mockImplementation((id: string) => {
      expect(id).toBe('uuid-99');
      return Promise.resolve(true);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await deleteCommand.execute(interaction as any);
  });

  it('should pass both id and userId to cancelJob', async () => {
    interaction.user = { id: 'user-abc' };
    interaction.options.getString.mockReturnValue('uuid-delete-test');
    mockJobService.cancelJob.mockImplementation((id: string, userId: string) => {
      expect(id).toBe('uuid-delete-test');
      expect(userId).toBe('user-abc');
      return Promise.resolve(true);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await deleteCommand.execute(interaction as any);
  });

  it('should propagate error thrown from cancelJob', async () => {
    mockJobService.cancelJob.mockRejectedValue(new Error('Queue write failed'));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(deleteCommand.execute(interaction as any)).rejects.toThrow('Queue write failed');
  });

  it('should not allow user A to delete user B\'s message (cancelJob returns false)', async () => {
    interaction.user = { id: 'attacker' };
    // jobService.cancelJob checks ownership and returns false for wrong user
    mockJobService.cancelJob.mockResolvedValue(false);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await deleteCommand.execute(interaction as any);

    expect(interaction.editReply).toHaveBeenCalledWith(
      'Message not found or you do not have permission to delete this message.',
    );
    expect(mockJobService.cancelJob).toHaveBeenCalledWith('uuid-42', 'attacker');
  });
});
