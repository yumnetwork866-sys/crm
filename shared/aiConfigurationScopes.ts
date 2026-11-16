import type { RetrievalSettings } from './knowledgeRetrievalSettings';

export type ConfigurationScope = 'assistant' | 'rag';
export interface ScopedAiConfiguration {
  model: string;
  suggestionsEnabled: boolean;
  autoReplyEnabled: boolean;
  instructions: string;
  timeoutMs: number;
  embeddingModel: string;
  ragEnabled: boolean;
  retrievalSettings: RetrievalSettings;
}
export const assistantConfigurationFields = [
  'model',
  'suggestionsEnabled',
  'autoReplyEnabled',
  'instructions',
  'timeoutMs',
] as const;
export const ragConfigurationFields = [
  'embeddingModel',
  'ragEnabled',
  'retrievalSettings',
] as const;

export function pickConfigurationScope(
  configuration: ScopedAiConfiguration,
  scope: ConfigurationScope,
) {
  const fields = scope === 'rag' ? ragConfigurationFields : assistantConfigurationFields;
  return Object.fromEntries(fields.map((field) => [field, configuration[field]]));
}

export function mergeConfigurationDraft<T extends ScopedAiConfiguration>(
  saved: T,
  draft: T | null,
  dirty: Record<ConfigurationScope, boolean>,
): T {
  const result = { ...saved };
  if (draft && dirty.assistant) Object.assign(result, pickConfigurationScope(draft, 'assistant'));
  if (draft && dirty.rag) Object.assign(result, pickConfigurationScope(draft, 'rag'));
  // Auto reply depends on the persisted RAG state, not an unsaved RAG toggle.
  if (!saved.ragEnabled) result.autoReplyEnabled = false;
  return result;
}
