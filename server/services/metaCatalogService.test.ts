import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/prisma', () => ({
  prisma: { whatsAppConnection: { findUnique: vi.fn() } },
}));
vi.mock('./metaApiClient', () => ({
  getIntegrationSetting: vi.fn().mockResolvedValue({}),
  getMetaCatalogAccessToken: vi.fn().mockResolvedValue('catalog-token'),
  getMetaAccessTokenForPhone: vi.fn().mockResolvedValue('phone-token'),
  getMetaAccessToken: vi.fn().mockResolvedValue('token'),
}));

import { prisma } from '../lib/prisma';
import { CatalogAccessError, fetchMetaCatalogProducts } from './metaCatalogService';

const json = (data: unknown) => new Response(JSON.stringify(data), { status: 200 });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.whatsAppConnection.findUnique).mockResolvedValue({
    wabaId: '200', metaCatalogId: '222',
  } as never);
});

afterEach(() => vi.unstubAllGlobals());

describe('phone-scoped catalog products', () => {
  it('rejects the previous phone catalog before reading its products', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => json({ id: '222', name: 'Current catalog' }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchMetaCatalogProducts('111', {}, '2000')).rejects.toMatchObject({
      name: 'CatalogAccessError', statusCode: 403, code: 'CATALOG_PHONE_MISMATCH',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/222?');
  });

  it('loads products from the catalog bound to the current phone', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => (
      json(url.includes('/products?')
        ? { data: [{ id: '333', retailer_id: 'sku', name: 'Product' }] }
        : { id: '222', name: 'Current catalog' })
    ));
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchMetaCatalogProducts('222', {}, '2000');
    expect(result.catalog.id).toBe('222');
    expect(result.products).toEqual([expect.objectContaining({ id: '333', retailerId: 'sku' })]);
    expect(prisma.whatsAppConnection.findUnique).toHaveBeenCalledWith({
      where: { phoneNumberId: '2000' }, select: { wabaId: true, metaCatalogId: true },
    });
  });

  it('keeps upstream failures distinct from catalog mismatches', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ error: { message: 'Token expired' } }), { status: 401 },
    )));

    const error = await fetchMetaCatalogProducts('222', {}, '2000').catch((err: unknown) => err);
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(CatalogAccessError);
  });
});
