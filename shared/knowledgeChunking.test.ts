import { describe, expect, it } from 'vitest';
import { chunkSettingsError, defaultChunkSettings, splitKnowledge } from './knowledgeChunking';

describe('shared document chunking for preview and indexing', () => {
  it('uses custom delimiters as literal text and respects the maximum length', () => {
    const chunks = splitKnowledge('a'.repeat(80) + '||' + 'b'.repeat(80), 'Title', {
      ...defaultChunkSettings,
      delimiter: '||',
      maxLength: 100,
      overlap: 0,
    });
    expect(chunks.map((chunk) => chunk.content)).toEqual(['a'.repeat(80) + '||', 'b'.repeat(80)]);
  });

  it('supports escaped newlines and preserves paragraph boundaries', () => {
    const chunks = splitKnowledge('a'.repeat(80) + '\n' + 'b'.repeat(80), 'Title', {
      ...defaultChunkSettings,
      maxLength: 100,
      overlap: 0,
    });
    expect(chunks.map((chunk) => chunk.content)).toEqual(['a'.repeat(80), 'b'.repeat(80)]);
  });

  it('retains the configured overlap when splitting uninterrupted text', () => {
    const content = Array.from({ length: 180 }, (_, index) =>
      String.fromCharCode(0x400 + index),
    ).join('');
    const chunks = splitKnowledge(content, 'Title', {
      ...defaultChunkSettings,
      maxLength: 100,
      overlap: 20,
    });
    expect(chunks).toHaveLength(2);
    expect(chunks[0].content.slice(-20)).toBe(chunks[1].content.slice(0, 20));
    expect(chunks[1].content).toBe(content.slice(80));
  });

  it('always advances even when overlap is near the maximum length', () => {
    const chunks = splitKnowledge('x'.repeat(130), 'Title', {
      ...defaultChunkSettings,
      maxLength: 64,
      overlap: 63,
    });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.length).toBeLessThan(130);
    expect(chunks.every((chunk) => chunk.content.length <= 64)).toBe(true);
  });

  it('normalizes whitespace without losing paragraph separation', () => {
    const chunks = splitKnowledge('First\t  paragraph.\r\n\r\n\r\n Second  paragraph.', 'Title', {
      ...defaultChunkSettings,
      normalizeWhitespace: true,
    });
    expect(chunks[0].content).toBe('First paragraph.\n\nSecond paragraph.');
  });

  it('removes URLs and email addresses only when requested', () => {
    const content = 'Liên hệ support@example.com hoặc https://example.com/help và www.example.com.';
    expect(splitKnowledge(content, 'Title')[0].content).toBe(content);
    const result = splitKnowledge(content, 'Title', {
      ...defaultChunkSettings,
      removeUrlsAndEmails: true,
    });
    expect(result[0].content).not.toMatch(/https|www|@/);
    expect(result[0].searchText).not.toContain('example');
  });

  it('returns no chunks when preprocessing removes all content', () => {
    expect(
      splitKnowledge('https://example.com', 'Title', {
        ...defaultChunkSettings,
        removeUrlsAndEmails: true,
      }),
    ).toEqual([]);
  });

  it.each([{ maxLength: 0 }, { maxLength: NaN }, { overlap: -1 }, { overlap: 1000 }])(
    'rejects invalid settings: %j',
    (updates) => {
      const settings = { ...defaultChunkSettings, ...updates };
      expect(chunkSettingsError(settings)).not.toBe('');
      expect(() => splitKnowledge('some content', 'Title', settings)).toThrow();
    },
  );
});
