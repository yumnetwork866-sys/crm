export const retrievalModes = ['hybrid', 'vector', 'keyword'] as const;
export type RetrievalMode = (typeof retrievalModes)[number];
export const hybridStrategies = ['rrf', 'weighted'] as const;
export type HybridStrategy = (typeof hybridStrategies)[number];

export interface RetrievalSettings {
  mode: RetrievalMode;
  topK: number;
  scoreThresholdEnabled: boolean;
  scoreThreshold: number;
  hybridStrategy: HybridStrategy;
  semanticWeight: number;
}

export const defaultRetrievalSettings: RetrievalSettings = {
  mode: 'hybrid',
  topK: 5,
  scoreThresholdEnabled: true,
  scoreThreshold: 0.55,
  hybridStrategy: 'rrf',
  semanticWeight: 0.7,
};

export function resolveRetrievalSettings(
  value: unknown,
  defaults = defaultRetrievalSettings,
): RetrievalSettings {
  const data = value && typeof value === 'object' ? (value as Partial<RetrievalSettings>) : {};
  return {
    hybridStrategy: hybridStrategies.includes(data.hybridStrategy as HybridStrategy)
      ? data.hybridStrategy! : defaults.hybridStrategy,
    semanticWeight: typeof data.semanticWeight === 'number' && Number.isFinite(data.semanticWeight)
      && data.semanticWeight >= 0 && data.semanticWeight <= 1 ? data.semanticWeight : defaults.semanticWeight,
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
