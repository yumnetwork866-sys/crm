import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Layers3, Loader2, Search, TextSearch } from 'lucide-react';
import { api } from '../../utils/apiClient';
import {
  resolveRetrievalSettings,
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
    description: 'Kết hợp từ khóa và vector, gộp thứ hạng bằng RRF.',
    icon: Layers3,
  },
] as const;

export function KnowledgeRetrievalSettings({
  settings,
  disabled = false,
  idPrefix = 'retrieval',
}: {
  settings?: RetrievalSettings;
  disabled?: boolean;
  idPrefix?: string;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<RetrievalSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const value = draft || resolveRetrievalSettings(settings);
  const locked = disabled || busy || !settings;
  const invalid =
    !Number.isInteger(value.topK) ||
    value.topK < 1 ||
    value.topK > 20 ||
    !Number.isFinite(value.scoreThreshold) ||
    value.scoreThreshold < 0 ||
    value.scoreThreshold > 1;
  const dirty =
    !!draft && JSON.stringify(draft) !== JSON.stringify(resolveRetrievalSettings(settings));
  const update = (updates: Partial<RetrievalSettings>) => {
    setDraft({ ...value, ...updates });
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

  return (
    <section aria-labelledby={`${idPrefix}-heading`} className="space-y-3">
      <div>
        <h3 id={`${idPrefix}-heading`} className="text-sm font-semibold text-slate-900">
          Thiết lập truy xuất
        </h3>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          Áp dụng cho toàn bộ kho kiến thức. Lưu riêng với tài liệu.
        </p>
      </div>
      <fieldset disabled={locked} className="space-y-2">
        <legend className="sr-only">Phương thức tìm kiếm</legend>
        {modes.map(({ id, label, description, icon: Icon }) => (
          <label
            key={id}
            className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition focus-within:ring-2 focus-within:ring-emerald-400 ${value.mode === id ? 'border-emerald-400 bg-emerald-50/50 ring-1 ring-emerald-100' : 'border-slate-200 bg-white hover:border-slate-300'} ${locked ? 'cursor-default opacity-60' : ''}`}
          >
            <input
              type="radio"
              name={`${idPrefix}-mode`}
              value={id}
              checked={value.mode === id}
              onChange={() => update({ mode: id })}
              className="sr-only"
            />
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold text-slate-800">
                {label}
                {id === 'hybrid' && (
                  <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] text-emerald-700">
                    KHUYÊN DÙNG
                  </span>
                )}
              </span>
              <span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span>
            </span>
            {value.mode === id && <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />}
          </label>
        ))}
        <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
          <label htmlFor={`${idPrefix}-top-k`} className="text-xs font-medium text-slate-600">
            Top K · Số đoạn tối đa
            <input
              id={`${idPrefix}-top-k`}
              type="number"
              min={1}
              max={20}
              step={1}
              value={value.topK}
              onChange={(event) => update({ topK: Number(event.target.value) })}
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 disabled:bg-slate-50"
            />
          </label>
          <div>
            <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
              <input
                type="checkbox"
                checked={value.scoreThresholdEnabled}
                disabled={value.mode === 'keyword'}
                onChange={(event) => update({ scoreThresholdEnabled: event.target.checked })}
                className="accent-emerald-600"
              />
              Ngưỡng điểm vector
            </label>
            <input
              aria-label="Ngưỡng tương đồng vector"
              type="number"
              min={0}
              max={1}
              step={0.01}
              value={value.scoreThreshold}
              disabled={value.mode === 'keyword' || !value.scoreThresholdEnabled}
              onChange={(event) => update({ scoreThreshold: Number(event.target.value) })}
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 disabled:bg-slate-50 disabled:text-slate-400"
            />
          </div>
          <p className="text-xs leading-5 text-slate-400 sm:col-span-2">
            {value.mode === 'keyword'
              ? 'Full-Text Search tìm theo từ khóa và không dùng ngưỡng tương đồng vector.'
              : value.mode === 'hybrid'
                ? 'Ngưỡng lọc nhánh vector trước khi gộp thứ hạng. Kết quả khớp từ khóa vẫn được giữ.'
                : 'Ngưỡng từ 0 đến 1 lọc các đoạn theo độ tương đồng vector; đây không phải xác suất câu trả lời đúng.'}
          </p>
        </div>
      </fieldset>
      {invalid && (
        <p role="alert" className="text-xs text-rose-700">
          Top K cần từ 1 đến 20; ngưỡng điểm cần từ 0 đến 1.
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
      {!disabled && (
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
    </section>
  );
}
