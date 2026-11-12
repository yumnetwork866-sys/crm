import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

vi.mock('../../lib/prisma', () => ({
  prisma: {
    $queryRaw: vi.fn().mockResolvedValue([]),
    whatsAppMessage: { findMany: vi.fn().mockResolvedValue([]) },
    customer: { findUnique: vi.fn().mockResolvedValue(null) },
  },
}));
vi.mock('../../services/metaApiClient', () => ({
  getIntegrationSetting: vi.fn().mockResolvedValue({}),
  resolvePhoneNumberId: vi.fn().mockResolvedValue('999'),
  fetchAndCacheMetaMedia: vi.fn(),
}));
vi.mock('../../services/linkPreviewService', () => ({ fetchLinkPreview: vi.fn() }));

import { prisma } from '../../lib/prisma';
import { resolvePhoneNumberId } from '../../services/metaApiClient';
import { decodeConversationCursor, encodeConversationCursor } from '../../utils/conversationCursor';
import { getConversations, getMessages } from './chatMessageQueries';

const response = () => ({ json: vi.fn(), status: vi.fn().mockReturnThis() });
beforeEach(() => vi.clearAllMocks());

describe('WhatsApp business phone scope', () => {
  it('queries all conversations without falling back to the default phone, with separate latest messages and reply counts per phone', async () => {
    const res = response();
    await getConversations({ query: { phoneNumberId: 'all' } } as unknown as Request, res as unknown as Response);
    expect(res.status).not.toHaveBeenCalled();
    expect(resolvePhoneNumberId).not.toHaveBeenCalled();
    const [strings, ...values] = vi.mocked(prisma.$queryRaw).mock.calls[0];
    const sql = Array.from(strings as TemplateStringsArray).join('?');
    // Prisma fragments retain SQL and values independently from the outer tagged template.
    const fragments = values.filter((value: any) => typeof value?.sql === 'string') as any[];
    const partitionFragments = fragments.filter((value) => value.sql.includes('JSON_BUILD_ARRAY'));
    expect(partitionFragments).toHaveLength(4);
    expect(partitionFragments.every((value) => value.sql.includes('"businessPhoneNumberId"'))).toBe(true);
    expect(fragments.some((value) => value.sql.includes('IS NOT NULL'))).toBe(true);
    expect(sql).toContain('LEFT JOIN UnreadStats');
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: [] }));
  });

  it('keeps a specific phone filter and loads older history within the selected conversation phone', async () => {
    const res = response();
    await getConversations({ query: { phoneNumberId: '222' } } as unknown as Request, res as unknown as Response);
    const values = vi.mocked(prisma.$queryRaw).mock.calls[0].slice(1) as any[];
    expect(values.filter((value) => value?.values?.includes('222'))).toHaveLength(2);
    await getMessages({ params: {}, query: {
      phoneNumberId: '222', customerId: 'crm-customer', customerPhone: '+60123456789', paginate: 'true', limit: '30',
    } } as unknown as Request, res as unknown as Response);
    expect(prisma.whatsAppMessage.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ businessPhoneNumberId: '222' }), take: 31,
    }));
  });
});


const rawThread = (id: string) => ({
  customerId: `crm-${id}`, customerName: 'Customer', customerPhone: '+60123456789',
  businessPhoneNumberId: '222', unreadCount: 1n, lastMsgId: id,
  lastMsgTimestamp: new Date('2026-11-12T08:00:00.000Z'), lastMsgContent: 'Hello', lastMsgSender: 'customer',
});

describe('conversation cursor pagination', () => {
  it('returns only the requested page and uses the last visible row as the next cursor', async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([rawThread('c'), rawThread('b'), rawThread('a')] as never);
    const res = response();
    await getConversations({ query: { phoneNumberId: 'all', limit: '2' } } as unknown as Request, res as unknown as Response);
    const payload = res.json.mock.calls[0][0];
    expect(payload.data.map((row: any) => row.lastMessage.id)).toEqual(['c', 'b']);
    expect(payload.hasMore).toBe(true);
    expect(decodeConversationCursor(payload.nextCursor)).toEqual({ timestamp: '2026-11-12T08:00:00.000Z', id: 'b' });
  });

  it('does not require the boundary message to still exist, and breaks timestamp ties by ID', async () => {
    const cursor = encodeConversationCursor('2026-11-12T08:00:00.000Z', 'deleted-boundary');
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([rawThread('a')] as never);
    const res = response();
    await getConversations({ query: { phoneNumberId: '222', limit: '2', cursor } } as unknown as Request, res as unknown as Response);
    const [strings, ...values] = vi.mocked(prisma.$queryRaw).mock.calls[0];
    const boundary = values.find((value: any) => value?.values?.includes('deleted-boundary')) as any;
    expect(boundary.sql).toContain('rm."timestamp" <');
    expect(boundary.sql).toContain('rm."id" <');
    expect(boundary.values).toEqual([new Date('2026-11-12T08:00:00.000Z'), new Date('2026-11-12T08:00:00.000Z'), 'deleted-boundary']);
    expect(Array.from(strings as TemplateStringsArray).join('?')).toContain('ORDER BY rm."timestamp" DESC, rm."id" DESC');
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ hasMore: false, nextCursor: null, count: 1 }));
  });

  it.each(['invalid!', 'e30', ['unexpected']])('rejects invalid cursor %s before querying', async (cursor) => {
    const res = response();
    await getConversations({ query: { phoneNumberId: 'all', cursor } } as unknown as Request, res as unknown as Response);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });
});
