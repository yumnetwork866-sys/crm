import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('./ollamaModels', () => ({ listAiModels: vi.fn() }));
import { listAiModels } from './ollamaModels';
import { rerankKnowledge, validateRerankSettings } from './rerankService';
import { defaultRetrievalSettings } from '../../../shared/knowledgeRetrievalSettings';
import type { KnowledgeSource } from './knowledgeRetrieval';

const sources: KnowledgeSource[] = [
  {
    id: 'shipping',
    documentId: 'doc1',
    title: 'Shipping',
    brand: '*',
    content: 'Delivery takes 5 days.',
    score: 1,
  },
  {
    id: 'returns',
    documentId: 'doc2',
    title: 'Returns',
    brand: '*',
    content: 'Returns accepted within 7 days.',
    score: 0.4,
  },
];
const settings = {
  ...defaultRetrievalSettings,
  rerankEnabled: true,
  mode: 'keyword' as const,
  topK: 1,
  scoreThreshold: 0.5,
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal('fetch', vi.fn());
});
afterEach(() => vi.unstubAllGlobals());
const respond = (scores: unknown) =>
  vi
    .mocked(fetch)
    .mockResolvedValue(
      new Response(JSON.stringify({ message: { content: JSON.stringify({ scores }) } })),
    );

describe('Ollama reranking', () => {
  it('traces all reranked candidates before threshold and Top K discard them', async () => {
    respond([
      { index: 0, score: 0.1 },
      { index: 1, score: 0.9 },
    ]);
    const trace = vi.fn();
    const result = await rerankKnowledge('Returns?', sources, settings, 45000, trace);
    const done = trace.mock.calls.map(([step]) => step).find((step) => step.status === 'completed');
    expect(done.sources.map((source: KnowledgeSource) => source.id)).toEqual([
      'returns',
      'shipping',
    ]);
    expect(done.values.selectedChunkIds).toEqual(['returns']);
    expect(result.map((source) => source.id)).toEqual(['returns']);
  });
  it('ranks by validated model scores before Top K and keeps source identity', async () => {
    respond([
      { index: 0, score: 0.1 },
      { index: 1, score: 0.9 },
    ]);
    const result = await rerankKnowledge('Berapa hari boleh pulangkan barang?', sources, settings);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'returns',
      score: 0.9,
      ranking: 'rerank',
      rerankModel: 'qwen3:4b',
    });
    const [url, request] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toContain('/api/chat');
    const body = JSON.parse(String(request?.body));
    expect(body).toMatchObject({
      model: 'qwen3:4b',
      think: false,
      stream: false,
      options: { temperature: 0 },
    });
    expect(JSON.parse(body.messages[1].content).excerpts).toHaveLength(2);
  });
  it.each([
    [
      { index: 0, score: 0.9 },
      { index: 0, score: 0.8 },
    ],
    [
      { index: 0, score: 0.9 },
      { index: 3, score: 0.8 },
    ],
    [
      { index: 0, score: 2 },
      { index: 1, score: 0.8 },
    ],
    [{ index: 0, score: 0.9 }],
  ])(
    'rejects invalid indices, duplicates, missing candidates and invalid scores: %j',
    async (...scores) => {
      respond(scores);
      await expect(rerankKnowledge('Returns?', sources, settings)).rejects.toMatchObject({
        code: 'INVALID_RERANK_OUTPUT',
      });
    },
  );
  it('returns no sources below the rerank threshold', async () => {
    respond([
      { index: 0, score: 0.1 },
      { index: 1, score: 0.2 },
    ]);
    expect(await rerankKnowledge('Returns?', sources, settings)).toEqual([]);
  });
  it('does not call the model without candidates', async () => {
    expect(await rerankKnowledge('Returns?', [], settings)).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('surfaces an Ollama outage instead of silently presenting an unranked result', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('Offline'));
    await expect(rerankKnowledge('Returns?', sources, settings)).rejects.toMatchObject({
      code: 'RERANK_UNAVAILABLE',
    });
  });
  it('caps the candidate pool without truncating chunk text', async () => {
    const candidates = Array.from({ length: 25 }, (_, i) => ({ ...sources[0], id: `chunk-${i}` }));
    respond(candidates.slice(0, 20).map((_, index) => ({ index, score: 0.8 })));
    await rerankKnowledge('Returns?', candidates, settings);
    const body = JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body));
    expect(JSON.parse(body.messages[1].content).excerpts).toHaveLength(20);
  });
  it('validates that the selected rerank model is installed before saving', async () => {
    vi.mocked(listAiModels).mockResolvedValue({
      connected: true,
      models: ['qwen3:4b'],
      embeddingModels: [],
      error: null,
    });
    await expect(validateRerankSettings(settings)).resolves.toBeUndefined();
    await expect(
      validateRerankSettings({ ...settings, rerankModel: 'missing' }),
    ).rejects.toMatchObject({ code: 'RERANK_MODEL_UNAVAILABLE' });
  });
});
