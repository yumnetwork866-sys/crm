import { useImperativeHandle, useRef, useState, type Ref } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ListFilter, Loader2, Maximize2, Minimize2, X } from 'lucide-react';
import { api } from '../../utils/apiClient';

export interface EditableChunk {
  id: string;
  ordinal: number;
  content: string;
}

export interface KnowledgeChunkEditorHandle {
  requestClose: (afterClose: () => void) => void;
}

export function KnowledgeChunkEditor({
  ref,
  documentId,
  chunk,
  onClose,
}: {
  ref?: Ref<KnowledgeChunkEditorHandle>;
  documentId: string;
  chunk: EditableChunk;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [content, setContent] = useState(chunk.content);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const savingRef = useRef(false);
  const changed = content.trim() !== chunk.content;
  const pendingClose = useRef<(() => void) | null>(null);
  const close = (afterClose = onClose) => {
    if (savingRef.current) return;
    if (changed) {
      pendingClose.current = afterClose;
      setDiscarding(true);
    } else afterClose();
  };
  useImperativeHandle(ref, () => ({ requestClose: close }));
  const save = async () => {
    if (savingRef.current || !changed || !content.trim()) return;
    savingRef.current = true;
    setSaving(true);
    setError('');
    try {
      await api.put(
        `/ai/knowledge/${encodeURIComponent(documentId)}/chunks/${encodeURIComponent(chunk.id)}`,
        {
          content,
          originalContent: chunk.content,
        },
      );
      await queryClient.invalidateQueries({ queryKey: ['ai', 'knowledge'] });
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Không lưu được chunk.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <aside
      aria-label={`Chỉnh sửa Chunk-${chunk.ordinal + 1}`}
      className={`fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-slate-200 bg-white shadow-xl ${expanded ? 'lg:w-[calc(100vw-5rem)]' : 'sm:w-[560px]'}`}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          close();
        }
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
          event.preventDefault();
          void save();
        }
      }}
    >
      <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-5">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Chỉnh sửa chunk</h3>
          <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-500">
            <ListFilter className="h-3 w-3" />
            Chunk-{String(chunk.ordinal + 1).padStart(2, '0')}
            <span className="mx-1">·</span>
            {content.length.toLocaleString('vi-VN')} ký tự
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            aria-label={expanded ? 'Thu nhỏ' : 'Mở rộng'}
            onClick={() => setExpanded(!expanded)}
            className="rounded p-1 text-slate-400 hover:bg-slate-100"
          >
            {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <button
            type="button"
            aria-label="Đóng chỉnh sửa chunk"
            disabled={saving}
            onClick={() => close()}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      <form
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <label className="sr-only" htmlFor="chunk-editor-content">
          Nội dung chunk
        </label>
        <textarea
          id="chunk-editor-content"
          autoFocus
          value={content}
          disabled={saving}
          onChange={(event) => {
            setContent(event.target.value);
            setDiscarding(false);
          }}
          className="mx-5 mb-4 min-h-64 flex-1 resize-none rounded-lg border border-transparent p-2 text-sm leading-6 text-slate-700 outline-none focus:border-indigo-200 focus:ring-2 focus:ring-indigo-50 disabled:opacity-60"
        />
        {error && (
          <p role="alert" className="mx-5 mb-3 rounded-lg bg-rose-50 p-3 text-xs text-rose-600">
            {error}
          </p>
        )}
        {discarding ? (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 p-4 text-xs"
          >
            <span className="mr-auto text-slate-600">Bỏ các thay đổi chưa lưu?</span>
            <button
              type="button"
              onClick={() => setDiscarding(false)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-slate-600"
            >
              Tiếp tục sửa
            </button>
            <button
              type="button"
              onClick={() => (pendingClose.current || onClose)()}
              className="rounded-lg bg-rose-600 px-3 py-2 text-white"
            >
              Bỏ thay đổi
            </button>
          </div>
        ) : (
          <div className="flex justify-end gap-2 border-t border-slate-100 p-4">
            <button
              type="button"
              disabled={saving}
              onClick={() => close()}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs text-slate-600 disabled:opacity-40"
            >
              Hủy <kbd className="ml-1 text-[10px] text-slate-400">Esc</kbd>
            </button>
            <button
              type="submit"
              disabled={saving || !changed || !content.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white disabled:opacity-40"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Lưu{' '}
              <kbd className="ml-1 text-[10px] text-indigo-100">Ctrl S</kbd>
            </button>
          </div>
        )}
      </form>
    </aside>
  );
}
