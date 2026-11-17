import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../lib/prisma', () => ({ prisma: { whatsAppMessage: { upsert: vi.fn() } } }));
vi.mock('./realtimeHub', () => ({ realtimeHub: { broadcast: vi.fn() } }));
vi.mock('./queueService', () => ({
  enqueueMessageTranslation: vi.fn(),
  enqueueDifyAutoReply: vi.fn(),
  enqueueMediaPrefetch: vi.fn(),
}));
vi.mock('./webhook/webhookCustomerSync', () => ({ matchCustomerByPhone: vi.fn() }));
vi.mock('./webhook/webhookStatusHandler', () => ({
  processIntegrationLifecycle: vi.fn(),
  processWebhookStatuses: vi.fn(),
  processSmbContacts: vi.fn(async () => 0),
  processSmbMessages: vi.fn(async () => 0),
}));
vi.mock('../lib/logger', () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));
import { prisma } from '../lib/prisma';
import { matchCustomerByPhone } from './webhook/webhookCustomerSync';
import { enqueueMessageTranslation } from './queueService';
import { processWebhookPayload } from './webhookService';

const payload = (text: string) => ({
  messages: [
    {
      id: 'incoming',
      type: 'text',
      from: '60123456789',
      text: { body: text },
      timestamp: '1794880000',
    },
  ],
  metadata: { phone_number_id: 'business-phone' },
});
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.whatsAppMessage.upsert).mockResolvedValue({ id: 'incoming' } as any);
  vi.mocked(matchCustomerByPhone).mockResolvedValue({
    customerId: 'customer',
    customerName: 'Customer',
    isCrmCustomer: false,
  });
});
describe('incoming translation enqueue', () => {
  it('enqueues saved foreign text directly from the webhook without an open browser', async () => {
    await processWebhookPayload(payload('Berapa harga?'));
    expect(enqueueMessageTranslation).toHaveBeenCalledWith({ messageId: 'incoming' });
    expect(vi.mocked(prisma.whatsAppMessage.upsert).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(enqueueMessageTranslation).mock.invocationCallOrder[0],
    );
  });
  it('does not enqueue a message that failed to save', async () => {
    vi.mocked(prisma.whatsAppMessage.upsert).mockRejectedValue(new Error('DB unavailable'));
    await processWebhookPayload(payload('Hello'));
    expect(enqueueMessageTranslation).not.toHaveBeenCalled();
  });
  it('does not enqueue Vietnamese text', async () => {
    await processWebhookPayload(payload('Xin chào bạn'));
    expect(enqueueMessageTranslation).not.toHaveBeenCalled();
  });
});
