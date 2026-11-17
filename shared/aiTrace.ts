export interface AiTraceSource {
  id: string;
  documentId: string;
  title: string;
  content: string;
  ordinal?: number;
  score: number;
  semanticScore?: number | null;
  keywordScore?: number | null;
  rerankScore?: number;
  rerankModel?: string;
  ranking?: string;
  retrieval?: string;
}

export interface AiTraceStep {
  id: string;
  title: string;
  status: 'running' | 'completed' | 'skipped' | 'error';
  detail?: string;
  durationMs?: number;
  input?: unknown;
  prompt?: { role: string; content: string }[];
  output?: unknown;
  inputSources?: AiTraceSource[];
  sources?: AiTraceSource[];
  values?: Record<string, unknown>;
}

export type AiTraceObserver = (step: AiTraceStep) => void;

export type AiTestEvent =
  | { type: 'step'; step: AiTraceStep }
  | { type: 'result'; result: Record<string, unknown> }
  | { type: 'error'; error: string; code?: string; stage?: string; runId?: string }
  | { type: 'heartbeat' };
