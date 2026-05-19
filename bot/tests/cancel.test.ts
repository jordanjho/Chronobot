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
    const uuid = 'a8e031674c0aed91-2099-01-01T00:00:00.000Z';
    mockScheduledJobs[uuid] = { cancel: cancelFn };

    cancelScheduledMessage('a8e031674c0aed91');

    expect(cancelFn).toHaveBeenCalledOnce();
  });

  it('should not cancel jobs for different ids', () => {
    const cancelFn = vi.fn();
    mockScheduledJobs['other-uuid-2099-01-01T00:00:00.000Z'] = { cancel: cancelFn };

    cancelScheduledMessage('my-uuid');

    expect(cancelFn).not.toHaveBeenCalled();
  });

  it('should cancel multiple jobs for the same message id', () => {
    const cancelFn1 = vi.fn();
    const cancelFn2 = vi.fn();
    const uuid = 'my-job-uuid';
    mockScheduledJobs[`${uuid}-2099-01-01T00:00:00.000Z`] = { cancel: cancelFn1 };
    mockScheduledJobs[`${uuid}-2099-01-08T00:00:00.000Z`] = { cancel: cancelFn2 };

    cancelScheduledMessage(uuid);

    expect(cancelFn1).toHaveBeenCalledOnce();
    expect(cancelFn2).toHaveBeenCalledOnce();
  });

  it('should do nothing when no jobs exist for the id', () => {
    expect(() => cancelScheduledMessage('nonexistent-uuid')).not.toThrow();
  });

  it('should not cancel jobs with id that is a prefix of the given id', () => {
    const cancelFn = vi.fn();
    // Job for id='abc', should NOT be cancelled when cancelling id='abcdef'
    mockScheduledJobs['abc-2099-01-01T00:00:00.000Z'] = { cancel: cancelFn };

    cancelScheduledMessage('abcdef');

    expect(cancelFn).not.toHaveBeenCalled();
  });

  it('should handle empty scheduled jobs gracefully', () => {
    expect(() => cancelScheduledMessage('uuid-1')).not.toThrow();
  });
});
