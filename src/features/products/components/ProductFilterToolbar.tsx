import React, { useEffect, useRef } from 'react';
import { AlertTriangle, ChevronDown, Columns3, Edit2, Plus } from 'lucide-react';
import {
  META_COLUMN_LABELS,
  type MetaCatalogOption,
  type MetaColumnKey,
} from './productTypes';

interface ProductFilterToolbarProps {
  viewCatalogId: string;
  isLoadingCatalogs: boolean;
  catalogs: MetaCatalogOption[];
  onCatalogChange: (nextCatalogId: string) => void;
  isMetaFilterOpen: boolean;
  setIsMetaFilterOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isMetaColumnsOpen: boolean;
  setIsMetaColumnsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  metaAvailabilityFilter: string;
  setMetaAvailabilityFilter: React.Dispatch<React.SetStateAction<string>>;
  selectedMetaProductIdsCount: number;
  visibleMetaColumns: Record<MetaColumnKey, boolean>;
  setVisibleMetaColumns: React.Dispatch<React.SetStateAction<Record<MetaColumnKey, boolean>>>;
  metaCatalogName: string;
  filteredMetaProductsCount: number;
  metaProductsError: string | null;
}

export const ProductFilterToolbar: React.FC<ProductFilterToolbarProps> = ({
  viewCatalogId,
  isLoadingCatalogs,
  catalogs,
  onCatalogChange,
  isMetaFilterOpen,
  setIsMetaFilterOpen,
  isMetaColumnsOpen,
  setIsMetaColumnsOpen,
  metaAvailabilityFilter,
  setMetaAvailabilityFilter,
  selectedMetaProductIdsCount,
  visibleMetaColumns,
  setVisibleMetaColumns,
  metaCatalogName,
  filteredMetaProductsCount,
  metaProductsError,
}) => {
  const metaFilterMenuRef = useRef<HTMLDivElement>(null);
  const metaColumnsMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMetaFilterOpen && !isMetaColumnsOpen) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (isMetaFilterOpen && !metaFilterMenuRef.current?.contains(target)) {
        setIsMetaFilterOpen(false);
      }
      if (isMetaColumnsOpen && !metaColumnsMenuRef.current?.contains(target)) {
        setIsMetaColumnsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [isMetaColumnsOpen, isMetaFilterOpen, setIsMetaColumnsOpen, setIsMetaFilterOpen]);

  return (
    <>
      <div className="flex flex-col gap-3 border-b border-slate-200 p-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {/* Dropdown chọn Catalog */}
          <select
            value={viewCatalogId}
            disabled={isLoadingCatalogs}
            onChange={(event) => onCatalogChange(event.target.value)}
            className="h-9 min-w-56 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 shadow-xs focus:border-indigo-500 focus:outline-none disabled:opacity-50 cursor-pointer"
            aria-label="Chọn Meta Catalog"
          >
            {catalogs.length === 0 && <option value="">Đang tải danh mục Catalog...</option>}
            {catalogs.map((catalog) => (
              <option key={catalog.id} value={catalog.id}>
                {catalog.name}{typeof catalog.product_count === 'number' ? ` — ${catalog.product_count} SP` : ''}
              </option>
            ))}
          </select>

          <a
            href={`https://business.facebook.com/commerce/catalogs/${encodeURIComponent(viewCatalogId)}/products`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            title="Mở catalog này trong Meta Commerce Manager"
          >
            <Edit2 className="h-3.5 w-3.5" />
            Edit
            <span className="ml-1 border-l border-slate-200 pl-2"><ChevronDown className="h-3.5 w-3.5" /></span>
          </a>
          <button
            type="button"
            disabled
            title="Tạo product set sẽ được bổ sung ở phiên bản tiếp theo"
            className="inline-flex h-9 items-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-400 shadow-sm disabled:cursor-not-allowed"
          >
            Create set
          </button>
          <div ref={metaFilterMenuRef} className="relative">
            <button
              type="button"
              onClick={() => {
                setIsMetaFilterOpen((open) => !open);
                setIsMetaColumnsOpen(false);
              }}
              className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              <Plus className="h-4 w-4" />
              Add filter
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {isMetaFilterOpen && (
              <div className="absolute left-0 top-11 z-30 w-56 rounded-lg border border-slate-200 bg-white p-3 shadow-xl">
                <label className="mb-2 block text-[11px] font-bold text-slate-600">Availability</label>
                <select
                  value={metaAvailabilityFilter}
                  onChange={(event) => setMetaAvailabilityFilter(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-700 outline-none focus:border-blue-500"
                >
                  <option value="all">All availability</option>
                  <option value="in stock">In stock</option>
                  <option value="out of stock">Out of stock</option>
                  <option value="available for order">Available for order</option>
                </select>
              </div>
            )}
          </div>
          {selectedMetaProductIdsCount > 0 && (
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
              {selectedMetaProductIdsCount} selected
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div ref={metaColumnsMenuRef} className="relative">
            <button
              type="button"
              onClick={() => {
                setIsMetaColumnsOpen((open) => !open);
                setIsMetaFilterOpen(false);
              }}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <Columns3 className="h-4 w-4" />
              Columns
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {isMetaColumnsOpen && (
              <div className="absolute right-0 top-11 z-30 w-48 rounded-lg border border-slate-200 bg-white p-1.5 shadow-xl">
                {(Object.keys(META_COLUMN_LABELS) as MetaColumnKey[]).map((column) => (
                  <label key={column} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-xs text-slate-700 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={visibleMetaColumns[column]}
                      onChange={() => setVisibleMetaColumns((current) => ({ ...current, [column]: !current[column] }))}
                      className="h-4 w-4 rounded border-slate-300 accent-blue-600"
                    />
                    {META_COLUMN_LABELS[column]}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
        <div>
          <h3 className="text-sm font-bold text-slate-900">{metaCatalogName || 'Meta Catalog'}</h3>
          <p className="text-[11px] text-slate-500">{filteredMetaProductsCount} items loaded</p>
        </div>
      </div>

      {metaProductsError && (
        <div className="m-4 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{metaProductsError}</span>
        </div>
      )}
    </>
  );
};
