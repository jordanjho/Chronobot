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

// Mock database — we control behavior per test
const mockDbRun = vi.fn();
vi.mock('../src/db/database.js', () => ({
  default: {
    run: mockDbRun,
    get: vi.fn(),
    all: vi.fn(),
  },
}));

const { default: deleteCommand } = await import('../src/commands/delete.js');
const { default: cancelScheduledMessage } = await import('../src/scheduler/cancel.js');

describe('delete command', () => {
  let interaction: ReturnType<typeof createMockInteraction>;

  beforeEach(() => {
    vi.clearAllMocks();
    interaction = createMockInteraction({ commandName: 'delete' });
    interaction.options.getInteger.mockReturnValue(42);
  });

  it('should have the correct command name', () => {
    expect(deleteCommand.data.name).toBe('delete');
  });

  it('should have a description', () => {
    expect(deleteCommand.data.description).toBe('Delete a scheduled message');
  });

  it('should reply with error if message not found', async () => {
    mockDbRun.mockImplementation((_sql: string, _params: unknown[], cb: (this: { changes: number }, err: Error | null) => void) => {
      cb.call({ changes: 0 }, null);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await deleteCommand.execute(interaction as any);

    // Wait for any microtasks (void promises)
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(interaction.editReply).toHaveBeenCalledWith(
      'Message not found or you do not have permission to delete this message.',
    );
  });

  it('should cancel the scheduled job on successful delete', async () => {
    mockDbRun.mockImplementation((_sql: string, _params: unknown[], cb: (this: { changes: number }, err: Error | null) => void) => {
      cb.call({ changes: 1 }, null);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await deleteCommand.execute(interaction as any);

    await new Promise(resolve => setTimeout(resolve, 0));
    expect(cancelScheduledMessage).toHaveBeenCalledWith(42);
  });

  it('should reply with success message after deleting', async () => {
    mockDbRun.mockImplementation((_sql: string, _params: unknown[], cb: (this: { changes: number }, err: Error | null) => void) => {
      cb.call({ changes: 1 }, null);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await deleteCommand.execute(interaction as any);

    await new Promise(resolve => setTimeout(resolve, 0));
    expect(interaction.editReply).toHaveBeenCalledWith('Deleted message 42');
  });

  it('should reply with error if db returns an error', async () => {
    mockDbRun.mockImplementation((_sql: string, _params: unknown[], cb: (this: { changes: number }, err: Error | null) => void) => {
      cb.call({ changes: 0 }, new Error('DB error'));
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await deleteCommand.execute(interaction as any);

    await new Promise(resolve => setTimeout(resolve, 0));
    expect(interaction.editReply).toHaveBeenCalledWith(
      'Message not found or you do not have permission to delete this message.',
    );
  });

  it('should not cancel job if delete failed', async () => {
    mockDbRun.mockImplementation((_sql: string, _params: unknown[], cb: (this: { changes: number }, err: Error | null) => void) => {
      cb.call({ changes: 0 }, null);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await deleteCommand.execute(interaction as any);

    await new Promise(resolve => setTimeout(resolve, 0));
    expect(cancelScheduledMessage).not.toHaveBeenCalled();
  });

  it('should use the user id from interaction', async () => {
    interaction.user = { id: 'specific-user-789' };

    mockDbRun.mockImplementation((_sql: string, params: unknown[], cb: (this: { changes: number }, err: Error | null) => void) => {
      expect(params[1]).toBe('specific-user-789');
      cb.call({ changes: 1 }, null);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await deleteCommand.execute(interaction as any);
  });

  it('should use the message id from options', async () => {
    interaction.options.getInteger.mockReturnValue(99);

    mockDbRun.mockImplementation((_sql: string, params: unknown[], cb: (this: { changes: number }, err: Error | null) => void) => {
      expect(params[0]).toBe(99);
      cb.call({ changes: 1 }, null);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await deleteCommand.execute(interaction as any);
  });
});
