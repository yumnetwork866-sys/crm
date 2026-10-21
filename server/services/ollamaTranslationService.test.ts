import { afterEach, describe, expect, it, vi } from 'vitest';
import { isLikelyVietnamese, translateWithOllama } from './ollamaTranslationService';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('translateWithOllama', () => {
  it('recognizes Vietnamese messages before invoking the model', () => {
    expect(isLikelyVietnamese('Dạ sản phẩm này giá bao nhiêu vậy ạ?')).toBe(true);
    expect(isLikelyVietnamese('Berapa harga barang ini?')).toBe(false);
  });

  it('calls translategemma:12b and returns only the normalized translation', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      message: { content: 'Translation: Xin chào!' },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await translateWithOllama({ text: 'Hello!', targetLanguage: 'vi' });

    expect(result).toEqual({
      translation: 'Xin chào!',
      targetLanguage: 'vi',
      model: 'translategemma:12b',
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [, request] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(request.body));
    expect(body.model).toBe('translategemma:12b');
    expect(body.stream).toBe(false);
    expect(body.messages[0].content).toContain('\n\nHello!');
  });

  it('rejects empty and oversized messages before calling Ollama', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(translateWithOllama({ text: '   ' })).rejects.toThrow('đang trống');
    await expect(translateWithOllama({ text: 'a'.repeat(5_001) })).rejects.toThrow('5.000');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('surfaces an Ollama API error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: 'model not found',
    }), { status: 404, headers: { 'Content-Type': 'application/json' } })));

    await expect(translateWithOllama({ text: 'Hello' })).rejects.toThrow('model not found');
  });
});

