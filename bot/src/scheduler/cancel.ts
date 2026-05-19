import schedule from 'node-schedule';

export default function cancelScheduledMessage(id: number): void {
  const jobs = schedule.scheduledJobs;
  Object.keys(jobs).forEach((key) => {
    if (key.startsWith(`${id}-`)) jobs[key]?.cancel();
  });
}
