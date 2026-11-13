import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { realtimeHub } from '../services/realtimeHub';
import { getRouteParam } from '../utils/requestParams';
import { createLogger } from '../lib/logger';

const log = createLogger('customerName');
const renameSchema = z.object({
  name: z.string().trim().min(1, 'Tên khách hàng không được để trống'),
}).strict();

export async function renameCustomer(req: Request, res: Response) {
  const parsed = renameSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Tên khách hàng không hợp lệ' });
  }
  try {
    const customer = await prisma.customer.update({
      where: { id: getRouteParam(req.params.id) },
      data: { name: parsed.data.name },
      select: { id: true, name: true },
    });
    realtimeHub.broadcast('customers:sync', { source: 'customer-renamed', customerId: customer.id });
    return res.json(customer);
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025') {
      return res.status(404).json({ error: 'Không tìm thấy khách hàng' });
    }
    log.error({ err: error }, 'Không thể đổi tên khách hàng');
    return res.status(500).json({ error: 'Không thể lưu tên khách hàng. Vui lòng thử lại.' });
  }
}
