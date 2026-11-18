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
  buildAiSystemPrompt,
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
  systemPromptTemplate: null,
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
  it('emits selected chunks, model output, validation and completion for live test diagnostics', async () => {
    const trace = vi.fn();
    const candidates = [source, { ...source, id: 'rejected-chunk', score: 0.01 }];
    vi.mocked(retrieveKnowledge).mockImplementationOnce(async (_question, _db, observe) => {
      observe?.({ id: 'fusion', title: 'Hybrid', status: 'completed', sources: candidates });
      return [source];
    });
    const result = await generateNativeAi(input, 'test', trace);
    const steps = trace.mock.calls.map(([step]) => step);
    expect(retrieveKnowledge).toHaveBeenCalledWith(
      input.messages[0].content,
      prisma,
      expect.any(Function),
    );
    expect(steps.find((step) => step.id === 'selection').sources).toEqual([source]);
    expect(steps.find((step) => step.id === 'selection').inputSources).toEqual(candidates);
    expect(steps.find((step) => step.id === 'context').input).toEqual(input);
    const generation = steps.find(
      (step) => step.id === 'generation' && step.status === 'completed',
    );
    expect(generation.input).toEqual(JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body)));
    expect(generation.prompt).toEqual(
      JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body)).messages,
    );
    expect(generation.output).toBe(JSON.stringify(output));
    expect(
      steps.find((step) => step.id === 'validation' && step.status === 'completed').output,
    ).toEqual(output);
    expect(
      steps.find((step) => step.id === 'generation' && step.status === 'completed').values
        .rawOutput,
    ).toBe(JSON.stringify(output));
    expect(
      steps.find((step) => step.id === 'validation' && step.status === 'completed').values
        .sourceIds,
    ).toEqual(['chunk-1']);
    expect(steps.at(-1)).toMatchObject({
      id: 'audit',
      status: 'completed',
      values: { runId: result.runId },
    });
  });
  it('calls Ollama directly with a schema, validates output, and stores diagnostics', async () => {
    const result = await generateNativeAi(input, 'test');
    expect(result.provider).toBe('ollama');
    expect(result.shouldAutoReply).toBe(true);
    const [url, options] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toContain('/api/chat');
    expect(JSON.parse(String(options?.body)).format.required).toContain('sourceIds');
    const request = JSON.parse(String(options?.body));
    expect(request.messages[0].content).toContain('CRM sales assistant for Actiscar');
    expect(request.messages[0].content).toContain('Be helpful, brief and polite.');
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
  it('uses the same prompt as the configuration preview for the default brand', async () => {
    const instructions = 'Xưng em, gọi khách là anh/chị.';
    vi.mocked(prisma.aiConfiguration.upsert).mockResolvedValueOnce({ ...config, instructions });
    await generateNativeAi({ messages: input.messages }, 'test');
    const request = JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body));
    expect(request.messages[0]).toEqual({
      role: 'system',
      content: buildAiSystemPrompt({ instructions }),
    });
    expect(request.messages[0].content).toContain('CRM sales assistant for Yum Network');
    expect(request.messages[0].content).toContain(instructions);
  });
  it('uses the saved system prompt template for the current brand and appends guidance', async () => {
    const instructions = 'Xưng em khi trả lời.';
    const systemPromptTemplate = 'Assist customers of {{brand}} with their orders.';
    vi.mocked(prisma.aiConfiguration.upsert).mockResolvedValueOnce({
      ...config,
      instructions,
      systemPromptTemplate,
    });
    await generateNativeAi(input, 'test');
    const request = JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body));
    expect(request.messages[0].content).toMatch(
      /^Assist customers of Actiscar with their orders\./,
    );
    expect(request.messages[0].content).toContain('Required JSON schema:');
    expect(request.messages[0].content).toContain(instructions);
  });
  it('uses conversation history for both retrieval and the model on follow-up turns', async () => {
    const messages = [
      { sender: 'customer' as const, content: 'Có sản phẩm X không?' },
      { sender: 'agent' as const, content: 'Có sản phẩm X.' },
      { sender: 'customer' as const, content: 'Giá bao nhiêu?' },
    ];
    await generateNativeAi({ messages }, 'test');
    expect(retrieveKnowledge).toHaveBeenCalledWith(expect.stringContaining('Có sản phẩm X không?'));
    expect(retrieveKnowledge).toHaveBeenCalledWith(expect.stringMatching(/^Giá bao nhiêu\?/));
    const request = JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body));
    expect(JSON.parse(request.messages[1].content).conversation).toEqual(messages);
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
