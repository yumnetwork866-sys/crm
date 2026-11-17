import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { knowledgeQuery } from './contracts';
import { getAiConfig } from './aiSettings';
import { embedQuery, getEmbeddingVersion } from './embeddingService';
import { rerankKnowledge } from './rerankService';
import { usesRerank } from '../../../shared/knowledgeRetrievalSettings';
import type { AiTraceObserver } from '../../../shared/aiTrace';

export interface KnowledgeSource {
  id: string;
  documentId: string;
  title: string;
  brand: string;
  content: string;
  ordinal?: number;
  score: number;
  semanticScore?: number | null;
  keywordScore?: number | null;
  ranking?: 'rrf' | 'weighted' | 'rerank';
  rerankScore?: number;
  rerankModel?: string;
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
  trace?: AiTraceObserver,
): Promise<KnowledgeSource[]> {
  if (!question.trim()) return [];
  const config = await getAiConfig();
  const retrieval = config.retrievalSettings;
  const candidateLimit = Math.max(20, retrieval.topK * 4);
  const weighted = retrieval.mode === 'hybrid' && retrieval.hybridStrategy === 'weighted';
  const reranking = usesRerank(retrieval);
  const query = knowledgeQuery(question);
  trace?.({
    id: 'retrieval-config',
    title: 'Thiết lập truy xuất',
    status: 'completed',
    values: {
      question,
      keywordQuery: query,
      ...retrieval,
      embeddingModel: config.embeddingModel,
      dimensions: config.embeddingDimensions,
    },
  });
  const keywordStarted = Date.now();
  trace?.({
    id: 'keyword',
    title: 'Tìm kiếm full-text',
    status: retrieval.mode === 'vector' ? 'skipped' : 'running',
  });
  const keyword =
    retrieval.mode !== 'vector' && query
      ? await db.$queryRaw<KnowledgeSource[]>(Prisma.sql`
    SELECT c.id, c."documentId", d.title, d.brand, c.content, c.ordinal,
      ts_rank_cd(to_tsvector('simple', c."searchText"), to_tsquery('simple', ${query}))::float8 AS score
    FROM "AiKnowledgeChunk" c JOIN "AiKnowledgeDocument" d ON d.id = c."documentId"
    WHERE d.enabled = true
      AND to_tsvector('simple', c."searchText") @@ to_tsquery('simple', ${query})
    ORDER BY score DESC, d."updatedAt" DESC, c.id ASC LIMIT ${candidateLimit}
  `)
      : [];
  if (retrieval.mode !== 'vector')
    trace?.({
      id: 'keyword',
      title: 'Tìm kiếm full-text',
      status: 'completed',
      durationMs: Date.now() - keywordStarted,
      sources: keyword.map((source) => ({
        ...source,
        keywordScore: source.score,
        retrieval: 'keyword',
      })),
      detail: `${keyword.length} chunk ứng viên; điểm ts_rank_cd thô.`,
    });
  const rerank = (sources: KnowledgeSource[]) =>
    trace
      ? rerankKnowledge(question, sources, retrieval, config.timeoutMs, trace)
      : rerankKnowledge(question, sources, retrieval, config.timeoutMs);
  const withoutRerank = (sources: KnowledgeSource[]) => {
    trace?.({
      id: 'rerank',
      title: 'Rerank',
      status: 'skipped',
      detail: 'Không bật rerank trong cấu hình truy xuất hiện tại.',
    });
    return sources;
  };
  const finishHybrid = (semantic: KnowledgeSource[]) => {
    const candidates = weighted
      ? fuseWeightedKnowledgeResults(
          keyword,
          semantic,
          retrieval.semanticWeight,
          candidateLimit * 2,
        )
      : fuseKnowledgeResults(keyword, semantic, candidateLimit * 2);
    trace?.({
      id: 'fusion',
      title: 'Kết hợp kết quả hybrid',
      status: 'completed',
      sources: candidates,
      detail: weighted
        ? 'Điểm = semanticWeight × cosine + (1 − semanticWeight) × rank / (1 + rank).'
        : 'Reciprocal Rank Fusion (RRF): cộng 1 / (60 + thứ hạng) từ từng nhánh.',
    });
    if (reranking) return rerank(candidates);
    const results = candidates.slice(0, retrieval.topK);
    return withoutRerank(
      weighted && retrieval.scoreThresholdEnabled
        ? results.filter((source) => source.score >= retrieval.scoreThreshold)
        : results,
    );
  };
  if (retrieval.mode === 'keyword') {
    trace?.({
      id: 'embedding',
      title: 'Embedding câu hỏi',
      status: 'skipped',
      detail: 'Chế độ full-text không dùng vector.',
    });
    trace?.({ id: 'vector', title: 'Tìm kiếm vector', status: 'skipped' });
    if (reranking) return rerank(keyword);
    return withoutRerank(
      keyword.slice(0, retrieval.topK).map((source) => ({ ...source, retrieval: 'keyword' })),
    );
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
  if (!indexed) {
    trace?.({
      id: 'embedding',
      title: 'Embedding câu hỏi',
      status: 'skipped',
      detail: 'Chưa có chunk được index bằng model hiện tại.',
    });
    trace?.({ id: 'vector', title: 'Tìm kiếm vector', status: 'skipped' });
    if (retrieval.mode !== 'vector') return finishHybrid([]);
    if (reranking) return rerank([]);
    return withoutRerank([]);
  }
  const embeddingStarted = Date.now();
  trace?.({ id: 'embedding', title: 'Embedding câu hỏi', status: 'running', values: settings });
  const vector = await embedQuery(question, settings);
  trace?.({
    id: 'embedding',
    title: 'Embedding câu hỏi',
    status: 'completed',
    durationMs: Date.now() - embeddingStarted,
    values: { ...settings, actualDimensions: vector.length },
  });
  const scoreCondition =
    retrieval.scoreThresholdEnabled && !weighted && !reranking
      ? Prisma.sql`AND crm_ai_cosine(c.embedding, ${vector}::real[]) >= ${retrieval.scoreThreshold}`
      : Prisma.empty;
  const vectorStarted = Date.now();
  trace?.({ id: 'vector', title: 'Tìm kiếm vector', status: 'running' });
  const semantic = await db.$queryRaw<KnowledgeSource[]>(Prisma.sql`
    SELECT c.id, c."documentId", d.title, d.brand, c.content, c.ordinal,
      crm_ai_cosine(c.embedding, ${vector}::real[]) AS score
    FROM "AiKnowledgeChunk" c JOIN "AiKnowledgeDocument" d ON d.id = c."documentId"
    WHERE d.enabled = true
      AND c."embeddingModel" = ${version}
      ${scoreCondition}
    ORDER BY score DESC, c.id ASC LIMIT ${candidateLimit}
  `);
  trace?.({
    id: 'vector',
    title: 'Tìm kiếm vector',
    status: 'completed',
    durationMs: Date.now() - vectorStarted,
    sources: semantic.map((source) => ({
      ...source,
      semanticScore: source.score,
      retrieval: 'vector',
    })),
    detail: `${semantic.length} chunk ứng viên theo cosine${retrieval.scoreThresholdEnabled && !weighted && !reranking ? `, đã lọc ngưỡng ${retrieval.scoreThreshold}` : ', chưa lọc ngưỡng ở nhánh vector'}.`,
  });
  if (retrieval.mode === 'vector') {
    if (reranking)
      return rerank(
        semantic.map((source) => ({ ...source, semanticScore: source.score, retrieval: 'vector' })),
      );
    return withoutRerank(
      semantic
        .slice(0, retrieval.topK)
        .map((source) => ({ ...source, semanticScore: source.score, retrieval: 'vector' })),
    );
  }
  return finishHybrid(semantic);
}
