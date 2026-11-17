import { describe, expect, it, vi } from 'vitest';
import { getLogContext, withLogContext, type LogContext } from '../lib/logContext';
import {
  enqueueCampaignRecipients,
  enqueueDifyAutoReply,
  enqueueMediaPrefetch,
  enqueueMessageTranslation,
  enqueueWebhookPayload,
  getQueueHealth,
  initMessageQueues,
} from './queueService';

describe('queueService (BullMQ + In-Memory Fallback)', () => {
  it('runs translations one at a time and deduplicates messages while they are waiting', async () => {
    vi.stubEnv('QUEUE_MODE', 'memory');
    const started: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    try {
      await initMessageQueues({
        onWebhookPayload: async () => {},
        onDifyAutoReply: async () => {},
        onMediaPrefetch: async () => {},
        onCampaignRecipient: async () => {},
        onMessageTranslation: async ({ messageId }) => {
          started.push(messageId);
          if (messageId === 'first') await gate;
        },
      });
      await enqueueMessageTranslation({ messageId: 'first' });
      await enqueueMessageTranslation({ messageId: 'second' });
      await enqueueMessageTranslation({ messageId: 'second' });
      await vi.waitFor(() => expect(started).toEqual(['first']));
      expect(getQueueHealth().inMemoryPending.messageTranslation).toBe(2);
      release();
      await vi.waitFor(() => expect(started).toEqual(['first', 'second']));
    } finally {
      release();
      vi.unstubAllEnvs();
    }
  });
  it('retries a failed translation after backoff without blocking or duplicating other messages', async () => {
    vi.useFakeTimers();
    vi.stubEnv('QUEUE_MODE', 'memory');
    const attempts: string[] = [];
    let fail = true;
    try {
      await initMessageQueues({
        onWebhookPayload: async () => {},
        onDifyAutoReply: async () => {},
        onMediaPrefetch: async () => {},
        onCampaignRecipient: async () => {},
        onMessageTranslation: async ({ messageId }) => {
          attempts.push(messageId);
          if (messageId === 'retry' && fail) {
            fail = false;
            throw new Error('Temporary timeout');
          }
        },
      });
      await enqueueMessageTranslation({ messageId: 'retry' });
      await enqueueMessageTranslation({ messageId: 'next' });
      await vi.advanceTimersByTimeAsync(0);
      await enqueueMessageTranslation({ messageId: 'retry' });
      expect(attempts).toEqual(['retry', 'next']);
      await vi.advanceTimersByTimeAsync(5000);
      expect(attempts).toEqual(['retry', 'next', 'retry']);
    } finally {
      vi.useRealTimers();
      vi.unstubAllEnvs();
    }
  });
  it('initializes in memory-fallback mode when Redis is disabled and processes all queue types', async () => {
    process.env.QUEUE_MODE = 'memory';

    const processedWebhooks: unknown[] = [];
    const contexts: LogContext[] = [];
    const processedDify: string[] = [];
    const processedMedia: string[] = [];
    const processedRecipients: string[] = [];
    const processedTranslations: string[] = [];

    const health = await initMessageQueues({
      onWebhookPayload: async ({ payload }) => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        contexts.push({ ...getLogContext() });
        processedWebhooks.push(payload);
      },
      onDifyAutoReply: async (data) => {
        processedDify.push(data.incomingText);
      },
      onMediaPrefetch: async ({ mediaId }) => {
        processedMedia.push(mediaId);
      },
      onMessageTranslation: async ({ messageId }) => {
        processedTranslations.push(messageId);
      },
      onCampaignRecipient: async ({ recipientId }) => {
        processedRecipients.push(recipientId);
      },
    });

    expect(health.mode).toBe('memory-fallback');
    expect(health.redisConnected).toBe(false);

    await withLogContext({ requestId: 'webhook-a' }, () =>
      enqueueWebhookPayload({ object: 'whatsapp_business_account' }),
    );
    await withLogContext({ requestId: 'webhook-b' }, () =>
      enqueueWebhookPayload({ object: 'other-event' }),
    );
    await enqueueDifyAutoReply({
      fromPhone: '84901234567',
      customerName: 'Khách Test',
      customerId: 'cust_1',
      incomingText: 'Xin chào shop',
      isCrmCustomer: true,
    });
    await enqueueMediaPrefetch({ mediaId: 'media_123' });
    await enqueueMessageTranslation({ messageId: 'incoming-1' });
    await enqueueCampaignRecipients([
      { recipientId: 'rec_1', campaignId: 'camp_1' },
      { recipientId: 'rec_2', campaignId: 'camp_1' },
    ]);

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(processedWebhooks).toHaveLength(2);
    expect(contexts.map((context) => context.requestId).sort()).toEqual(['webhook-a', 'webhook-b']);
    expect(new Set(contexts.map((context) => context.jobId)).size).toBe(2);
    expect(contexts.every((context) => context.queue === 'webhook-ingest')).toBe(true);
    expect(processedDify).toEqual(['Xin chào shop']);
    expect(processedMedia).toEqual(['media_123']);
    expect(processedTranslations).toEqual(['incoming-1']);
    expect(processedRecipients).toEqual(['rec_1', 'rec_2']);
    expect(getQueueHealth().inMemoryPending.webhookIngest).toBe(0);
  });
});
