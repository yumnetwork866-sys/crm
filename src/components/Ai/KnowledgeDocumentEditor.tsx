import { useState } from 'react';
import {
  Check,
  CircleHelp,
  FileText,
  Loader2,
  RotateCcw,
  ScanText,
  Settings2,
  X,
} from 'lucide-react';
import {
  chunkSettingsError,
  defaultChunkSettings,
  splitKnowledge,
  type ChunkSettings,
} from '../../../shared/knowledgeChunking';

export interface KnowledgeDraft {
  title: string;
  content: string;
  enabled: boolean;
  chunkSettings: ChunkSettings;
}

const field =
  'mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:opacity-50';
const secondary =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50';

export function KnowledgeDocumentEditor({
  draft,
  onChange,
  onSave,
  onClose,
  busy,
  error,
  editing,
  reindex = false,
  resetChunkSettings,
}: {
  draft: KnowledgeDraft;
  onChange: (draft: KnowledgeDraft) => void;
  onSave: (event: React.FormEvent) => void;
  onClose: () => void;
  busy: boolean;
  error: string;
  editing: boolean;
  reindex?: boolean;
  resetChunkSettings?: ChunkSettings;
}) {
  const [preview, setPreview] = useState<{
    draft: KnowledgeDraft;
    chunks: ReturnType<typeof splitKnowledge>;
  } | null>(null);
  const [visibleCount, setVisibleCount] = useState(30);
  const settings = draft.chunkSettings;
  const settingsError = chunkSettingsError(settings);
  const currentPreview =
    preview &&
    preview.draft.content === draft.content &&
    preview.draft.title === draft.title &&
    preview.draft.chunkSettings === settings
      ? preview
      : null;
  const updateSettings = (updates: Partial<ChunkSettings>) =>
    onChange({ ...draft, chunkSettings: { ...settings, ...updates } });
  const previewChunks = () => {
    if (settingsError) return;
    setPreview({ draft, chunks: splitKnowledge(draft.content, draft.title, settings) });
    setVisibleCount(30);
  };

  return (
    <form
      className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/70"
      onSubmit={(event) => {
        if (reindex && !currentPreview?.chunks.length) {
          event.preventDefault();
          return;
        }
        onSave(event);
      }}
    >
      {!reindex && (
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="rounded-xl bg-emerald-50 p-2.5 text-emerald-600">
              <FileText className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              {editing && <p className="mb-1 text-xs text-slate-500">Chỉnh sửa tài liệu</p>}
              <p className="truncate text-sm font-semibold text-slate-900">
                {draft.title || 'Tài liệu mới'}
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Đóng trình soạn tài liệu"
            disabled={busy}
            onClick={onClose}
            className={secondary}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      <div className="grid items-start lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <fieldset disabled={busy} className="min-w-0 space-y-5 p-4 sm:p-5">
          {!reindex && (
            <label className="block text-xs font-semibold text-slate-700" htmlFor="knowledge-title">
              Tên tài liệu
              <input
                id="knowledge-title"
                required
                maxLength={160}
                value={draft.title}
                onChange={(event) => onChange({ ...draft, title: event.target.value })}
                className={field}
              />
            </label>
          )}

          <section
            aria-labelledby="chunk-settings-title"
            className="overflow-hidden rounded-xl border border-slate-200 bg-white"
          >
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
              <Settings2 className="h-4 w-4 text-emerald-600" />
              <h3 id="chunk-settings-title" className="text-sm font-semibold text-slate-900">
                Chunking settings
              </h3>
              <button
                type="button"
                aria-label="Hướng dẫn chunking"
                title={'Độ dài và chồng lấn tính bằng ký tự. Dùng \\n để ưu tiên ngắt ở dòng mới.'}
                className="rounded text-slate-400 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              >
                <CircleHelp className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="space-y-4 p-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="text-xs font-medium text-slate-600" htmlFor="chunk-delimiter">
                  <span className="inline-flex items-center gap-1">
                    Dấu phân cách
                    <span
                      tabIndex={0}
                      role="img"
                      aria-label="Hướng dẫn dấu phân cách"
                      title={
                        'Dấu phân cách là ký tự dùng để chia văn bản. \\n\\n và \\n thường được dùng để phân tách đoạn văn và dòng. Khi kết hợp bằng dấu phẩy (\\n\\n,\\n), đoạn văn sẽ được chia theo dòng nếu vượt quá độ dài tối đa của chunk. Bạn cũng có thể tự đặt dấu phân cách đặc biệt, ví dụ: ***.'
                      }
                      className="cursor-help rounded text-slate-400 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                    >
                      <CircleHelp className="h-3.5 w-3.5" />
                    </span>
                  </span>
                  <input
                    id="chunk-delimiter"
                    maxLength={100}
                    value={settings.delimiter}
                    onChange={(event) => updateSettings({ delimiter: event.target.value })}
                    className={`${field} font-mono`}
                    placeholder="\\n"
                  />
                </label>
                <label className="text-xs font-medium text-slate-600" htmlFor="chunk-length">
                  Độ dài tối đa
                  <input
                    id="chunk-length"
                    type="number"
                    required
                    min={64}
                    max={10000}
                    step={1}
                    value={settings.maxLength}
                    onChange={(event) => updateSettings({ maxLength: Number(event.target.value) })}
                    className={field}
                  />
                </label>
                <label className="text-xs font-medium text-slate-600" htmlFor="chunk-overlap">
                  <span className="inline-flex items-center gap-1">
                    Độ chồng lấn
                    <span
                      tabIndex={0}
                      role="img"
                      aria-label="Hướng dẫn độ chồng lấn"
                      title="Độ chồng lấn giúp duy trì sự liên kết về ngữ nghĩa giữa các chunk, cải thiện hiệu quả truy xuất. Khuyến nghị đặt bằng 10%–25% độ dài tối đa của chunk."
                      className="cursor-help rounded text-slate-400 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                    >
                      <CircleHelp className="h-3.5 w-3.5" />
                    </span>
                  </span>
                  <input
                    id="chunk-overlap"
                    type="number"
                    required
                    min={0}
                    max={settings.maxLength - 1}
                    step={1}
                    value={settings.overlap}
                    onChange={(event) => updateSettings({ overlap: Number(event.target.value) })}
                    className={field}
                  />
                </label>
              </div>
              <div className="space-y-2.5 border-t border-slate-100 pt-4">
                <p className="text-xs font-semibold text-slate-700">Xử lý văn bản</p>
                <label className="flex items-center gap-2 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={settings.normalizeWhitespace}
                    onChange={(event) =>
                      updateSettings({ normalizeWhitespace: event.target.checked })
                    }
                    className="accent-emerald-600"
                  />
                  Chuẩn hóa khoảng trắng, tab và dòng trống liên tiếp
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={settings.removeUrlsAndEmails}
                    onChange={(event) =>
                      updateSettings({ removeUrlsAndEmails: event.target.checked })
                    }
                    className="accent-emerald-600"
                  />
                  Loại bỏ đường dẫn và địa chỉ email
                </label>
              </div>
              {settingsError && (
                <p role="alert" className="text-xs text-rose-700">
                  {settingsError}
                </p>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  disabled={!!settingsError || !draft.content.trim()}
                  onClick={previewChunks}
                  className={secondary}
                >
                  <ScanText className="h-4 w-4" />
                  Xem trước các chunk
                </button>
                <button
                  type="button"
                  onClick={() => updateSettings(resetChunkSettings ?? defaultChunkSettings)}
                  className={secondary}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Đặt lại
                </button>
              </div>
            </div>
          </section>

          {error && (
            <p role="alert" className="text-sm text-rose-700">
              {error}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
            <button type="button" onClick={onClose} className={secondary}>
              Hủy
            </button>
            <button
              type="submit"
              disabled={busy || !!settingsError || (reindex && !currentPreview?.chunks.length)}
              title={
                reindex && !currentPreview ? 'Xem trước các chunk trước khi áp dụng.' : undefined
              }
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {reindex ? 'Chia lại & reindex' : 'Lưu & xử lý'}
            </button>
          </div>
        </fieldset>

        <section
          aria-label="Xem trước các chunk tài liệu"
          className="min-w-0 border-t border-slate-200 bg-white lg:sticky lg:top-4 lg:border-l lg:border-t-0"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <ScanText className="h-4 w-4 text-emerald-600" />
              Xem trước
            </div>
            <span
              aria-live="polite"
              className="rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-500"
            >
              {currentPreview
                ? `${currentPreview.chunks.length.toLocaleString('vi-VN')} chunk`
                : 'Chưa xem trước'}
            </span>
          </div>
          {currentPreview ? (
            <div className="max-h-[560px] space-y-3 overflow-y-auto p-4 sm:p-5">
              {currentPreview.chunks.length === 0 && (
                <p className="py-12 text-center text-sm text-amber-700">
                  Không còn nội dung sau khi xử lý. Kiểm tra lại các tùy chọn.
                </p>
              )}
              {currentPreview.chunks.slice(0, visibleCount).map((chunk) => (
                <article
                  key={chunk.ordinal}
                  className="rounded-xl border border-slate-200 bg-slate-50/50 p-4"
                >
                  <div className="mb-3 flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-emerald-700">
                      Chunk {chunk.ordinal + 1}
                    </span>
                    <span className="text-slate-400">
                      {chunk.content.length.toLocaleString('vi-VN')} ký tự
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap break-words text-xs leading-6 text-slate-700">
                    {chunk.content}
                  </p>
                </article>
              ))}
              {visibleCount < currentPreview.chunks.length && (
                <button
                  type="button"
                  onClick={() => setVisibleCount((count) => count + 30)}
                  className={`${secondary} w-full`}
                >
                  Xem thêm chunk
                </button>
              )}
            </div>
          ) : (
            <div className="flex min-h-80 flex-col items-center justify-center gap-3 px-8 py-16 text-center">
              <span className="rounded-2xl bg-slate-50 p-4">
                <ScanText className="h-8 w-8 text-slate-300" />
              </span>
              <p className="text-sm font-medium text-slate-600">Xem trước chunking của tài liệu</p>
            </div>
          )}
        </section>
      </div>
    </form>
  );
}
