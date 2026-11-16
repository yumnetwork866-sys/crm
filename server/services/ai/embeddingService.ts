import { createHash } from 'node:crypto';
import { AiFailure } from './contracts';

import {
  getEmbeddingSettings,
  DEFAULT_EMBEDDING_DIMENSIONS,
  type EmbeddingSettings,
} from './aiSettings';
export const EMBEDDING_DIMENSIONS = DEFAULT_EMBEDDING_DIMENSIONS;
export const getEmbeddingVersion = (settings: EmbeddingSettings) =>
  `${settings.model}|${settings.dimensions}|retrieval-v1`;
export const formatEmbeddingQuery = (text: string, model: string) =>
  /^embeddinggemma(?::|$)/i.test(model) ? `task: search result | query: ${text}` : text;
export const formatEmbeddingDocument = (title: string, content: string, model: string) =>
  /^embeddinggemma(?::|$)/i.test(model)
    ? `title: ${title} | text: ${content}`
    : `${title}\n${content}`;
const queryCache = new Map<string, { expires: number; vector: number[] }>();
const inFlight = new Map<string, Promise<number[]>>();

export function normalizeEmbedding(value: unknown, dimensions?: number): number[] {
  if (
    !Array.isArray(value) ||
    value.length < 8 ||
    value.length > 8192 ||
    (dimensions !== undefined && value.length !== dimensions) ||
    value.some((item) => typeof item !== 'number' || !Number.isFinite(item))
  ) {
    throw new AiFailure(
      'INVALID_EMBEDDING',
      'embedding',
      'Model trả vector không hợp lệ hoặc sai số chiều.',
    );
  }
  const norm = Math.sqrt(value.reduce((sum, item) => sum + item * item, 0));
  if (!Number.isFinite(norm) || norm === 0)
    throw new AiFailure('INVALID_EMBEDDING', 'embedding', 'Model trả vector rỗng.');
  return value.map((item) => item / norm);
}

async function requestEmbeddings(
  texts: string[],
  settings: { model: string; dimensions?: number },
): Promise<number[][]> {
  if (!texts.length) return [];
  if (texts.length > 8)
    throw new AiFailure(
      'EMBEDDING_BATCH_LIMIT',
      'embedding',
      'Mỗi lượt lập chỉ mục tối đa 8 đoạn.',
      400,
    );
  const signal = AbortSignal.timeout(90000);
  try {
    const res = await fetch(
      `${(process.env.OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/+$/, '')}/api/embed`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: settings.model,
          input: texts,
          truncate: false,
          keep_alive: '10m',
        }),
        signal,
      },
    );
    const payload = await res.json().catch(() => null);
    if (signal.aborted)
      throw new AiFailure(
        'EMBEDDING_TIMEOUT',
        'embedding',
        'Model embedding vượt quá thời gian chờ 90 giây.',
        504,
      );
    if (!res.ok)
      throw new AiFailure(
        'EMBEDDING_HTTP_ERROR',
        'embedding',
        `Embedding HTTP ${res.status}: ${String(payload?.error || 'Không có chi tiết').slice(0, 300)}`,
      );
    if (!Array.isArray(payload?.embeddings) || payload.embeddings.length !== texts.length) {
      throw new AiFailure(
        'INVALID_EMBEDDING',
        'embedding',
        'Số vector nhận được không khớp với số đoạn.',
      );
    }
    return payload.embeddings.map((vector: unknown) =>
      normalizeEmbedding(vector, settings.dimensions),
    );
  } catch (error) {
    if (error instanceof AiFailure) throw error;
    if (signal.aborted)
      throw new AiFailure(
        'EMBEDDING_TIMEOUT',
        'embedding',
        'Model embedding vượt quá thời gian chờ 90 giây.',
        504,
      );
    throw new AiFailure(
      'EMBEDDING_UNAVAILABLE',
      'embedding',
      'Không tạo được embedding. Kiểm tra model embedding và kết nối Ollama.',
      503,
    );
  }
}

export async function embedTexts(
  texts: string[],
  settings?: EmbeddingSettings,
): Promise<number[][]> {
  if (!texts.length) return [];
  return requestEmbeddings(texts, settings || (await getEmbeddingSettings()));
}
export async function probeEmbeddingDimensions(model: string) {
  const [vector] = await requestEmbeddings([formatEmbeddingQuery('Knowledge retrieval', model)], {
    model,
  });
  return vector.length;
}

export async function embedQuery(
  question: string,
  settings?: EmbeddingSettings,
): Promise<number[]> {
  const selected = settings || (await getEmbeddingSettings());
  const text = question.trim().replace(/\s+/g, ' ').slice(0, 2000);
  const key = createHash('sha256')
    .update(`${getEmbeddingVersion(selected)}\n${text}`)
    .digest('hex');
  const cached = queryCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.vector;
  const pending = inFlight.get(key);
  if (pending) return pending;
  const request = embedTexts([formatEmbeddingQuery(text, selected.model)], selected).then(
    ([vector]) => {
      if (queryCache.size >= 128) queryCache.delete(queryCache.keys().next().value!);
      queryCache.set(key, { vector, expires: Date.now() + 600000 });
      return vector;
    },
  );
  inFlight.set(key, request);
  try {
    return await request;
  } finally {
    if (inFlight.get(key) === request) inFlight.delete(key);
  }
}
