import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, RefreshCw, X } from 'lucide-react';
import {
  defaultChunkSettings,
  type KnowledgeReindexRequest,
} from '../../../shared/knowledgeChunking';
import { KnowledgeDocumentEditor, type KnowledgeDraft } from './KnowledgeDocumentEditor';
import type { KnowledgeDocument } from './KnowledgeLibrary';

export function KnowledgeReindexDialog({
  document: knowledge,
  onClose,
  onApply,
}: {
  document: KnowledgeDocument;
  onClose: () => void;
  onApply: (request: KnowledgeReindexRequest) => Promise<void>;
}) {
  const [mode, setMode] = useState<'embedding' | 'rechunk'>('embedding');
  const initialSettings = { ...defaultChunkSettings, ...knowledge.chunkSettings };
  const [draft, setDraft] = useState<KnowledgeDraft>({
    title: knowledge.title,
    content: knowledge.content,
    enabled: knowledge.enabled,
    chunkSettings: initialSettings,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = window.document.activeElement as HTMLElement | null;
    dialogRef.current
      ?.querySelector<HTMLInputElement>('input[type="radio"]:checked')
      ?.focus({ preventScroll: true });
    return () => {
      previous?.focus({ preventScroll: true });
    };
  }, []);
  const apply = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await onApply(
        mode === 'rechunk'
          ? { mode, chunkSettings: draft.chunkSettings, expectedUpdatedAt: knowledge.updatedAt }
          : { mode, expectedUpdatedAt: knowledge.updatedAt },
      );
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Không reindex được tài liệu.');
    } finally {
      setBusy(false);
    }
  };
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-3 backdrop-blur-sm sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="knowledge-reindex-title"
        className={`flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl ${mode === 'rechunk' ? 'max-w-5xl' : 'max-w-lg'}`}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation();
            if (!busy) onClose();
          }
          if (event.key === 'Tab') {
            const controls = Array.from(
              dialogRef.current?.querySelectorAll<HTMLElement>(
                'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
              ) || [],
            ).filter((node) => node.getClientRects().length > 0);
            const first = controls[0];
            const last = controls.at(-1);
            if (event.shiftKey && window.document.activeElement === first) {
              event.preventDefault();
              last?.focus();
            }
            if (!event.shiftKey && window.document.activeElement === last) {
              event.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <h2 id="knowledge-reindex-title" className="text-sm font-semibold text-slate-900">
              Reindex
            </h2>
            <p className="mt-1 truncate text-xs text-slate-500">{knowledge.title}</p>
          </div>
          <button
            type="button"
            aria-label="Đóng Reindex"
            disabled={busy}
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5">
          <fieldset disabled={busy} className="mb-4 grid gap-2 sm:grid-cols-2">
            {(
              [
                { id: 'embedding', title: 'Giữ nguyên chunk', subtitle: 'Chỉ tạo lại embedding' },
                { id: 'rechunk', title: 'Chia lại chunk', subtitle: 'Cấu hình và xem trước' },
              ] as const
            ).map((option) => (
              <label
                key={option.id}
                className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 ${mode === option.id ? 'border-emerald-400 bg-emerald-50/60' : 'border-slate-200 hover:bg-slate-50'}`}
              >
                <input
                  type="radio"
                  name="reindex-mode"
                  value={option.id}
                  checked={mode === option.id}
                  onChange={() => {
                    setMode(option.id);
                    setError('');
                  }}
                  className="mt-0.5 accent-emerald-600"
                />
                <span>
                  <span className="block text-xs font-medium text-slate-700">{option.title}</span>
                  <span className="mt-1 block text-[11px] text-slate-500">{option.subtitle}</span>
                </span>
              </label>
            ))}
          </fieldset>
          {mode === 'rechunk' ? (
            <>
              <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                Các chunk hiện tại và chỉnh sửa thủ công sẽ bị thay thế.
              </p>
              <KnowledgeDocumentEditor
                draft={draft}
                onChange={setDraft}
                onSave={(event) => {
                  event.preventDefault();
                  void apply();
                }}
                onClose={onClose}
                busy={busy}
                error={error}
                editing
                reindex
                resetChunkSettings={initialSettings}
              />
            </>
          ) : (
            <>
              {error && (
                <p role="alert" className="mb-3 text-xs text-rose-700">
                  {error}
                </p>
              )}
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  disabled={busy}
                  onClick={onClose}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600 disabled:opacity-40"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void apply()}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
                >
                  {busy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  Reindex
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    window.document.body,
  );
}
