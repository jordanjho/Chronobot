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

// Mock database
const mockDbGet = vi.fn();
const mockDbRun = vi.fn();
vi.mock('../src/db/database.js', () => ({
  default: {
    run: mockDbRun,
    get: mockDbGet,
    all: vi.fn(),
  },
}));

const { default: editCommand } = await import('../src/commands/edit.js');

describe('edit command', () => {
  let interaction: ReturnType<typeof createMockInteraction>;

  beforeEach(() => {
    vi.clearAllMocks();
    interaction = createMockInteraction({ commandName: 'edit' });
    interaction.options.getInteger.mockReturnValue(10);
    interaction.options.getString.mockReturnValue(null);
    interaction.options.getAttachment.mockReturnValue(null);
  });

  it('should have the correct command name', () => {
    expect(editCommand.data.name).toBe('edit');
  });

  it('should have a description', () => {
    expect(editCommand.data.description).toBe('Edit a scheduled message');
  });

  it('should reply with error if message not found', async () => {
    mockDbGet.mockImplementation((_sql: string, _params: unknown[], cb: (err: Error | null, row: undefined) => void) => {
      cb(null, undefined);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await editCommand.execute(interaction as any);

    await new Promise(resolve => setTimeout(resolve, 0));
    expect(interaction.editReply).toHaveBeenCalledWith(
      'Message not found or you do not have permission to edit this message.',
    );
  });

  it('should reply with error if db get returns error', async () => {
    mockDbGet.mockImplementation((_sql: string, _params: unknown[], cb: (err: Error | null, row: undefined) => void) => {
      cb(new Error('DB error'), undefined);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await editCommand.execute(interaction as any);

    await new Promise(resolve => setTimeout(resolve, 0));
    expect(interaction.editReply).toHaveBeenCalledWith(
      'Message not found or you do not have permission to edit this message.',
    );
  });

  it('should update message with new content', async () => {
    const existingRow = { content: 'old content', attachment_url: null };
    interaction.options.getString.mockReturnValue('new content');

    mockDbGet.mockImplementation((_sql: string, _params: unknown[], cb: (err: Error | null, row: typeof existingRow) => void) => {
      cb(null, existingRow);
    });
    mockDbRun.mockImplementation((_sql: string, _params: unknown[], cb: (this: { changes: number }, err: Error | null) => void) => {
      cb.call({ changes: 1 }, null);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await editCommand.execute(interaction as any);

    await new Promise(resolve => setTimeout(resolve, 0));
    expect(interaction.editReply).toHaveBeenCalledWith('Updated message 10');
  });

  it('should keep old content when no new content provided', async () => {
    const existingRow = { content: 'original content', attachment_url: null };
    interaction.options.getString.mockReturnValue(null);

    mockDbGet.mockImplementation((_sql: string, _params: unknown[], cb: (err: Error | null, row: typeof existingRow) => void) => {
      cb(null, existingRow);
    });
    mockDbRun.mockImplementation((_sql: string, params: unknown[], cb: (this: { changes: number }, err: Error | null) => void) => {
      expect(params[0]).toBe('original content');
      cb.call({ changes: 1 }, null);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await editCommand.execute(interaction as any);
  });

  it('should update attachment when new one provided', async () => {
    const existingRow = { content: 'content', attachment_url: 'https://old.example.com/img.png' };
    interaction.options.getAttachment.mockReturnValue({ url: 'https://new.example.com/img.png' });

    mockDbGet.mockImplementation((_sql: string, _params: unknown[], cb: (err: Error | null, row: typeof existingRow) => void) => {
      cb(null, existingRow);
    });
    mockDbRun.mockImplementation((_sql: string, params: unknown[], cb: (this: { changes: number }, err: Error | null) => void) => {
      expect(params[1]).toBe('https://new.example.com/img.png');
      cb.call({ changes: 1 }, null);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await editCommand.execute(interaction as any);
  });

  it('should reply with error when update has 0 changes', async () => {
    const existingRow = { content: 'content', attachment_url: null };

    mockDbGet.mockImplementation((_sql: string, _params: unknown[], cb: (err: Error | null, row: typeof existingRow) => void) => {
      cb(null, existingRow);
    });
    mockDbRun.mockImplementation((_sql: string, _params: unknown[], cb: (this: { changes: number }, err: Error | null) => void) => {
      cb.call({ changes: 0 }, null);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await editCommand.execute(interaction as any);

    await new Promise(resolve => setTimeout(resolve, 0));
    expect(interaction.editReply).toHaveBeenCalledWith(
      'Failed to update message or no changes made.',
    );
  });

  it('should reply with error when db run fails', async () => {
    const existingRow = { content: 'content', attachment_url: null };

    mockDbGet.mockImplementation((_sql: string, _params: unknown[], cb: (err: Error | null, row: typeof existingRow) => void) => {
      cb(null, existingRow);
    });
    mockDbRun.mockImplementation((_sql: string, _params: unknown[], cb: (this: { changes: number }, err: Error | null) => void) => {
      cb.call({ changes: 0 }, new Error('Update error'));
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await editCommand.execute(interaction as any);

    await new Promise(resolve => setTimeout(resolve, 0));
    expect(interaction.editReply).toHaveBeenCalledWith(
      'Failed to update message or no changes made.',
    );
  });

  it('should query by both message id and user id', async () => {
    interaction.user = { id: 'owner-456' };
    interaction.options.getInteger.mockReturnValue(77);

    mockDbGet.mockImplementation((_sql: string, params: unknown[], _cb: unknown) => {
      expect(params[0]).toBe(77);
      expect(params[1]).toBe('owner-456');
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await editCommand.execute(interaction as any);
  });
});
