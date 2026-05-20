import { Queue } from 'bullmq';
import { config } from '../config.js';
import type { QueuedJobData } from './jobTypes.js';

const connection = { url: config.REDIS_URL };

export const jobQueue = new Queue<QueuedJobData>('jobs', { connection });
