import { Router, type Response } from 'express';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../middleware/authMiddleware';
import { authenticateToken, requirePermission } from '../middleware/authMiddleware';
import { Permission } from '../auth/permissions';
import { prisma } from '../lib/prisma';
import { realtimeHub } from '../services/realtimeHub';

const router = Router();
router.use(authenticateToken);

const profileSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  avatarUrl: z.string().trim().max(2_000).nullable().optional(),
}).refine((value) => value.name !== undefined || value.avatarUrl !== undefined);

const getDefaultAiName = () => process.env.DIFY_AGENT_NAME?.trim() || '🤖 Trợ lý AI';

router.get(
  '/',
  async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const setting = await prisma.integrationSetting.findUnique({
        where: { id: 'default' },
        select: { aiName: true, aiAvatarUrl: true },
      });
      return res.json({ name: setting?.aiName || getDefaultAiName(), avatarUrl: setting?.aiAvatarUrl || null });
    } catch (error) {
      console.error('[AI PROFILE GET ERROR]', error);
      return res.status(500).json({ error: 'Không thể tải hồ sơ AI.' });
    }
  },
);

router.put(
  '/',
  requirePermission(Permission.USERS_MANAGE),
  async (req: AuthenticatedRequest, res: Response) => {
    const parsed = profileSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Ảnh đại diện AI không hợp lệ.' });
    const requestedAvatarUrl = parsed.data.avatarUrl;
    if (requestedAvatarUrl && !requestedAvatarUrl.startsWith('/uploads/ai/')) {
      return res.status(400).json({ error: 'Ảnh đại diện AI phải được tải lên hệ thống.' });
    }

    try {
      const current = await prisma.integrationSetting.findUnique({ where: { id: 'default' } });
      const name = parsed.data.name ?? current?.aiName ?? getDefaultAiName();
      const avatarUrl = requestedAvatarUrl !== undefined
        ? requestedAvatarUrl
        : (current?.aiAvatarUrl || null);
      const setting = await prisma.integrationSetting.upsert({
        where: { id: 'default' },
        update: {
          ...(parsed.data.name !== undefined ? { aiName: name } : {}),
          ...(requestedAvatarUrl !== undefined ? { aiAvatarUrl: avatarUrl } : {}),
        },
        create: { id: 'default', aiName: name, aiAvatarUrl: avatarUrl },
        select: { aiName: true, aiAvatarUrl: true },
      });
      const profile = { name: setting.aiName || getDefaultAiName(), avatarUrl: setting.aiAvatarUrl || null };
      realtimeHub.broadcast('ai:profile', profile);
      return res.json(profile);
    } catch (error) {
      console.error('[AI PROFILE UPDATE ERROR]', error);
      return res.status(503).json({
        error: 'Database chưa sẵn sàng. Vui lòng khởi động PostgreSQL và thử lại.',
      });
    }
  },
);

export default router;
