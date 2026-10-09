import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  X,
  Search,
  Package,
  Loader2,
  Send,
  ExternalLink,
  Tag,
  Check,
  AlertCircle
} from 'lucide-react';
import { api } from '../../../utils/apiClient';
import { queryKeys } from '../../../lib/queryClient';

export interface MetaCatalogProduct {
  id: string;
  retailerId: string;
  name: string;
  description?: string;
  price?: string | number;
  currency?: string;
  availability?: string;
  imageUrl?: string;
  category?: string;
  status?: string;
}

interface MetaCatalogOption {
  id: string;
  name: string;
  product_count?: number;
}

interface ProductPickerModalProps {
  isOpen: boolean;
  phoneNumberId: string;
  catalogScopeId: string;
  onClose: () => void;
  onSendProduct: (product: MetaCatalogProduct, catalogId: string, customText: string) => void;
}

function formatProductPrice(price?: string | number, currency?: string): string {
  if (price === undefined || price === null || price === '') return 'Liên hệ';
  if (typeof price === 'string' && /[a-z]/i.test(price)) return price;
  const num = Number(price);
  if (!Number.isFinite(num)) return String(price);
  const amount = num / 100;
  return `${new Intl.NumberFormat('vi-VN').format(amount)} ${currency || 'VND'}`;
}

export const ProductPickerModal: React.FC<ProductPickerModalProps> = ({
  isOpen,
  phoneNumberId,
  catalogScopeId,
  onClose,
  onSendProduct,
}) => {
  const [selectedCatalogId, setSelectedCatalogId] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<MetaCatalogProduct | null>(null);
  const [customMessage, setCustomMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const catalogsQuery = useQuery({
    queryKey: queryKeys.metaCatalogs(catalogScopeId),
    queryFn: () => api.get<{ catalogs: MetaCatalogOption[]; currentCatalogId: string | null }>(
      `/catalog/list?phoneNumberId=${encodeURIComponent(phoneNumberId)}`,
    ),
    enabled: Boolean(phoneNumberId && catalogScopeId),
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const catalogs = catalogsQuery.data?.catalogs || [];

  useEffect(() => {
    const defaultId = catalogsQuery.data?.currentCatalogId || catalogs[0]?.id || '';
    setSelectedCatalogId((current) => catalogs.some((catalog) => catalog.id === current) ? current : defaultId);
  }, [catalogs, catalogsQuery.data?.currentCatalogId]);

  const productsQuery = useQuery({
    queryKey: queryKeys.metaCatalogProducts(catalogScopeId, selectedCatalogId),
    queryFn: () => api.get<{ products: MetaCatalogProduct[] }>(
      `/catalog/${encodeURIComponent(selectedCatalogId)}/products?limit=50&phoneNumberId=${encodeURIComponent(phoneNumberId)}`,
    ),
    enabled: Boolean(phoneNumberId && catalogScopeId && selectedCatalogId),
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const products = productsQuery.data?.products || [];
  const isLoadingCatalogs = catalogsQuery.isPending && Boolean(phoneNumberId);
  const isLoadingProducts = productsQuery.isPending && Boolean(selectedCatalogId);
  const error = catalogsQuery.error?.message || productsQuery.error?.message || null;

  useEffect(() => {
    setSelectedProduct(null);
    setSearchTerm('');
  }, [catalogScopeId, selectedCatalogId]);

  const handleCatalogChange = (catId: string) => {
    setSelectedCatalogId(catId);
    setSearchTerm('');
  };

  const handleClose = () => {
    setCustomMessage('');
    setSelectedProduct(null);
    onClose();
  };

  const handleSend = () => {
    if (!selectedProduct || !selectedCatalogId) return;
    onSendProduct(selectedProduct, selectedCatalogId, customMessage);
    handleClose();
  };

  if (!isOpen) return null;

  const filteredProducts = products.filter((p) => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      p.retailerId.toLowerCase().includes(q) ||
      (p.description || '').toLowerCase().includes(q)
    );
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) handleClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-scaleUp">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Gửi Sản Phẩm Từ Meta Catalog</h3>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar: Catalog Selector + Search */}
        <div className="p-4 border-b border-slate-100 bg-white flex flex-col sm:flex-row gap-3">
          <div className="sm:w-1/2">
            <select
              value={selectedCatalogId}
              disabled={isLoadingCatalogs}
              onChange={(e) => handleCatalogChange(e.target.value)}
              className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-800 focus:outline-indigo-500 cursor-pointer disabled:opacity-50"
            >
              {catalogs.length === 0 && (
                <option value="">Không có catalog liên kết với số này</option>
              )}
              {catalogs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {typeof c.product_count === 'number' ? `(${c.product_count} SP)` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:w-1/2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm tên, Content ID..."
                className="w-full text-xs pl-8 pr-3 py-2 rounded-xl border border-slate-300 focus:outline-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Product List Content */}
        <div className="flex-1 overflow-y-auto p-4 min-h-[260px] max-h-[380px] bg-slate-50/50">
          {error && (
            <div className="p-3 mb-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {isLoadingCatalogs || isLoadingProducts ? (
            <div className="py-16 flex flex-col items-center justify-center text-slate-400 text-xs gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
              <span>Đang tải danh sách sản phẩm từ Meta...</span>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <span>
                {selectedCatalogId
                  ? 'Không tìm thấy sản phẩm nào trong catalog này.'
                  : 'Số WhatsApp này chưa được liên kết với Meta Catalog.'}
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredProducts.map((p) => {
                const isSelected = selectedProduct?.id === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => setSelectedProduct((current) => current?.id === p.id ? null : p)}
                    className={`p-3 rounded-xl border transition cursor-pointer flex gap-3 relative ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-500/20 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs'
                    }`}
                  >
                    <div className="w-16 h-16 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        <Package className="w-6 h-6 text-slate-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 pr-6">
                      <p className={`text-xs font-bold truncate ${isSelected ? 'text-emerald-950' : 'text-slate-800'}`}>
                        {p.name}
                      </p>
                      <p className="text-[11px] font-bold text-emerald-700 mt-0.5">
                        {formatProductPrice(p.price, p.currency)}
                      </p>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
                        ID: {p.retailerId}
                      </p>
                    </div>
                    {isSelected && (
                      <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Custom Message Input */}
        <div className="p-4 border-t border-slate-100 bg-white">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder="Lời nhắn đi kèm..."
              className="flex-1 text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-emerald-500"
            />
            <button
              type="button"
              disabled={!selectedProduct}
              onClick={handleSend}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-md shadow-emerald-600/20 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Gửi</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
