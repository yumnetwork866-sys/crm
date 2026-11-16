import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../lib/prisma', () => ({ prisma: { aiConfiguration: { upsert: vi.fn() } } }));
import { prisma } from '../../lib/prisma';
import { getAiConfig } from './aiSettings';
import { defaultRetrievalSettings } from '../../../shared/knowledgeRetrievalSettings';

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(prisma.aiConfiguration.upsert).mockResolvedValue({ retrievalSettings: {} } as any);
});
afterEach(() => vi.unstubAllEnvs());

describe('persisted retrieval configuration', () => {
  it('preserves the legacy environment threshold until retrieval settings are saved', async () => {
    vi.stubEnv('AI_EMBEDDING_MIN_SCORE', '0.72');
    expect((await getAiConfig()).retrievalSettings).toEqual({
      ...defaultRetrievalSettings,
      scoreThreshold: 0.72,
    });
  });
  it('uses persisted settings ahead of the environment value', async () => {
    vi.stubEnv('AI_EMBEDDING_MIN_SCORE', '0.72');
    const settings = {
      ...defaultRetrievalSettings,
      mode: 'vector',
      topK: 3,
      scoreThresholdEnabled: false,
      scoreThreshold: 0.4,
    };
    vi.mocked(prisma.aiConfiguration.upsert).mockResolvedValue({
      retrievalSettings: settings,
    } as any);
    expect((await getAiConfig()).retrievalSettings).toEqual(settings);
  });
  it('falls back to safe defaults for invalid legacy settings', async () => {
    vi.stubEnv('AI_EMBEDDING_MIN_SCORE', 'invalid');
    vi.mocked(prisma.aiConfiguration.upsert).mockResolvedValue({
      retrievalSettings: { mode: 'unknown', topK: -1, scoreThreshold: 3 },
    } as any);
    expect((await getAiConfig()).retrievalSettings).toEqual(defaultRetrievalSettings);
  });
});
