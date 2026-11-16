import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../lib/prisma', () => ({
  prisma: {
    aiConversationState: {
      findMany: vi.fn(),
      upsert: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    whatsAppMessage: { findFirst: vi.fn(), create: vi.fn() },
    whatsAppConnection: { findUnique: vi.fn() },
    aiRun: { update: vi.fn() },
    aiKnowledgeChunk: { count: vi.fn() },
  },
}));
vi.mock('../../lib/logger', () => ({ createLogger: () => ({ info: vi.fn(), error: vi.fn() }) }));
vi.mock('../realtimeHub', () => ({ realtimeHub: { broadcast: vi.fn() } }));
vi.mock('../difyService', () => ({
  isCustomerDemandingHuman: vi.fn(() => false),
  isCustomerAngryOrComplaining: vi.fn(() => false),
}));
vi.mock('./nativeAiService', () => ({ generateNativeAi: vi.fn(), getAiConfig: vi.fn() }));
vi.mock('../metaApiClient', () => ({
  getIntegrationSetting: vi.fn(),
  getMetaAccessTokenForPhone: vi.fn(),
  dispatchMetaMessage: vi.fn(),
}));
import { prisma } from '../../lib/prisma';
import { isCustomerDemandingHuman } from '../difyService';
import { generateNativeAi, getAiConfig } from './nativeAiService';
import {
  dispatchMetaMessage,
  getIntegrationSetting,
  getMetaAccessTokenForPhone,
} from '../metaApiClient';
import { autoReplyWithNativeAi, isNativeAiActive, pauseNativeAi } from './nativeAutoReply';

const input = {
  fromPhone: '60123456789',
  customerName: 'Test',
  customerId: 'customer',
  incomingText: 'Return policy?',
  isCrmCustomer: true,
  incomingMsgId: 'inbound-1',
  businessPhoneNumberId: 'phone-1',
};
const message = { id: 'inbound-1', sender: 'customer' };
const result = {
  runId: 'run-1',
  sourceIds: ['chunk-1'],
  shouldAutoReply: true,
  answer: 'Returns in 7 days.',
  reason: 'Supported.',
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getAiConfig).mockResolvedValue({ autoReplyEnabled: true } as any);
  vi.mocked(prisma.aiConversationState.findMany).mockResolvedValue([]);
  vi.mocked(prisma.aiKnowledgeChunk.count).mockResolvedValue(1);
  vi.mocked(prisma.aiConversationState.upsert).mockResolvedValue({ id: 'state' } as any);
  vi.mocked(prisma.aiConversationState.updateMany).mockResolvedValue({ count: 1 });
  vi.mocked(prisma.aiConversationState.update).mockResolvedValue({ id: 'state' } as any);
  vi.mocked(prisma.whatsAppMessage.findFirst).mockResolvedValue(message as any);
  vi.mocked(prisma.whatsAppMessage.create).mockResolvedValue({ id: 'sent-1' } as any);
  vi.mocked(prisma.whatsAppConnection.findUnique).mockResolvedValue({
    verifiedName: 'Actiscar',
  } as any);
  vi.mocked(prisma.aiRun.update).mockResolvedValue({ id: 'run-1' } as any);
  vi.mocked(generateNativeAi).mockResolvedValue(result as any);
  vi.mocked(getIntegrationSetting).mockResolvedValue({ aiName: 'Assistant' } as any);
  vi.mocked(getMetaAccessTokenForPhone).mockResolvedValue('mock-token');
  vi.mocked(dispatchMetaMessage).mockResolvedValue({
    isRealSent: true,
    metaResult: { messages: [{ id: 'sent-1' }] },
  } as any);
});

describe('native automatic reply dispatch', () => {
  it('does not generate or send when global AI is disabled', async () => {
    vi.mocked(getAiConfig).mockResolvedValue({ autoReplyEnabled: false } as any);
    expect(await autoReplyWithNativeAi(input)).toBe(false);
    expect(generateNativeAi).not.toHaveBeenCalled();
    expect(dispatchMetaMessage).not.toHaveBeenCalled();
  });
  it('persists pauses with the business phone scope and honors them', async () => {
    await pauseNativeAi(input.fromPhone, 30, 'phone-1');
    expect(prisma.aiConversationState.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: JSON.stringify(['phone-1', input.fromPhone]) },
        update: { pausedUntil: expect.any(Date) },
      }),
    );
    vi.mocked(prisma.aiConversationState.findMany).mockResolvedValue([
      { pausedUntil: new Date(Date.now() + 60000) },
    ] as any);
    expect(await isNativeAiActive(input.fromPhone, 'phone-1')).toBe(false);
    expect(await autoReplyWithNativeAi(input)).toBe(false);
    expect(dispatchMetaMessage).not.toHaveBeenCalled();
  });
  it('hands over human requests without generating a reply', async () => {
    vi.mocked(isCustomerDemandingHuman).mockReturnValue(true);
    expect(await autoReplyWithNativeAi(input)).toBe(false);
    expect(prisma.aiConversationState.upsert).toHaveBeenCalled();
    expect(generateNativeAi).not.toHaveBeenCalled();
  });
  it('blocks stale output when staff replies while the model is running', async () => {
    vi.mocked(prisma.whatsAppMessage.findFirst)
      .mockResolvedValueOnce(message as any)
      .mockResolvedValueOnce({ id: 'staff-reply', sender: 'agent' } as any);
    expect(await autoReplyWithNativeAi(input)).toBe(false);
    expect(dispatchMetaMessage).not.toHaveBeenCalled();
    expect(prisma.aiRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'blocked', stage: 'dispatch-check' }),
      }),
    );
  });
  it('does not send unsupported answers or duplicate attempts', async () => {
    vi.mocked(generateNativeAi).mockResolvedValueOnce({ ...result, shouldAutoReply: false } as any);
    expect(await autoReplyWithNativeAi(input)).toBe(false);
    vi.mocked(prisma.aiConversationState.updateMany).mockResolvedValue({ count: 0 });
    expect(await autoReplyWithNativeAi(input)).toBe(false);
    expect(dispatchMetaMessage).not.toHaveBeenCalled();
  });
  it('claims delivery before sending and persists Meta-confirmed messages', async () => {
    expect(await autoReplyWithNativeAi(input)).toBe(true);
    expect(
      vi.mocked(prisma.aiConversationState.updateMany).mock.invocationCallOrder[0],
    ).toBeLessThan(vi.mocked(dispatchMetaMessage).mock.invocationCallOrder[0]);
    expect(dispatchMetaMessage).toHaveBeenCalledWith(
      expect.objectContaining({ phoneId: 'phone-1', contextMessageId: 'inbound-1' }),
    );
    expect(prisma.whatsAppMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          id: 'sent-1',
          isAi: true,
          businessPhoneNumberId: 'phone-1',
        }),
      }),
    );
  });
  it('records delivery failures and never retries an uncertain dispatch inside the worker', async () => {
    vi.mocked(dispatchMetaMessage).mockRejectedValue(new Error('Connection closed after dispatch'));
    expect(await autoReplyWithNativeAi(input)).toBe(false);
    expect(dispatchMetaMessage).toHaveBeenCalledTimes(1);
    expect(prisma.aiRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'error', errorCode: 'DISPATCH_FAILED' }),
      }),
    );
  });
});
