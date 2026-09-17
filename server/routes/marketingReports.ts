import type { Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../middleware/authMiddleware';
import { authenticateToken } from '../middleware/authMiddleware';
import { prisma } from '../lib/prisma';

const router = Router();
router.use(authenticateToken);

const reportSchema = z.object({
  campaignName: z.string().trim().min(1, 'Tên chiến dịch không được để trống'),
  source: z.string().default('Direct'),
  leadsCount: z.number().int().nonnegative().default(0),
  adSpend: z.number().nonnegative().default(0),
  revenue: z.number().nonnegative().default(0),
  cpl: z.number().nonnegative().optional(),
  roas: z.number().nonnegative().optional(),
});

const DEFAULT_MARKETING_REPORTS = [
  { campaignName: 'Tet Sale 2026 - Beauty', source: 'Facebook', leadsCount: 142, adSpend: 15000000, revenue: 68000000, cpl: 105633, roas: 4.53 },
  { campaignName: 'TikTok Shop Live FlashSale', source: 'TikTok', leadsCount: 210, adSpend: 18000000, revenue: 52000000, cpl: 85714, roas: 2.88 },
  { campaignName: 'Google Search Branded', source: 'Google', leadsCount: 98, adSpend: 8000000, revenue: 42000000, cpl: 81632, roas: 5.25 },
  { campaignName: 'Zalo OA Official Feed', source: 'Zalo', leadsCount: 65, adSpend: 4000000, revenue: 21000000, cpl: 61538, roas: 5.25 },
  { campaignName: 'Organic SEO Website', source: 'Website', leadsCount: 112, adSpend: 0, revenue: 38000000, cpl: 0, roas: 99.00 }
];

// GET /api/reports/marketing - List all marketing reports (auto-seeds defaults if empty)
router.get('/', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    let reports = await prisma.marketingReport.findMany({
      orderBy: { createdAt: 'desc' },
    });

    if (reports.length === 0) {
      await prisma.marketingReport.createMany({
        data: DEFAULT_MARKETING_REPORTS,
      });
      reports = await prisma.marketingReport.findMany({
        orderBy: { createdAt: 'desc' },
      });
    }

    return res.json(reports);
  } catch (error) {
    console.error('[Marketing Reports] Lỗi khi lấy danh sách báo cáo:', error);
    return res.status(500).json({ error: 'Không thể lấy dữ liệu báo cáo marketing.' });
  }
});

// POST /api/reports/marketing - Create a new marketing report
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = reportSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Dữ liệu không hợp lệ.' });
    }

    const data = parsed.data;
    const cpl = data.cpl ?? (data.leadsCount > 0 ? Math.round(data.adSpend / data.leadsCount) : 0);
    const roas = data.roas ?? (data.adSpend > 0 ? parseFloat((data.revenue / data.adSpend).toFixed(2)) : 0);

    const created = await prisma.marketingReport.create({
      data: {
        campaignName: data.campaignName,
        source: data.source,
        leadsCount: data.leadsCount,
        adSpend: data.adSpend,
        revenue: data.revenue,
        cpl,
        roas,
      },
    });

    return res.status(201).json(created);
  } catch (error) {
    console.error('[Marketing Reports] Lỗi khi tạo báo cáo:', error);
    return res.status(500).json({ error: 'Không thể lưu báo cáo marketing.' });
  }
});

// PUT /api/reports/marketing/:id - Update report
router.put('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const parsed = reportSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Dữ liệu không hợp lệ.' });
    }

    const existing = await prisma.marketingReport.findUnique({ where: { id: String(id) } });
    if (!existing) {
      return res.status(404).json({ error: 'Không tìm thấy báo cáo.' });
    }

    const data = parsed.data;
    const leadsCount = data.leadsCount ?? existing.leadsCount;
    const adSpend = data.adSpend ?? existing.adSpend;
    const revenue = data.revenue ?? existing.revenue;
    const cpl = data.cpl ?? (leadsCount > 0 ? Math.round(adSpend / leadsCount) : 0);
    const roas = data.roas ?? (adSpend > 0 ? parseFloat((revenue / adSpend).toFixed(2)) : 0);

    const updated = await prisma.marketingReport.update({
      where: { id: String(id) },
      data: {
        ...data,
        cpl,
        roas,
      },
    });

    return res.json(updated);
  } catch (error) {
    console.error('[Marketing Reports] Lỗi khi cập nhật báo cáo:', error);
    return res.status(500).json({ error: 'Không thể cập nhật báo cáo marketing.' });
  }
});

// DELETE /api/reports/marketing/:id - Delete report
router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.marketingReport.delete({ where: { id: String(id) } });
    return res.json({ message: 'Xóa báo cáo thành công.' });
  } catch (error) {
    console.error('[Marketing Reports] Lỗi khi xóa báo cáo:', error);
    return res.status(500).json({ error: 'Không thể xóa báo cáo marketing.' });
  }
});

export default router;
