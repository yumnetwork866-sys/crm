import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('./aiSettings', () => ({
  DEFAULT_EMBEDDING_DIMENSIONS: 768,
  getEmbeddingSettings: vi.fn(async () => ({ model: 'test-model', dimensions: 768 })),
}));
vi.mock('../../lib/prisma', () => ({
  prisma: {
    aiKnowledgeDocument: { findFirst: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
    aiKnowledgeChunk: { findMany: vi.fn(), updateMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock('../../lib/logger', () => ({ createLogger: () => ({ info: vi.fn(), error: vi.fn() }) }));
vi.mock('./embeddingService', () => ({
  embedTexts: vi.fn(),
  formatEmbeddingDocument: (title: string, content: string) => `${title}\n${content}`,
  getEmbeddingVersion: () => 'test-model|768|retrieval-v1',
}));
import { prisma } from '../../lib/prisma';
import { embedTexts } from './embeddingService';
import { processKnowledgeIndex } from './knowledgeIndexer';
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(prisma.aiKnowledgeDocument.findFirst).mockResolvedValue({
    id: 'doc',
    title: 'Returns',
  } as any);
  vi.mocked(prisma.aiKnowledgeDocument.updateMany).mockResolvedValue({ count: 1 });
  vi.mocked(prisma.aiKnowledgeDocument.findUnique).mockImplementation((async () => ({
    indexingToken: (vi.mocked(prisma.aiKnowledgeDocument.updateMany).mock.calls[0][0] as any).data
      .indexingToken,
  })) as any);
  vi.mocked(prisma.aiKnowledgeChunk.findMany)
    .mockResolvedValueOnce([{ id: 'chunk-1', content: 'Policy' }] as any)
    .mockResolvedValue([]);
  vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => callback(prisma));
  vi.mocked(embedTexts).mockResolvedValue([[1, 0]]);
});
describe('durable knowledge indexing', () => {
  it('embeds and writes batches before marking the document ready', async () => {
    await processKnowledgeIndex();
    expect(embedTexts).toHaveBeenCalledWith(['Returns\nPolicy'], {
      model: 'test-model',
      dimensions: 768,
    });
    expect(prisma.aiKnowledgeChunk.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'chunk-1', documentId: 'doc' },
        data: { embedding: [1, 0], embeddingModel: 'test-model|768|retrieval-v1' },
      }),
    );
    expect(prisma.aiKnowledgeDocument.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ embeddingStatus: 'ready', indexingToken: null }),
      }),
    );
  });
  it('persists a visible indexing error instead of marking missing embeddings ready', async () => {
    vi.mocked(embedTexts).mockRejectedValue(new Error('Embedding timeout'));
    await processKnowledgeIndex();
    expect(prisma.aiKnowledgeChunk.updateMany).not.toHaveBeenCalled();
    expect(prisma.aiKnowledgeDocument.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          embeddingStatus: 'error',
          embeddingError: 'Embedding timeout',
        }),
      }),
    );
  });
  it('stops when an edit has replaced the indexing lease', async () => {
    vi.mocked(prisma.aiKnowledgeDocument.findUnique).mockResolvedValue({
      indexingToken: 'new-edit',
    } as any);
    await processKnowledgeIndex();
    expect(embedTexts).not.toHaveBeenCalled();
    expect(prisma.aiKnowledgeChunk.updateMany).not.toHaveBeenCalled();
  });
});
