import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { AiFailure, chunkSettingsSchema, splitKnowledge } from './contracts';
import type { KnowledgeReindexRequest } from '../../../shared/knowledgeChunking';

export const knowledgeReindexSchema = z.union([
  z
    .object({
      mode: z.literal('embedding').default('embedding'),
      expectedUpdatedAt: z.string().datetime().optional(),
    })
    .strict(),
  z
    .object({
      mode: z.literal('rechunk'),
      chunkSettings: chunkSettingsSchema,
      expectedUpdatedAt: z.string().datetime(),
    })
    .strict(),
]);

export async function reindexKnowledgeDocument(id: string, request: KnowledgeReindexRequest) {
  return prisma.$transaction(async (tx) => {
    const document = await tx.aiKnowledgeDocument.findUnique({ where: { id } });
    if (!document)
      throw new AiFailure('KNOWLEDGE_NOT_FOUND', 'knowledge', 'Không tìm thấy tài liệu.', 404);
    const conflict = () =>
      new AiFailure(
        'KNOWLEDGE_CHANGED',
        'knowledge',
        'Tài liệu đã thay đổi. Đóng hộp Reindex và mở lại để xem dữ liệu mới nhất.',
        409,
      );
    if (
      request.expectedUpdatedAt &&
      new Date(request.expectedUpdatedAt).getTime() !== document.updatedAt.getTime()
    )
      throw conflict();
    const chunks =
      request.mode === 'rechunk'
        ? splitKnowledge(document.content, document.title, request.chunkSettings)
        : null;
    if (chunks && !chunks.length)
      throw new AiFailure(
        'EMPTY_KNOWLEDGE',
        'knowledge',
        'Tài liệu không còn nội dung sau khi xử lý.',
        400,
      );
    // Lock the document and invalidate old workers before touching chunks.
    const claimed = await tx.aiKnowledgeDocument.updateMany({
      where: { id, updatedAt: document.updatedAt },
      data: {
        embeddingStatus: 'pending',
        embeddingError: null,
        embeddingModel: null,
        indexingToken: null,
        indexingLeaseUntil: null,
        ...(request.mode === 'rechunk' ? { chunkSettings: { ...request.chunkSettings } } : {}),
      },
    });
    if (!claimed.count) throw conflict();
    if (chunks) {
      await tx.aiKnowledgeChunk.deleteMany({ where: { documentId: id } });
      await tx.aiKnowledgeChunk.createMany({
        data: chunks.map((chunk) => ({ ...chunk, documentId: id })),
      });
    } else {
      await tx.aiKnowledgeChunk.updateMany({
        where: { documentId: id },
        data: { embedding: [], embeddingModel: null },
      });
    }
    return { success: true, mode: request.mode, ...(chunks ? { chunkCount: chunks.length } : {}) };
  });
}
