import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/authMiddleware';

vi.mock('../lib/prisma', () => ({
  prisma: { messageThreadState: { findMany: vi.fn() } },
}));
vi.mock('../services/realtimeHub', () => ({ realtimeHub: { broadcast: vi.fn() } }));
vi.mock('../services/webhookService', () => ({ matchCustomerByPhone: vi.fn() }));

import { prisma } from '../lib/prisma';
import { getMessagePreferences } from './messagePreferenceController';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.messageThreadState.findMany).mockResolvedValue([
    { businessPhoneNumberId: '111', threadId: 'crm-1', status: 'consulting', isPinned: true, autoTranslate: false },
    { businessPhoneNumberId: '222', threadId: 'crm-1', status: 'completed', isPinned: false, autoTranslate: true },
  ] as never);
});

describe('WhatsApp preferences in the all phones view', () => {
  it('preserves different states for the same CRM customer on two numbers', async () => {
    const res = { json: vi.fn(), status: vi.fn().mockReturnThis() };
    await getMessagePreferences({ query: { phoneNumberId: 'all' } } as unknown as AuthenticatedRequest, res as unknown as Response);
    expect(prisma.messageThreadState.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      threadStatuses: { 'waba:111:crm-1': 'consulting', 'waba:222:crm-1': 'completed' },
      pinnedThreadIds: ['waba:111:crm-1'], autoTranslateThreadIds: ['waba:222:crm-1'],
    }));
  });

  it('keeps the existing per-phone preference keys compatible', async () => {
    vi.mocked(prisma.messageThreadState.findMany).mockResolvedValue([
      { businessPhoneNumberId: '111', threadId: 'crm-1', status: 'consulting', isPinned: true, autoTranslate: false },
    ] as never);
    const res = { json: vi.fn(), status: vi.fn().mockReturnThis() };
    await getMessagePreferences({ query: { phoneNumberId: '111' } } as unknown as AuthenticatedRequest, res as unknown as Response);
    expect(prisma.messageThreadState.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { businessPhoneNumberId: '111' } }));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ pinnedThreadIds: ['crm-1'] }));
  });
});
