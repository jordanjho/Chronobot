export interface JobPayload {
  jobId: string;
  channelId: string;
  isoTime: string;
}

export type QueuedJobData = JobPayload;
