import { describe, it, expect, beforeEach } from 'vitest';
import {
  registry,
  jobsEnqueued,
  jobsCompleted,
  jobsFailed,
  jobsDead,
  jobDurationMs,
  jobScheduleDelayMs,
  activeWorkers,
} from '../../src/metrics/metrics.js';

describe('metrics module', () => {
  beforeEach(() => {
    registry.resetMetrics();
  });

  it('registry is not null', () => {
    expect(registry).toBeDefined();
  });

  it('jobsEnqueued counter increments without error', async () => {
    jobsEnqueued.labels({ frequency: 'once' }).inc();
    const { values } = await jobsEnqueued.get();
    expect(values.find(v => v.labels.frequency === 'once')?.value).toBe(1);
  });

  it('jobsCompleted counter increments without error', async () => {
    jobsCompleted.inc();
    const { values } = await jobsCompleted.get();
    expect(values[0]?.value).toBe(1);
  });

  it('jobsFailed counter with label final=true increments correctly', async () => {
    jobsFailed.labels({ final: 'true' }).inc();
    const { values } = await jobsFailed.get();
    expect(values.find(v => v.labels.final === 'true')?.value).toBe(1);
  });

  it('jobsFailed counter with label final=false increments correctly', async () => {
    jobsFailed.labels({ final: 'false' }).inc();
    const { values } = await jobsFailed.get();
    expect(values.find(v => v.labels.final === 'false')?.value).toBe(1);
  });

  it('jobDurationMs histogram observes a number without error', async () => {
    expect(() => jobDurationMs.observe(250)).not.toThrow();
  });

  it('jobScheduleDelayMs histogram observes a number without error', async () => {
    expect(() => jobScheduleDelayMs.observe(500)).not.toThrow();
  });

  it('jobsDead counter increments without error', async () => {
    jobsDead.inc();
    const { values } = await jobsDead.get();
    expect(values[0]?.value).toBe(1);
  });

  it('activeWorkers gauge can be incremented and decremented', async () => {
    activeWorkers.inc();
    activeWorkers.inc();
    activeWorkers.dec();
    const { values } = await activeWorkers.get();
    expect(values[0]?.value).toBe(1);
  });
});
