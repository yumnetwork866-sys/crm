import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthenticatedRequest } from '../middleware/authMiddleware';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

// GET /api/campaigns
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const campaigns = await prisma.broadcastCampaign.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return res.json(campaigns);
  } catch (error) {
    return res.status(500).json({ error: 'Lỗi khi lấy danh sách chiến dịch' });
  }
});

// POST /api/campaigns - Create campaign
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, targetGroup, targetProduct, targetCountry, category, messageTemplate } = req.body;

    if (!name || !targetGroup || !messageTemplate) {
      return res.status(400).json({ error: 'Tên chiến dịch, nhóm đối tượng và nội dung mẫu là bắt buộc' });
    }

    const newCampaign = await prisma.broadcastCampaign.create({
      data: {
        name,
        targetGroup,
        targetProduct: targetProduct || null,
        targetCountry: targetCountry || null,
        category: category || 'Thông báo',
        messageTemplate,
        status: 'Draft',
        totalTargeted: 150,
        optedInCount: 120,
        sentCount: 0,
        deliveredCount: 0,
        readCount: 0,
        respondedCount: 0
      }
    });

    return res.status(201).json(newCampaign);
  } catch (error) {
    return res.status(500).json({ error: 'Lỗi khi tạo chiến dịch mới' });
  }
});

export default router;
