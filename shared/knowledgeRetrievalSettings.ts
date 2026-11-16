export const retrievalModes = ['hybrid', 'vector', 'keyword'] as const;
export type RetrievalMode = (typeof retrievalModes)[number];
export const hybridStrategies = ['rrf', 'weighted', 'rerank'] as const;
export type HybridStrategy = (typeof hybridStrategies)[number];

export interface RetrievalSettings {
  mode: RetrievalMode;
  topK: number;
  scoreThresholdEnabled: boolean;
  scoreThreshold: number;
  hybridStrategy: HybridStrategy;
  semanticWeight: number;
  rerankEnabled: boolean;
  rerankModel: string;
}

export const defaultRetrievalSettings: RetrievalSettings = {
  mode: 'hybrid',
  topK: 5,
  scoreThresholdEnabled: true,
  scoreThreshold: 0.55,
  hybridStrategy: 'weighted',
  semanticWeight: 0.7,
  rerankEnabled: false,
  rerankModel: 'qwen3:4b',
};

export function resolveRetrievalSettings(
  value: unknown,
  defaults = defaultRetrievalSettings,
): RetrievalSettings {
  const data = value && typeof value === 'object' ? (value as Partial<RetrievalSettings>) : {};
  return {
    rerankEnabled:
      typeof data.rerankEnabled === 'boolean' ? data.rerankEnabled : defaults.rerankEnabled,
    rerankModel:
      typeof data.rerankModel === 'string' && /^[\w.:/-]{1,100}$/.test(data.rerankModel)
        ? data.rerankModel
        : defaults.rerankModel,
    hybridStrategy: hybridStrategies.includes(data.hybridStrategy as HybridStrategy)
      ? data.hybridStrategy!
      : defaults.hybridStrategy,
    semanticWeight:
      typeof data.semanticWeight === 'number' &&
      Number.isFinite(data.semanticWeight) &&
      data.semanticWeight >= 0 &&
      data.semanticWeight <= 1
        ? data.semanticWeight
        : defaults.semanticWeight,
    mode: retrievalModes.includes(data.mode as RetrievalMode) ? data.mode! : defaults.mode,
    topK:
      Number.isInteger(data.topK) && data.topK! >= 1 && data.topK! <= 20
        ? data.topK!
        : defaults.topK,
    scoreThresholdEnabled:
      typeof data.scoreThresholdEnabled === 'boolean'
        ? data.scoreThresholdEnabled
        : defaults.scoreThresholdEnabled,
    scoreThreshold:
      typeof data.scoreThreshold === 'number' &&
      Number.isFinite(data.scoreThreshold) &&
      data.scoreThreshold >= 0 &&
      data.scoreThreshold <= 1
        ? data.scoreThreshold
        : defaults.scoreThreshold,
  };
}

export const usesRerank = (settings: RetrievalSettings) =>
  settings.mode === 'hybrid' ? settings.hybridStrategy === 'rerank' : settings.rerankEnabled;
