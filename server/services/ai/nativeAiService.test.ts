import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../lib/prisma', () => ({
  prisma: {
    aiConfiguration: { upsert: vi.fn() },
    aiKnowledgeDocument: { aggregate: vi.fn() },
    aiRun: { create: vi.fn() },
    whatsAppMessage: { findMany: vi.fn() },
    $queryRaw: vi.fn(),
  },
}));
vi.mock('./knowledgeRetrieval', () => ({ retrieveKnowledge: vi.fn() }));
vi.mock('../../lib/logger', () => ({ createLogger: () => ({ info: vi.fn(), error: vi.fn() }) }));
import { prisma } from '../../lib/prisma';
import {
  clearAiCache,
  generateNativeAi,
  loadAiMessages,
  retrieveKnowledge,
} from './nativeAiService';

const config = {
  id: 'default',
  model: 'gemma4:latest',
  embeddingModel: 'embeddinggemma:300m',
  embeddingDimensions: 768,
  suggestionsEnabled: true,
  autoReplyEnabled: false,
  ragEnabled: true,
  timeoutMs: 45000,
  instructions: '',
  retrievalSettings: {},
  updatedAt: new Date('2026-11-13'),
};
const source = {
  id: 'chunk-1',
  documentId: 'doc-1',
  title: 'Policy',
  brand: 'Actiscar',
  content: 'Returns within 7 days.',
  score: 0.2,
};
const output = {
  suggestions: ['Returns within 7 days.', 'May I help with your return?'],
  answer: 'Returns within 7 days.',
  shouldAutoReply: true,
  sourceIds: ['chunk-1'],
  reason: 'Supported by policy.',
};
const input = {
  brandName: 'Actiscar',
  messages: [{ sender: 'customer' as const, content: 'Return policy?' }],
};
function modelResponse(value: unknown = output) {
  return new Response(JSON.stringify({ message: { content: JSON.stringify(value) } }), {
    status: 200,
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  clearAiCache();
  vi.mocked(prisma.aiConfiguration.upsert).mockResolvedValue({ ...config });
  vi.mocked(prisma.aiKnowledgeDocument.aggregate).mockResolvedValue({
    _max: { updatedAt: new Date('2026-11-13') },
    _count: 1,
  } as any);
  vi.mocked(retrieveKnowledge).mockResolvedValue([source]);
  vi.mocked(prisma.aiRun.create).mockResolvedValue({ id: 'audit' } as any);
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async () => modelResponse()),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe('native AI generation', () => {
  it('calls Ollama directly with a schema, validates output, and stores diagnostics', async () => {
    const result = await generateNativeAi(input, 'test');
    expect(result.provider).toBe('ollama');
    expect(result.shouldAutoReply).toBe(true);
    const [url, options] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toContain('/api/chat');
    expect(JSON.parse(String(options?.body)).format.required).toContain('sourceIds');
    const request = JSON.parse(String(options?.body));
    expect(request.messages[0].content).toContain('CRM sales assistant for Actiscar');
    expect(JSON.parse(request.messages[1].content).brand).toBe('Actiscar');
    expect(retrieveKnowledge).toHaveBeenCalledWith(input.messages[0].content);
    expect(prisma.aiRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          operation: 'test',
          status: 'success',
          rawOutput: JSON.stringify(output),
        }),
      }),
    );
  });
  it('validates a single JSON code fence but rejects surrounding prose', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({ message: { content: '```json\n' + JSON.stringify(output) + '\n```' } }),
      ),
    );
    expect((await generateNativeAi(input, 'test')).suggestions).toEqual(output.suggestions);
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({ message: { content: 'Here is an answer: ' + JSON.stringify(output) } }),
      ),
    );
    await expect(generateNativeAi(input, 'test')).rejects.toMatchObject({ code: 'INVALID_JSON' });
  });
  it('rejects unknown citations and preserves the original output for debugging', async () => {
    vi.mocked(fetch).mockResolvedValue(
      modelResponse({ ...output, sourceIds: ['other-brand-secret'] }),
    );
    await expect(generateNativeAi(input)).rejects.toMatchObject({
      code: 'INVALID_CITATION',
      stage: 'validation',
    });
    expect(prisma.aiRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'error',
          errorCode: 'INVALID_CITATION',
          rawOutput: expect.stringContaining('other-brand-secret'),
        }),
      }),
    );
  });
  it('blocks automatic replies when there is no cited evidence', async () => {
    vi.mocked(retrieveKnowledge).mockResolvedValue([]);
    vi.mocked(fetch).mockResolvedValue(modelResponse({ ...output, sourceIds: [] }));
    expect((await generateNativeAi(input, 'reply')).shouldAutoReply).toBe(false);
  });
  it('returns distinct errors for provider failures and malformed output without fallback templates', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: 'model missing' }), { status: 404 }),
    );
    await expect(generateNativeAi(input)).rejects.toMatchObject({ code: 'MODEL_HTTP_ERROR' });
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ message: { content: 'not JSON' } })),
    );
    await expect(generateNativeAi(input)).rejects.toMatchObject({ code: 'INVALID_JSON' });
    vi.mocked(fetch).mockResolvedValue(modelResponse({ suggestions: ['incomplete'] }));
    await expect(generateNativeAi(input)).rejects.toMatchObject({ code: 'INVALID_OUTPUT' });
    vi.mocked(fetch).mockRejectedValue(
      Object.assign(new Error('timed out'), { name: 'TimeoutError' }),
    );
    await expect(generateNativeAi(input)).rejects.toMatchObject({ code: 'MODEL_TIMEOUT' });
  });
  it('deduplicates concurrent requests and caches completed suggestions', async () => {
    let release!: (response: Response) => void;
    vi.mocked(fetch).mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const first = generateNativeAi(input);
    const second = generateNativeAi(input);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    release(modelResponse());
    const results = await Promise.all([first, second]);
    expect(results[0].runId).toBe(results[1].runId);
    expect((await generateNativeAi(input)).cached).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('regenerates on explicit refresh and updates the normal cache', async () => {
    const initial = await generateNativeAi(input);
    const refreshed = await generateNativeAi({ ...input, force: true });
    expect(refreshed.runId).not.toBe(initial.runId);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect((await generateNativeAi(input)).runId).toBe(refreshed.runId);
  });
  it('honors disabled suggestions before calling the model', async () => {
    vi.mocked(prisma.aiConfiguration.upsert).mockResolvedValue({
      ...config,
      suggestionsEnabled: false,
    });
    await expect(generateNativeAi(input)).rejects.toMatchObject({ code: 'AI_DISABLED' });
    expect(fetch).not.toHaveBeenCalled();
  });
  it('loads scoped database history instead of trusting a partial browser history', async () => {
    vi.mocked(prisma.whatsAppMessage.findMany).mockResolvedValue([
      { sender: 'customer', content: 'Persisted question', timestamp: new Date() },
    ] as any);
    const messages = await loadAiMessages({
      ...input,
      phone: '601234',
      businessPhoneNumberId: 'waba-1',
    });
    expect(messages[0].content).toBe('Persisted question');
    expect(prisma.whatsAppMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          businessPhoneNumberId: 'waba-1',
          OR: [{ customerPhone: '601234' }],
        }),
      }),
    );
  });
});
