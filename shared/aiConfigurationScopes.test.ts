import { describe, expect, it } from 'vitest';
import { mergeConfigurationDraft, pickConfigurationScope } from './aiConfigurationScopes';
import { defaultRetrievalSettings } from './knowledgeRetrievalSettings';

const saved = {
  model: 'chat',
  suggestionsEnabled: true,
  autoReplyEnabled: false,
  instructions: 'Saved guidance',
  timeoutMs: 45000,
  embeddingModel: 'embed',
  ragEnabled: true,
  retrievalSettings: { ...defaultRetrievalSettings },
};

describe('assistant and RAG configuration drafts', () => {
  it('only includes fields owned by the scope in its save payload', () => {
    expect(pickConfigurationScope(saved, 'assistant')).toEqual({
      model: 'chat',
      suggestionsEnabled: true,
      autoReplyEnabled: false,
      instructions: 'Saved guidance',
      timeoutMs: 45000,
    });
    expect(pickConfigurationScope(saved, 'rag')).toEqual({
      embeddingModel: 'embed',
      ragEnabled: true,
      retrievalSettings: defaultRetrievalSettings,
    });
  });
  it('keeps unsaved RAG edits after saving the assistant', () => {
    const draft = {
      ...saved,
      instructions: 'New guidance',
      embeddingModel: 'next-embed',
      retrievalSettings: { ...defaultRetrievalSettings, topK: 9 },
    };
    const result = mergeConfigurationDraft({ ...saved, instructions: 'New guidance' }, draft, {
      assistant: false,
      rag: true,
    });
    expect(result.embeddingModel).toBe('next-embed');
    expect(result.retrievalSettings.topK).toBe(9);
    expect(result.instructions).toBe('New guidance');
  });
  it('keeps assistant edits after saving RAG but disables auto reply when RAG is turned off', () => {
    const draft = { ...saved, instructions: 'Unsaved guidance', autoReplyEnabled: true };
    const result = mergeConfigurationDraft({ ...saved, ragEnabled: false }, draft, {
      assistant: true,
      rag: false,
    });
    expect(result.instructions).toBe('Unsaved guidance');
    expect(result.autoReplyEnabled).toBe(false);
    expect(result.ragEnabled).toBe(false);
  });
  it('keeps auto reply enabled when RAG is enabled in the same draft', () => {
    const result = mergeConfigurationDraft(
      { ...saved, ragEnabled: false },
      { ...saved, autoReplyEnabled: true },
      { assistant: true, rag: true },
    );
    expect(result.ragEnabled).toBe(true);
    expect(result.autoReplyEnabled).toBe(true);
  });
});
