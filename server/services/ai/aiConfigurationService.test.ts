import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../lib/prisma', () => ({
  prisma: {
    aiConfiguration: { upsert: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn() },
    aiKnowledgeDocument: { updateMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock('./embeddingService', () => ({ probeEmbeddingDimensions: vi.fn() }));
vi.mock('./ollamaModels', () => ({ requireInstalledEmbeddingModel: vi.fn() }));
import { prisma } from '../../lib/prisma';
import { probeEmbeddingDimensions } from './embeddingService';
import { requireInstalledEmbeddingModel } from './ollamaModels';
import { saveAiConfiguration } from './aiConfigurationService';
const config = {
  id: 'default',
  model: 'chat',
  embeddingModel: 'embed-a',
  embeddingDimensions: 768,
  suggestionsEnabled: true,
  autoReplyEnabled: false,
  ragEnabled: true,
  timeoutMs: 45000,
  instructions: '',
  retrievalSettings: {},
  updatedAt: new Date(),
};
const input = {
  model: 'chat',
  suggestionsEnabled: true,
  autoReplyEnabled: false,
  ragEnabled: true,
  timeoutMs: 45000,
  instructions: '',
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(prisma.aiConfiguration.upsert).mockResolvedValue({ ...config });
  vi.mocked(prisma.aiConfiguration.findUniqueOrThrow).mockResolvedValue({ ...config });
  vi.mocked(prisma.aiConfiguration.update).mockImplementation((async (args: any) => ({
    ...config,
    ...args.data,
  })) as any);
  vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => callback(prisma));
  vi.mocked(probeEmbeddingDimensions).mockResolvedValue(384);
});
describe('embedding model configuration', () => {
  it('probes dimensions and invalidates indexing leases in the same transaction as the model change', async () => {
    const saved = await saveAiConfiguration({ ...input, embeddingModel: 'embed-b' });
    expect(requireInstalledEmbeddingModel).toHaveBeenCalledWith('embed-b');
    expect(probeEmbeddingDimensions).toHaveBeenCalledWith('embed-b');
    expect(saved.config.embeddingDimensions).toBe(384);
    expect(saved.reindexing).toBe(true);
    expect(prisma.aiKnowledgeDocument.updateMany).toHaveBeenCalledWith({
      data: expect.objectContaining({
        embeddingStatus: 'pending',
        indexingToken: null,
        indexingLeaseUntil: null,
      }),
    });
  });
  it('keeps the index when saving unrelated settings or the same model', async () => {
    expect((await saveAiConfiguration({ ...input, embeddingModel: 'embed-a' })).reindexing).toBe(
      false,
    );
    expect(probeEmbeddingDimensions).not.toHaveBeenCalled();
    expect(prisma.aiKnowledgeDocument.updateMany).not.toHaveBeenCalled();
  });
  it('preserves the embedding model for older clients that omit the field', async () => {
    await saveAiConfiguration(input);
    expect(prisma.aiConfiguration.update).toHaveBeenCalledWith({
      where: { id: 'default' },
      data: input,
    });
    expect(requireInstalledEmbeddingModel).not.toHaveBeenCalled();
    expect(prisma.aiKnowledgeDocument.updateMany).not.toHaveBeenCalled();
  });
  it('does not save or invalidate the old index when the new model cannot embed', async () => {
    vi.mocked(probeEmbeddingDimensions).mockRejectedValue(new Error('Embedding unavailable'));
    await expect(saveAiConfiguration({ ...input, embeddingModel: 'embed-b' })).rejects.toThrow(
      'Embedding unavailable',
    );
    expect(prisma.aiConfiguration.update).not.toHaveBeenCalled();
    expect(prisma.aiKnowledgeDocument.updateMany).not.toHaveBeenCalled();
  });
});
