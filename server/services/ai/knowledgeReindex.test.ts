import { beforeEach, describe, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({
  aiKnowledgeDocument: { findUnique: vi.fn(), updateMany: vi.fn() },
  aiKnowledgeChunk: { deleteMany: vi.fn(), createMany: vi.fn(), updateMany: vi.fn() },
  $transaction: vi.fn(),
}));
vi.mock('../../lib/prisma', () => ({ prisma: db }));
import { knowledgeReindexSchema, reindexKnowledgeDocument } from './knowledgeReindex';
import { defaultChunkSettings, splitKnowledge } from '../../../shared/knowledgeChunking';

const document = {
  id: 'doc',
  title: 'Chính sách',
  content: 'Chính sách đổi trả hàng trong 7 ngày. '.repeat(8),
  updatedAt: new Date('2026-11-18T00:00:00.000Z'),
};
beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation(async (callback) => callback(db));
  db.aiKnowledgeDocument.findUnique.mockResolvedValue(document);
  db.aiKnowledgeDocument.updateMany.mockResolvedValue({ count: 1 });
});

describe('knowledge reindex options', () => {
  it('keeps old API requests as embedding-only and rejects incomplete or invalid rechunk settings', () => {
    expect(knowledgeReindexSchema.parse({})).toEqual({ mode: 'embedding' });
    expect(
      knowledgeReindexSchema.safeParse({ mode: 'rechunk', chunkSettings: defaultChunkSettings })
        .success,
    ).toBe(false);
    expect(
      knowledgeReindexSchema.safeParse({
        mode: 'rechunk',
        chunkSettings: { ...defaultChunkSettings, overlap: 1024 },
        expectedUpdatedAt: document.updatedAt.toISOString(),
      }).success,
    ).toBe(false);
    expect(knowledgeReindexSchema.safeParse({ mode: 'other' }).success).toBe(false);
  });
  it('preserves current chunks and manual edits when only rebuilding embeddings', async () => {
    expect(await reindexKnowledgeDocument('doc', { mode: 'embedding' })).toEqual({
      success: true,
      mode: 'embedding',
    });
    expect(db.aiKnowledgeChunk.updateMany).toHaveBeenCalledWith({
      where: { documentId: 'doc' },
      data: { embedding: [], embeddingModel: null },
    });
    expect(db.aiKnowledgeChunk.deleteMany).not.toHaveBeenCalled();
    expect(db.aiKnowledgeChunk.createMany).not.toHaveBeenCalled();
    const data = db.aiKnowledgeDocument.updateMany.mock.calls[0][0].data;
    expect(data).not.toHaveProperty('chunkSettings');
    expect(data).toMatchObject({
      embeddingStatus: 'pending',
      indexingToken: null,
      indexingLeaseUntil: null,
    });
  });
  it('replaces chunks from the stored original content with the selected settings in one transaction', async () => {
    const settings = { ...defaultChunkSettings, maxLength: 100, overlap: 20 };
    const chunks = splitKnowledge(document.content, document.title, settings);
    const result = await reindexKnowledgeDocument('doc', {
      mode: 'rechunk',
      chunkSettings: settings,
      expectedUpdatedAt: document.updatedAt.toISOString(),
    });
    expect(result).toEqual({ success: true, mode: 'rechunk', chunkCount: chunks.length });
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.aiKnowledgeDocument.updateMany.mock.calls[0][0]).toMatchObject({
      where: { id: 'doc', updatedAt: document.updatedAt },
      data: { chunkSettings: settings, indexingToken: null },
    });
    expect(db.aiKnowledgeChunk.deleteMany).toHaveBeenCalledWith({ where: { documentId: 'doc' } });
    expect(db.aiKnowledgeChunk.createMany).toHaveBeenCalledWith({
      data: chunks.map((chunk) => ({ ...chunk, documentId: 'doc' })),
    });
    expect(db.aiKnowledgeDocument.updateMany.mock.invocationCallOrder[0]).toBeLessThan(
      db.aiKnowledgeChunk.deleteMany.mock.invocationCallOrder[0],
    );
    expect(db.aiKnowledgeChunk.updateMany).not.toHaveBeenCalled();
  });
  it('rejects a stale preview before changing chunks or settings', async () => {
    await expect(
      reindexKnowledgeDocument('doc', {
        mode: 'rechunk',
        chunkSettings: defaultChunkSettings,
        expectedUpdatedAt: '2026-11-17T00:00:00.000Z',
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(db.aiKnowledgeDocument.updateMany).not.toHaveBeenCalled();
    expect(db.aiKnowledgeChunk.deleteMany).not.toHaveBeenCalled();
  });
  it('does not delete chunks if a concurrent write wins the document lock', async () => {
    db.aiKnowledgeDocument.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      reindexKnowledgeDocument('doc', {
        mode: 'rechunk',
        chunkSettings: defaultChunkSettings,
        expectedUpdatedAt: document.updatedAt.toISOString(),
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(db.aiKnowledgeChunk.deleteMany).not.toHaveBeenCalled();
    expect(db.aiKnowledgeChunk.createMany).not.toHaveBeenCalled();
  });
  it('rejects empty cleaned content without deleting the current chunks', async () => {
    db.aiKnowledgeDocument.findUnique.mockResolvedValue({
      ...document,
      content: 'https://example.com',
    });
    await expect(
      reindexKnowledgeDocument('doc', {
        mode: 'rechunk',
        chunkSettings: { ...defaultChunkSettings, removeUrlsAndEmails: true },
        expectedUpdatedAt: document.updatedAt.toISOString(),
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(db.aiKnowledgeDocument.updateMany).not.toHaveBeenCalled();
    expect(db.aiKnowledgeChunk.deleteMany).not.toHaveBeenCalled();
  });
  it('returns not found for a removed document', async () => {
    db.aiKnowledgeDocument.findUnique.mockResolvedValue(null);
    await expect(reindexKnowledgeDocument('missing', { mode: 'embedding' })).rejects.toMatchObject({
      status: 404,
    });
  });
});
