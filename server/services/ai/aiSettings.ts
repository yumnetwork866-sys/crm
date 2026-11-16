import { prisma } from '../../lib/prisma';
import {
  defaultRetrievalSettings,
  resolveRetrievalSettings,
} from '../../../shared/knowledgeRetrievalSettings';

export interface EmbeddingSettings {
  model: string;
  dimensions: number;
}
export const DEFAULT_EMBEDDING_MODEL = 'embeddinggemma:300m';
export const DEFAULT_EMBEDDING_DIMENSIONS = 768;
export const getAiConfig = async () => {
  const config = await prisma.aiConfiguration.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      model: process.env.AI_CHAT_MODEL || 'gemma4:latest',
      embeddingModel: process.env.AI_EMBEDDING_MODEL?.trim() || DEFAULT_EMBEDDING_MODEL,
    },
  });
  const configuredMinimum = Number(process.env.AI_EMBEDDING_MIN_SCORE || '0.55');
  return {
    ...config,
    retrievalSettings: resolveRetrievalSettings(config.retrievalSettings, {
      ...defaultRetrievalSettings,
      scoreThreshold:
        Number.isFinite(configuredMinimum) && configuredMinimum >= 0 && configuredMinimum <= 1
          ? configuredMinimum
          : 0.55,
    }),
  };
};
export async function getEmbeddingSettings(): Promise<EmbeddingSettings> {
  const config = await prisma.aiConfiguration.findUnique({
    where: { id: 'default' },
    select: { embeddingModel: true, embeddingDimensions: true },
  });
  return {
    model:
      config?.embeddingModel || process.env.AI_EMBEDDING_MODEL?.trim() || DEFAULT_EMBEDDING_MODEL,
    dimensions: config?.embeddingDimensions || DEFAULT_EMBEDDING_DIMENSIONS,
  };
}
