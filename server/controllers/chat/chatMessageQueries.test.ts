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
