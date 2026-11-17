import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const messageDb = vi.hoisted(() => ({ findUnique: vi.fn(), updateMany: vi.fn() }));
vi.mock('../lib/prisma', () => ({
  prisma: { whatsAppMessage: messageDb },
}));
vi.mock('./realtimeHub', () => ({ realtimeHub: { broadcast: vi.fn() } }));
vi.mock('./ollamaTranslationService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./ollamaTranslationService')>()),
  translateWithOllama: vi.fn(),
}));
import { realtimeHub } from './realtimeHub';
import { translateWithOllama } from './ollamaTranslationService';
import {
  getStoredTranslationText,
  needsIncomingTranslation,
  processIncomingTranslation,
  translateStoredMessage,
} from './messageTranslationService';

const rows = new Map<string, Record<string, unknown>>();
beforeEach(() => {
  vi.clearAllMocks();
  rows.clear();
  for (const id of ['one', 'two'])
    rows.set(id, { id, sender: 'customer', content: `Hello ${id}`, translatedContent: null });
  messageDb.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => {
    const row = rows.get(where.id);
    return row ? { ...row } : null;
  });
  messageDb.updateMany.mockImplementation(
    async ({
      where,
      data,
    }: {
      where: { id: string; content: string };
      data: Record<string, unknown>;
    }) => {
      const row = rows.get(where.id);
      if (!row || row.content !== where.content) return { count: 0 };
      Object.assign(row, data);
      return { count: 1 };
    },
  );
  vi.mocked(translateWithOllama).mockResolvedValue({
    translation: 'Xin chào',
    targetLanguage: 'vi',
    model: 'test-model',
  });
});
afterEach(() => vi.unstubAllEnvs());

describe('background message translation', () => {
  it('extracts captions and reply text without translating URLs, products or orders', () => {
    expect(getStoredTranslationText('[reply:{"content":"Old text"}]\nHello')).toBe('Hello');
    expect(getStoredTranslationText('/api/meta/media/image-id?phoneId=123\nHow much?')).toBe(
      'How much?',
    );
    expect(needsIncomingTranslation('/api/meta/media/audio-id?type=audio')).toBe(false);
    expect(needsIncomingTranslation('[whatsapp_order:{"items":[]} ]')).toBe(false);
    expect(needsIncomingTranslation('[image]')).toBe(false);
    expect(needsIncomingTranslation('[product:{"name":"Serum"}]')).toBe(false);
    expect(getStoredTranslationText('[product:{"name":"Serum"}]\nHow much?')).toBe('How much?');
    expect(needsIncomingTranslation('Dạ mình cảm ơn')).toBe(false);
    expect(needsIncomingTranslation('😀')).toBe(false);
    expect(needsIncomingTranslation('x'.repeat(5001))).toBe(false);
    expect(needsIncomingTranslation('Berapa harga?')).toBe(true);
    vi.stubEnv('AUTO_TRANSLATE_INCOMING', 'false');
    expect(needsIncomingTranslation('Berapa harga?')).toBe(false);
  });
  it('serializes manual and background requests and coalesces the same message', async () => {
    let release!: (value: any) => void;
    vi.mocked(translateWithOllama).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const first = translateStoredMessage('one');
    const duplicate = translateStoredMessage('one');
    const second = processIncomingTranslation({ messageId: 'two' });
    expect(duplicate).toBe(first);
    await vi.waitFor(() => expect(translateWithOllama).toHaveBeenCalledTimes(1));
    expect(vi.mocked(translateWithOllama).mock.calls[0][0].text).toBe('Hello one');
    release({ translation: 'Một', targetLanguage: 'vi', model: 'test-model' });
    await Promise.all([first, duplicate, second]);
    expect(translateWithOllama).toHaveBeenCalledTimes(2);
    expect(realtimeHub.broadcast).toHaveBeenCalledTimes(2);
    await processIncomingTranslation({ messageId: 'one' });
    expect(translateWithOllama).toHaveBeenCalledTimes(2);
  });
  it('continues with the next message after a failure and allows retrying the failed message', async () => {
    vi.mocked(translateWithOllama).mockRejectedValueOnce(new Error('Model timeout'));
    const failed = expect(translateStoredMessage('one')).rejects.toThrow('Model timeout');
    const next = translateStoredMessage('two');
    await failed;
    await next;
    expect(realtimeHub.broadcast).toHaveBeenCalledTimes(1);
    await translateStoredMessage('one');
    expect(realtimeHub.broadcast).toHaveBeenCalledTimes(2);
  });
  it('does not publish a stale translation when the message changes while translating', async () => {
    vi.mocked(translateWithOllama).mockImplementationOnce(async () => {
      rows.get('one')!.content = 'Changed';
      return { translation: 'Old translation', targetLanguage: 'vi', model: 'test-model' };
    });
    await expect(translateStoredMessage('one')).rejects.toThrow('đã thay đổi');
    expect(realtimeHub.broadcast).not.toHaveBeenCalled();
  });
  it('skips deleted messages, agent messages and Vietnamese in background jobs', async () => {
    rows.get('one')!.sender = 'agent';
    rows.get('two')!.content = 'Xin chào bạn';
    await processIncomingTranslation({ messageId: 'missing' });
    await processIncomingTranslation({ messageId: 'one' });
    await processIncomingTranslation({ messageId: 'two' });
    expect(translateWithOllama).not.toHaveBeenCalled();
  });
});
