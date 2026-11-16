import { describe, expect, it } from 'vitest';
import {
  aiConfigSchema,
  aiOutputSchema,
  knowledgeQuery,
  knowledgeSchema,
  splitKnowledge,
  retrievalSettingsSchema,
  assistantConfigSchema,
  ragConfigSchema,
} from './contracts';
import { defaultChunkSettings } from '../../../shared/knowledgeChunking';

describe('native AI contracts and knowledge indexing', () => {
  it('scopes configuration writes so one tab cannot overwrite the other tab', () => {
    const assistant = {
      model: 'chat',
      suggestionsEnabled: true,
      autoReplyEnabled: false,
      timeoutMs: 45000,
      instructions: '',
    };
    expect(
      assistantConfigSchema.parse({ ...assistant, ragEnabled: false, embeddingModel: 'other' }),
    ).toEqual(assistant);
    expect(
      ragConfigSchema.parse({
        ragEnabled: true,
        model: 'other',
        instructions: 'other',
        aiProfile: { name: 'other', avatarUrl: null },
      }),
    ).toEqual({ ragEnabled: true });
  });
  it('validates retrieval modes, Top K and cosine thresholds', () => {
    const settings = { mode: 'hybrid', topK: 5, scoreThresholdEnabled: true, scoreThreshold: 0.55 };
    expect(retrievalSettingsSchema.safeParse(settings).success).toBe(true);
    for (const invalid of [
      { mode: 'rerank' },
      { hybridStrategy: 'unknown' },
      { semanticWeight: -0.1 },
      { semanticWeight: 1.1 },
      { topK: 0 },
      { topK: 21 },
      { topK: 1.5 },
      { scoreThreshold: -0.1 },
      { scoreThreshold: 1.1 },
    ]) {
      expect(retrievalSettingsSchema.safeParse({ ...settings, ...invalid }).success).toBe(false);
    }
  });
  it('accepts shared knowledge without a brand and ignores legacy brand input', () => {
    const document = {
      title: 'Chính sách',
      content: 'Nội dung dùng chung cho tất cả thương hiệu.',
    };
    expect(knowledgeSchema.parse(document)).toEqual({
      ...document,
      enabled: true,
      chunkSettings: defaultChunkSettings,
    });
    expect(knowledgeSchema.parse({ ...document, brand: 'Actiscar' })).toEqual({
      ...document,
      enabled: true,
      chunkSettings: defaultChunkSettings,
    });
  });
  it('builds a bounded full-text query without query operators from user input', () => {
    expect(knowledgeQuery("Shop ơi, mình hỏi chính sách đổi trả? ' | ! & :* ")).toBe(
      'hoi | chinh | sach | doi | tra',
    );
    expect(knowledgeQuery('Hi, xin chào bạn')).toBe('');
    expect(
      knowledgeQuery(Array.from({ length: 100 }, (_, i) => `token${i}`).join(' ')).split(' | '),
    ).toHaveLength(24);
  });
  it('splits documents with overlap and indexes their title', () => {
    const text = 'policy '.repeat(600);
    const chunks = splitKnowledge(text, 'Đổi trả');
    expect(chunks.length).toBeGreaterThan(3);
    expect(chunks[0].searchText).toContain('doi tra');
    expect(chunks.every((chunk) => chunk.content.length <= 1000)).toBe(true);
    expect(chunks.map((chunk) => chunk.ordinal)).toEqual(chunks.map((_, index) => index));
    expect(chunks[0].content.slice(-100)).toContain('policy');
    expect(chunks.at(-1)?.content.endsWith(text.trim().slice(-20))).toBe(true);
  });
  it('rejects malformed model output and unsafe runtime settings', () => {
    expect(aiOutputSchema.safeParse({ suggestions: ['Hello'] }).success).toBe(false);
    expect(
      aiOutputSchema.safeParse({
        suggestions: [],
        answer: '',
        shouldAutoReply: true,
        sourceIds: [],
        reason: '',
      }).success,
    ).toBe(false);
    expect(
      aiConfigSchema.safeParse({
        model: 'gemma4:latest',
        suggestionsEnabled: true,
        autoReplyEnabled: false,
        ragEnabled: true,
        timeoutMs: 1,
        instructions: '',
      }).success,
    ).toBe(false);
  });
});
