import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../lib/prisma', () => ({
  prisma: {
    aiKnowledgeDocument: { update: vi.fn() },
    aiKnowledgeChunk: { updateMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));
import { prisma } from '../../lib/prisma';
import { updateKnowledgeChunk } from './knowledgeChunkEditor';

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => callback(prisma));
  vi.mocked(prisma.aiKnowledgeDocument.update).mockResolvedValue({ title: 'Chính sách' } as any);
  vi.mocked(prisma.aiKnowledgeChunk.updateMany).mockResolvedValue({ count: 1 });
});

describe('editing a stored knowledge chunk', () => {
  it('invalidates the indexing lease before replacing text and its stale embedding', async () => {
    await updateKnowledgeChunk('doc', 'chunk', 'Đổi trả trong 7 ngày.', 'Original');
    expect(prisma.aiKnowledgeDocument.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'doc' },
        data: expect.objectContaining({ embeddingStatus: 'pending', indexingToken: null }),
      }),
    );
    expect(prisma.aiKnowledgeChunk.updateMany).toHaveBeenCalledWith({
      where: { id: 'chunk', documentId: 'doc', content: 'Original' },
      data: {
        content: 'Đổi trả trong 7 ngày.',
        searchText: 'chinh sach doi tra trong 7 ngay.',
        embedding: [],
        embeddingModel: null,
      },
    });
    expect(vi.mocked(prisma.aiKnowledgeDocument.update).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(prisma.aiKnowledgeChunk.updateMany).mock.invocationCallOrder[0],
    );
  });

  it('rejects a stale or missing chunk instead of overwriting newer edits', async () => {
    vi.mocked(prisma.aiKnowledgeChunk.updateMany).mockResolvedValue({ count: 0 });
    await expect(updateKnowledgeChunk('doc', 'chunk', 'New', 'Old')).rejects.toMatchObject({
      code: 'AI_CHUNK_CONFLICT',
      status: 409,
    });
  });
});
