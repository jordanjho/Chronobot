import type { JobPayload } from '../queue/jobTypes.js';

export interface ExecutionResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface Adapter {
  execute(payload: JobPayload): Promise<ExecutionResult>;
}
