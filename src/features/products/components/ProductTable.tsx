import React from 'react';
import type { Product } from '../../../types';
import { formatVND } from '../../../utils/crmUtils';
import {
  AlertTriangle,
  CheckCheck,
  Edit2,
  Image as ImageIcon,
  Loader2,
  Trash2,
} from 'lucide-react';
import {
  formatMetaPrice,
  type MetaCatalogProduct,
  type MetaColumnKey,
} from './productTypes';

interface MetaCatalogTableSectionProps {
  visibleMetaColumns: Record<MetaColumnKey, boolean>;
  visibleMetaColumnCount: number;
  allVisibleMetaProductsSelected: boolean;
  filteredMetaProducts: MetaCatalogProduct[];
  metaProductsCount: number;
  isLoadingMetaProducts: boolean;
  searchTerm: string;
  metaAvailabilityFilter: string;
  selectedMetaProductIds: string[];
  setSelectedMetaProductIds: React.Dispatch<React.SetStateAction<string[]>>;
  metaHasNextPage: boolean;
  metaNextCursor: string | null;
  onLoadMoreMetaProducts: () => void;
}

export const MetaCatalogTableSection: React.FC<MetaCatalogTableSectionProps> = ({
  visibleMetaColumns,
  visibleMetaColumnCount,
  allVisibleMetaProductsSelected,
  filteredMetaProducts,
  metaProductsCount,
  isLoadingMetaProducts,
  searchTerm,
  metaAvailabilityFilter,
  selectedMetaProductIds,
  setSelectedMetaProductIds,
  metaHasNextPage,
  metaNextCursor,
  onLoadMoreMetaProducts,
}) => {
  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-max text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-white text-[11px] font-semibold text-slate-700">
              <th className="w-14 px-4 py-3 text-center">
                <input
                  type="checkbox"
                  checked={allVisibleMetaProductsSelected}
                  onChange={() => {
                    const visibleIds = filteredMetaProducts.map((product) => product.id);
                    setSelectedMetaProductIds((current) => allVisibleMetaProductsSelected
                      ? current.filter((id) => !visibleIds.includes(id))
                      : Array.from(new Set([...current, ...visibleIds])));
                  }}
                  className="h-4 w-4 rounded border-slate-300 accent-blue-600"
                  aria-label="Chọn tất cả sản phẩm đang hiển thị"
                />
              </th>
              <th className="min-w-80 px-3 py-3">Name</th>
              <th className="min-w-36 px-3 py-3">Status</th>
              {visibleMetaColumns.variants && <th className="min-w-28 px-3 py-3">Variants</th>}
              {visibleMetaColumns.availability && <th className="min-w-36 px-3 py-3">Availability</th>}
              {visibleMetaColumns.price && <th className="min-w-36 px-3 py-3">Price</th>}
              {visibleMetaColumns.brand && <th className="min-w-32 px-3 py-3">Brand</th>}
              {visibleMetaColumns.condition && <th className="min-w-28 px-3 py-3">Condition</th>}
              {visibleMetaColumns.quantity && <th className="min-w-36 px-3 py-3">Quantity to sell</th>}
              {visibleMetaColumns.dataSource && <th className="min-w-36 px-3 py-3">Data sources</th>}
              {visibleMetaColumns.lastUpdated && <th className="min-w-32 px-3 py-3">Last updated</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-slate-700">
            {isLoadingMetaProducts && metaProductsCount === 0 ? (
              <tr>
                <td colSpan={3 + visibleMetaColumnCount} className="py-12 text-center text-slate-500">
                  <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-blue-600" />
                  Đang tải sản phẩm từ Meta...
                </td>
              </tr>
            ) : filteredMetaProducts.length === 0 ? (
              <tr>
                <td colSpan={3 + visibleMetaColumnCount} className="py-12 text-center text-slate-500">
                  {searchTerm || metaAvailabilityFilter !== 'all' ? 'Không tìm thấy sản phẩm phù hợp.' : 'Catalog chưa có sản phẩm.'}
                </td>
              </tr>
            ) : filteredMetaProducts.map((product) => {
              const reviewStatus = (product.reviewStatus || '').toLowerCase();
              const publicationStatus = (product.status || '').toLowerCase();
              const hasRejectionReason = Boolean(product.reviewRejectionReasons?.length);
              const isRejected = hasRejectionReason
                || ['rejected', 'disapproved', 'error'].some((status) => reviewStatus.includes(status));
              const isPending = !isRejected && reviewStatus.includes('pending');
              const isEligible = !isRejected && !isPending && (
                ['approved', 'active', 'eligible'].some((status) => reviewStatus.includes(status))
                || ['published', 'active'].some((status) => publicationStatus.includes(status))
              );
              const statusLabel = isEligible
                ? 'Eligible'
                : isPending
                  ? 'Pending'
                  : isRejected
                    ? 'Not eligible'
                    : reviewStatus || publicationStatus || 'Unknown';
              return (
                <tr key={product.id} className="transition hover:bg-slate-50">
                  <td className="px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={selectedMetaProductIds.includes(product.id)}
                      onChange={() => setSelectedMetaProductIds((current) => current.includes(product.id)
                        ? current.filter((id) => id !== product.id)
                        : [...current, product.id])}
                      className="h-4 w-4 rounded border-slate-300 accent-blue-600"
                      aria-label={`Chọn ${product.name}`}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-3">
                      {product.imageUrl ? (
                        <img src={product.imageUrl} alt={product.name} className="h-11 w-11 shrink-0 rounded-md border border-slate-200 object-cover" />
                      ) : (
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-400"><ImageIcon className="h-4 w-4" /></div>
                      )}
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-blue-600">{product.name}</div>
                        <div className="mt-0.5 text-[10px] text-slate-500">Content ID: {product.retailerId}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className="inline-flex items-center gap-2"
                      title={product.reviewRejectionReasons?.join('; ') || `Meta status: ${product.status || 'unknown'}`}
                    >
                      <span className={`h-2.5 w-2.5 rounded-full ${isEligible ? 'bg-emerald-600' : isPending ? 'bg-amber-500' : 'bg-rose-500'}`} />
                      {statusLabel}
                    </span>
                  </td>
                  {visibleMetaColumns.variants && <td className="px-3 py-3 text-slate-500">{product.retailerProductGroupId || '—'}</td>}
                  {visibleMetaColumns.availability && <td className="px-3 py-3 capitalize">{product.availability || '—'}</td>}
                  {visibleMetaColumns.price && <td className="px-3 py-3 font-medium text-slate-800">{formatMetaPrice(product.price, product.currency)}</td>}
                  {visibleMetaColumns.brand && <td className="px-3 py-3">{product.brand || '—'}</td>}
                  {visibleMetaColumns.condition && <td className="px-3 py-3 capitalize">{product.condition || '—'}</td>}
                  {visibleMetaColumns.quantity && <td className="px-3 py-3">{product.quantityToSell ?? product.inventory ?? '—'}</td>}
                  {visibleMetaColumns.dataSource && <td className="px-3 py-3">{product.dataSource || '—'}</td>}
                  {visibleMetaColumns.lastUpdated && <td className="px-3 py-3 text-slate-500">—</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {metaHasNextPage && metaNextCursor && (
        <div className="border-t border-slate-200 p-4 text-center">
          <button
            type="button"
            disabled={isLoadingMetaProducts}
            onClick={onLoadMoreMetaProducts}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
          >
            {isLoadingMetaProducts && <Loader2 className="h-4 w-4 animate-spin" />}
            Tải thêm sản phẩm
          </button>
        </div>
      )}
    </>
  );
};

interface ProductTableProps {
  isMetaView: boolean;
  filteredProducts: Product[];
  selectedProductIds: string[];
  setSelectedProductIds: React.Dispatch<React.SetStateAction<string[]>>;
  onOpenEditModal: (product: Product) => void;
  onDeleteProduct: (productId: string) => void;
}

export const ProductTable: React.FC<ProductTableProps> = ({
  isMetaView,
  filteredProducts,
  selectedProductIds,
  setSelectedProductIds,
  onOpenEditModal,
  onDeleteProduct,
}) => {
  return (
    <div className={`${isMetaView ? 'hidden' : ''} bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl`}>
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <h3 className="font-bold text-white text-sm">Danh Mục Sản Phẩm CRM ({filteredProducts.length})</h3>

          {selectedProductIds.length > 0 && (
            <span className="font-semibold text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Đã chọn: {selectedProductIds.length} / {filteredProducts.length}
            </span>
          )}
        </div>
        <span className="text-xs text-slate-400">Cập nhật thời gian thực</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <th className="py-3 px-3 text-center w-10">
                <input
                  type="checkbox"
                  checked={
                    filteredProducts.length > 0 &&
                    selectedProductIds.length === filteredProducts.length
                  }
                  onChange={() => {
                    if (selectedProductIds.length === filteredProducts.length && filteredProducts.length > 0) {
                      setSelectedProductIds([]);
                    } else {
                      setSelectedProductIds(filteredProducts.map((p) => p.id));
                    }
                  }}
                  title="Chọn tất cả / Bỏ chọn tất cả"
                  className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600"
                />
              </th>
              <th className="py-3 px-4">Sản Phẩm</th>
              <th className="py-3 px-3">Danh Mục / SKU</th>
              <th className="py-3 px-3 text-right">Giá Bán Niêm Yết</th>
              <th className="py-3 px-3 text-right">Giá Vốn</th>
              <th className="py-3 px-3 text-right">Biên Lợi Nhuận</th>
              <th className="py-3 px-3 text-center">Tồn Kho</th>
              <th className="py-3 px-3 text-center">Meta Catalog</th>
              <th className="py-3 px-4 text-right">Thao Tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-300">
            {filteredProducts.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-slate-500">
                  Không tìm thấy sản phẩm nào phù hợp.
                </td>
              </tr>
            ) : (
              filteredProducts.map((product) => {
                const profit = product.price - (product.costPrice || 0);
                const margin = product.price > 0 ? ((profit / product.price) * 100).toFixed(0) : '0';
                const isSelected = selectedProductIds.includes(product.id);

                return (
                  <tr
                    key={product.id}
                    className={`transition ${isSelected ? 'bg-indigo-50/80' : ''}`}
                  >
                    {/* Checkbox */}
                    <td className="py-3 px-3 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {
                          setSelectedProductIds((prev) =>
                            prev.includes(product.id) ? prev.filter((i) => i !== product.id) : [...prev, product.id]
                          );
                        }}
                        className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600"
                      />
                    </td>

                    {/* Name & Image */}
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-3">
                        <img
                          src={
                            product.image ||
                            'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=100'
                          }
                          alt={product.name}
                          className="w-10 h-10 rounded-xl object-cover shrink-0 border border-slate-700"
                        />
                        <div>
                          <div className="font-bold text-slate-900 text-xs">{product.name}</div>
                          <div className="text-[10px] text-indigo-400 font-mono mt-0.5">{product.code}</div>
                        </div>
                      </div>
                    </td>

                    {/* Category & SKU */}
                    <td className="py-3 px-3">
                      <span className="inline-block px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] border border-slate-700">
                        {product.category}
                      </span>
                      <div className="text-[10px] text-slate-400 mt-1">{product.sku || 'N/A'}</div>
                    </td>

                    {/* Selling Price */}
                    <td className="py-3 px-3 text-right font-bold text-emerald-400">
                      {formatVND(product.price)}
                    </td>

                    {/* Cost Price */}
                    <td className="py-3 px-3 text-right text-slate-400">
                      {formatVND(product.costPrice || 0)}
                    </td>

                    {/* Profit Margin */}
                    <td className="py-3 px-3 text-right font-semibold text-teal-300">
                      {margin}% ({formatVND(profit)})
                    </td>

                    {/* Stock Status Badge */}
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          product.stock > 15
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : product.stock > 0
                            ? 'bg-amber-500/10 text-amber-300 border-amber-500/30 animate-pulse'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                        }`}
                      >
                        <span>
                          {product.stock > 0 ? `${product.stock} sp` : 'Hết hàng'}
                        </span>
                      </span>
                    </td>

                    {/* Meta Catalog Sync Status */}
                    <td className="py-3 px-3 text-center">
                      {product.metaSyncStatus === 'synced' ? (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/30"
                          title={product.lastSyncedAt ? `Đã đồng bộ lúc: ${new Date(product.lastSyncedAt).toLocaleString('vi-VN')}` : 'Đã đồng bộ Meta Catalog'}
                        >
                          <CheckCheck className="w-3 h-3 text-blue-400" />
                          <span>Đã đồng bộ</span>
                        </span>
                      ) : product.metaSyncStatus === 'error' ? (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30"
                          title="Lỗi khi đồng bộ lên Meta Catalog"
                        >
                          <AlertTriangle className="w-3 h-3 text-rose-400" />
                          <span>Lỗi</span>
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700"
                          title="Chưa đồng bộ lên Meta"
                        >
                          <span>Chưa đồng bộ</span>
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <button
                          onClick={() => onOpenEditModal(product)}
                          className="p-1.5 rounded-lg text-slate-900 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition cursor-pointer font-bold"
                          title="Sửa sản phẩm"
                        >
                          <Edit2 className="w-4 h-4 text-slate-900 dark:text-slate-300 hover:text-indigo-600" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Xóa sản phẩm "${product.name}"?`)) {
                              onDeleteProduct(product.id);
                            }
                          }}
                          className="p-1.5 rounded-lg text-slate-900 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 transition cursor-pointer font-bold"
                          title="Xóa sản phẩm"
                        >
                          <Trash2 className="w-4 h-4 text-slate-900 dark:text-slate-300 hover:text-rose-600" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
