import { Router, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { prisma } from '../lib/prisma';
import { authenticateToken, requirePermission } from '../middleware/authMiddleware';
import { Permission } from '../auth/permissions';
import {
  getAiConfig,
  generateNativeAi,
  retrieveKnowledge,
  listAiModels,
  clearAiCache,
} from '../services/ai/nativeAiService';
import {
  AiFailure,
  aiConfigSchema,
  generationInputSchema,
  knowledgeSchema,
  retrievalSettingsSchema,
  splitKnowledge,
} from '../services/ai/contracts';
import { saveAiConfiguration } from '../services/ai/aiConfigurationService';
import { scheduleKnowledgeIndex } from '../services/ai/knowledgeIndexer';
import { realtimeHub } from '../services/realtimeHub';
import { createLogger } from '../lib/logger';
import { resolveRetrievalSettings } from '../../shared/knowledgeRetrievalSettings';

const router = Router();
const log = createLogger('ai-management');
router.use(authenticateToken, requirePermission(Permission.AI_VIEW));
function failure(res: Response, error: unknown) {
  if (error instanceof AiFailure)
    return res.status(error.status).json({
      error: error.message,
      code: error.code,
      stage: error.stage,
      runId: error.runId,
      requestId: res.locals.requestId,
    });
  log.error({ err: error }, 'AI management request failed');
  return res.status(500).json({
    error: 'Không xử lý được yêu cầu quản lý AI.',
    code: 'AI_INTERNAL_ERROR',
    requestId: res.locals.requestId,
  });
}
router.get('/configuration', async (_req, res) => {
  try {
    return res.json(await getAiConfig());
  } catch (error) {
    return failure(res, error);
  }
});
router.put('/configuration', requirePermission(Permission.AI_MANAGE), async (req, res) => {
  const parsed = aiConfigSchema.safeParse(req.body);
  if (!parsed.success)
    return res
      .status(400)
      .json({ error: 'Cấu hình AI không hợp lệ.', details: parsed.error.flatten() });
  if (parsed.data.autoReplyEnabled && !parsed.data.ragEnabled)
    return res.status(400).json({ error: 'Bật kho kiến thức trước khi bật tự động trả lời.' });
  try {
    const { config: result, reindexing } = await saveAiConfiguration(parsed.data);
    if (reindexing) scheduleKnowledgeIndex();
    clearAiCache();
    realtimeHub.broadcast('ai:status', {
      scope: 'global',
      isAiEnabled: result.autoReplyEnabled,
      suggestionsEnabled: result.suggestionsEnabled,
    });
    return res.json({ ...result, reindexing });
  } catch (error) {
    return failure(res, error);
  }
});
router.put('/retrieval-settings', requirePermission(Permission.AI_MANAGE), async (req, res) => {
  const parsed = retrievalSettingsSchema.safeParse(req.body);
  if (!parsed.success)
    return res
      .status(400)
      .json({
        error: 'Thiết lập truy xuất không hợp lệ. Top K từ 1 đến 20, ngưỡng điểm từ 0 đến 1.',
      });
  try {
    const current = await getAiConfig();
    const retrievalSettings = resolveRetrievalSettings(parsed.data, current.retrievalSettings);
    const config = await prisma.aiConfiguration.update({
      where: { id: 'default' },
      data: { retrievalSettings: { ...retrievalSettings } },
    });
    clearAiCache();
    realtimeHub.broadcast('ai:status', { scope: 'global' });
    return res.json({ retrievalSettings: resolveRetrievalSettings(config.retrievalSettings) });
  } catch (error) {
    return failure(res, error);
  }
});
router.get('/models', async (_req, res) => res.json(await listAiModels()));
router.get('/knowledge', async (_req, res) => {
  try {
    return res.json(
      await prisma.aiKnowledgeDocument.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 200,
        include: { _count: { select: { chunks: true } } },
      }),
    );
  } catch (error) {
    return failure(res, error);
  }
});
router.post('/knowledge', requirePermission(Permission.AI_MANAGE), async (req, res) => {
  const parsed = knowledgeSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: 'Tài liệu cần tiêu đề và nội dung ít nhất 10 ký tự.' });
  try {
    const { title, content, enabled, chunkSettings } = parsed.data;
    const chunks = splitKnowledge(content, title, chunkSettings);
    if (!chunks.length)
      return res.status(400).json({ error: 'Tài liệu không còn nội dung sau khi xử lý.' });
    const result = await prisma.aiKnowledgeDocument.create({
      data: {
        title,
        content,
        chunkSettings,
        brand: '*',
        brandKey: '*',
        enabled,
        chunks: { create: chunks },
      },
    });
    clearAiCache();
    scheduleKnowledgeIndex();
    return res.status(201).json(result);
  } catch (error) {
    return failure(res, error);
  }
});
router.put('/knowledge/:id', requirePermission(Permission.AI_MANAGE), async (req, res) => {
  const parsed = knowledgeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Nội dung tài liệu không hợp lệ.' });
  try {
    const id = String(req.params.id);
    const { title, content, enabled, chunkSettings } = parsed.data;
    const chunks = splitKnowledge(content, title, chunkSettings);
    if (!chunks.length)
      return res.status(400).json({ error: 'Tài liệu không còn nội dung sau khi xử lý.' });
    const result = await prisma.$transaction(async (tx) => {
      await tx.aiKnowledgeChunk.deleteMany({ where: { documentId: id } });
      return tx.aiKnowledgeDocument.update({
        where: { id },
        data: {
          title,
          content,
          chunkSettings,
          brand: '*',
          brandKey: '*',
          enabled,
          embeddingStatus: 'pending',
          embeddingError: null,
          embeddingModel: null,
          indexingToken: null,
          indexingLeaseUntil: null,
          chunks: { create: chunks },
        },
      });
    });
    clearAiCache();
    scheduleKnowledgeIndex();
    return res.json(result);
  } catch (error) {
    return failure(res, error);
  }
});
router.post('/knowledge/:id/reindex', requirePermission(Permission.AI_MANAGE), async (req, res) => {
  try {
    const id = String(req.params.id);
    await prisma.$transaction(async (tx) => {
      const document = await tx.aiKnowledgeDocument.findUniqueOrThrow({
        where: { id },
        select: { title: true, content: true },
      });
      await tx.aiKnowledgeChunk.deleteMany({ where: { documentId: id } });
      await tx.aiKnowledgeDocument.update({
        where: { id },
        data: {
          embeddingStatus: 'pending',
          embeddingError: null,
          embeddingModel: null,
          indexingToken: null,
          indexingLeaseUntil: null,
          chunks: { create: splitKnowledge(document.content, document.title) },
        },
      });
    });
    clearAiCache();
    scheduleKnowledgeIndex();
    return res.json({ success: true });
  } catch (error) {
    return failure(res, error);
  }
});
router.delete('/knowledge/:id', requirePermission(Permission.AI_MANAGE), async (req, res) => {
  try {
    await prisma.aiKnowledgeDocument.delete({ where: { id: String(req.params.id) } });
    clearAiCache();
    return res.json({ success: true });
  } catch (error) {
    return failure(res, error);
  }
});
router.post(
  '/test',
  requirePermission(Permission.AI_MANAGE),
  rateLimit({ windowMs: 60000, limit: 12, standardHeaders: true, legacyHeaders: false }),
  async (req, res) => {
    const parsed = generationInputSchema.safeParse(req.body);
    if (
      !parsed.success ||
      !parsed.data.messages?.some(
        (message) => message.sender === 'customer' && message.content.trim(),
      )
    )
      return res.status(400).json({ error: 'Nhập nội dung khách hàng để thử AI.' });
    try {
      // Test always uses supplied sample messages; it never reads a real conversation or sends to Meta.
      const { customerId: _customerId, businessPhoneNumberId: _phoneId, ...sample } = parsed.data;
      return res.json(await generateNativeAi(sample, 'test'));
    } catch (error) {
      return failure(res, error);
    }
  },
);
router.get('/runs', requirePermission(Permission.AI_MANAGE), async (_req, res) => {
  try {
    return res.json(
      await prisma.aiRun.findMany({ orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 50 }),
    );
  } catch (error) {
    return failure(res, error);
  }
});
router.post(
  '/retrieve',
  rateLimit({ windowMs: 60000, limit: 20, standardHeaders: true, legacyHeaders: false }),
  async (req, res) => {
    if (
      typeof req.body?.question !== 'string' ||
      !req.body.question.trim() ||
      req.body.question.length > 2000
    )
      return res.status(400).json({ error: 'Nhập câu hỏi hợp lệ.' });
    try {
      return res.json({ sources: await retrieveKnowledge(req.body.question) });
    } catch (error) {
      return failure(res, error);
    }
  },
);
export default router;
