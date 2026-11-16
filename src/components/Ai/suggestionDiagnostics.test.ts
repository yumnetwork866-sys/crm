import { describe, expect, it } from 'vitest';
import { inspectSuggestionResponse } from './suggestionDiagnostics';

describe('AI suggestion diagnostics', () => {
  it('distinguishes AI output from fallback templates', () => {
    for (const source of ['ai', 'smart_suggestions']) {
      const result = inspectSuggestionResponse({
        success: true,
        source,
        suggestions: [' Xin chào '],
      });
      expect(result.valid).toBe(true);
      expect(result.source).toBe(source);
      expect(result.suggestions).toEqual(['Xin chào']);
    }
  });

  it.each([
    null,
    { success: false, source: 'ai', suggestions: ['Hello'] },
    { success: true, suggestions: ['Hello'] },
    { success: true, source: 'ai', suggestions: [] },
    { success: true, source: 'ai', suggestions: [' '] },
    { success: true, source: 'ai', suggestions: [{ text: 'Hello' }] },
    { success: true, source: 'ai', suggestions: ['a', 'b', 'c', 'd'] },
  ])('rejects malformed output without presenting it as AI success: %j', (payload) => {
    const result = inspectSuggestionResponse(payload);
    expect(result.valid).toBe(false);
    expect(result.suggestions).toEqual([]);
    expect(result.issues.length).toBeGreaterThan(0);
  });
});
