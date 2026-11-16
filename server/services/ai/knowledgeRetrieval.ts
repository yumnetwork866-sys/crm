import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { knowledgeQuery } from './contracts';
import { getAiConfig } from './aiSettings';
import { embedQuery, getEmbeddingVersion } from './embeddingService';

export interface KnowledgeSource {
  id: string;
  documentId: string;
  title: string;
  brand: string;
  content: string;
  score: number;
  semanticScore?: number | null;
  keywordScore?: number | null;
  ranking?: 'rrf' | 'weighted';
  retrieval?: 'hybrid' | 'keyword' | 'vector';
}

export function fuseWeightedKnowledgeResults(
  keyword: KnowledgeSource[],
  semantic: KnowledgeSource[],
  semanticWeight: number,
  limit = 5,
): KnowledgeSource[] {
  const results = new Map<string, KnowledgeSource>();
  for (const source of keyword) {
    // PostgreSQL lexical ranks are unbounded; map rank to rank / (1 + rank).
    const rank = Math.max(0, source.score);
    const keywordScore = rank / (1 + rank);
    results.set(source.id, {
      ...source,
      keywordScore,
      semanticScore: null,
      score: (1 - semanticWeight) * keywordScore,
      retrieval: 'keyword',
      ranking: 'weighted',
    });
  }
  for (const source of semantic) {
    const previous = results.get(source.id);
    const semanticScore = Math.min(1, Math.max(0, source.score));
    results.set(source.id, {
      ...source,
      keywordScore: previous?.keywordScore ?? null,
      semanticScore,
      score: (previous?.score || 0) + semanticWeight * semanticScore,
      retrieval: previous ? 'hybrid' : 'vector',
      ranking: 'weighted',
    });
  }
  return [...results.values()]
    .filter((source) => source.score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, limit);
}

export function fuseKnowledgeResults(
  keyword: KnowledgeSource[],
  semantic: KnowledgeSource[],
  limit = 5,
): KnowledgeSource[] {
  const results = new Map<string, KnowledgeSource>();
  for (const [kind, matches] of [
    ['keyword', keyword],
    ['vector', semantic],
  ] as const) {
    matches.forEach((source, index) => {
      const previous = results.get(source.id);
      results.set(source.id, {
        ...source,
        semanticScore: kind === 'vector' ? source.score : previous?.semanticScore,
        score: (previous?.score || 0) + 1 / (60 + index + 1),
        retrieval: previous ? 'hybrid' : kind,
        ranking: 'rrf',
      });
    });
  }
  return [...results.values()]
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, limit);
}

export async function retrieveKnowledge(
  question: string,
  db: Pick<typeof prisma, '$queryRaw' | 'aiKnowledgeChunk'> = prisma,
): Promise<KnowledgeSource[]> {
  if (!question.trim()) return [];
  const config = await getAiConfig();
  const retrieval = config.retrievalSettings;
  const candidateLimit = Math.max(20, retrieval.topK * 4);
  const weighted = retrieval.mode === 'hybrid' && retrieval.hybridStrategy === 'weighted';
  const query = knowledgeQuery(question);
  const keyword =
    retrieval.mode !== 'vector' && query
      ? await db.$queryRaw<KnowledgeSource[]>(Prisma.sql`
    SELECT c.id, c."documentId", d.title, d.brand, c.content,
      ts_rank_cd(to_tsvector('simple', c."searchText"), to_tsquery('simple', ${query}))::float8 AS score
    FROM "AiKnowledgeChunk" c JOIN "AiKnowledgeDocument" d ON d.id = c."documentId"
    WHERE d.enabled = true
      AND to_tsvector('simple', c."searchText") @@ to_tsquery('simple', ${query})
    ORDER BY score DESC, d."updatedAt" DESC, c.id ASC LIMIT ${candidateLimit}
  `)
      : [];
  const finishHybrid = (semantic: KnowledgeSource[]) => {
    if (!weighted) return fuseKnowledgeResults(keyword, semantic, retrieval.topK);
    const results = fuseWeightedKnowledgeResults(
      keyword,
      semantic,
      retrieval.semanticWeight,
      retrieval.topK,
    );
    return retrieval.scoreThresholdEnabled
      ? results.filter((source) => source.score >= retrieval.scoreThreshold)
      : results;
  };
  if (retrieval.mode === 'keyword') {
    return keyword.slice(0, retrieval.topK).map((source) => ({ ...source, retrieval: 'keyword' }));
  }
  const settings = { model: config.embeddingModel, dimensions: config.embeddingDimensions };
  const version = getEmbeddingVersion(settings);
  const indexed = await db.aiKnowledgeChunk.count({
    where: {
      embeddingModel: version,
      document: { enabled: true },
    },
  });
  // New or failed documents remain available to lexical search; sources identify the mode.
  if (!indexed) return retrieval.mode === 'vector' ? [] : finishHybrid([]);
  const vector = await embedQuery(question, settings);
  const scoreCondition =
    retrieval.scoreThresholdEnabled && !weighted
      ? Prisma.sql`AND crm_ai_cosine(c.embedding, ${vector}::real[]) >= ${retrieval.scoreThreshold}`
      : Prisma.empty;
  const semantic = await db.$queryRaw<KnowledgeSource[]>(Prisma.sql`
    SELECT c.id, c."documentId", d.title, d.brand, c.content,
      crm_ai_cosine(c.embedding, ${vector}::real[]) AS score
    FROM "AiKnowledgeChunk" c JOIN "AiKnowledgeDocument" d ON d.id = c."documentId"
    WHERE d.enabled = true
      AND c."embeddingModel" = ${version}
      ${scoreCondition}
    ORDER BY score DESC, c.id ASC LIMIT ${candidateLimit}
  `);
  if (retrieval.mode === 'vector') {
    return semantic
      .slice(0, retrieval.topK)
      .map((source) => ({ ...source, semanticScore: source.score, retrieval: 'vector' }));
  }
  return finishHybrid(semantic);
}
