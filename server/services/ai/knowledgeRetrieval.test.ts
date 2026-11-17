import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('./rerankService', () => ({ rerankKnowledge: vi.fn() }));
vi.mock('./aiSettings', () => ({
  DEFAULT_EMBEDDING_DIMENSIONS: 768,
  getAiConfig: vi.fn(),
}));
vi.mock('../../lib/prisma', () => ({
  prisma: { $queryRaw: vi.fn(), aiKnowledgeChunk: { count: vi.fn() } },
}));
vi.mock('./embeddingService', () => ({
  embedQuery: vi.fn(),
  getEmbeddingVersion: () => 'test-model|768|retrieval-v1',
}));
import { prisma } from '../../lib/prisma';
import { getAiConfig } from './aiSettings';
import { defaultRetrievalSettings } from '../../../shared/knowledgeRetrievalSettings';
import { embedQuery } from './embeddingService';
import { rerankKnowledge } from './rerankService';
import {
  fuseKnowledgeResults,
  fuseWeightedKnowledgeResults,
  retrieveKnowledge,
  type KnowledgeSource,
} from './knowledgeRetrieval';
const source = (id: string, score: number): KnowledgeSource => ({
  id,
  documentId: 'doc',
  title: id,
  content: 'Policy',
  brand: 'Actiscar',
  score,
});
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getAiConfig).mockResolvedValue({
    embeddingModel: 'test-model',
    embeddingDimensions: 768,
    retrievalSettings: { ...defaultRetrievalSettings, hybridStrategy: 'rrf' },
  } as any);
  vi.mocked(embedQuery).mockResolvedValue([1, 0]);
});

describe('hybrid knowledge retrieval', () => {
  it('traces candidates discarded by the weighted threshold separately from selected sources', async () => {
    vi.mocked(getAiConfig).mockResolvedValue({
      embeddingModel: 'test-model',
      embeddingDimensions: 768,
      retrievalSettings: {
        ...defaultRetrievalSettings,
        mode: 'hybrid',
        hybridStrategy: 'weighted',
        scoreThreshold: 0.55,
      },
    } as any);
    vi.mocked(prisma.aiKnowledgeChunk.count).mockResolvedValue(2);
    vi.mocked(prisma.$queryRaw)
      .mockResolvedValueOnce([source('A', 1)])
      .mockResolvedValueOnce([source('A', 0.8), source('B', 0.5)]);
    const trace = vi.fn();
    const result = await retrieveKnowledge('Policy', prisma, trace);
    expect(result.map((item) => item.id)).toEqual(['A']);
    const steps = trace.mock.calls.map(([step]) => step);
    expect(
      steps.find((step) => step.id === 'fusion').sources.map((item: KnowledgeSource) => item.id),
    ).toEqual(['A', 'B']);
    expect(steps.find((step) => step.id === 'rerank').status).toBe('skipped');
    expect(
      steps.find((step) => step.id === 'embedding' && step.status === 'completed'),
    ).toMatchObject({
      input: { text: 'Policy', model: 'test-model' },
      output: { dimensions: 2, vectorPreview: [1, 0] },
    });
    expect(
      steps.find((step) => step.id === 'keyword' && step.status === 'completed'),
    ).toMatchObject({
      input: { keywordQuery: expect.any(String) },
      output: { count: 1 },
    });
    expect(
      steps.find((step) => step.id === 'vector' && step.status === 'completed').sources[0]
        .semanticScore,
    ).toBe(0.8);
  });
  it.each(['keyword', 'vector', 'hybrid'] as const)(
    'reranks %s candidates before applying Top K',
    async (mode) => {
      vi.mocked(getAiConfig).mockResolvedValue({
        embeddingModel: 'test-model',
        embeddingDimensions: 768,
        timeoutMs: 45000,
        retrievalSettings: {
          ...defaultRetrievalSettings,
          mode,
          rerankEnabled: true,
          hybridStrategy: 'rerank',
          topK: 1,
        },
      } as any);
      vi.mocked(prisma.aiKnowledgeChunk.count).mockResolvedValue(1);
      vi.mocked(prisma.$queryRaw).mockResolvedValue([source('A', 0.9), source('B', 0.8)]);
      vi.mocked(rerankKnowledge).mockResolvedValue([{ ...source('B', 0.95), ranking: 'rerank' }]);
      const results = await retrieveKnowledge('Return policy');
      expect(results.map((item) => item.id)).toEqual(['B']);
      expect(rerankKnowledge).toHaveBeenCalledTimes(1);
      const candidates = vi.mocked(rerankKnowledge).mock.calls[0][1];
      expect(candidates).toHaveLength(2);
      expect(new Set(candidates.map((item) => item.id)).size).toBe(2);
      for (const [query] of vi.mocked(prisma.$queryRaw).mock.calls)
        expect((query as any).strings.join('')).not.toContain('>=');
      if (mode === 'keyword') expect(embedQuery).not.toHaveBeenCalled();
    },
  );
  it('changes the hybrid ordering when semantic and keyword weights change', () => {
    const keyword = [source('keyword', 9)];
    const semantic = [source('semantic', 0.8)];
    expect(fuseWeightedKnowledgeResults(keyword, semantic, 0.7)[0].id).toBe('semantic');
    expect(fuseWeightedKnowledgeResults(keyword, semantic, 0.2)[0].id).toBe('keyword');
    expect(fuseWeightedKnowledgeResults(keyword, semantic, 1).map((item) => item.id)).toEqual([
      'semantic',
    ]);
    expect(fuseWeightedKnowledgeResults(keyword, semantic, 0).map((item) => item.id)).toEqual([
      'keyword',
    ]);
  });

  it('normalizes keyword ranks and combines both scores without duplicate chunks', () => {
    const results = fuseWeightedKnowledgeResults([source('A', 1)], [source('A', 0.8)], 0.7);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      keywordScore: 0.5,
      semanticScore: 0.8,
      ranking: 'weighted',
      retrieval: 'hybrid',
    });
    expect(results[0].score).toBeCloseTo(0.7 * 0.8 + 0.3 * 0.5);
  });

  it('applies the threshold to the final weighted score without prefiltering semantic candidates', async () => {
    vi.mocked(getAiConfig).mockResolvedValue({
      embeddingModel: 'test-model',
      embeddingDimensions: 768,
      retrievalSettings: {
        ...defaultRetrievalSettings,
        hybridStrategy: 'weighted',
        semanticWeight: 0.7,
        topK: 2,
        scoreThreshold: 0.65,
      },
    } as any);
    vi.mocked(prisma.aiKnowledgeChunk.count).mockResolvedValue(1);
    vi.mocked(prisma.$queryRaw)
      .mockResolvedValueOnce([source('A', 9), source('B', 0.1)])
      .mockResolvedValueOnce([source('A', 0.6), source('B', 0.9)]);
    const results = await retrieveKnowledge('Return policy');
    expect(results.map((item) => item.id)).toEqual(['A', 'B']);
    expect(results[0].score).toBeCloseTo(0.69);
    const query = vi.mocked(prisma.$queryRaw).mock.calls[1][0] as any;
    expect(query.strings.join('')).not.toContain('>=');
  });

  it('filters weighted matches below the aggregate threshold', async () => {
    vi.mocked(getAiConfig).mockResolvedValue({
      embeddingModel: 'test-model',
      embeddingDimensions: 768,
      retrievalSettings: {
        ...defaultRetrievalSettings,
        hybridStrategy: 'weighted',
        semanticWeight: 0.7,
        scoreThreshold: 0.75,
      },
    } as any);
    vi.mocked(prisma.aiKnowledgeChunk.count).mockResolvedValue(1);
    vi.mocked(prisma.$queryRaw)
      .mockResolvedValueOnce([source('A', 1)])
      .mockResolvedValueOnce([source('A', 0.8)]);
    expect(await retrieveKnowledge('Return policy')).toEqual([]);
  });
  it('fuses both rankings without duplicates and keeps vector similarity separate', () => {
    const results = fuseKnowledgeResults(
      [source('A', 0.1), source('B', 0.05)],
      [source('C', 0.9), source('A', 0.8)],
    );
    expect(results[0].id).toBe('A');
    expect(results[0].retrieval).toBe('hybrid');
    expect(results[0].semanticScore).toBe(0.8);
    expect(results.filter((row) => row.id === 'A')).toHaveLength(1);
  });
  it('searches all enabled documents, including documents with legacy brand labels', async () => {
    vi.mocked(prisma.aiKnowledgeChunk.count).mockResolvedValue(1);
    vi.mocked(prisma.$queryRaw)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([source('semantic-only', 0.8)]);
    const results = await retrieveKnowledge('When will my parcel arrive?');
    expect(results[0].retrieval).toBe('vector');
    expect(results[0].brand).toBe('Actiscar');
    for (const call of vi.mocked(prisma.$queryRaw).mock.calls) {
      const query = call[0] as any;
      expect(query.strings.join('')).toContain('d.enabled = true');
      expect(query.strings.join('')).not.toContain('brandKey');
    }
    expect(prisma.aiKnowledgeChunk.count).toHaveBeenCalledWith({
      where: {
        embeddingModel: 'test-model|768|retrieval-v1',
        document: { enabled: true },
      },
    });
    expect((vi.mocked(prisma.$queryRaw).mock.calls[1][0] as any).values).toContain(
      'test-model|768|retrieval-v1',
    );
  });
  it('labels keyword-only results when documents have not been indexed yet', async () => {
    vi.mocked(prisma.aiKnowledgeChunk.count).mockResolvedValue(0);
    vi.mocked(prisma.$queryRaw).mockResolvedValue([source('A', 0.1)]);
    expect((await retrieveKnowledge('Return policy'))[0].retrieval).toBe('keyword');
    expect((vi.mocked(prisma.$queryRaw).mock.calls[0][0] as any).strings.join('')).not.toContain(
      'brandKey',
    );
    expect(embedQuery).not.toHaveBeenCalled();
  });
  it('does not silently hide embedding outages once semantic search is active', async () => {
    vi.mocked(prisma.aiKnowledgeChunk.count).mockResolvedValue(1);
    vi.mocked(prisma.$queryRaw).mockResolvedValue([]);
    vi.mocked(embedQuery).mockRejectedValue(new Error('Embedding unavailable'));
    await expect(retrieveKnowledge('Return policy')).rejects.toThrow('Embedding unavailable');
  });

  it('runs Full-Text Search without consulting embeddings and respects Top K', async () => {
    vi.mocked(getAiConfig).mockResolvedValue({
      retrievalSettings: { ...defaultRetrievalSettings, mode: 'keyword', topK: 2 },
    } as any);
    vi.mocked(prisma.$queryRaw).mockResolvedValue([
      source('A', 0.8),
      source('B', 0.7),
      source('C', 0.6),
    ]);
    const result = await retrieveKnowledge('Return policy');
    expect(result.map((item) => item.id)).toEqual(['A', 'B']);
    expect(result.every((item) => item.retrieval === 'keyword')).toBe(true);
    expect(result[0].score).toBe(0.8);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.aiKnowledgeChunk.count).not.toHaveBeenCalled();
    expect(embedQuery).not.toHaveBeenCalled();
  });

  it('runs Vector Search alone with the configured cosine threshold and Top K', async () => {
    vi.mocked(getAiConfig).mockResolvedValue({
      embeddingModel: 'test-model',
      embeddingDimensions: 768,
      retrievalSettings: {
        ...defaultRetrievalSettings,
        mode: 'vector',
        topK: 1,
        scoreThreshold: 0.73,
      },
    } as any);
    vi.mocked(prisma.aiKnowledgeChunk.count).mockResolvedValue(2);
    vi.mocked(prisma.$queryRaw).mockResolvedValue([source('A', 0.9), source('B', 0.8)]);
    const result = await retrieveKnowledge('Return policy');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'A',
      retrieval: 'vector',
      score: 0.9,
      semanticScore: 0.9,
    });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    const query = vi.mocked(prisma.$queryRaw).mock.calls[0][0] as any;
    expect(query.values).toContain(0.73);
    expect(query.strings.join('')).toContain('>=');
    expect(query.strings.join('')).not.toContain('to_tsquery');
  });

  it('omits the cosine filter when the score threshold is disabled', async () => {
    vi.mocked(getAiConfig).mockResolvedValue({
      embeddingModel: 'test-model',
      embeddingDimensions: 768,
      retrievalSettings: {
        ...defaultRetrievalSettings,
        mode: 'vector',
        scoreThresholdEnabled: false,
      },
    } as any);
    vi.mocked(prisma.aiKnowledgeChunk.count).mockResolvedValue(1);
    vi.mocked(prisma.$queryRaw).mockResolvedValue([source('A', 0.1)]);
    expect((await retrieveKnowledge('Return policy'))[0].id).toBe('A');
    const query = vi.mocked(prisma.$queryRaw).mock.calls[0][0] as any;
    expect(query.strings.join('')).not.toContain('>=');
    expect(query.values).not.toContain(0.55);
  });

  it('does not fall back to keyword search when Vector Search has no index', async () => {
    vi.mocked(getAiConfig).mockResolvedValue({
      embeddingModel: 'test-model',
      embeddingDimensions: 768,
      retrievalSettings: { ...defaultRetrievalSettings, mode: 'vector' },
    } as any);
    vi.mocked(prisma.aiKnowledgeChunk.count).mockResolvedValue(0);
    expect(await retrieveKnowledge('Return policy')).toEqual([]);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    expect(embedQuery).not.toHaveBeenCalled();
  });

  it('applies Top K after fusing both hybrid branches and keeps keyword matches', async () => {
    vi.mocked(getAiConfig).mockResolvedValue({
      embeddingModel: 'test-model',
      embeddingDimensions: 768,
      retrievalSettings: {
        ...defaultRetrievalSettings,
        hybridStrategy: 'rrf',
        topK: 2,
        scoreThreshold: 0.95,
      },
    } as any);
    vi.mocked(prisma.aiKnowledgeChunk.count).mockResolvedValue(1);
    vi.mocked(prisma.$queryRaw)
      .mockResolvedValueOnce([source('A', 0.2), source('B', 0.1)])
      .mockResolvedValueOnce([source('C', 0.99)]);
    const results = await retrieveKnowledge('Return policy');
    expect(results).toHaveLength(2);
    expect(results.some((item) => item.retrieval === 'keyword')).toBe(true);
    expect((vi.mocked(prisma.$queryRaw).mock.calls[1][0] as any).values).toContain(0.95);
  });
});
