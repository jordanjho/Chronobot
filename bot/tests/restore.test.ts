import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock logger
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
const mockDbAll = vi.fn();
vi.mock('../src/db/database.js', () => ({
  default: {
    run: vi.fn(),
    get: vi.fn(),
    all: mockDbAll,
  },
}));

const { default: restoreScheduledMessages } = await import('../src/scheduler/restore.js');
const mockClient = {} as Parameters<typeof restoreScheduledMessages>[0];

describe('restoreScheduledMessages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call scheduleMessage for each future time', () => {
    const futureDate = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour from now
    const rows = [
      {
        id: 1,
        channel_id: 'chan-1',
        send_times: JSON.stringify([futureDate]),
        content: 'Hello',
        frequency: 'once',
        attachment_url: null,
        user_id: 'user-1',
      },
    ];

    mockDbAll.mockImplementation((_sql: string, _params: unknown[], cb: (err: Error | null, rows: typeof rows) => void) => {
      cb(null, rows);
    });

    restoreScheduledMessages(mockClient);

    expect(mockScheduleMessage).toHaveBeenCalledTimes(1);
    expect(mockScheduleMessage).toHaveBeenCalledWith(
      mockClient,
      1,
      'chan-1',
      futureDate,
      'Hello',
      null,
    );
  });

  it('should skip times in the past (Bug 1 fix)', () => {
    const pastDate = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1 hour ago
    const rows = [
      {
        id: 2,
        channel_id: 'chan-2',
        send_times: JSON.stringify([pastDate]),
        content: 'Past message',
        frequency: 'once',
        attachment_url: null,
        user_id: 'user-2',
      },
    ];

    mockDbAll.mockImplementation((_sql: string, _params: unknown[], cb: (err: Error | null, rows: typeof rows) => void) => {
      cb(null, rows);
    });

    restoreScheduledMessages(mockClient);

    expect(mockScheduleMessage).not.toHaveBeenCalled();
  });

  it('should only schedule future times from a mixed array', () => {
    const pastDate = new Date(Date.now() - 1000).toISOString();
    const futureDate = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const rows = [
      {
        id: 3,
        channel_id: 'chan-3',
        send_times: JSON.stringify([pastDate, futureDate]),
        content: 'Mixed',
        frequency: 'daily',
        attachment_url: null,
        user_id: 'user-3',
      },
    ];

    mockDbAll.mockImplementation((_sql: string, _params: unknown[], cb: (err: Error | null, rows: typeof rows) => void) => {
      cb(null, rows);
    });

    restoreScheduledMessages(mockClient);

    expect(mockScheduleMessage).toHaveBeenCalledTimes(1);
    expect(mockScheduleMessage).toHaveBeenCalledWith(
      mockClient,
      3,
      'chan-3',
      futureDate,
      'Mixed',
      null,
    );
  });

  it('should log error when db fails', () => {
    mockDbAll.mockImplementation((_sql: string, _params: unknown[], cb: (err: Error, rows: null) => void) => {
      cb(new Error('DB failure'), null as unknown as never);
    });

    restoreScheduledMessages(mockClient);

    expect(mockScheduleMessage).not.toHaveBeenCalled();
  });

  it('should handle multiple rows correctly', () => {
    const future1 = new Date(Date.now() + 3600000).toISOString();
    const future2 = new Date(Date.now() + 7200000).toISOString();
    const rows = [
      {
        id: 10,
        channel_id: 'chan-a',
        send_times: JSON.stringify([future1]),
        content: 'Msg A',
        frequency: 'once',
        attachment_url: 'https://cdn.example.com/a.png',
        user_id: 'user-a',
      },
      {
        id: 11,
        channel_id: 'chan-b',
        send_times: JSON.stringify([future2]),
        content: 'Msg B',
        frequency: 'once',
        attachment_url: null,
        user_id: 'user-b',
      },
    ];

    mockDbAll.mockImplementation((_sql: string, _params: unknown[], cb: (err: Error | null, rows: typeof rows) => void) => {
      cb(null, rows);
    });

    restoreScheduledMessages(mockClient);

    expect(mockScheduleMessage).toHaveBeenCalledTimes(2);
    expect(mockScheduleMessage).toHaveBeenCalledWith(mockClient, 10, 'chan-a', future1, 'Msg A', 'https://cdn.example.com/a.png');
    expect(mockScheduleMessage).toHaveBeenCalledWith(mockClient, 11, 'chan-b', future2, 'Msg B', null);
  });

  it('should handle empty result set gracefully', () => {
    mockDbAll.mockImplementation((_sql: string, _params: unknown[], cb: (err: Error | null, rows: never[]) => void) => {
      cb(null, []);
    });

    restoreScheduledMessages(mockClient);

    expect(mockScheduleMessage).not.toHaveBeenCalled();
  });

  it('should pass attachment_url to scheduleMessage', () => {
    const futureDate = new Date(Date.now() + 3600000).toISOString();
    const rows = [
      {
        id: 20,
        channel_id: 'chan-x',
        send_times: JSON.stringify([futureDate]),
        content: 'With attachment',
        frequency: 'once',
        attachment_url: 'https://cdn.example.com/img.jpg',
        user_id: 'user-x',
      },
    ];

    mockDbAll.mockImplementation((_sql: string, _params: unknown[], cb: (err: Error | null, rows: typeof rows) => void) => {
      cb(null, rows);
    });

    restoreScheduledMessages(mockClient);

    expect(mockScheduleMessage).toHaveBeenCalledWith(
      mockClient,
      20,
      'chan-x',
      futureDate,
      'With attachment',
      'https://cdn.example.com/img.jpg',
    );
  });
});
