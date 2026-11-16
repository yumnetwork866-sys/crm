import { afterEach, describe, expect, it, vi } from 'vitest';
import { listAiModels, requireInstalledEmbeddingModel } from './ollamaModels';
afterEach(() => vi.unstubAllGlobals());
describe('Ollama model choices', () => {
  it('separates chat and embedding models by capabilities', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(
        async () =>
          new Response(
            JSON.stringify({
              models: [
                { name: 'chat', capabilities: ['completion'] },
                { name: 'embed', capabilities: ['embedding'] },
              ],
            }),
          ),
      ),
    );
    const result = await listAiModels();
    expect(result.models).toEqual(['chat']);
    expect(result.embeddingModels).toEqual(['embed']);
    await expect(requireInstalledEmbeddingModel('chat')).rejects.toMatchObject({
      code: 'INVALID_EMBEDDING_MODEL',
    });
  });
  it('reads model details when tags omit capabilities', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(new Response(JSON.stringify({ models: [{ name: 'embed' }] })))
        .mockResolvedValueOnce(new Response(JSON.stringify({ capabilities: ['embedding'] }))),
    );
    expect((await listAiModels()).embeddingModels).toEqual(['embed']);
    expect(String(vi.mocked(fetch).mock.calls[1][0])).toContain('/api/show');
  });
  it('reports provider outages and never offers invented embedding models', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Offline')));
    expect(await listAiModels()).toMatchObject({ connected: false, embeddingModels: [] });
    await expect(requireInstalledEmbeddingModel('embed')).rejects.toMatchObject({
      code: 'EMBEDDING_UNAVAILABLE',
    });
  });
});
