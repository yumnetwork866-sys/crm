import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('./aiSettings', () => ({
  DEFAULT_EMBEDDING_DIMENSIONS: 768,
  getEmbeddingSettings: vi.fn(async () => ({ model: 'test-model', dimensions: 768 })),
}));
import {
  embedQuery,
  embedTexts,
  EMBEDDING_DIMENSIONS,
  normalizeEmbedding,
  getEmbeddingVersion,
  formatEmbeddingQuery,
  formatEmbeddingDocument,
} from './embeddingService';
const vector = () => Array.from({ length: EMBEDDING_DIMENSIONS }, (_, i) => (i === 0 ? 2 : 0));
afterEach(() => vi.unstubAllGlobals());

describe('embedding model boundary', () => {
  it('normalizes valid vectors and rejects invalid dimensions, zeros and non-finite values', () => {
    expect(normalizeEmbedding(vector())[0]).toBe(1);
    for (const value of [
      [],
      [1],
      Array(768).fill(0),
      [NaN, ...Array(767).fill(1)],
      [Infinity, ...Array(767).fill(1)],
    ]) {
      expect(() => normalizeEmbedding(value)).toThrow();
    }
  });
  it('uses Gemma task prompts only with Gemma embedding models', () => {
    expect(formatEmbeddingQuery('Delivery?', 'embeddinggemma:300m')).toBe(
      'task: search result | query: Delivery?',
    );
    expect(formatEmbeddingDocument('Policy', 'Delivery', 'embeddinggemma:300m')).toBe(
      'title: Policy | text: Delivery',
    );
    expect(formatEmbeddingQuery('Delivery?', 'another-model')).toBe('Delivery?');
    expect(formatEmbeddingDocument('Policy', 'Delivery', 'another-model')).toBe('Policy\nDelivery');
  });
  it('supports the selected model dimension and isolates query caches between models', async () => {
    const firstSettings = { model: 'embed-768', dimensions: 768 };
    const secondSettings = { model: 'embed-384', dimensions: 384 };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (_url, init) => {
        const body = JSON.parse(String(init?.body));
        const dimensions = body.model === firstSettings.model ? 768 : 384;
        return new Response(
          JSON.stringify({
            embeddings: [Array.from({ length: dimensions }, (_, index) => (index === 0 ? 1 : 0))],
          }),
        );
      }),
    );
    expect((await embedQuery('Same query across model choices', firstSettings)).length).toBe(768);
    expect((await embedQuery('Same query across model choices', secondSettings)).length).toBe(384);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(getEmbeddingVersion(firstSettings)).not.toBe(getEmbeddingVersion(secondSettings));
    expect(() => normalizeEmbedding(vector(), 384)).toThrow();
  });
  it('validates batch cardinality and calls the dedicated embedding endpoint', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ embeddings: [vector()] }))),
    );
    expect((await embedTexts(['title: Test | text: Policy']))[0][0]).toBe(1);
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toContain('/api/embed');
    expect(JSON.parse(String(init?.body)).truncate).toBe(false);
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ embeddings: [] })));
    await expect(embedTexts(['A'])).rejects.toMatchObject({ code: 'INVALID_EMBEDDING' });
  });
  it('reports unavailable models as embedding errors, without fabricated vectors', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ error: 'missing model' }), { status: 404 }),
        ),
    );
    await expect(embedTexts(['A'])).rejects.toMatchObject({
      code: 'EMBEDDING_HTTP_ERROR',
      stage: 'embedding',
    });
    vi.mocked(fetch).mockRejectedValue(new Error('connection refused'));
    await expect(embedTexts(['A'])).rejects.toMatchObject({ code: 'EMBEDDING_UNAVAILABLE' });
  });
  it('deduplicates and caches repeated query embeddings', async () => {
    let release!: (response: Response) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            release = resolve;
          }),
      ),
    );
    const first = embedQuery('How do I return a damaged item?');
    const second = embedQuery('How do I return a damaged item?');
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    release(new Response(JSON.stringify({ embeddings: [vector()] })));
    await Promise.all([first, second]);
    expect((await embedQuery('How do I return a damaged item?'))[0]).toBe(1);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
