import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { aiConfigSchema, AiFailure } from './contracts';
import { getAiConfig } from './aiSettings';
import { probeEmbeddingDimensions } from './embeddingService';
import { requireInstalledEmbeddingModel } from './ollamaModels';
import { resolveRetrievalSettings } from '../../../shared/knowledgeRetrievalSettings';

export async function saveAiConfiguration(input: Partial<z.infer<typeof aiConfigSchema>>) {
  const { aiProfile, retrievalSettings, ...settings } = input;
  const current = await getAiConfig();
  let dimensions = current.embeddingDimensions;
  if (input.embeddingModel && input.embeddingModel !== current.embeddingModel) {
    await requireInstalledEmbeddingModel(input.embeddingModel);
    dimensions = await probeEmbeddingDimensions(input.embeddingModel);
  }
  return prisma.$transaction(async (tx) => {
    const previous = await tx.aiConfiguration.findUniqueOrThrow({ where: { id: 'default' } });
    if (input.autoReplyEnabled === true && !(input.ragEnabled ?? previous.ragEnabled)) {
      throw new AiFailure(
        'RAG_REQUIRED',
        'configuration',
        'Bật và lưu RAG trước khi bật tự động trả lời.',
        400,
      );
    }
    const config = await tx.aiConfiguration.update({
      where: { id: 'default' },
      data: {
        ...settings,
        ...(input.ragEnabled === false ? { autoReplyEnabled: false } : {}),
        ...(retrievalSettings
          ? {
              retrievalSettings: {
                ...resolveRetrievalSettings(
                  retrievalSettings,
                  resolveRetrievalSettings(previous.retrievalSettings, current.retrievalSettings),
                ),
              },
            }
          : {}),
        ...(input.embeddingModel ? { embeddingDimensions: dimensions } : {}),
      },
    });
    const reindexing =
      previous.embeddingModel !== config.embeddingModel ||
      previous.embeddingDimensions !== config.embeddingDimensions;
    if (reindexing) {
      // Invalidate active leases atomically with the model change. Old batches cannot publish into the new index.
      await tx.aiKnowledgeDocument.updateMany({
        data: {
          embeddingStatus: 'pending',
          embeddingError: null,
          embeddingModel: null,
          indexingToken: null,
          indexingLeaseUntil: null,
        },
      });
    }
    if (aiProfile) {
      await tx.integrationSetting.upsert({
        where: { id: 'default' },
        update: { aiName: aiProfile.name, aiAvatarUrl: aiProfile.avatarUrl },
        create: { id: 'default', aiName: aiProfile.name, aiAvatarUrl: aiProfile.avatarUrl },
      });
    }
    return {
      config: {
        ...config,
        retrievalSettings: resolveRetrievalSettings(
          config.retrievalSettings,
          current.retrievalSettings,
        ),
      },
      reindexing,
      aiProfile,
    };
  });
}
