import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import type { AuthenticatedRequest } from '../../middleware/authMiddleware';

vi.mock('../../lib/prisma', () => ({
  prisma: {
    whatsAppMessage: { findFirst: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
    $transaction: vi.fn(),
  },
}));
vi.mock('../../services/metaApiClient', () => ({
  getIntegrationSetting: vi.fn().mockResolvedValue({}),
  getMetaAccessTokenForPhone: vi.fn().mockResolvedValue('token'),
  resolvePhoneNumberId: vi.fn().mockResolvedValue('123'),
  dispatchMetaMessage: vi.fn(),
  dispatchMetaReaction: vi.fn(),
}));
vi.mock('../../services/realtimeHub', () => ({ realtimeHub: { broadcast: vi.fn() } }));
vi.mock('../../services/difyService', () => ({ pauseAiForCustomer: vi.fn() }));
vi.mock('../../services/webhookService', () => ({ resolveWhatsAppBrandName: vi.fn() }));

import { prisma } from '../../lib/prisma';
import { dispatchMetaReaction } from '../../services/metaApiClient';
import { realtimeHub } from '../../services/realtimeHub';
import { deleteThread, sendMessage, sendReaction } from './chatMessagingActions';

const invoke = async (emoji = '👍') => {
  const req = {
    body: { messageId: 'wamid.target', customerPhone: '+60123456789', senderPhoneId: '123', emoji },
    user: { name: 'Sales' },
  } as AuthenticatedRequest;
  const res = { json: vi.fn(), status: vi.fn().mockReturnThis() };
  await sendReaction(req, res as unknown as Response);
  return res;
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.whatsAppMessage.findFirst).mockResolvedValue({
    id: 'wamid.target', customerId: 'crm-customer', customerPhone: '+60123456789',
    businessPhoneNumberId: '123',
  } as never);
  vi.mocked(prisma.$transaction).mockImplementation(async (run: any) => run(prisma));
  vi.mocked(dispatchMetaReaction).mockResolvedValue({ isRealSent: true, metaResult: {} });
});

describe('staff reactions as replies', () => {
  it('persists the reply watermark and marks earlier inbound messages read in the selected WABA', async () => {
    const res = await invoke();
    expect(prisma.whatsAppMessage.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: 'wamid.target', businessPhoneNumberId: '123' },
      data: { reaction: '👍', agentReactedAt: expect.any(Date) },
    });
    const repliedAt = vi.mocked(prisma.whatsAppMessage.updateMany).mock.calls[0][0]!.data.agentReactedAt;
    expect(prisma.whatsAppMessage.updateMany).toHaveBeenNthCalledWith(2, {
      where: {
        businessPhoneNumberId: '123', customerId: 'crm-customer', sender: 'customer',
        isRead: false, timestamp: { lte: repliedAt },
      },
      data: { isRead: true, readAt: repliedAt, readBy: 'Sales' },
    });
    expect(realtimeHub.broadcast).toHaveBeenCalledWith('message:reaction', expect.objectContaining({
      businessPhoneNumberId: '123', repliedAt: expect.any(String),
    }));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ repliedAt: expect.any(String) }));
  });

  it.each(['not sent', 'dispatch error', 'removed'])('does not advance the reply watermark when %s', async (scenario) => {
    if (scenario === 'not sent') vi.mocked(dispatchMetaReaction).mockResolvedValue({ isRealSent: false, metaResult: null });
    if (scenario === 'dispatch error') vi.mocked(dispatchMetaReaction).mockRejectedValue(new Error('Meta unavailable'));
    const res = await invoke(scenario === 'removed' ? '' : '👍');
    expect(prisma.whatsAppMessage.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.whatsAppMessage.updateMany).toHaveBeenCalledWith({
      where: { id: 'wamid.target', businessPhoneNumberId: '123' },
      data: { reaction: scenario === 'removed' ? null : '👍' },
    });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ repliedAt: null }));
  });

  it('rejects a message outside the selected WABA before sending a reaction', async () => {
    vi.mocked(prisma.whatsAppMessage.findFirst).mockResolvedValue(null);
    const res = await invoke();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(dispatchMetaReaction).not.toHaveBeenCalled();
    expect(prisma.whatsAppMessage.updateMany).not.toHaveBeenCalled();
  });
});


describe('all phones conversation actions', () => {
  it('deletes only the clicked business phone conversation and broadcasts that scope', async () => {
    const res = { json: vi.fn(), status: vi.fn().mockReturnThis() };
    await deleteThread({ params: { customerId: 'crm-customer' }, query: {
      customerPhone: '+60123456789', phoneNumberId: '222',
    } } as unknown as Request, res as unknown as Response);
    expect(prisma.whatsAppMessage.deleteMany).toHaveBeenCalledWith({ where: {
      businessPhoneNumberId: '222', OR: [
        { customerId: 'crm-customer' },
        { customerPhone: { contains: '123456789' } },
        { customerId: { contains: '123456789' } },
      ],
    } });
    expect(realtimeHub.broadcast).toHaveBeenCalledWith('message:thread_deleted', expect.objectContaining({
      businessPhoneNumberId: '222',
    }));
  });

  it.each(['MY.941245582048923', '@customer'])('deletes identifier %s without treating it as a phone number', async (identifier) => {
    const res = { json: vi.fn(), status: vi.fn().mockReturnThis() };
    await deleteThread({ params: { customerId: `meta_${identifier}` }, query: {
      customerPhone: identifier, phoneNumberId: '222',
    } } as unknown as Request, res as unknown as Response);
    expect(prisma.whatsAppMessage.deleteMany).toHaveBeenCalledWith({ where: {
      businessPhoneNumberId: '222', OR: [{ customerId: `meta_${identifier}` }, { customerPhone: identifier }],
    } });
  });

  it('rejects the all sentinel for deletion and sending', async () => {
    const res = { json: vi.fn(), status: vi.fn().mockReturnThis() };
    await deleteThread({ params: { customerId: 'crm-customer' }, query: {
      phoneNumberId: 'all',
    } } as unknown as Request, res as unknown as Response);
    expect(res.status).toHaveBeenLastCalledWith(400);
    expect(prisma.whatsAppMessage.deleteMany).not.toHaveBeenCalled();
    await sendMessage({ body: { senderPhoneId: 'all', customerPhone: '+60123456789', content: 'Test' } } as AuthenticatedRequest, res as unknown as Response);
    expect(res.status).toHaveBeenLastCalledWith(400);
  });
});
