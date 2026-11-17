import {
  Check,
  ChevronDown,
  CircleAlert,
  Clock3,
  Link2,
  Loader2,
  Minus,
  ShieldCheck,
  Workflow,
} from 'lucide-react';
import type { AiTraceSource, AiTraceStep } from '../../../shared/aiTrace';

const titles: Record<string, string> = {
  context: 'Ngữ cảnh',
  'retrieval-config': 'Thiết lập truy xuất',
  keyword: 'Full-text',
  embedding: 'Embedding',
  vector: 'Vector',
  fusion: 'Hybrid',
  rerank: 'Rerank',
  selection: 'Nguồn đã chọn',
  generation: 'Tạo phản hồi',
  validation: 'Kiểm tra',
  audit: 'Lưu kết quả',
};
const statuses = { running: 'Đang chạy', completed: 'Hoàn tất', skipped: 'Bỏ qua', error: 'Lỗi' };
const score = (value: number) => value.toFixed(4);
const duration = (ms: number) => (ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`);
const chip =
  'inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-[10px] leading-none text-slate-500';

function StepMetadata({ step }: { step: AiTraceStep }) {
  const values = step.values;
  if (!values) return null;
  const model = typeof values.model === 'string' ? values.model : undefined;
  const query = typeof values.question === 'string' ? values.question : undefined;
  const dimensions =
    typeof values.actualDimensions === 'number' ? values.actualDimensions : values.dimensions;
  return (
    <div className="space-y-2">
      {query && (
        <p className="max-h-24 overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
          {query}
        </p>
      )}
      <div className="flex flex-wrap gap-1.5">
        {model && <span className={chip}>{model}</span>}
        {Array.isArray(values.messages) && (
          <span className={chip}>{values.messages.length} tin nhắn</span>
        )}
        {typeof values.mode === 'string' && (
          <span className={chip}>
            {values.mode === 'keyword'
              ? 'Full-text'
              : values.mode === 'vector'
                ? 'Vector'
                : 'Hybrid'}
          </span>
        )}
        {typeof values.topK === 'number' && <span className={chip}>Top {values.topK}</span>}
        {values.scoreThresholdEnabled === true && typeof values.scoreThreshold === 'number' && (
          <span className={chip}>Ngưỡng {values.scoreThreshold}</span>
        )}
        {typeof dimensions === 'number' && (
          <span className={chip}>{dimensions.toLocaleString('vi-VN')} chiều</span>
        )}
      </div>
    </div>
  );
}

function ChunkCard({
  source,
  rank,
  selected,
  cited,
}: {
  source: AiTraceSource;
  rank: number;
  selected: boolean;
  cited: boolean;
}) {
  const scores = [
    ['Vector', source.semanticScore],
    ['Keyword', source.keywordScore],
    ['Rerank', source.rerankScore],
  ] as const;
  return (
    <details
      className={`group/chunk rounded-lg border bg-white ${selected ? 'border-indigo-200/80' : 'border-slate-200/80'}`}
    >
      <summary className="cursor-pointer list-none px-3 py-2.5 [&::-webkit-details-marker]:hidden">
        <div className="flex items-center gap-2">
          <span className="w-4 shrink-0 text-[10px] tabular-nums text-slate-400">{rank + 1}</span>
          <span
            className="min-w-0 flex-1 truncate text-xs font-medium text-slate-700"
            title={source.title}
          >
            {source.title}
          </span>
          {typeof source.ordinal === 'number' && (
            <span className="shrink-0 text-[10px] text-slate-400">#{source.ordinal + 1}</span>
          )}
          {cited ? (
            <Link2 className="h-3 w-3 shrink-0 text-emerald-600" aria-label="Được trích dẫn" />
          ) : selected ? (
            <Check className="h-3 w-3 shrink-0 text-indigo-500" aria-label="Được chọn cho LLM" />
          ) : null}
          <span
            className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-slate-600"
            title="Điểm xếp hạng tại bước này"
          >
            {score(source.score)}
          </span>
          <ChevronDown className="h-3 w-3 shrink-0 text-slate-400 transition-transform group-open/chunk:rotate-180" />
        </div>
        <p className="mt-1.5 line-clamp-2 break-words text-[11px] leading-5 text-slate-500 group-open/chunk:hidden">
          {source.content}
        </p>
      </summary>
      <div className="space-y-2 border-t border-slate-100 px-3 pb-3 pt-2.5">
        <div className="flex flex-wrap gap-1.5">
          {scores.map(
            ([label, value]) =>
              typeof value === 'number' && (
                <span key={label} className={chip}>
                  {label}
                  <span className="ml-1.5 font-mono tabular-nums text-slate-700">
                    {score(value)}
                  </span>
                </span>
              ),
          )}
          {selected && <span className="text-[10px] leading-5 text-indigo-600">Đã chọn</span>}
          {cited && <span className="text-[10px] leading-5 text-emerald-600">Trích dẫn</span>}
        </div>
        <p className="whitespace-pre-wrap break-words text-xs leading-6 text-slate-600">
          {source.content}
        </p>
        <div className="space-y-1 border-t border-slate-100 pt-2 text-[10px] text-slate-400">
          <p className="break-all font-mono">Chunk ID: {source.id}</p>
          <p className="break-all font-mono">Document ID: {source.documentId}</p>
        </div>
      </div>
    </details>
  );
}

export function AiTestTracePanel({
  steps,
  pending,
  error,
  result,
}: {
  steps: AiTraceStep[];
  pending: boolean;
  error?: string;
  result: {
    answer?: string;
    runId?: string;
    durationMs?: number;
    sourceIds?: string[];
    shouldAutoReply?: boolean;
    reason?: string;
  } | null;
}) {
  const selection = steps.find((step) => step.id === 'selection');
  const selectedIds = new Set(selection?.sources?.map((source) => source.id));
  const citedIds = new Set(result?.sourceIds);
  const hasStepError = steps.some((step) => step.status === 'error');
  return (
    <aside
      className="flex max-h-[720px] min-h-[360px] min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:max-h-none lg:min-h-0"
      aria-label="Tiến trình thử AI"
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          <Workflow className="h-4 w-4 text-indigo-500" />
          <h2 className="text-sm font-semibold text-slate-800">Tiến trình xử lý</h2>
        </div>
        <div
          className="flex shrink-0 items-center gap-2.5 text-[11px] text-slate-400"
          role="status"
        >
          {result && typeof result.durationMs === 'number' && (
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Clock3 className="h-3 w-3" />
              {duration(result.durationMs)}
            </span>
          )}
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-500" aria-label="Đang chạy" />
          ) : error ? (
            <CircleAlert className="h-3.5 w-3.5 text-rose-500" aria-label="Lỗi" />
          ) : result ? (
            <Check className="h-3.5 w-3.5 text-emerald-500" aria-label="Hoàn tất" />
          ) : null}
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
        {steps.map((step, index) => {
          const skipped = step.status === 'skipped';
          const failed = step.status === 'error';
          const running = step.status === 'running';
          return (
            <div key={step.id} className="relative flex gap-3">
              {index < steps.length - 1 && (
                <span
                  aria-hidden="true"
                  className="absolute bottom-0 left-[11px] top-7 w-px bg-slate-100"
                />
              )}
              <span
                className={`relative z-10 mt-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ring-4 ring-white ${running ? 'bg-indigo-50 text-indigo-500' : failed ? 'bg-rose-50 text-rose-500' : skipped ? 'bg-slate-50 text-slate-300' : 'bg-emerald-50 text-emerald-600'}`}
                title={statuses[step.status]}
                aria-label={statuses[step.status]}
              >
                {running ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : failed ? (
                  <CircleAlert className="h-3 w-3" />
                ) : skipped ? (
                  <Minus className="h-3 w-3" />
                ) : (
                  <Check className="h-3 w-3" />
                )}
              </span>
              <details
                open={failed || (step.id === 'selection' && !skipped)}
                className="group/step mb-1 min-w-0 flex-1"
              >
                <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 py-2 [&::-webkit-details-marker]:hidden">
                  <span
                    className={`min-w-0 flex-1 text-xs font-medium ${skipped ? 'text-slate-400' : running ? 'text-indigo-600' : 'text-slate-700'}`}
                  >
                    {titles[step.id] || step.title}
                  </span>
                  {step.sources && (
                    <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] tabular-nums text-slate-500">
                      {step.sources.length}
                    </span>
                  )}
                  {skipped && <span className="text-[10px] text-slate-400">Bỏ qua</span>}
                  {typeof step.durationMs === 'number' && (
                    <span className="text-[10px] tabular-nums text-slate-400">
                      {duration(step.durationMs)}
                    </span>
                  )}
                  <ChevronDown className="h-3 w-3 shrink-0 text-slate-300 transition-transform group-open/step:rotate-180" />
                </summary>
                <div className="space-y-2.5 pb-3">
                  <StepMetadata step={step} />
                  {failed && step.detail && (
                    <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-700">
                      {step.detail}
                    </p>
                  )}
                  {step.sources && step.sources.length > 0 && (
                    <div className="max-h-[360px] space-y-2 overflow-y-auto overscroll-contain pr-1">
                      {step.sources.map((source, rank) => (
                        <ChunkCard
                          key={source.id}
                          source={source}
                          rank={rank}
                          selected={selectedIds.has(source.id)}
                          cited={citedIds.has(source.id)}
                        />
                      ))}
                    </div>
                  )}
                  {step.sources?.length === 0 && (
                    <span className="text-[11px] text-slate-400">0 chunk</span>
                  )}
                  {(step.values || (step.detail && !failed)) && (
                    <div className="text-[10px] text-slate-400">
                      {step.detail && !failed && (
                        <p className="mb-2 mt-1 leading-5 text-slate-500">{step.detail}</p>
                      )}
                      {step.values && (
                        <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-2.5 font-mono text-[10px] leading-5 text-slate-500">
                          {JSON.stringify(step.values, null, 2)}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              </details>
            </div>
          );
        })}
        {error && !hasStepError && (
          <p
            role="alert"
            className="rounded-lg border border-rose-100 bg-rose-50 p-3 text-xs leading-5 text-rose-700"
          >
            {error}
          </p>
        )}
      </div>
      {result && (
        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/60 px-4 py-3">
          <span
            title={result.reason}
            className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${result.shouldAutoReply ? 'text-emerald-700' : 'text-amber-700'}`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            {result.shouldAutoReply ? 'Có thể tự động trả lời' : 'Cần duyệt'}
          </span>
          {citedIds.size > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
              <Link2 className="h-3 w-3" />
              {citedIds.size}
            </span>
          )}
        </footer>
      )}
    </aside>
  );
}
