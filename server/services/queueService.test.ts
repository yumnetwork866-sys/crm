import { describe, expect, it } from 'vitest';
import {
  enqueueCampaignRecipients,
  enqueueDifyAutoReply,
  enqueueMediaPrefetch,
  enqueueWebhookPayload,
  getQueueHealth,
  initMessageQueues,
} from './queueService';

describe('queueService (BullMQ + In-Memory Fallback)', () => {
  it('initializes in memory-fallback mode when Redis is disabled and processes all queue types', async () => {
    process.env.QUEUE_MODE = 'memory';

    const processedWebhooks: unknown[] = [];
    const processedDify: string[] = [];
    const processedMedia: string[] = [];
    const processedRecipients: string[] = [];

    const health = await initMessageQueues({
      onWebhookPayload: async ({ payload }) => {
        processedWebhooks.push(payload);
      },
      onDifyAutoReply: async (data) => {
        processedDify.push(data.incomingText);
      },
      onMediaPrefetch: async ({ mediaId }) => {
        processedMedia.push(mediaId);
      },
      onCampaignRecipient: async ({ recipientId }) => {
        processedRecipients.push(recipientId);
      },
    });

    expect(health.mode).toBe('memory-fallback');
    expect(health.redisConnected).toBe(false);

    await enqueueWebhookPayload({ object: 'whatsapp_business_account' });
    await enqueueDifyAutoReply({
      fromPhone: '84901234567',
      customerName: 'Khách Test',
      customerId: 'cust_1',
      incomingText: 'Xin chào shop',
      isCrmCustomer: true,
    });
    await enqueueMediaPrefetch({ mediaId: 'media_123' });
    await enqueueCampaignRecipients([
      { recipientId: 'rec_1', campaignId: 'camp_1' },
      { recipientId: 'rec_2', campaignId: 'camp_1' },
    ]);

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(processedWebhooks).toHaveLength(1);
    expect(processedDify).toEqual(['Xin chào shop']);
    expect(processedMedia).toEqual(['media_123']);
    expect(processedRecipients).toEqual(['rec_1', 'rec_2']);
    expect(getQueueHealth().inMemoryPending.webhookIngest).toBe(0);
  });
});
