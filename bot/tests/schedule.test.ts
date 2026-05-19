import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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

// Mock scheduleMessage
const mockScheduleMessage = vi.fn();
vi.mock('../src/scheduler/scheduleMessage.js', () => ({
  default: mockScheduleMessage,
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

const { default: scheduleCommand } = await import('../src/commands/schedule.js');

describe('schedule command', () => {
  let interaction: ReturnType<typeof createMockInteraction>;

  beforeEach(() => {
    vi.clearAllMocks();
    interaction = createMockInteraction({ commandName: 'schedule' });
    // Default: frequency = once, valid future timestamp
    interaction.options.getString.mockImplementation((name: string) => {
      if (name === 'frequency') return 'once';
      if (name === 'timestamp') return '2099-12-31 23:59';
      if (name === 'content') return 'Test message';
      return null;
    });
    interaction.options.getAttachment.mockReturnValue(null);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should have the correct command name', () => {
    expect(scheduleCommand.data.name).toBe('schedule');
  });

  it('should have a description', () => {
    expect(scheduleCommand.data.description).toBe('Schedule a message');
  });

  it('should reject invalid frequency', async () => {
    interaction.options.getString.mockImplementation((name: string) => {
      if (name === 'frequency') return 'monthly';
      if (name === 'timestamp') return '2099-12-31 23:59';
      return null;
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await scheduleCommand.execute(interaction as any);

    expect(interaction.editReply).toHaveBeenCalledWith(
      'Invalid frequency. Use once, daily, or weekly.',
    );
  });

  it('should reject past timestamp', async () => {
    interaction.options.getString.mockImplementation((name: string) => {
      if (name === 'frequency') return 'once';
      if (name === 'timestamp') return '2000-01-01 00:00';
      return null;
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await scheduleCommand.execute(interaction as any);

    expect(interaction.editReply).toHaveBeenCalledWith(
      'Invalid or distant timestamp. Format: YYYY-MM-DD HH:mm UTC.',
    );
  });

  it('should reject invalid timestamp format', async () => {
    interaction.options.getString.mockImplementation((name: string) => {
      if (name === 'frequency') return 'once';
      if (name === 'timestamp') return 'not-a-date';
      return null;
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await scheduleCommand.execute(interaction as any);

    expect(interaction.editReply).toHaveBeenCalledWith(
      'Invalid or distant timestamp. Format: YYYY-MM-DD HH:mm UTC.',
    );
  });

  it('should reply with error if user already has 5 messages', async () => {
    mockDbGet.mockImplementation((_sql: string, _params: unknown[], cb: (err: Error | null, row: { count: number }) => void) => {
      cb(null, { count: 5 });
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await scheduleCommand.execute(interaction as any);

    await new Promise(resolve => setTimeout(resolve, 0));
    expect(interaction.editReply).toHaveBeenCalledWith(
      'You can only have 5 scheduled messages at a time.',
    );
  });

  it('should reply with error on database get error', async () => {
    mockDbGet.mockImplementation((_sql: string, _params: unknown[], cb: (err: Error | null, row: null) => void) => {
      cb(new Error('DB error'), null);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await scheduleCommand.execute(interaction as any);

    await new Promise(resolve => setTimeout(resolve, 0));
    expect(interaction.editReply).toHaveBeenCalledWith('Database error.');
  });

  it('should schedule a once message successfully', async () => {
    mockDbGet.mockImplementation((_sql: string, _params: unknown[], cb: (err: Error | null, row: { count: number }) => void) => {
      cb(null, { count: 0 });
    });
    mockDbRun.mockImplementation((_sql: string, _params: unknown[], cb: (this: { lastID: number }, err: Error | null) => void) => {
      cb.call({ lastID: 1 }, null);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await scheduleCommand.execute(interaction as any);

    await new Promise(resolve => setTimeout(resolve, 0));
    expect(interaction.editReply).toHaveBeenCalledWith('Message scheduled with ID 1');
    expect(mockScheduleMessage).toHaveBeenCalledTimes(1);
  });

  it('should schedule 7 times for daily frequency', async () => {
    interaction.options.getString.mockImplementation((name: string) => {
      if (name === 'frequency') return 'daily';
      if (name === 'timestamp') return '2099-12-25 10:00';
      if (name === 'content') return 'Daily msg';
      return null;
    });

    mockDbGet.mockImplementation((_sql: string, _params: unknown[], cb: (err: Error | null, row: { count: number }) => void) => {
      cb(null, { count: 0 });
    });
    mockDbRun.mockImplementation((_sql: string, params: unknown[], cb: (this: { lastID: number }, err: Error | null) => void) => {
      // Verify 7 times stored
      const times = JSON.parse(params[1] as string) as string[];
      expect(times).toHaveLength(7);
      cb.call({ lastID: 2 }, null);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await scheduleCommand.execute(interaction as any);

    await new Promise(resolve => setTimeout(resolve, 0));
    expect(mockScheduleMessage).toHaveBeenCalledTimes(7);
  });

  it('should schedule 4 times for weekly frequency', async () => {
    interaction.options.getString.mockImplementation((name: string) => {
      if (name === 'frequency') return 'weekly';
      if (name === 'timestamp') return '2099-12-25 10:00';
      if (name === 'content') return 'Weekly msg';
      return null;
    });

    mockDbGet.mockImplementation((_sql: string, _params: unknown[], cb: (err: Error | null, row: { count: number }) => void) => {
      cb(null, { count: 0 });
    });
    mockDbRun.mockImplementation((_sql: string, params: unknown[], cb: (this: { lastID: number }, err: Error | null) => void) => {
      const times = JSON.parse(params[1] as string) as string[];
      expect(times).toHaveLength(4);
      cb.call({ lastID: 3 }, null);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await scheduleCommand.execute(interaction as any);

    await new Promise(resolve => setTimeout(resolve, 0));
    expect(mockScheduleMessage).toHaveBeenCalledTimes(4);
  });

  it('should reply with error on db insert failure', async () => {
    mockDbGet.mockImplementation((_sql: string, _params: unknown[], cb: (err: Error | null, row: { count: number }) => void) => {
      cb(null, { count: 0 });
    });
    mockDbRun.mockImplementation((_sql: string, _params: unknown[], cb: (this: { lastID: number }, err: Error | null) => void) => {
      cb.call({ lastID: 0 }, new Error('Insert failed'));
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await scheduleCommand.execute(interaction as any);

    await new Promise(resolve => setTimeout(resolve, 0));
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.stringContaining('Failed to schedule message'),
    );
  });

  it('should pass attachment url to scheduleMessage', async () => {
    interaction.options.getAttachment.mockReturnValue({ url: 'https://cdn.example.com/img.png' });

    mockDbGet.mockImplementation((_sql: string, _params: unknown[], cb: (err: Error | null, row: { count: number }) => void) => {
      cb(null, { count: 0 });
    });
    mockDbRun.mockImplementation((_sql: string, _params: unknown[], cb: (this: { lastID: number }, err: Error | null) => void) => {
      cb.call({ lastID: 5 }, null);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await scheduleCommand.execute(interaction as any);

    await new Promise(resolve => setTimeout(resolve, 0));
    expect(mockScheduleMessage).toHaveBeenCalledWith(
      expect.anything(), // client
      5,
      expect.any(String),
      expect.any(String),
      expect.any(String),
      'https://cdn.example.com/img.png',
    );
  });

  it('should use empty string for content when not provided', async () => {
    interaction.options.getString.mockImplementation((name: string) => {
      if (name === 'frequency') return 'once';
      if (name === 'timestamp') return '2099-12-31 23:59';
      if (name === 'content') return null;
      return null;
    });

    mockDbGet.mockImplementation((_sql: string, _params: unknown[], cb: (err: Error | null, row: { count: number }) => void) => {
      cb(null, { count: 0 });
    });
    mockDbRun.mockImplementation((_sql: string, params: unknown[], cb: (this: { lastID: number }, err: Error | null) => void) => {
      expect(params[2]).toBe(''); // content should be empty string
      cb.call({ lastID: 6 }, null);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await scheduleCommand.execute(interaction as any);
  });
});
