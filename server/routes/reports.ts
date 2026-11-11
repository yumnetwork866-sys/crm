import type { Response } from 'express';
import { Router } from 'express';
import { Prisma } from '@prisma/client';
import type { AuthenticatedRequest } from '../middleware/authMiddleware';
import { authenticateToken, requirePermission } from '../middleware/authMiddleware';
import { Permission } from '../auth/permissions';
import { prisma } from '../lib/prisma';
import { createLogger } from '../lib/logger';

const log = createLogger('reports');

const router = Router();

router.use(authenticateToken);

function parseDateBoundary(value: unknown, endOfDay = false): Date | undefined {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

const rate = (part: number, total: number) =>
  total > 0 ? Number(((part / total) * 100).toFixed(1)) : 0;

// GET /api/reports/whatsapp - Real WhatsApp delivery metrics from WhatsAppMessage
router.get('/whatsapp', requirePermission(Permission.REPORTS_VIEW), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const start = parseDateBoundary(req.query.start);
    const end = parseDateBoundary(req.query.end, true);

    const timestampFilter =
      start || end
        ? { timestamp: { ...(start ? { gte: start } : {}), ...(end ? { lte: end } : {}) } }
        : {};

    const baseWhere = { channel: 'WhatsApp', ...timestampFilter };
    const outboundWhere = { ...baseWhere, sender: 'agent' };
    const inboundWhere = { ...baseWhere, sender: 'customer' };

    const [sent, delivered, read, failed, inbound] = await Promise.all([
      prisma.whatsAppMessage.count({ where: outboundWhere }),
      prisma.whatsAppMessage.count({
        where: { ...outboundWhere, status: { in: ['delivered', 'read'] } },
      }),
      prisma.whatsAppMessage.count({ where: { ...outboundWhere, status: 'read' } }),
      prisma.whatsAppMessage.count({ where: { ...outboundWhere, status: 'failed' } }),
      prisma.whatsAppMessage.count({ where: inboundWhere }),
    ]);

    const outboundCustomers = await prisma.whatsAppMessage.findMany({
      where: { ...outboundWhere, customerId: { not: null } },
      select: { customerId: true },
      distinct: ['customerId'],
    });
    const outboundCustomerIds = outboundCustomers
      .map((item) => item.customerId)
      .filter((id): id is string => Boolean(id));

    const respondedCustomers = outboundCustomerIds.length
      ? await prisma.whatsAppMessage.findMany({
          where: { ...inboundWhere, customerId: { in: outboundCustomerIds } },
          select: { customerId: true },
          distinct: ['customerId'],
        })
      : [];
    const responded = respondedCustomers.length;

    const conditions: Prisma.Sql[] = [Prisma.sql`"channel" = 'WhatsApp'`];
    if (start) conditions.push(Prisma.sql`"timestamp" >= ${start}`);
    if (end) conditions.push(Prisma.sql`"timestamp" <= ${end}`);
    const whereSql = Prisma.join(conditions, ' AND ');

    const dailyRows = await prisma.$queryRaw<
      Array<{ date: string; sent: number; received: number }>
    >(Prisma.sql`
      SELECT
        to_char(date_trunc('day', "timestamp"), 'YYYY-MM-DD') AS date,
        COUNT(*) FILTER (WHERE "sender" = 'agent')::int AS sent,
        COUNT(*) FILTER (WHERE "sender" = 'customer')::int AS received
      FROM "WhatsAppMessage"
      WHERE ${whereSql}
      GROUP BY 1
      ORDER BY 1
    `);

    return res.json({
      sent,
      delivered,
      read,
      responded,
      failed,
      inbound,
      readRate: rate(read, sent),
      responseRate: rate(responded, outboundCustomerIds.length),
      failureRate: rate(failed, sent),
      statusDistribution: [
        { name: 'Đã đọc', count: read },
        { name: 'Đã nhận', count: Math.max(0, delivered - read) },
        { name: 'Phản hồi', count: inbound },
        { name: 'Gửi lỗi', count: failed },
      ],
      daily: dailyRows.map((row) => ({
        date: row.date,
        sent: Number(row.sent) || 0,
        received: Number(row.received) || 0,
      })),
    });
  } catch (error) {
    log.error({ err: error }, '[REPORTS] Lỗi khi lấy thống kê WhatsApp:');
    return res.status(500).json({ error: 'Lỗi khi lấy thống kê WhatsApp' });
  }
});

export default router;
