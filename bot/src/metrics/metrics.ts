import { Counter, Histogram, Gauge, Registry, collectDefaultMetrics } from 'prom-client';

export const registry = new Registry();

collectDefaultMetrics({ register: registry });

export const jobsEnqueued = new Counter({
  name: 'chronobot_jobs_enqueued_total',
  help: 'Total number of BullMQ jobs enqueued (one per sendTime, not per Prisma job)',
  labelNames: ['frequency'] as const,
  registers: [registry],
});

export const jobsCompleted = new Counter({
  name: 'chronobot_jobs_completed_total',
  help: 'Total number of job executions completed successfully',
  registers: [registry],
});

export const jobsFailed = new Counter({
  name: 'chronobot_jobs_failed_total',
  help: 'Number of job execution failures',
  labelNames: ['final'] as const,
  registers: [registry],
});

export const jobsDead = new Counter({
  name: 'chronobot_jobs_dead_total',
  help: 'Total number of jobs marked DEAD after all retries exhausted',
  registers: [registry],
});

export const jobDurationMs = new Histogram({
  name: 'chronobot_job_duration_ms',
  help: 'Milliseconds from worker start to adapter return (success path)',
  buckets: [50, 100, 250, 500, 1000, 2500, 5000, 10000],
  registers: [registry],
});

export const jobScheduleDelayMs = new Histogram({
  name: 'chronobot_job_schedule_delay_ms',
  help: 'Delta between intended fire time (isoTime) and actual execution start',
  buckets: [100, 500, 1000, 2000, 5000, 15000, 60000],
  registers: [registry],
});

export const activeWorkers = new Gauge({
  name: 'chronobot_active_workers',
  help: 'Number of BullMQ concurrency slots currently processing a job',
  registers: [registry],
});
