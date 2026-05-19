import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock node-schedule
const mockScheduledJobs: Record<string, { cancel: ReturnType<typeof vi.fn> }> = {};
vi.mock('node-schedule', () => ({
  default: {
    get scheduledJobs() {
      return mockScheduledJobs;
    },
    scheduleJob: vi.fn(),
  },
}));

const { default: cancelScheduledMessage } = await import('../src/scheduler/cancel.js');

describe('cancelScheduledMessage', () => {
  beforeEach(() => {
    // Clear all jobs
    Object.keys(mockScheduledJobs).forEach(key => {
      delete mockScheduledJobs[key];
    });
  });

  it('should cancel jobs that start with the given id', () => {
    const cancelFn = vi.fn();
    mockScheduledJobs['42-2099-01-01T00:00:00.000Z'] = { cancel: cancelFn };

    cancelScheduledMessage(42);

    expect(cancelFn).toHaveBeenCalledOnce();
  });

  it('should not cancel jobs for different ids', () => {
    const cancelFn = vi.fn();
    mockScheduledJobs['99-2099-01-01T00:00:00.000Z'] = { cancel: cancelFn };

    cancelScheduledMessage(42);

    expect(cancelFn).not.toHaveBeenCalled();
  });

  it('should cancel multiple jobs for the same message id', () => {
    const cancelFn1 = vi.fn();
    const cancelFn2 = vi.fn();
    mockScheduledJobs['5-2099-01-01T00:00:00.000Z'] = { cancel: cancelFn1 };
    mockScheduledJobs['5-2099-01-08T00:00:00.000Z'] = { cancel: cancelFn2 };

    cancelScheduledMessage(5);

    expect(cancelFn1).toHaveBeenCalledOnce();
    expect(cancelFn2).toHaveBeenCalledOnce();
  });

  it('should do nothing when no jobs exist for the id', () => {
    // No jobs in scheduledJobs
    expect(() => cancelScheduledMessage(999)).not.toThrow();
  });

  it('should not cancel jobs with id that is a prefix of the given id', () => {
    const cancelFn = vi.fn();
    // Job for id=4, should NOT be cancelled when cancelling id=42
    mockScheduledJobs['4-2099-01-01T00:00:00.000Z'] = { cancel: cancelFn };

    cancelScheduledMessage(42);

    expect(cancelFn).not.toHaveBeenCalled();
  });

  it('should handle empty scheduled jobs gracefully', () => {
    expect(() => cancelScheduledMessage(1)).not.toThrow();
  });
});
