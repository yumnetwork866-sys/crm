import { prisma } from '../../lib/prisma';
import { AiFailure, normalizeKnowledgeText } from './contracts';

export async function updateKnowledgeChunk(
  documentId: string,
  chunkId: string,
  content: string,
  originalContent: string,
) {
  return prisma.$transaction(async (tx) => {
    // Lock the document before changing chunks so an older indexing worker cannot commit.
    const document = await tx.aiKnowledgeDocument.update({
      where: { id: documentId },
      data: {
        embeddingStatus: 'pending',
        embeddingError: null,
        embeddingModel: null,
        indexingToken: null,
        indexingLeaseUntil: null,
      },
      select: { title: true },
    });
    const result = await tx.aiKnowledgeChunk.updateMany({
      where: { id: chunkId, documentId, content: originalContent },
      data: {
        content,
        searchText: normalizeKnowledgeText(`${document.title}\n${content}`),
        embedding: [],
        embeddingModel: null,
      },
    });
    if (!result.count)
      throw new AiFailure(
        'AI_CHUNK_CONFLICT',
        'knowledge',
        'Chunk đã thay đổi hoặc không còn tồn tại. Hãy tải lại tài liệu trước khi sửa.',
        409,
      );
    return { success: true };
  });
}
