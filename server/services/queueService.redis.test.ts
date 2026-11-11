import { describe, expect, it, vi } from 'vitest';
import { getLogContext, withLogContext, type LogContext } from '../lib/logContext';

const state = vi.hoisted(() => ({
  jobs: [] as Array<{ queue: string; data: any }>,
  processors: new Map<string, (job: { data: any }) => Promise<void>>(),
}));

vi.mock('ioredis', () => ({
  default: class {
    options = { host: 'localhost', port: 6379 };
    on() {}
    async connect() {}
    async ping() { return 'PONG'; }
    async quit() {}
  },
}));
vi.mock('bullmq', () => ({
  Queue: class {
    constructor(private queue: string) {}
    async add(_name: string, data: unknown) { state.jobs.push({ queue: this.queue, data }); }
    async addBulk(jobs: Array<{ data: unknown }>) {
      for (const job of jobs) state.jobs.push({ queue: this.queue, data: job.data });
    }
    async close() {}
  },
  Worker: class {
    constructor(queue: string, processJob: (job: { data: any }) => Promise<void>) {
      state.processors.set(queue, processJob);
    }
    async close() {}
  },
}));

import { closeMessageQueues, enqueueWebhookPayload, enqueueDifyAutoReply, initMessageQueues } from './queueService';

describe('Redis job log correlation', () => {
  it('restores serialized request context in workers and passes it to nested jobs and retries', async () => {
    vi.stubEnv('QUEUE_MODE', 'redis');
    vi.stubEnv('DISABLE_REDIS', 'false');
    const observed: LogContext[] = [];
    let failFirstAttempt = true;
    try {
      const health = await initMessageQueues({
        onWebhookPayload: async () => {
          await Promise.resolve();
          observed.push({ ...getLogContext() });
          if (failFirstAttempt) {
            failFirstAttempt = false;
            throw new Error('Retry this job');
          }
          await enqueueDifyAutoReply({
            fromPhone: 'test', customerName: 'Test', customerId: 'test',
            incomingText: 'Test', isCrmCustomer: false,
          });
        },
        onDifyAutoReply: async () => { observed.push({ ...getLogContext() }); },
        onMediaPrefetch: async () => {},
        onCampaignRecipient: async () => {},
      });
      expect(health.mode).toBe('bullmq-redis');
      await withLogContext({ requestId: 'http-original' }, () => enqueueWebhookPayload({ object: 'test' }));
      const webhook = JSON.parse(JSON.stringify(state.jobs[0]));
      expect(webhook.data.logContext).toMatchObject({ requestId: 'http-original', jobId: expect.any(String) });
      const processWebhook = state.processors.get(webhook.queue)!;
      await expect(processWebhook({ data: webhook.data })).rejects.toThrow('Retry this job');
      await withLogContext({ requestId: 'unrelated-request' }, () => processWebhook({ data: webhook.data }));
      const dify = JSON.parse(JSON.stringify(state.jobs[1]));
      await state.processors.get(dify.queue)!({ data: dify.data });
      expect(observed.map((context) => context.requestId)).toEqual(['http-original', 'http-original', 'http-original']);
      expect(observed[0].jobId).toBe(observed[1].jobId);
      expect(observed[2].jobId).not.toBe(observed[0].jobId);
      expect(observed[2].queue).toBe('dify-auto-reply');
      expect(getLogContext()).toEqual({});
    } finally {
      await closeMessageQueues();
      vi.unstubAllEnvs();
    }
  });
});
