import React, { useEffect, useState, useRef } from 'react';
import type { Product } from '../../types';
import { formatVND } from '../../utils/crmUtils';
import { ImportProductCsvModal } from '../CsvImport/ImportProductCsvModal';
import { api } from '../../utils/apiClient';
import {
  Package,
  Plus,
  Search,
  Filter,
  AlertTriangle,
  Edit2,
  Trash2,
  X,
  Save,
  Tag,
  DollarSign,
  Boxes,
  TrendingUp,
  Image as ImageIcon,
  Upload,
  Loader2,
  CheckCheck,
  ArrowDownToLine,
  ChevronDown,
  Columns3,
} from 'lucide-react';

interface ProductManagementViewProps {
  products: Product[];
  onAddProduct: (product: Partial<Product>) => void;
  onEditProduct: (product: Product) => void;
  onDeleteProduct: (productId: string) => void;
  onImportProducts?: (products: Product[]) => Promise<unknown> | void;
}

const CATEGORIES = ['Tất cả danh mục', 'Mỹ Phẩm', 'Thực Phẩm Chức Năng', 'Thời Trang', 'Gia Dụng', 'Khác'];

interface MetaCatalogOption {
  id: string;
  name: string;
  product_count?: number;
}

interface MetaCatalogProduct {
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
  reviewStatus?: string;
  reviewRejectionReasons?: string[];
  retailerProductGroupId?: string;
  brand?: string;
  condition?: string;
  inventory?: number;
  quantityToSell?: number;
  dataSource?: string;
}

type MetaColumnKey = 'variants' | 'availability' | 'price' | 'brand' | 'condition' | 'quantity' | 'dataSource' | 'lastUpdated';

const META_COLUMN_LABELS: Record<MetaColumnKey, string> = {
  variants: 'Variants',
  availability: 'Availability',
  price: 'Price',
  brand: 'Brand',
  condition: 'Condition',
  quantity: 'Quantity to sell',
  dataSource: 'Data sources',
  lastUpdated: 'Last updated',
};

function formatMetaPrice(price?: string | number, currency?: string): string {
  if (price === undefined || price === null || price === '') return 'Chưa có giá';
  if (typeof price === 'string') {
    if (/[a-z]/i.test(price)) return price;
  }
  const numericPrice = Number(price);
  if (!Number.isFinite(numericPrice)) return String(price);
  const amount = numericPrice / 100;
  return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(amount)}${currency ? ` ${currency}` : ''}`;
}

export const ProductManagementView: React.FC<ProductManagementViewProps> = ({
  products,
  onAddProduct,
  onEditProduct,
  onDeleteProduct,
  onImportProducts,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Tất cả danh mục');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportCsvOpen, setIsImportCsvOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Meta Catalog Sync State
  const [isImportingMeta, setIsImportingMeta] = useState(false);
  const [syncAlert, setSyncAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [catalogs, setCatalogs] = useState<MetaCatalogOption[]>([]);
  const [defaultCatalogId, setDefaultCatalogId] = useState('');
  const [viewCatalogId, setViewCatalogId] = useState('');
  const [metaProducts, setMetaProducts] = useState<MetaCatalogProduct[]>([]);
  const [metaCatalogName, setMetaCatalogName] = useState('');
  const [metaNextCursor, setMetaNextCursor] = useState<string | null>(null);
  const [metaHasNextPage, setMetaHasNextPage] = useState(false);
  const [isLoadingCatalogs, setIsLoadingCatalogs] = useState(true);
  const [isLoadingMetaProducts, setIsLoadingMetaProducts] = useState(false);
  const [metaProductsError, setMetaProductsError] = useState<string | null>(null);
  const [selectedMetaProductIds, setSelectedMetaProductIds] = useState<string[]>([]);
  const [isMetaColumnsOpen, setIsMetaColumnsOpen] = useState(false);
  const [isMetaFilterOpen, setIsMetaFilterOpen] = useState(false);
  const [metaAvailabilityFilter, setMetaAvailabilityFilter] = useState('all');
  const [visibleMetaColumns, setVisibleMetaColumns] = useState<Record<MetaColumnKey, boolean>>({
    variants: true,
    availability: true,
    price: true,
    brand: false,
    condition: false,
    quantity: false,
    dataSource: false,
    lastUpdated: true,
  });
  const catalogRequestIdRef = useRef(0);
  const metaFilterMenuRef = useRef<HTMLDivElement>(null);
  const metaColumnsMenuRef = useRef<HTMLDivElement>(null);

  const loadMetaCatalogProducts = async (catalogId: string, after?: string, append = false) => {
    if (!catalogId) return;
    const requestId = ++catalogRequestIdRef.current;
    if (!append) setSelectedMetaProductIds([]);
    setIsLoadingMetaProducts(true);
    setMetaProductsError(null);
    try {
      const query = new URLSearchParams({ limit: '50' });
      if (after) query.set('after', after);
      const response = await api.get<{
        catalog: MetaCatalogOption;
        products: MetaCatalogProduct[];
        paging: { after: string | null; hasNextPage: boolean };
      }>(`/catalog/${encodeURIComponent(catalogId)}/products?${query.toString()}`);
      if (requestId !== catalogRequestIdRef.current) return;
      setMetaCatalogName(response.catalog.name || catalogId);
      setMetaProducts((current) => append ? [...current, ...response.products] : response.products);
      setMetaNextCursor(response.paging.after);
      setMetaHasNextPage(response.paging.hasNextPage);
    } catch (error: any) {
      if (requestId !== catalogRequestIdRef.current) return;
      setMetaProductsError(error?.message || 'Không thể tải sản phẩm của catalog.');
      if (!append) setMetaProducts([]);
    } finally {
      if (requestId === catalogRequestIdRef.current) setIsLoadingMetaProducts(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const loadCatalogs = async () => {
      setIsLoadingCatalogs(true);
      try {
        const response = await api.get<{
          catalogs: MetaCatalogOption[];
          currentCatalogId: string | null;
        }>('/catalog/list');
        if (!isMounted) return;
        setCatalogs(response.catalogs || []);
        setDefaultCatalogId(response.currentCatalogId || '');
      } catch (error: any) {
        if (isMounted) {
          setSyncAlert({ type: 'error', message: error?.message || 'Không thể tải danh sách Meta Catalog.' });
        }
      } finally {
        if (isMounted) setIsLoadingCatalogs(false);
      }
    };
    void loadCatalogs();
    return () => {
      isMounted = false;
      catalogRequestIdRef.current += 1;
    };
  }, []);

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
  }, [isMetaColumnsOpen, isMetaFilterOpen]);

  const handleImportMeta = async () => {
    if (!confirm('Bạn có muốn kéo các sản phẩm từ Meta Catalog về CRM không?')) return;
    setIsImportingMeta(true);
    setSyncAlert(null);
    try {
      const res = await api.post<{
        success: boolean;
        message: string;
        importedCount: number;
        updatedCount: number;
      }>('/catalog/import', viewCatalogId ? { catalogId: viewCatalogId } : {});
      setSyncAlert({
        type: 'success',
        message: res.message || 'Kéo sản phẩm từ Meta thành công!',
      });
      // Trigger page reload or callback if exists
      window.location.reload();
    } catch (err: any) {
      setSyncAlert({
        type: 'error',
        message: err?.message || 'Lỗi khi kéo sản phẩm từ Meta Catalog.',
      });
    } finally {
      setIsImportingMeta(false);
    }
  };
  const [formData, setFormData] = useState<Partial<Product>>({
    code: '',
    name: '',
    category: 'Mỹ Phẩm',
    price: 500000,
    costPrice: 200000,
    stock: 50,
    status: 'In Stock',
    sku: '',
    description: '',
    image: '',
  });

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Dung lượng ảnh vượt quá 5MB. Vui lòng chọn ảnh nhỏ hơn 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setIsUploadingImage(true);
      try {
        const res = await api.post<{ success: boolean; url: string }>('/upload', {
          imageBase64: base64,
          folder: 'products',
          customFilename: formData.code || formData.name || 'product'
        });
        if (res?.url) {
          setFormData((prev) => ({ ...prev, image: res.url }));
        } else {
          setFormData((prev) => ({ ...prev, image: base64 }));
        }
      } catch (err) {
        console.warn('Lỗi khi tải ảnh lên server, sử dụng ảnh xem trước cục bộ:', err);
        setFormData((prev) => ({ ...prev, image: base64 }));
      } finally {
        setIsUploadingImage(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };
    reader.readAsDataURL(file);
  };

  // Metrics
  const totalProductsCount = products.length;
  const inStockCount = products.filter((p) => p.status === 'In Stock').length;
  const lowStockCount = products.filter((p) => p.status === 'Low Stock' || p.stock < 15).length;
  const totalStockValue = products.reduce((sum, p) => sum + p.price * p.stock, 0);

  // Filtered
  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCategory = categoryFilter === 'Tất cả danh mục' || p.category === categoryFilter;
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  const filteredMetaProducts = metaProducts.filter((product) => {
    const query = searchTerm.trim().toLowerCase();
    const matchesSearch = !query || product.name.toLowerCase().includes(query)
      || product.retailerId.toLowerCase().includes(query)
      || (product.category || '').toLowerCase().includes(query);
    const matchesAvailability = metaAvailabilityFilter === 'all'
      || product.availability === metaAvailabilityFilter;
    return matchesSearch && matchesAvailability;
  });
  const isMetaView = Boolean(viewCatalogId);
  const visibleMetaColumnCount = Object.values(visibleMetaColumns).filter(Boolean).length;
  const allVisibleMetaProductsSelected = filteredMetaProducts.length > 0
    && filteredMetaProducts.every((product) => selectedMetaProductIds.includes(product.id));

  const handleOpenAddModal = () => {
    setEditingProduct(null);
    setFormData({
      code: `SP-${Math.floor(100 + Math.random() * 900)}`,
      name: '',
      category: 'Mỹ Phẩm',
      price: 500000,
      costPrice: 200000,
      stock: 50,
      status: 'In Stock',
      sku: `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
      description: '',
      image: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&q=80&w=300',
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (p: Product) => {
    setEditingProduct(p);
    setFormData(p);
    setIsModalOpen(true);
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.price) {
      alert('Vui lòng điền tên sản phẩm và giá bán.');
      return;
    }

    const stockVal = Number(formData.stock || 0);
    let autoStatus: Product['status'] = 'In Stock';
    if (stockVal <= 0) autoStatus = 'Out of Stock';
    else if (stockVal < 15) autoStatus = 'Low Stock';

    if (editingProduct) {
      onEditProduct({
        ...editingProduct,
        ...formData,
        status: autoStatus,
      } as Product);
    } else {
      onAddProduct({
        ...formData,
        id: `prd_${Date.now()}`,
        status: autoStatus,
      });
    }

    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      
      {/* Top Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400">Tổng Mã Sản Phẩm</div>
            <div className="text-2xl font-bold text-white mt-1">{totalProductsCount} SKUs</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Danh mục hàng hóa</div>
          </div>
          <div className="p-3 bg-indigo-600/20 text-indigo-400 rounded-xl border border-indigo-500/30">
            <Package className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400">Sẵn Hàng Trong Kho</div>
            <div className="text-2xl font-bold text-emerald-400 mt-1">{inStockCount} sản phẩm</div>
            <div className="text-[11px] text-emerald-400 mt-0.5">Sẵn sàng xuất đơn</div>
          </div>
          <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
            <Boxes className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400">Cảnh Báo Sắp Hết Kho</div>
            <div className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">{lowStockCount} sản phẩm</div>
            <div className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold mt-0.5">Cần bổ sung hàng gấp</div>
          </div>
          <div className="p-3 bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl border border-rose-300 dark:border-rose-500/30">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400">Giá Trị Tồn Kho Nguồn</div>
            <div className="text-2xl font-bold text-[#00793d] dark:text-emerald-400 mt-1">{formatVND(totalStockValue)}</div>
            <div className="text-[11px] text-[#00793d] dark:text-emerald-400 font-semibold mt-0.5">Tổng trị giá hàng hóa</div>
          </div>
          <div className="p-3 bg-emerald-50 dark:bg-emerald-500/20 text-[#00793d] dark:text-emerald-400 rounded-xl border border-emerald-300 dark:border-emerald-500/30">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

      </div>

      {/* Product source selector: browsing a catalog does not change the default sync catalog. */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-sm font-bold text-white">Nguồn sản phẩm</div>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row md:w-auto md:items-center">
          <select
            value={viewCatalogId}
            disabled={isLoadingCatalogs}
            onChange={(event) => {
              const nextCatalogId = event.target.value;
              setViewCatalogId(nextCatalogId);
              setSearchTerm('');
              setSelectedProductIds([]);
              setSelectedMetaProductIds([]);
              setMetaProducts([]);
              setMetaNextCursor(null);
              setMetaHasNextPage(false);
              setMetaProductsError(null);
              if (nextCatalogId) void loadMetaCatalogProducts(nextCatalogId);
            }}
            className="min-w-64 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 disabled:opacity-50"
            aria-label="Chọn nguồn sản phẩm hoặc Meta Catalog"
          >
            <option value="">Sản phẩm CRM</option>
            {catalogs.map((catalog) => (
              <option key={catalog.id} value={catalog.id}>
                {catalog.name}{catalog.id === defaultCatalogId ? ' (mặc định)' : ''}{typeof catalog.product_count === 'number' ? ` — ${catalog.product_count} SP` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Control Bar */}
      <div className={`${isMetaView ? 'hidden' : ''} bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4`}>
        
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={isMetaView ? 'Tìm tên hoặc Content ID trong trang đã tải...' : 'Tìm theo tên SP, Mã SP, SKU...'}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Filters & Add button */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          
          {!isMetaView && <div className="flex items-center space-x-1.5 text-xs text-slate-400">
            <Filter className="w-3.5 h-3.5" />
            <span>Danh mục:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>}

          {!isMetaView && <div className="flex items-center space-x-1.5 text-xs text-slate-400">
            <span>Tồn kho:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="In Stock">Sẵn Hàng (In Stock)</option>
              <option value="Low Stock">Sắp Hết (Low Stock)</option>
              <option value="Out of Stock">Hết Hàng (Out of Stock)</option>
            </select>
          </div>}

          {!isMetaView && <button
            onClick={() => setIsImportCsvOpen(true)}
            className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 transition active:scale-95 cursor-pointer"
            title="Nhập danh sách sản phẩm hàng loạt bằng file CSV"
          >
            <Upload className="w-4 h-4" />
            <span>Nhập CSV</span>
          </button>}

          {!isMetaView && <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition active:scale-95 cursor-pointer ml-auto md:ml-0"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm Sản Phẩm</span>
          </button>}

        </div>

      </div>

      {syncAlert && (
        <div className={`p-4 rounded-2xl text-xs font-semibold border flex items-center justify-between gap-3 ${
          syncAlert.type === 'success'
            ? 'bg-emerald-950/50 text-emerald-300 border-emerald-800'
            : 'bg-rose-950/50 text-rose-300 border-rose-800'
        }`}>
          <div className="flex items-center gap-2">
            {syncAlert.type === 'success' ? <CheckCheck className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-rose-400" />}
            <span>{syncAlert.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setSyncAlert(null)}
            className="text-xs hover:underline cursor-pointer"
          >
            Đóng
          </button>
        </div>
      )}

      {isMetaView && (
        <div className="overflow-visible rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
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
              {selectedMetaProductIds.length > 0 && (
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                  {selectedMetaProductIds.length} selected
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void handleImportMeta()}
                disabled={isImportingMeta}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
                title="Kéo sản phẩm từ catalog đang xem về CRM"
              >
                <ArrowDownToLine className={`h-4 w-4 ${isImportingMeta ? 'animate-bounce' : ''}`} />
                Import to CRM
              </button>
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
              <p className="text-[11px] text-slate-500">{filteredMetaProducts.length} items loaded</p>
            </div>
            {viewCatalogId === defaultCatalogId && (
              <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-700">Default catalog</span>
            )}
          </div>

          {metaProductsError && (
            <div className="m-4 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{metaProductsError}</span>
            </div>
          )}

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
                {isLoadingMetaProducts && metaProducts.length === 0 ? (
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
                onClick={() => void loadMetaCatalogProducts(viewCatalogId, metaNextCursor, true)}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
              >
                {isLoadingMetaProducts && <Loader2 className="h-4 w-4 animate-spin" />}
                Tải thêm sản phẩm
              </button>
            </div>
          )}
        </div>
      )}

      {/* Product List Table */}
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
                  const isBatchActive = selectedProductIds.length > 0;

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
                            onClick={() => handleOpenEditModal(product)}
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

      {/* Add / Edit Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative text-slate-900 dark:text-slate-100">
            
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition cursor-pointer"
              title="Đóng"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
              {editingProduct ? 'Chỉnh Sửa Sản Phẩm' : 'Thêm Sản Phẩm Mới'}
            </h2>

            <form onSubmit={handleSubmitForm} className="space-y-3">
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Mã Sản Phẩm *</label>
                  <input
                    type="text"
                    required
                    value={formData.code || ''}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="SP-COL-01"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Mã SKU</label>
                  <input
                    type="text"
                    value={formData.sku || ''}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    placeholder="SKU-50ML"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Tên Sản Phẩm *</label>
                <input
                  type="text"
                  required
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ví dụ: Kem Dưỡng Da Collagen Premium"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Danh Mục</label>
                  <select
                    value={formData.category || 'Mỹ Phẩm'}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                  >
                    {CATEGORIES.filter((c) => c !== 'Tất cả danh mục').map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Số Lượng Tồn Kho</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.stock ?? 50}
                    onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) || 0 })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Giá Bán Niêm Yết (VND) *</label>
                  <input
                    type="number"
                    step="10000"
                    required
                    value={formData.price || 0}
                    onChange={(e) => setFormData({ ...formData, price: parseInt(e.target.value) || 0 })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Giá Vốn Nhập (VND)</label>
                  <input
                    type="number"
                    step="10000"
                    value={formData.costPrice || 0}
                    onChange={(e) => setFormData({ ...formData, costPrice: parseInt(e.target.value) || 0 })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Hình ảnh sản phẩm (Hỗ trợ tải lên trực tiếp & URL) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Hình Ảnh Sản Phẩm</label>
                  {formData.image && (
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">✓ Đã có ảnh</span>
                  )}
                </div>

                {/* Hidden file input for direct file upload */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={handleImageFileChange}
                  className="hidden"
                />

                {formData.image ? (
                  <div className="flex items-center gap-3 p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl">
                    <div className="w-14 h-14 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-white shrink-0 relative flex items-center justify-center shadow-xs">
                      <img
                        src={formData.image}
                        alt="Product preview"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://placehold.co/100x100?text=No+Image';
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                        {formData.image.startsWith('data:') ? 'Ảnh vừa tải từ máy tính' : formData.image.split('/').pop()}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {isUploadingImage ? 'Đang lưu ảnh lên máy chủ...' : 'Đã tải lên và sẵn sàng lưu'}
                      </p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <button
                          type="button"
                          disabled={isUploadingImage}
                          onClick={() => fileInputRef.current?.click()}
                          className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>Đổi ảnh</span>
                        </button>
                        <span className="text-slate-300 dark:text-slate-700">|</span>
                        <button
                          type="button"
                          disabled={isUploadingImage}
                          onClick={() => setFormData((prev) => ({ ...prev, image: '' }))}
                          className="text-xs font-semibold text-rose-500 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Xóa ảnh</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-400 rounded-2xl p-4 text-center cursor-pointer transition bg-slate-50/60 dark:bg-slate-950/40 hover:bg-indigo-50/20 dark:hover:bg-indigo-950/20 group ${
                      isUploadingImage ? 'opacity-60 pointer-events-none' : ''
                    }`}
                  >
                    {isUploadingImage ? (
                      <div className="flex flex-col items-center py-1">
                        <Loader2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400 animate-spin mb-1" />
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Đang tải ảnh lên máy chủ...</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center py-1">
                        <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-1.5 group-hover:scale-110 transition shadow-xs">
                          <Upload className="w-4.5 h-4.5" />
                        </div>
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                          Bấm vào đây để tải ảnh từ máy tính
                        </span>
                        <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                          Hỗ trợ PNG, JPG, WEBP, GIF (tối đa 5MB)
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Hoặc dán link URL ảnh:</span>
                  <input
                    type="text"
                    value={formData.image || ''}
                    onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                    placeholder="https://..."
                    className="w-3/5 bg-transparent border-b border-slate-200 dark:border-slate-800 px-1 py-0.5 text-[11px] text-slate-700 dark:text-slate-300 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Mô Tả Sản Phẩm</label>
                <textarea
                  rows={2}
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Thành phần, công dụng, lưu ý..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              <div className="pt-3 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition flex items-center space-x-1.5 shadow-md shadow-indigo-600/20 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{editingProduct ? 'Lưu Sản Phẩm' : 'Thêm Vào Kho'}</span>
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {isImportCsvOpen && (
        <ImportProductCsvModal
          isOpen={isImportCsvOpen}
          onClose={() => setIsImportCsvOpen(false)}
          onImportProducts={async (importedPrds) => {
            if (onImportProducts) {
              await onImportProducts(importedPrds);
            }
          }}
        />
      )}

    </div>
  );
};
