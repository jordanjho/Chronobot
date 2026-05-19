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
const mockDbAll = vi.fn();
vi.mock('../src/db/database.js', () => ({
  default: {
    run: vi.fn(),
    get: vi.fn(),
    all: mockDbAll,
  },
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
    mockDbAll.mockImplementation((_sql: string, _params: unknown[], cb: (err: Error | null, rows: unknown[]) => void) => {
      cb(null, []);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await listCommand.execute(interaction as any);

    await new Promise(resolve => setTimeout(resolve, 0));
    expect(interaction.editReply).toHaveBeenCalledWith('No messages scheduled.');
  });

  it('should reply with no messages on db error', async () => {
    mockDbAll.mockImplementation((_sql: string, _params: unknown[], cb: (err: Error | null, rows: unknown[]) => void) => {
      cb(new Error('DB error'), []);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await listCommand.execute(interaction as any);

    await new Promise(resolve => setTimeout(resolve, 0));
    expect(interaction.editReply).toHaveBeenCalledWith('No messages scheduled.');
  });

  it('should list scheduled messages when rows are returned', async () => {
    const rows = [
      {
        id: 1,
        channel_id: 'chan-1',
        send_times: JSON.stringify(['2030-01-01T12:00:00.000Z']),
        content: 'Hello world',
        frequency: 'once',
        attachment_url: null,
        user_id: 'user-123',
      },
    ];

    mockDbAll.mockImplementation((_sql: string, _params: unknown[], cb: (err: Error | null, rows: unknown[]) => void) => {
      cb(null, rows);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await listCommand.execute(interaction as any);

    await new Promise(resolve => setTimeout(resolve, 0));
    expect(interaction.editReply).toHaveBeenCalledOnce();
    const reply = interaction.editReply.mock.calls[0][0] as string;
    expect(reply).toContain('**Your Scheduled Messages:**');
    expect(reply).toContain('ID: 1');
    expect(reply).toContain('Hello world');
    expect(reply).toContain('<#chan-1>');
  });

  it('should show [media only] when content is null', async () => {
    const rows = [
      {
        id: 2,
        channel_id: 'chan-2',
        send_times: JSON.stringify(['2030-06-01T00:00:00.000Z']),
        content: null,
        frequency: 'once',
        attachment_url: 'https://example.com/image.png',
        user_id: 'user-123',
      },
    ];

    mockDbAll.mockImplementation((_sql: string, _params: unknown[], cb: (err: Error | null, rows: unknown[]) => void) => {
      cb(null, rows);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await listCommand.execute(interaction as any);

    await new Promise(resolve => setTimeout(resolve, 0));
    const reply = interaction.editReply.mock.calls[0][0] as string;
    expect(reply).toContain('[media only]');
  });

  it('should show None when attachment_url is null', async () => {
    const rows = [
      {
        id: 3,
        channel_id: 'chan-3',
        send_times: JSON.stringify(['2030-06-01T00:00:00.000Z']),
        content: 'Test message',
        frequency: 'once',
        attachment_url: null,
        user_id: 'user-123',
      },
    ];

    mockDbAll.mockImplementation((_sql: string, _params: unknown[], cb: (err: Error | null, rows: unknown[]) => void) => {
      cb(null, rows);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await listCommand.execute(interaction as any);

    await new Promise(resolve => setTimeout(resolve, 0));
    const reply = interaction.editReply.mock.calls[0][0] as string;
    expect(reply).toContain('Attachment: None');
  });

  it('should show separator between multiple messages', async () => {
    const rows = [
      {
        id: 1,
        channel_id: 'chan-1',
        send_times: JSON.stringify(['2030-01-01T12:00:00.000Z']),
        content: 'Message 1',
        frequency: 'once',
        attachment_url: null,
        user_id: 'user-123',
      },
      {
        id: 2,
        channel_id: 'chan-2',
        send_times: JSON.stringify(['2030-02-01T12:00:00.000Z']),
        content: 'Message 2',
        frequency: 'once',
        attachment_url: null,
        user_id: 'user-123',
      },
    ];

    mockDbAll.mockImplementation((_sql: string, _params: unknown[], cb: (err: Error | null, rows: unknown[]) => void) => {
      cb(null, rows);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await listCommand.execute(interaction as any);

    await new Promise(resolve => setTimeout(resolve, 0));
    const reply = interaction.editReply.mock.calls[0][0] as string;
    expect(reply).toContain('---');
    expect(reply).toContain('Message 1');
    expect(reply).toContain('Message 2');
  });

  it('should query messages by user id', async () => {
    interaction.user = { id: 'my-user-id' };
    mockDbAll.mockImplementation((_sql: string, params: unknown[], cb: (err: Error | null, rows: unknown[]) => void) => {
      expect(params[0]).toBe('my-user-id');
      cb(null, []);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await listCommand.execute(interaction as any);
  });

  it('should show attachment url when present', async () => {
    const rows = [
      {
        id: 4,
        channel_id: 'chan-4',
        send_times: JSON.stringify(['2030-06-01T00:00:00.000Z']),
        content: 'Has attachment',
        frequency: 'once',
        attachment_url: 'https://cdn.example.com/file.gif',
        user_id: 'user-123',
      },
    ];

    mockDbAll.mockImplementation((_sql: string, _params: unknown[], cb: (err: Error | null, rows: unknown[]) => void) => {
      cb(null, rows);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await listCommand.execute(interaction as any);

    await new Promise(resolve => setTimeout(resolve, 0));
    const reply = interaction.editReply.mock.calls[0][0] as string;
    expect(reply).toContain('https://cdn.example.com/file.gif');
  });
});
