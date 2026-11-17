import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  FileText,
  ListFilter,
  Pencil,
  RefreshCw,
  Search,
} from 'lucide-react';
import { api } from '../../utils/apiClient';
import { defaultChunkSettings } from '../../../shared/knowledgeChunking';
import { DocumentStatus, type KnowledgeDocument } from './KnowledgeLibrary';
import {
  KnowledgeChunkEditor,
  type EditableChunk,
  type KnowledgeChunkEditorHandle,
} from './KnowledgeChunkEditor';

interface Detail {
  document: KnowledgeDocument;
  chunks: { id: string; ordinal: number; content: string }[];
  total: number;
}

const button =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40';
const date = (value?: string) => (value ? new Date(value).toLocaleString('vi-VN') : '—');

export function KnowledgeDocumentDetail({
  id,
  canManage,
  busy,
  onBack,
  onEdit,
  onToggle,
  onReindex,
}: {
  id: string;
  canManage: boolean;
  busy: boolean;
  onBack: () => void;
  onEdit: (document: KnowledgeDocument) => void;
  onToggle: (document: KnowledgeDocument) => void;
  onReindex: (id: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [editingChunk, setEditingChunk] = useState<EditableChunk | null>(null);
  const editorRef = useRef<KnowledgeChunkEditorHandle>(null);
  const selectChunk = (chunk: EditableChunk) => {
    if (!canManage || busy || editingChunk?.id === chunk.id) return;
    if (editingChunk) editorRef.current?.requestClose(() => setEditingChunk(chunk));
    else setEditingChunk(chunk);
  };
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setTerm(search.trim());
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search]);
  const query = useQuery({
    queryKey: ['ai', 'knowledge', 'detail', id, page, pageSize, term],
    queryFn: () =>
      api.get<Detail>(
        `/ai/knowledge/${encodeURIComponent(id)}?${new URLSearchParams({ page: String(page), pageSize: String(pageSize), search: term })}`,
      ),
    refetchInterval: (state) =>
      ['pending', 'indexing'].includes(state.state.data?.document.embeddingStatus || '')
        ? 5000
        : false,
  });
  const document = query.data?.document;
  const pages = Math.max(1, Math.ceil((query.data?.total || 0) / pageSize));
  useEffect(() => {
    if (query.data && page > pages) setPage(pages);
  }, [query.data, page, pages]);
  const settings = { ...defaultChunkSettings, ...document?.chunkSettings };

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className={button}
            aria-label="Quay lại kho kiến thức"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <FileText className="h-5 w-5 shrink-0 text-indigo-500" />
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-slate-900">
              {document?.title || 'Chi tiết tài liệu'}
            </h2>
            <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
              <ListFilter className="h-3 w-3" />
              GENERAL
            </span>
          </div>
        </div>
        {document && (
          <div className="flex flex-wrap items-center gap-2">
            {canManage && (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onEdit(document)}
                  className={button}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Chỉnh sửa tài liệu
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onReindex(id)}
                  className={button}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Reindex
                </button>
              </>
            )}
            <div className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2">
              <DocumentStatus document={document} />
              {canManage && (
                <button
                  type="button"
                  role="switch"
                  aria-checked={document.enabled}
                  aria-label="Sử dụng tài liệu"
                  disabled={busy}
                  onClick={() => onToggle(document)}
                  className={`relative h-4 w-7 rounded disabled:opacity-40 ${document.enabled ? 'bg-indigo-600' : 'bg-slate-200'}`}
                >
                  <span
                    className={`absolute top-0.5 h-3 w-3 rounded-sm bg-white ${document.enabled ? 'left-3.5' : 'left-0.5'}`}
                  />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-semibold uppercase text-slate-700">
              {query.data?.total ?? '…'} chunk
            </span>
            <label className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-slate-400">
              <Search className="h-4 w-4" />
              <input
                aria-label="Tìm trong các chunk"
                placeholder="Tìm kiếm chunk"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-44 bg-transparent text-xs text-slate-700 outline-none"
              />
            </label>
          </div>
          {query.isPending ? (
            <p className="py-20 text-center text-sm text-slate-500">Đang tải các chunk…</p>
          ) : query.isError ? (
            <div role="alert" className="py-12 text-center text-sm text-rose-600">
              <p>{query.error.message}</p>
              <button
                type="button"
                onClick={() => void query.refetch()}
                className={`${button} mt-3`}
              >
                Thử lại
              </button>
            </div>
          ) : (
            <>
              <div className="max-h-[65vh] min-h-64 space-y-1 overflow-y-auto pr-2">
                {query.data.chunks.length ? (
                  query.data.chunks.map((chunk) => (
                    <article
                      key={chunk.id}
                      onClick={() => selectChunk(chunk)}
                      className={`group relative rounded-xl px-3 py-3 transition-colors hover:bg-slate-100/70 focus-within:bg-slate-100/70 ${canManage ? 'cursor-pointer' : ''} ${editingChunk?.id === chunk.id ? 'bg-slate-100/70' : ''}`}
                    >
                      <div className="mb-1 flex min-h-4 items-center gap-2 pr-10 text-[11px] text-slate-500">
                        <ListFilter className="h-3 w-3" />
                        <span>Chunk-{String(chunk.ordinal + 1).padStart(2, '0')}</span>
                        <span>·</span>
                        <span>{chunk.content.length.toLocaleString('vi-VN')} ký tự</span>
                        {canManage && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={(event) => {
                              event.stopPropagation();
                              selectChunk(chunk);
                            }}
                            aria-label={`Chỉnh sửa Chunk-${chunk.ordinal + 1}`}
                            className="absolute right-2 top-2 rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 shadow-sm hover:text-indigo-600 focus-visible:opacity-100 disabled:cursor-default disabled:opacity-40 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            <span className="absolute inset-0" />
                          </button>
                        )}
                      </div>
                      <p className="line-clamp-2 whitespace-pre-wrap break-words text-sm leading-5 text-slate-700">
                        {chunk.content}
                      </p>
                    </article>
                  ))
                ) : (
                  <p className="py-20 text-center text-sm text-slate-400">
                    {term ? 'Không có chunk phù hợp.' : 'Chưa có chunk.'}
                  </p>
                )}
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className={button}
                    disabled={page <= 1}
                    aria-label="Trang trước"
                    onClick={() => setPage(page - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-xs tabular-nums text-slate-500">
                    {page} / {pages}
                  </span>
                  <button
                    type="button"
                    className={button}
                    disabled={page >= pages}
                    aria-label="Trang sau"
                    onClick={() => setPage(page + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex items-center gap-1" aria-label="Số chunk mỗi trang">
                  {[10, 25, 50].map((size) => (
                    <button
                      key={size}
                      type="button"
                      aria-pressed={size === pageSize}
                      onClick={() => {
                        setPageSize(size);
                        setPage(1);
                      }}
                      className={`rounded-lg px-3 py-2 text-xs ${size === pageSize ? 'bg-indigo-50 font-medium text-indigo-600' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
        {document && (
          <aside className="space-y-7 border-t border-slate-100 p-6 lg:border-l lg:border-t-0">
            <div>
              <h3 className="mb-4 text-xs font-semibold uppercase text-slate-700">
                Thông tin tài liệu
              </h3>
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-4 text-xs text-slate-500">
                <dt>Tên tài liệu</dt>
                <dd className="break-words text-slate-700">{document.title}</dd>
                <dt>Ngày tải lên</dt>
                <dd>{date(document.createdAt)}</dd>
                <dt>Cập nhật lần cuối</dt>
                <dd>{date(document.updatedAt)}</dd>
                <dt>Nguồn</dt>
                <dd>File tải lên</dd>
              </dl>
            </div>
            <div>
              <h3 className="mb-4 text-xs font-semibold uppercase text-slate-700">
                Thông số kỹ thuật
              </h3>
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-4 text-xs text-slate-500">
                <dt>Chunking mode</dt>
                <dd>General</dd>
                <dt>Độ dài tối đa</dt>
                <dd>{settings.maxLength.toLocaleString('vi-VN')} ký tự</dd>
                <dt>Độ chồng lấn</dt>
                <dd>{settings.overlap.toLocaleString('vi-VN')} ký tự</dd>
                <dt>Số chunk</dt>
                <dd>{document._count.chunks.toLocaleString('vi-VN')}</dd>
                <dt>Embedding model</dt>
                <dd className="break-words">{document.embeddingModel || '—'}</dd>
              </dl>
            </div>
            {document.embeddingError && (
              <p
                role="alert"
                className="break-words rounded-lg bg-rose-50 p-3 text-xs leading-5 text-rose-600"
              >
                {document.embeddingError}
              </p>
            )}
          </aside>
        )}
      </div>
      {editingChunk && (
        <KnowledgeChunkEditor
          key={editingChunk.id}
          ref={editorRef}
          documentId={id}
          chunk={editingChunk}
          onClose={() => setEditingChunk(null)}
        />
      )}
    </section>
  );
}
