import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

vi.mock('../lib/prisma', () => ({ prisma: { customer: { update: vi.fn() } } }));
vi.mock('../services/realtimeHub', () => ({ realtimeHub: { broadcast: vi.fn() } }));

import { prisma } from '../lib/prisma';
import { realtimeHub } from '../services/realtimeHub';
import { renameCustomer } from './customerNameController';

const invoke = async (body: unknown) => {
  const res = { json: vi.fn(), status: vi.fn().mockReturnThis() };
  await renameCustomer({ params: { id: 'crm-contact' }, body } as unknown as Request, res as unknown as Response);
  return res;
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.customer.update).mockResolvedValue({ id: 'crm-contact', name: 'Tên mới' } as never);
});

describe('rename a CRM contact from the chat drawer', () => {
  it('trims the name and updates only that field without applying customer form defaults', async () => {
    const res = await invoke({ name: '  Tên mới  ' });
    expect(prisma.customer.update).toHaveBeenCalledWith({
      where: { id: 'crm-contact' }, data: { name: 'Tên mới' }, select: { id: true, name: true },
    });
    expect(res.json).toHaveBeenCalledWith({ id: 'crm-contact', name: 'Tên mới' });
    expect(realtimeHub.broadcast).toHaveBeenCalledWith('customers:sync', { source: 'customer-renamed', customerId: 'crm-contact' });
  });

  it.each([{ name: '' }, { name: '   ' }, {}, { name: 'Tên mới', phone: '' }])('rejects an invalid or mixed update: %j', async (body) => {
    const res = await invoke(body);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.customer.update).not.toHaveBeenCalled();
    expect(realtimeHub.broadcast).not.toHaveBeenCalled();
  });

  it('reports a missing customer without broadcasting a successful rename', async () => {
    vi.mocked(prisma.customer.update).mockRejectedValueOnce({ code: 'P2025' });
    const res = await invoke({ name: 'Tên mới' });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(realtimeHub.broadcast).not.toHaveBeenCalled();
  });

  it('returns a retryable error when saving fails', async () => {
    vi.mocked(prisma.customer.update).mockRejectedValueOnce(new Error('Database unavailable'));
    const res = await invoke({ name: 'Tên mới' });
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Không thể lưu tên khách hàng. Vui lòng thử lại.' });
    expect(realtimeHub.broadcast).not.toHaveBeenCalled();
  });
});
