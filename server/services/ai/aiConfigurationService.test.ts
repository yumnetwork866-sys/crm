import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../lib/prisma', () => ({
  prisma: {
    aiConfiguration: { upsert: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn() },
    aiKnowledgeDocument: { updateMany: vi.fn() },
    integrationSetting: { upsert: vi.fn() },
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
  it('saves retrieval settings and the assistant profile with the configuration in one transaction', async () => {
    const retrievalSettings = {
      mode: 'hybrid' as const,
      topK: 3,
      scoreThresholdEnabled: true,
      scoreThreshold: 0.4,
      hybridStrategy: 'weighted' as const,
      semanticWeight: 0.7,
    };
    const aiProfile = { name: 'Trợ lý', avatarUrl: '/uploads/ai/new-avatar.png' };
    const result = await saveAiConfiguration({ ...input, retrievalSettings, aiProfile });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.aiConfiguration.update).toHaveBeenCalledWith({
      where: { id: 'default' },
      data: { ...input, retrievalSettings },
    });
    expect(prisma.integrationSetting.upsert).toHaveBeenCalledWith({
      where: { id: 'default' },
      update: { aiName: aiProfile.name, aiAvatarUrl: aiProfile.avatarUrl },
      create: { id: 'default', aiName: aiProfile.name, aiAvatarUrl: aiProfile.avatarUrl },
    });
    expect(result.aiProfile).toEqual(aiProfile);
    expect(result.config.retrievalSettings).toEqual(retrievalSettings);
    expect(result.reindexing).toBe(false);
    expect(prisma.aiKnowledgeDocument.updateMany).not.toHaveBeenCalled();
  });
  it('rejects the combined save if the profile write fails inside the transaction', async () => {
    vi.mocked(prisma.integrationSetting.upsert).mockRejectedValue(
      new Error('Profile write failed'),
    );
    await expect(
      saveAiConfiguration({ ...input, aiProfile: { name: 'Trợ lý', avatarUrl: null } }),
    ).rejects.toThrow('Profile write failed');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
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
