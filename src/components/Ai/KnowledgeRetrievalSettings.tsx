import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  CircleHelp,
  Layers3,
  ListFilter,
  Loader2,
  Search,
  SlidersHorizontal,
  TextSearch,
} from 'lucide-react';
import './knowledgeRetrievalSettings.css';
import { api } from '../../utils/apiClient';
import {
  resolveRetrievalSettings,
  usesRerank,
  type RetrievalSettings,
} from '../../../shared/knowledgeRetrievalSettings';

const modes = [
  {
    id: 'vector',
    label: 'Vector Search',
    description: 'Tìm theo ý nghĩa, kể cả khi câu hỏi dùng từ khác tài liệu.',
    icon: Search,
  },
  {
    id: 'keyword',
    label: 'Full-Text Search',
    description: 'Tìm theo từ khóa, tên sản phẩm và thuật ngữ chính xác.',
    icon: TextSearch,
  },
  {
    id: 'hybrid',
    label: 'Hybrid Search',
    description: 'Kết hợp từ khóa và vector, chọn cách xếp hạng các đoạn phù hợp.',
    icon: Layers3,
  },
] as const;

export function KnowledgeRetrievalSettings({
  settings,
  disabled = false,
  idPrefix = 'retrieval',
  loading = false,
  loadError,
  onRetry,
  wide = false,
  onChange,
  formId,
  showModelSelector = true,
}: {
  settings?: RetrievalSettings;
  disabled?: boolean;
  idPrefix?: string;
  loading?: boolean;
  loadError?: string;
  onRetry?: () => void;
  wide?: boolean;
  onChange?: (settings: RetrievalSettings) => void;
  formId?: string;
  showModelSelector?: boolean;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<RetrievalSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const value = onChange
    ? settings || resolveRetrievalSettings(settings)
    : draft || resolveRetrievalSettings(settings);
  const locked = disabled || busy || loading || !!loadError;
  const invalid =
    !Number.isInteger(value.topK) ||
    value.topK < 1 ||
    value.topK > 20 ||
    !Number.isFinite(value.scoreThreshold) ||
    value.scoreThreshold < 0 ||
    value.scoreThreshold > 1 ||
    !Number.isFinite(value.semanticWeight) ||
    value.semanticWeight < 0 ||
    value.semanticWeight > 1;
  const weighted = value.mode === 'hybrid' && value.hybridStrategy === 'weighted';
  const reranking = usesRerank(value);
  const rerankModels = useQuery({
    queryKey: ['ai', 'models'],
    queryFn: () => api.get<{ connected: boolean; models: string[]; error?: string }>('/ai/models'),
    enabled: reranking && showModelSelector,
    staleTime: 60000,
  });
  const modelOptions = [...new Set([value.rerankModel, ...(rerankModels.data?.models || [])])];
  const dirty =
    !!draft && JSON.stringify(draft) !== JSON.stringify(resolveRetrievalSettings(settings));
  const update = (updates: Partial<RetrievalSettings>) => {
    const next = { ...value, ...updates };
    if (onChange) onChange(next);
    else setDraft(next);
    setSaved(false);
    setError('');
  };
  const save = async () => {
    if (locked || invalid || !dirty) return;
    setBusy(true);
    setError('');
    setSaved(false);
    try {
      const result = await api.put<{ retrievalSettings: RetrievalSettings }>(
        '/ai/retrieval-settings',
        value,
      );
      queryClient.setQueryData(
        ['ai', 'configuration'],
        (previous: Record<string, unknown> | undefined) =>
          previous ? { ...previous, retrievalSettings: result.retrievalSettings } : previous,
      );
      setDraft(null);
      setSaved(true);
      await queryClient.invalidateQueries({ queryKey: ['ai', 'configuration'] });
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : 'Không lưu được thiết lập truy xuất.',
      );
    } finally {
      setBusy(false);
    }
  };

  const scoreHelp = reranking
    ? 'Lọc theo điểm liên quan do model rerank đánh giá, từ 0 đến 1. Đây không phải xác suất câu trả lời đúng.'
    : value.mode === 'keyword'
      ? 'Tìm theo từ khóa, không dùng ngưỡng tương đồng vector.'
      : weighted
        ? 'Lọc theo điểm tổng hợp sau khi kết hợp vector và từ khóa.'
        : value.mode === 'hybrid'
          ? 'Lọc nhánh vector trước khi gộp thứ hạng. Kết quả khớp từ khóa vẫn được giữ.'
          : 'Lọc theo độ tương đồng vector từ 0 đến 1; đây không phải xác suất câu trả lời đúng.';
  const rangeFill = (progress: number) => ({
    background: `linear-gradient(to right, #5145ff ${progress}%, #e9eaf0 ${progress}%)`,
  });
  const controls = (
    <div className={`grid gap-5 ${value.mode !== 'keyword' || reranking ? 'sm:grid-cols-2' : ''}`}>
      <div>
        <div className="flex items-center gap-1.5">
          <label htmlFor={`${idPrefix}-top-k`} className="text-xs font-semibold text-slate-700">
            Top K
          </label>
          <button
            type="button"
            aria-label="Giải thích Top K"
            title="Số đoạn phù hợp nhất được chọn để hỗ trợ câu trả lời, từ 1 đến 20."
            className="text-slate-400 hover:text-slate-600"
          >
            <CircleHelp className="h-3 w-3" />
          </button>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <input
            form={formId}
            id={`${idPrefix}-top-k`}
            type="number"
            min={1}
            max={20}
            step={1}
            value={value.topK}
            onChange={(event) => update({ topK: Number(event.target.value) })}
            className="w-20 shrink-0 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-indigo-400 disabled:opacity-50"
          />
          <input
            form={formId}
            aria-label="Điều chỉnh Top K"
            type="range"
            min={1}
            max={20}
            step={1}
            value={value.topK}
            onChange={(event) => update({ topK: Number(event.target.value) })}
            className="knowledge-slider min-w-0 flex-1"
            style={rangeFill(((Math.min(20, Math.max(1, value.topK)) - 1) / 19) * 100)}
          />
        </div>
      </div>
      {(value.mode !== 'keyword' || reranking) && (
        <div>
          <div className="flex items-center gap-2">
            <button
              form={formId}
              type="button"
              role="switch"
              aria-checked={value.scoreThresholdEnabled}
              aria-label="Bật ngưỡng điểm"
              onClick={() => update({ scoreThresholdEnabled: !value.scoreThresholdEnabled })}
              className={`relative h-4 w-7 shrink-0 rounded transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${value.scoreThresholdEnabled ? 'bg-indigo-500' : 'bg-slate-200'}`}
            >
              <span
                className={`absolute top-0.5 h-3 w-3 rounded-sm bg-white shadow-sm transition-all ${value.scoreThresholdEnabled ? 'left-3.5' : 'left-0.5'}`}
              />
            </button>
            <span className="text-xs font-semibold text-slate-700">Ngưỡng điểm</span>
            <button
              type="button"
              aria-label="Giải thích ngưỡng điểm"
              title={scoreHelp}
              className="text-slate-400 hover:text-slate-600"
            >
              <CircleHelp className="h-3 w-3" />
            </button>
          </div>
          <div className="mt-2 flex items-center gap-3">
            <input
              form={formId}
              aria-label={
                reranking
                  ? 'Ngưỡng điểm rerank'
                  : weighted
                    ? 'Ngưỡng điểm tổng hợp'
                    : 'Ngưỡng tương đồng vector'
              }
              type="number"
              min={0}
              max={1}
              step={0.01}
              value={value.scoreThreshold}
              disabled={!value.scoreThresholdEnabled}
              onChange={(event) => update({ scoreThreshold: Number(event.target.value) })}
              className="w-20 shrink-0 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-indigo-400 disabled:text-slate-400"
            />
            <input
              form={formId}
              aria-label="Điều chỉnh ngưỡng điểm"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={value.scoreThreshold}
              disabled={!value.scoreThresholdEnabled}
              onChange={(event) => update({ scoreThreshold: Number(event.target.value) })}
              className="knowledge-slider min-w-0 flex-1"
              style={rangeFill(value.scoreThreshold * 100)}
            />
          </div>
        </div>
      )}
    </div>
  );

  return (
    <section
      aria-labelledby={`${idPrefix}-heading`}
      className={wide ? 'grid items-start gap-5 lg:grid-cols-[160px_minmax(0,1fr)]' : 'space-y-4'}
    >
      <h3 id={`${idPrefix}-heading`} className="pt-1 text-xs font-semibold text-slate-700">
        Thiết lập truy xuất
      </h3>
      <div className="min-w-0 space-y-3">
        {loading && (
          <p role="status" className="text-xs text-slate-500">
            Đang tải thiết lập truy xuất…
          </p>
        )}
        {loadError && (
          <p role="alert" className="text-xs text-rose-700">
            Không tải được thiết lập truy xuất. {loadError}
            {onRetry && (
              <button type="button" onClick={onRetry} className="ml-2 underline">
                Thử lại
              </button>
            )}
          </p>
        )}
        <fieldset disabled={locked} className="min-w-0 space-y-2">
          <legend className="sr-only">Phương thức tìm kiếm</legend>
          {modes.map(({ id, label, description, icon: Icon }) => {
            const selected = value.mode === id;
            return (
              <div
                key={id}
                className={`overflow-hidden rounded-[14px] border transition ${selected ? 'border-indigo-500 bg-white ring-1 ring-indigo-500' : 'border-slate-200 bg-indigo-50/25'}`}
              >
                <label
                  className={`relative flex items-start gap-3 px-3 py-2.5 transition focus-within:ring-2 focus-within:ring-inset focus-within:ring-indigo-400 ${locked ? 'cursor-default opacity-60' : 'cursor-pointer hover:bg-indigo-50/40'} ${selected ? 'bg-indigo-50/50' : ''}`}
                >
                  <input
                    form={formId}
                    type="radio"
                    name={`${idPrefix}-mode`}
                    value={id}
                    checked={selected}
                    onChange={() => update({ mode: id })}
                    className="sr-only"
                  />
                  <Icon
                    className={`mt-0.5 h-4 w-4 shrink-0 ${selected ? 'text-indigo-500' : 'text-slate-400'}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-slate-700">
                      {label}
                      {id === 'hybrid' && (
                        <span className="rounded border border-indigo-400 px-1 py-0.5 text-[9px] font-medium leading-none text-indigo-500">
                          KHUYÊN DÙNG
                        </span>
                      )}
                    </span>
                    <span className="mt-1 block text-xs leading-4 text-slate-500">
                      {description}
                    </span>
                  </span>
                  {selected && (
                    <span
                      aria-hidden="true"
                      className="absolute bottom-0 left-4 h-0 w-0 border-x-[6px] border-b-[6px] border-x-transparent border-b-white"
                    />
                  )}
                </label>
                {selected && (
                  <div role="group" aria-label={`Thiết lập ${label}`} className="space-y-5 p-4">
                    {id !== 'hybrid' && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={value.rerankEnabled}
                          aria-label="Rerank Model"
                          aria-describedby={`${idPrefix}-rerank-help`}
                          onClick={() => update({ rerankEnabled: !value.rerankEnabled })}
                          className={`relative h-4 w-7 shrink-0 rounded transition focus-visible:ring-2 focus-visible:ring-indigo-400 ${value.rerankEnabled ? 'bg-indigo-500' : 'bg-slate-200'}`}
                        >
                          <span
                            className={`absolute top-0.5 h-3 w-3 rounded-sm bg-white shadow-sm transition-all ${value.rerankEnabled ? 'left-3.5' : 'left-0.5'}`}
                          />
                        </button>
                        <span className="text-xs font-semibold text-slate-700">Rerank Model</span>
                        <button
                          type="button"
                          aria-label="Giải thích Rerank Model"
                          title="Model rerank trên Ollama xếp hạng lại các đoạn đã tìm được theo mức độ liên quan với câu hỏi trước khi lấy Top K."
                          className="rounded text-slate-400 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                        >
                          <CircleHelp className="h-3 w-3" />
                        </button>
                        <span id={`${idPrefix}-rerank-help`} className="sr-only">
                          Xếp hạng lại bằng model chat trên Ollama.
                        </span>
                      </div>
                    )}
                    {id === 'hybrid' && (
                      <>
                        <div className={`grid gap-2 ${wide ? 'sm:grid-cols-2' : 'xl:grid-cols-2'}`}>
                          <label
                            className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition focus-within:ring-2 focus-within:ring-indigo-400 ${weighted ? 'border-indigo-200 bg-white' : 'border-slate-200 bg-slate-50/50'}`}
                          >
                            <span className="rounded-lg bg-indigo-50 p-2 text-indigo-500">
                              <SlidersHorizontal className="h-4 w-4" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-xs font-semibold text-slate-700">
                                Weighted Score
                              </span>
                              <span className="mt-1 block text-xs leading-4 text-slate-500">
                                Điều chỉnh trọng số để ưu tiên ý nghĩa hoặc từ khóa khi tìm kiếm.
                              </span>
                            </span>
                            <input
                              form={formId}
                              type="radio"
                              name={`${idPrefix}-strategy`}
                              checked={weighted}
                              onChange={() => update({ hybridStrategy: 'weighted' })}
                              className="mt-0.5 h-4 w-4 shrink-0 accent-indigo-600"
                            />
                          </label>
                          <label
                            className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 focus-within:ring-2 focus-within:ring-indigo-400 ${reranking ? 'border-indigo-200 bg-white' : 'border-slate-200 bg-slate-50/40'}`}
                          >
                            <span className="rounded-lg bg-teal-50 p-2 text-teal-600">
                              <ListFilter className="h-4 w-4" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-xs font-semibold text-slate-700">
                                Rerank Model
                              </span>
                              <span className="mt-1 block text-xs leading-4 text-slate-500">
                                Dùng model trên Ollama để xếp hạng lại các đoạn phù hợp.
                              </span>
                            </span>
                            <input
                              form={formId}
                              type="radio"
                              name={`${idPrefix}-strategy`}
                              checked={reranking}
                              onChange={() => update({ hybridStrategy: 'rerank' })}
                              className="mt-0.5 h-4 w-4 shrink-0 accent-indigo-600"
                            />
                          </label>
                        </div>
                        {weighted && (
                          <div className="rounded-lg border border-slate-200 bg-white px-3 py-5">
                            <label htmlFor={`${idPrefix}-semantic-weight`} className="sr-only">
                              Trọng số tìm kiếm theo ý nghĩa
                            </label>
                            <input
                              form={formId}
                              id={`${idPrefix}-semantic-weight`}
                              type="range"
                              min={0}
                              max={1}
                              step={0.01}
                              value={value.semanticWeight}
                              onChange={(event) =>
                                update({ semanticWeight: Number(event.target.value) })
                              }
                              className="knowledge-slider knowledge-slider-weight w-full"
                            />
                            <div className="mt-4 flex justify-between gap-3 text-[11px] font-semibold">
                              <span className="text-sky-500">
                                SEMANTIC {value.semanticWeight.toFixed(2)}
                              </span>
                              <span className="text-teal-500">
                                {(1 - value.semanticWeight).toFixed(2)} KEYWORD
                              </span>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                    {reranking && showModelSelector && (
                      <div>
                        <label
                          className="text-xs font-semibold text-slate-700"
                          htmlFor={`${idPrefix}-rerank-model`}
                        >
                          Model rerank
                        </label>
                        <select
                          form={formId}
                          id={`${idPrefix}-rerank-model`}
                          value={value.rerankModel}
                          onChange={(event) => update({ rerankModel: event.target.value })}
                          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-indigo-400"
                        >
                          {modelOptions.map((model) => (
                            <option key={model}>{model}</option>
                          ))}
                        </select>
                        {(rerankModels.isError || rerankModels.data?.connected === false) && (
                          <p role="alert" className="mt-2 text-xs text-rose-700">
                            Không tải được danh sách model Ollama.
                          </p>
                        )}
                        {rerankModels.data?.connected &&
                          !rerankModels.data.models.includes(value.rerankModel) && (
                            <p role="alert" className="mt-2 text-xs text-amber-700">
                              Model chưa được cài trên Ollama.
                            </p>
                          )}
                      </div>
                    )}
                    {controls}
                    {id === 'hybrid' && (
                      <details
                        open={value.hybridStrategy === 'rrf'}
                        className="text-[11px] text-slate-400"
                      >
                        <summary className="cursor-pointer hover:text-slate-600">
                          Tùy chọn nâng cao{value.hybridStrategy === 'rrf' ? ' · RRF' : ''}
                        </summary>
                        <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                          <input
                            form={formId}
                            type="radio"
                            name={`${idPrefix}-strategy`}
                            checked={value.hybridStrategy === 'rrf'}
                            onChange={() => update({ hybridStrategy: 'rrf' })}
                            className="accent-indigo-600"
                          />
                          RRF · Gộp thứ hạng
                        </label>
                      </details>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </fieldset>
        {invalid && (
          <p role="alert" className="text-xs text-rose-700">
            Top K cần từ 1 đến 20; ngưỡng điểm và trọng số cần từ 0 đến 1.
          </p>
        )}
        {error && (
          <p role="alert" className="text-xs text-rose-700">
            {error}
          </p>
        )}
        {saved && (
          <p role="status" className="text-xs text-emerald-700">
            Đã lưu. Áp dụng cho toàn bộ kho kiến thức.
          </p>
        )}
        {!disabled && !onChange && (
          <button
            type="button"
            disabled={locked || invalid || !dirty}
            onClick={() => void save()}
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Lưu
            thiết lập truy xuất
          </button>
        )}
      </div>
    </section>
  );
}
