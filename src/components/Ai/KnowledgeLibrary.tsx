import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowDown,
  ArrowDownWideNarrow,
  ArrowUp,
  ArrowUpWideNarrow,
  BookOpen,
  CircleAlert,
  FileText,
  ListFilter,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  defaultChunkSettings,
  normalizeKnowledgeText,
  type ChunkSettings,
} from '../../../shared/knowledgeChunking';

export interface KnowledgeDocument {
  id: string;
  title: string;
  brand: string;
  content: string;
  chunkSettings?: Partial<ChunkSettings>;
  enabled: boolean;
  updatedAt: string;
  createdAt?: string;
  _count: { chunks: number };
  embeddingStatus?: string;
  embeddingError?: string | null;
  embeddingModel?: string | null;
}

const filters = [
  { id: 'all', label: 'Tất cả' },
  { id: 'ready', label: 'Sẵn sàng' },
  { id: 'pending', label: 'Đang xử lý' },
  { id: 'error', label: 'Lỗi' },
  { id: 'disabled', label: 'Đã tắt' },
] as const;
type Filter = (typeof filters)[number]['id'];
type Sort = 'upload' | 'name' | 'words' | 'chunks';
const statusOf = (document: KnowledgeDocument): Exclude<Filter, 'all'> =>
  !document.enabled
    ? 'disabled'
    : document.embeddingStatus === 'ready'
      ? 'ready'
      : document.embeddingStatus === 'error'
        ? 'error'
        : 'pending';
const dateLabel = (date?: string) =>
  date
    ? new Date(date).toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';
const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
const control =
  'h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-600 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50';
const menuItem =
  'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs text-slate-600 hover:bg-slate-50 focus:bg-slate-50 focus:outline-none disabled:opacity-40';
function countWords(content: string) {
  const pattern = /\S+/g;
  let count = 0;
  while (pattern.exec(content)) count++;
  return count;
}
function DocumentStatus({ document }: { document: KnowledgeDocument }) {
  const status = statusOf(document);
  return (
    <span
      title={document.embeddingError || undefined}
      className={`inline-flex items-center gap-2 text-xs ${status === 'ready' ? 'text-emerald-600' : status === 'error' ? 'text-rose-600' : status === 'disabled' ? 'text-slate-400' : 'text-amber-600'}`}
    >
      {status === 'pending' ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <span
          className={`h-2 w-2 rounded-[3px] ${status === 'ready' ? 'bg-emerald-400 shadow-sm shadow-emerald-200' : status === 'error' ? 'bg-rose-400' : 'bg-slate-300'}`}
        />
      )}
      {status === 'ready'
        ? 'Sẵn sàng'
        : status === 'error'
          ? 'Lỗi xử lý'
          : status === 'disabled'
            ? 'Đã tắt'
            : document.embeddingStatus === 'indexing'
              ? 'Đang xử lý'
              : 'Chờ xử lý'}
    </span>
  );
}

export function KnowledgeLibrary({
  documents,
  loading,
  error,
  onRetry,
  busy,
  canManage,
  deleteId,
  onUpload,
  onEdit,
  onReindex,
  onToggle,
  onRequestDelete,
  onCancelDelete,
  onDelete,
}: {
  documents: KnowledgeDocument[];
  loading: boolean;
  error?: string;
  onRetry: () => void;
  busy: boolean;
  canManage: boolean;
  deleteId: string | null;
  onUpload: () => void;
  onEdit: (document: KnowledgeDocument) => void;
  onReindex: (id: string) => void;
  onToggle: (document: KnowledgeDocument) => void;
  onRequestDelete: (id: string) => void;
  onCancelDelete: () => void;
  onDelete: (id: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('upload');
  const [descending, setDescending] = useState(true);
  const [menu, setMenu] = useState<{
    document: KnowledgeDocument;
    top: number;
    right: number;
  } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const outside = (event: MouseEvent) => {
      if (
        !menuRef.current?.contains(event.target as Node) &&
        !triggerRef.current?.contains(event.target as Node)
      )
        close();
    };
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close();
        triggerRef.current?.focus();
      }
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      const items = Array.from(
        menuRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') || [],
      );
      if (!items.length) return;
      event.preventDefault();
      const current = items.indexOf(document.activeElement as HTMLButtonElement);
      const next =
        event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? items.length - 1
            : (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items[next]?.focus();
    };
    const frame = requestAnimationFrame(() =>
      menuRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus(),
    );
    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', keydown);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('mousedown', outside);
      document.removeEventListener('keydown', keydown);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [menu]);
  const entries = useMemo(
    () => documents.map((document) => ({ document, words: countWords(document.content) })),
    [documents],
  );
  const counts = { all: documents.length, ready: 0, pending: 0, error: 0, disabled: 0 };
  for (const document of documents) counts[statusOf(document)]++;
  const terms = normalizeKnowledgeText(search).split(' ').filter(Boolean);
  const visible = entries
    .filter(({ document }) => {
      if (filter !== 'all' && statusOf(document) !== filter) return false;
      if (!terms.length) return true;
      const text = normalizeKnowledgeText(`${document.title}\n${document.content}`);
      return terms.every((term) => text.includes(term));
    })
    .sort((a, b) => {
      const order =
        sort === 'name'
          ? a.document.title.localeCompare(b.document.title, 'vi', {
              numeric: true,
              sensitivity: 'base',
            })
          : sort === 'words'
            ? a.words - b.words
            : sort === 'chunks'
              ? a.document._count.chunks - b.document._count.chunks
              : (a.document.createdAt ? new Date(a.document.createdAt).getTime() : 0) -
                (b.document.createdAt ? new Date(b.document.createdAt).getTime() : 0);
      return (descending ? -order : order) || a.document.id.localeCompare(b.document.id);
    });
  const chooseSort = (next: Sort) => {
    if (sort === next) setDescending(!descending);
    else {
      setSort(next);
      setDescending(next !== 'name');
    }
  };
  const filtered = !!search.trim() || filter !== 'all';
  const header = (label: string, key: Sort) => (
    <button
      type="button"
      onClick={() => chooseSort(key)}
      className="inline-flex items-center gap-1 uppercase hover:text-indigo-600"
    >
      {label}
      {sort === key ? (
        descending ? (
          <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUp className="h-3 w-3" />
        )
      ) : (
        <ArrowDown className="h-3 w-3 text-slate-300" />
      )}
    </button>
  );
  const openMenu = (button: HTMLButtonElement, document: KnowledgeDocument) => {
    if (menu?.document.id === document.id) {
      setMenu(null);
      return;
    }
    triggerRef.current = button;
    const rect = button.getBoundingClientRect();
    setMenu({
      document,
      right: Math.max(12, window.innerWidth - rect.right),
      top: rect.bottom + 150 > window.innerHeight ? Math.max(12, rect.top - 140) : rect.bottom + 6,
    });
  };

  return (
    <section
      aria-busy={busy}
      aria-label="Danh sách tài liệu"
      className="rounded-2xl border border-slate-100 bg-white"
    >
      <div className="flex flex-wrap items-center gap-2 p-3 sm:px-4">
        <select
          aria-label="Lọc trạng thái tài liệu"
          value={filter}
          onChange={(event) => {
            setFilter(event.target.value as Filter);
            onCancelDelete();
          }}
          className={`${control} w-40`}
        >
          {filters.map(({ id, label }) => (
            <option key={id} value={id}>
              {label}
              {counts[id] ? ` (${counts[id]})` : ''}
            </option>
          ))}
        </select>
        <div className="relative min-w-40 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            aria-label="Tìm tài liệu"
            placeholder="Tìm kiếm…"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              onCancelDelete();
            }}
            className="h-8 w-full rounded-lg border border-transparent bg-slate-100/80 pl-8 pr-7 text-xs text-slate-700 outline-none focus:border-indigo-300 focus:bg-white"
          />
          {search && (
            <button
              type="button"
              aria-label="Xóa tìm kiếm"
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        <div className="flex items-center overflow-hidden rounded-lg bg-slate-100/80">
          <select
            aria-label="Sắp xếp tài liệu"
            value={sort}
            onChange={(event) => {
              setSort(event.target.value as Sort);
              setDescending(event.target.value !== 'name');
            }}
            className="h-8 border-0 bg-transparent pl-3 pr-2 text-xs text-slate-600 outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-300"
          >
            <option value="upload">Sắp xếp: Thời gian tải lên</option>
            <option value="name">Sắp xếp: Tên tài liệu</option>
            <option value="words">Sắp xếp: Số từ</option>
            <option value="chunks">Sắp xếp: Số đoạn</option>
          </select>
          <button
            type="button"
            onClick={() => setDescending(!descending)}
            aria-label={descending ? 'Sắp xếp tăng dần' : 'Sắp xếp giảm dần'}
            title={descending ? 'Sắp xếp tăng dần' : 'Sắp xếp giảm dần'}
            className="flex h-8 w-8 items-center justify-center border-l border-white text-slate-500 hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-300"
          >
            {descending ? (
              <ArrowDownWideNarrow className="h-4 w-4" />
            ) : (
              <ArrowUpWideNarrow className="h-4 w-4" />
            )}
          </button>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={onUpload}
            disabled={busy}
            className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-xs font-medium text-white shadow-sm hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Thêm file
          </button>
        )}
      </div>
      {loading ? (
        <div role="status" className="space-y-4 px-5 py-8">
          <span className="sr-only">Đang tải tài liệu…</span>
          {[1, 2, 3].map((key) => (
            <div key={key} className="h-4 animate-pulse rounded bg-slate-100" />
          ))}
        </div>
      ) : error ? (
        <div
          role="alert"
          className="m-4 flex gap-2 rounded-lg bg-rose-50 p-3 text-xs text-rose-700"
        >
          <CircleAlert className="h-4 w-4 shrink-0" />
          {error}
          <button type="button" onClick={onRetry} className="underline">
            Thử lại
          </button>
        </div>
      ) : !visible.length ? (
        <div className="flex min-h-52 flex-col items-center justify-center gap-3 border-t border-slate-100 p-8">
          {documents.length ? (
            <Search className="h-7 w-7 text-slate-300" />
          ) : (
            <BookOpen className="h-7 w-7 text-slate-300" />
          )}
          <p className="text-sm text-slate-600">
            {documents.length ? 'Không tìm thấy tài liệu' : 'Chưa có tài liệu'}
          </p>
          {filtered && (
            <button
              type="button"
              onClick={() => {
                setFilter('all');
                setSearch('');
              }}
              className="text-xs text-indigo-600 hover:underline"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto px-3 pb-1">
            <table
              aria-label="Tài liệu trong kho"
              className="w-full min-w-[960px] border-collapse text-left"
            >
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                  <th scope="col" className="w-9 px-2 py-3 font-medium">
                    #
                  </th>
                  <th
                    scope="col"
                    aria-sort={
                      sort === 'name' ? (descending ? 'descending' : 'ascending') : undefined
                    }
                    className="px-2 py-3 font-medium"
                  >
                    {header('Tên tài liệu', 'name')}
                  </th>
                  <th scope="col" className="px-3 py-3 font-medium">
                    Chia đoạn
                  </th>
                  <th
                    scope="col"
                    aria-sort={
                      sort === 'words' ? (descending ? 'descending' : 'ascending') : undefined
                    }
                    className="whitespace-nowrap px-3 py-3 font-medium"
                  >
                    {header('Số từ', 'words')}
                  </th>
                  <th
                    scope="col"
                    aria-sort={
                      sort === 'chunks' ? (descending ? 'descending' : 'ascending') : undefined
                    }
                    className="whitespace-nowrap px-3 py-3 font-medium"
                  >
                    {header('Số đoạn', 'chunks')}
                  </th>
                  <th
                    scope="col"
                    aria-sort={
                      sort === 'upload' ? (descending ? 'descending' : 'ascending') : undefined
                    }
                    className="whitespace-nowrap px-3 py-3 font-medium"
                  >
                    {header('Tải lên', 'upload')}
                  </th>
                  <th scope="col" className="whitespace-nowrap px-3 py-3 font-medium">
                    Trạng thái
                  </th>
                  <th scope="col" className="px-3 py-3 text-right font-medium">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map(({ document, words }, index) => (
                  <tr
                    key={document.id}
                    className="border-b border-slate-100/80 text-xs text-slate-600 hover:bg-slate-50/50"
                  >
                    <td className="px-2 py-3 text-[11px] tabular-nums text-slate-400">
                      {index + 1}
                    </td>
                    <td className="w-full min-w-48 px-2 py-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <FileText className="h-3.5 w-3.5 shrink-0 text-indigo-500" />
                        {canManage ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => onEdit(document)}
                            title={document.title}
                            className="max-w-sm truncate text-left text-xs font-medium text-slate-700 hover:text-indigo-600 disabled:opacity-50"
                          >
                            {document.title}
                          </button>
                        ) : (
                          <span
                            title={document.title}
                            className="max-w-sm truncate text-xs text-slate-700"
                          >
                            {document.title}
                          </span>
                        )}
                      </div>
                      {document.embeddingError && (
                        <p
                          title={document.embeddingError}
                          className="mt-1 max-w-sm truncate text-[11px] text-rose-500"
                        >
                          {document.embeddingError}
                        </p>
                      )}
                      {deleteId === document.id && canManage && (
                        <div role="alert" className="mt-2 flex flex-wrap items-center gap-2">
                          <span className="text-xs text-rose-600">Xóa tài liệu này?</span>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => onDelete(document.id)}
                            className="rounded bg-rose-600 px-2 py-1 text-[11px] text-white disabled:opacity-50"
                          >
                            Xác nhận xóa
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={onCancelDelete}
                            className="rounded border border-slate-200 px-2 py-1 text-[11px] text-slate-500"
                          >
                            Hủy
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        title={`Tối đa ${document.chunkSettings?.maxLength ?? defaultChunkSettings.maxLength} ký tự · Chồng lấn ${document.chunkSettings?.overlap ?? defaultChunkSettings.overlap} ký tự`}
                        className="inline-flex items-center gap-1 rounded border border-slate-200 px-1 py-0.5 text-[9px] font-medium text-slate-500"
                      >
                        <ListFilter className="h-2.5 w-2.5" />
                        GENERAL
                      </span>
                    </td>
                    <td
                      title={`${words.toLocaleString('vi-VN')} từ`}
                      className="px-3 py-3 tabular-nums"
                    >
                      {compact.format(words).toLowerCase()}
                    </td>
                    <td className="px-3 py-3 tabular-nums">
                      {compact.format(document._count.chunks).toLowerCase()}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-[11px] tabular-nums">
                      <time dateTime={document.createdAt}>{dateLabel(document.createdAt)}</time>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      <DocumentStatus document={document} />
                    </td>
                    <td className="px-3 py-3">
                      {canManage ? (
                        <div className="flex items-center justify-end gap-3">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={document.enabled}
                            aria-label={`${document.enabled ? 'Tắt' : 'Bật'} tài liệu ${document.title}`}
                            disabled={busy}
                            onClick={() => onToggle(document)}
                            className={`relative h-4 w-7 shrink-0 rounded transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:opacity-50 ${document.enabled ? 'bg-indigo-600' : 'bg-slate-200'}`}
                          >
                            <span
                              className={`absolute top-0.5 h-3 w-3 rounded-sm bg-white shadow-sm transition-all ${document.enabled ? 'left-3.5' : 'left-0.5'}`}
                            />
                          </button>
                          <span aria-hidden="true" className="h-3 w-px bg-slate-200" />
                          <button
                            type="button"
                            aria-haspopup="menu"
                            aria-expanded={menu?.document.id === document.id}
                            aria-label={`Thao tác ${document.title}`}
                            disabled={busy}
                            onClick={(event) => openMenu(event.currentTarget, document)}
                            className="rounded p-1 text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:opacity-50"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap justify-between gap-2 px-5 py-3 text-[11px] text-slate-400">
            <span aria-live="polite">
              {filtered
                ? `${visible.length} / ${documents.length} tài liệu`
                : `${documents.length} tài liệu`}
            </span>
            {documents.length >= 200 && <span>Hiển thị 200 tài liệu cập nhật gần nhất.</span>}
          </div>
        </>
      )}
      {menu &&
        canManage &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label={`Thao tác ${menu.document.title}`}
            style={{ position: 'fixed', top: menu.top, right: menu.right }}
            className="z-50 w-48 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg"
          >
            <button
              type="button"
              role="menuitem"
              disabled={busy}
              onClick={() => {
                onEdit(menu.document);
                setMenu(null);
              }}
              className={menuItem}
            >
              <Pencil className="h-3.5 w-3.5" />
              Sửa tài liệu
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={
                busy || ['pending', 'indexing'].includes(menu.document.embeddingStatus || '')
              }
              onClick={() => {
                onReindex(menu.document.id);
                setMenu(null);
              }}
              className={menuItem}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Lập lại chỉ mục
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={busy}
              onClick={() => {
                onRequestDelete(menu.document.id);
                setMenu(null);
              }}
              className={`${menuItem} text-rose-600 hover:bg-rose-50 focus:bg-rose-50`}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Xóa tài liệu
            </button>
          </div>,
          document.body,
        )}
    </section>
  );
}
