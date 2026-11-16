import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { aiConfigSchema } from './contracts';
import { getAiConfig } from './aiSettings';
import { probeEmbeddingDimensions } from './embeddingService';
import { requireInstalledEmbeddingModel } from './ollamaModels';
import { resolveRetrievalSettings } from '../../../shared/knowledgeRetrievalSettings';

export async function saveAiConfiguration(input: z.infer<typeof aiConfigSchema>) {
  const current = await getAiConfig();
  let dimensions = current.embeddingDimensions;
  if (input.embeddingModel && input.embeddingModel !== current.embeddingModel) {
    await requireInstalledEmbeddingModel(input.embeddingModel);
    dimensions = await probeEmbeddingDimensions(input.embeddingModel);
  }
  return prisma.$transaction(async (tx) => {
    const previous = await tx.aiConfiguration.findUniqueOrThrow({ where: { id: 'default' } });
    const config = await tx.aiConfiguration.update({
      where: { id: 'default' },
      data: {
        ...input,
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
    return {
      config: {
        ...config,
        retrievalSettings: resolveRetrievalSettings(
          config.retrievalSettings,
          current.retrievalSettings,
        ),
      },
      reindexing,
    };
  });
}
