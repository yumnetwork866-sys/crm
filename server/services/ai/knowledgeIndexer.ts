import { randomUUID } from 'node:crypto';
import { prisma } from '../../lib/prisma';
import { createLogger } from '../../lib/logger';
import { getEmbeddingSettings } from './aiSettings';
import { embedTexts, getEmbeddingVersion, formatEmbeddingDocument } from './embeddingService';

const log = createLogger('knowledge-indexer');
let working = false;
let timer: ReturnType<typeof setInterval> | undefined;

export async function processKnowledgeIndex() {
  if (working) return;
  working = true;
  const now = new Date();
  const available = {
    OR: [
      { embeddingStatus: 'pending' },
      { embeddingStatus: 'indexing', indexingLeaseUntil: { lt: now } },
    ],
  };
  let document: { id: string; title: string } | null = null;
  const token = randomUUID();
  try {
    document = await prisma.aiKnowledgeDocument.findFirst({
      where: available,
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      select: { id: true, title: true },
    });
    if (!document) return;
    const id = document.id;
    const claim = await prisma.aiKnowledgeDocument.updateMany({
      where: { id, ...available },
      data: {
        embeddingStatus: 'indexing',
        embeddingError: null,
        indexingToken: token,
        indexingLeaseUntil: new Date(Date.now() + 180000),
      },
    });
    if (!claim.count) return;
    const settings = await getEmbeddingSettings();
    const version = getEmbeddingVersion(settings);
    while (true) {
      const current = await prisma.aiKnowledgeDocument.findUnique({
        where: { id },
        select: { indexingToken: true },
      });
      if (current?.indexingToken !== token) return;
      const chunks = await prisma.aiKnowledgeChunk.findMany({
        where: {
          documentId: id,
          OR: [{ embeddingModel: null }, { embeddingModel: { not: version } }],
        },
        orderBy: { ordinal: 'asc' },
        take: 6,
        select: { id: true, content: true },
      });
      if (!chunks.length) break;
      const vectors = await embedTexts(
        chunks.map((chunk) =>
          formatEmbeddingDocument(document!.title, chunk.content, settings.model),
        ),
        settings,
      );
      await prisma.$transaction(async (tx) => {
        const lease = await tx.aiKnowledgeDocument.updateMany({
          where: { id, indexingToken: token },
          data: { indexingLeaseUntil: new Date(Date.now() + 180000) },
        });
        if (!lease.count) return;
        for (let index = 0; index < chunks.length; index++) {
          await tx.aiKnowledgeChunk.updateMany({
            where: { id: chunks[index].id, documentId: id },
            data: { embedding: vectors[index], embeddingModel: version },
          });
        }
      });
    }
    await prisma.aiKnowledgeDocument.updateMany({
      where: { id, indexingToken: token },
      data: {
        embeddingStatus: 'ready',
        embeddingModel: version,
        embeddingError: null,
        indexingToken: null,
        indexingLeaseUntil: null,
      },
    });
    log.info({ documentId: id, model: version }, 'Knowledge embedding completed');
  } catch (error) {
    log.error({ err: error, documentId: document?.id }, 'Knowledge embedding failed');
    if (document)
      await prisma.aiKnowledgeDocument
        .updateMany({
          where: { id: document.id, indexingToken: token },
          data: {
            embeddingStatus: 'error',
            embeddingError:
              error instanceof Error
                ? error.message.slice(0, 600)
                : 'Không lập được chỉ mục embedding.',
            indexingToken: null,
            indexingLeaseUntil: null,
          },
        })
        .catch((writeError) => log.error({ err: writeError }, 'Cannot save indexing error'));
  } finally {
    working = false;
  }
}

export function scheduleKnowledgeIndex() {
  void processKnowledgeIndex();
}
export function startKnowledgeIndexer() {
  if (timer) return;
  timer = setInterval(() => void processKnowledgeIndex(), 5000);
  timer.unref();
  void getEmbeddingSettings()
    .then((settings) =>
      prisma.aiKnowledgeDocument.updateMany({
        where: {
          embeddingStatus: 'ready',
          OR: [
            { embeddingModel: null },
            { embeddingModel: { not: getEmbeddingVersion(settings) } },
          ],
        },
        data: {
          embeddingStatus: 'pending',
          embeddingError: null,
          indexingToken: null,
          indexingLeaseUntil: null,
        },
      }),
    )
    .then(() => processKnowledgeIndex())
    .catch((error) => log.error({ err: error }, 'Cannot check embedding index version'));
}
