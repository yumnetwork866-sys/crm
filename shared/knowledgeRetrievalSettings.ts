export const retrievalModes = ['hybrid', 'vector', 'keyword'] as const;
export type RetrievalMode = (typeof retrievalModes)[number];
export const hybridStrategies = ['rrf', 'weighted'] as const;
export type HybridStrategy = (typeof hybridStrategies)[number];

export interface RetrievalSettings {
  version: 2;
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
  version: 2,
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
  const data =
    value && typeof value === 'object'
      ? (value as Omit<Partial<RetrievalSettings>, 'hybridStrategy'> & {
          hybridStrategy?: HybridStrategy | 'rerank';
        })
      : {};
  const mode = retrievalModes.includes(data.mode as RetrievalMode) ? data.mode! : defaults.mode;
  // Older hybrid settings encoded reranking in the strategy and ignored its toggle.
  const legacyHybrid =
    data.version !== 2 &&
    mode === 'hybrid' &&
    (data.hybridStrategy !== undefined || data.rerankEnabled !== undefined);
  return {
    version: 2,
    rerankEnabled:
      legacyHybrid || (data.hybridStrategy === 'rerank' && mode === 'hybrid')
        ? data.hybridStrategy === 'rerank'
        : typeof data.rerankEnabled === 'boolean'
          ? data.rerankEnabled
          : defaults.rerankEnabled,
    rerankModel:
      typeof data.rerankModel === 'string' && /^[\w.:/-]{1,100}$/.test(data.rerankModel)
        ? data.rerankModel
        : defaults.rerankModel,
    hybridStrategy:
      data.hybridStrategy === 'rerank'
        ? 'rrf'
        : hybridStrategies.includes(data.hybridStrategy as HybridStrategy)
          ? (data.hybridStrategy as HybridStrategy)
          : defaults.hybridStrategy,
    semanticWeight:
      typeof data.semanticWeight === 'number' &&
      Number.isFinite(data.semanticWeight) &&
      data.semanticWeight >= 0 &&
      data.semanticWeight <= 1
        ? data.semanticWeight
        : defaults.semanticWeight,
    mode,
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

export const usesRerank = (settings: RetrievalSettings) => settings.rerankEnabled;
