import { Router, type Request, type Response } from 'express';
import { Prisma } from '@prisma/client';
import { conversationRetrievalQuery } from '../services/ai/conversationRetrieval';
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
  assistantConfigSchema,
  ragConfigSchema,
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
import { validateRerankSettings } from '../services/ai/rerankService';
import { updateKnowledgeChunk } from '../services/ai/knowledgeChunkEditor';
import type { AiTestEvent, AiTraceStep } from '../../shared/aiTrace';

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
function updateConfiguration(
  schema: typeof aiConfigSchema | typeof assistantConfigSchema | typeof ragConfigSchema,
) {
  return async (req: Request, res: Response) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ error: 'Cấu hình AI không hợp lệ.', details: parsed.error.flatten() });
    try {
      const { config: result, reindexing, aiProfile } = await saveAiConfiguration(parsed.data);
      if (reindexing) scheduleKnowledgeIndex();
      clearAiCache();
      if (aiProfile) realtimeHub.broadcast('ai:profile', aiProfile);
      realtimeHub.broadcast('ai:status', {
        scope: 'global',
        isAiEnabled: result.autoReplyEnabled,
        suggestionsEnabled: result.suggestionsEnabled,
      });
      return res.json({ ...result, reindexing, ...(aiProfile ? { aiProfile } : {}) });
    } catch (error) {
      return failure(res, error);
    }
  };
}
router.put(
  '/configuration',
  requirePermission(Permission.AI_MANAGE),
  updateConfiguration(aiConfigSchema),
);
router.put(
  '/configuration/assistant',
  requirePermission(Permission.AI_MANAGE),
  updateConfiguration(assistantConfigSchema),
);
router.put(
  '/configuration/rag',
  requirePermission(Permission.AI_MANAGE),
  updateConfiguration(ragConfigSchema),
);
router.put('/retrieval-settings', requirePermission(Permission.AI_MANAGE), async (req, res) => {
  const parsed = retrievalSettingsSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({
      error: 'Thiết lập truy xuất không hợp lệ. Top K từ 1 đến 20, ngưỡng điểm từ 0 đến 1.',
    });
  try {
    const current = await getAiConfig();
    const retrievalSettings = resolveRetrievalSettings(parsed.data, current.retrievalSettings);
    await validateRerankSettings(retrievalSettings);
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
    const documents = await prisma.aiKnowledgeDocument.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 200,
      include: { _count: { select: { chunks: true } } },
    });
    // Count each run once per document, even when several chunks were retrieved.
    const counts = documents.length
      ? await prisma.$queryRaw<{ documentId: string; retrievalCount: number }[]>(Prisma.sql`
          SELECT source->>'documentId' AS "documentId",
            COUNT(DISTINCT run.id)::int AS "retrievalCount"
          FROM "AiRun" run
          CROSS JOIN LATERAL jsonb_array_elements(
            CASE WHEN jsonb_typeof(run.sources) = 'array' THEN run.sources ELSE '[]'::jsonb END
          ) AS source
          WHERE source->>'documentId' IN (${Prisma.join(documents.map((document) => document.id))})
          GROUP BY source->>'documentId'
        `)
      : [];
    const countByDocument = new Map(counts.map((row) => [row.documentId, row.retrievalCount]));
    return res.json(
      documents.map((document) => ({
        ...document,
        retrievalCount: countByDocument.get(document.id) ?? 0,
      })),
    );
  } catch (error) {
    return failure(res, error);
  }
});
router.get('/knowledge/:id', async (req, res) => {
  const page = Math.max(1, Math.min(1000000, Math.floor(Number(req.query.page) || 1)));
  const pageSize = [10, 25, 50].includes(Number(req.query.pageSize))
    ? Number(req.query.pageSize)
    : 10;
  const search = String(req.query.search || '')
    .trim()
    .slice(0, 200);
  try {
    const document = await prisma.aiKnowledgeDocument.findUnique({
      where: { id: String(req.params.id) },
      include: { _count: { select: { chunks: true } } },
    });
    if (!document) return res.status(404).json({ error: 'Không tìm thấy tài liệu.' });
    const where = {
      documentId: document.id,
      ...(search ? { content: { contains: search, mode: 'insensitive' as const } } : {}),
    };
    const [total, chunks] = await Promise.all([
      prisma.aiKnowledgeChunk.count({ where }),
      prisma.aiKnowledgeChunk.findMany({
        where,
        orderBy: { ordinal: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: { id: true, ordinal: true, content: true },
      }),
    ]);
    return res.json({ document, chunks, total });
  } catch (error) {
    return failure(res, error);
  }
});
router.put(
  '/knowledge/:id/chunks/:chunkId',
  requirePermission(Permission.AI_MANAGE),
  async (req, res) => {
    const content = req.body?.content;
    const originalContent = req.body?.originalContent;
    if (typeof content !== 'string' || !content.trim() || typeof originalContent !== 'string')
      return res.status(400).json({ error: 'Nội dung chunk không được để trống.' });
    try {
      const result = await updateKnowledgeChunk(
        String(req.params.id),
        String(req.params.chunkId),
        content.trim(),
        originalContent,
      );
      clearAiCache();
      scheduleKnowledgeIndex();
      return res.json(result);
    } catch (error) {
      return failure(res, error);
    }
  },
);
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
router.patch(
  '/knowledge/:id/enabled',
  requirePermission(Permission.AI_MANAGE),
  async (req, res) => {
    if (typeof req.body?.enabled !== 'boolean')
      return res.status(400).json({ error: 'Trạng thái tài liệu không hợp lệ.' });
    try {
      const result = await prisma.aiKnowledgeDocument.update({
        where: { id: String(req.params.id) },
        data: { enabled: req.body.enabled },
      });
      clearAiCache();
      return res.json(result);
    } catch (error) {
      return failure(res, error);
    }
  },
);
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
      await tx.aiKnowledgeDocument.update({
        where: { id },
        data: {
          embeddingStatus: 'pending',
          embeddingError: null,
          embeddingModel: null,
          indexingToken: null,
          indexingLeaseUntil: null,
        },
      });
      await tx.aiKnowledgeChunk.updateMany({
        where: { documentId: id },
        data: { embedding: [], embeddingModel: null },
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
      if (req.get('accept')?.includes('application/x-ndjson')) {
        res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders();
        const send = (event: AiTestEvent) => {
          if (!res.destroyed && !res.writableEnded) res.write(`${JSON.stringify(event)}\n`);
        };
        const steps = new Map<string, AiTraceStep>();
        const heartbeat = setInterval(() => send({ type: 'heartbeat' }), 15000);
        const stopHeartbeat = () => clearInterval(heartbeat);
        res.once('close', stopHeartbeat);
        try {
          const result = await generateNativeAi(sample, 'test', (step) => {
            steps.set(step.id, step);
            send({ type: 'step', step });
          });
          send({ type: 'result', result: { ...result } });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Không chạy được thử AI.';
          for (const step of steps.values()) {
            if (step.status === 'running')
              send({ type: 'step', step: { ...step, status: 'error', detail: message } });
          }
          send({
            type: 'error',
            error: message,
            ...(error instanceof AiFailure
              ? { code: error.code, stage: error.stage, runId: error.runId }
              : {}),
          });
        } finally {
          stopHeartbeat();
          res.off('close', stopHeartbeat);
          res.end();
        }
        return;
      }
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
    const parsed = generationInputSchema.pick({ messages: true }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Lịch sử hội thoại không hợp lệ.' });
    const question = conversationRetrievalQuery([
      ...(parsed.data.messages || []).slice(-14),
      { sender: 'customer', content: req.body.question },
    ]);
    try {
      return res.json({ sources: await retrieveKnowledge(question) });
    } catch (error) {
      return failure(res, error);
    }
  },
);
export default router;
