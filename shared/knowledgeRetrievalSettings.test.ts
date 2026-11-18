import { describe, expect, it } from 'vitest';
import {
  defaultRetrievalSettings,
  resolveRetrievalSettings,
  usesRerank,
} from './knowledgeRetrievalSettings';

describe('independent fusion and rerank settings', () => {
  it('converts the old rerank strategy into RRF with rerank enabled', () => {
    const settings = resolveRetrievalSettings({
      mode: 'hybrid',
      hybridStrategy: 'rerank',
      rerankEnabled: false,
    });
    expect(settings).toMatchObject({ version: 2, hybridStrategy: 'rrf', rerankEnabled: true });
    expect(resolveRetrievalSettings(settings)).toEqual(settings);
    expect(usesRerank(settings)).toBe(true);
  });
  it.each(['rrf', 'weighted'] as const)(
    'preserves old hybrid %s behavior when its previously ignored toggle was true',
    (hybridStrategy) => {
      const settings = resolveRetrievalSettings({
        mode: 'hybrid',
        hybridStrategy,
        rerankEnabled: true,
      });
      expect(settings).toMatchObject({ version: 2, hybridStrategy, rerankEnabled: false });
    },
  );
  it.each(['rrf', 'weighted'] as const)(
    'allows rerank to be enabled or disabled independently with %s',
    (hybridStrategy) => {
      for (const rerankEnabled of [true, false]) {
        const settings = resolveRetrievalSettings({
          ...defaultRetrievalSettings,
          hybridStrategy,
          rerankEnabled,
        });
        expect(settings.hybridStrategy).toBe(hybridStrategy);
        expect(usesRerank(settings)).toBe(rerankEnabled);
      }
    },
  );
  it.each(['keyword', 'vector'] as const)(
    'preserves legacy rerank switches for %s mode',
    (mode) => {
      for (const rerankEnabled of [true, false]) {
        expect(
          resolveRetrievalSettings({ mode, hybridStrategy: 'rerank', rerankEnabled }).rerankEnabled,
        ).toBe(rerankEnabled);
      }
    },
  );
  it('retains inherited settings for partial input without fusion or rerank fields', () => {
    const defaults = {
      ...defaultRetrievalSettings,
      hybridStrategy: 'rrf' as const,
      rerankEnabled: true,
    };
    expect(resolveRetrievalSettings({ topK: 3 }, defaults)).toEqual({ ...defaults, topK: 3 });
  });
});
