import React, { useEffect, useState, useRef } from 'react';
import type { Product } from '../../types';
import { ImportProductCsvModal } from '../CsvImport/ImportProductCsvModal';
import { api } from '../../utils/apiClient';
import { ProductFilterToolbar } from '../../features/products/components/ProductFilterToolbar';
import { ProductFormModal } from '../../features/products/components/ProductFormModal';
import { ProductGrid } from '../../features/products/components/ProductGrid';
import { MetaCatalogTableSection, ProductTable } from '../../features/products/components/ProductTable';
import type {
  MetaCatalogOption,
  MetaCatalogProduct,
  MetaColumnKey,
} from '../../features/products/components/productTypes';

interface ProductManagementViewProps {
  products: Product[];
  onAddProduct: (product: Partial<Product>) => void;
  onEditProduct: (product: Product) => void;
  onDeleteProduct: (productId: string) => void;
  onImportProducts?: (products: Product[]) => Promise<unknown> | void;
  hideOverviewCards?: boolean;
  mode?: 'products' | 'meta-catalog';
}

export const ProductManagementView: React.FC<ProductManagementViewProps> = ({
  products,
  onAddProduct,
  onEditProduct,
  onDeleteProduct,
  onImportProducts,
  hideOverviewCards = false,
  mode = 'products',
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter] = useState('Tất cả danh mục');
  const [statusFilter] = useState('all');
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportCsvOpen, setIsImportCsvOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Meta Catalog Sync State
  const [syncAlert, setSyncAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [catalogs, setCatalogs] = useState<MetaCatalogOption[]>([]);
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
    if (mode !== 'meta-catalog') {
      setIsLoadingCatalogs(false);
      return;
    }
    let isMounted = true;
    const loadCatalogs = async () => {
      setIsLoadingCatalogs(true);
      try {
        const response = await api.get<{
          catalogs: MetaCatalogOption[];
          currentCatalogId: string | null;
        }>('/catalog/list');
        const availableCatalogs = response.catalogs || [];
        if (!isMounted) return;
        setCatalogs(availableCatalogs);
        const firstCatId = availableCatalogs[0]?.id || '';
        if (firstCatId) {
          setViewCatalogId(firstCatId);
          void loadMetaCatalogProducts(firstCatId);
        }
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

  // Chế độ Catalog Meta chỉ bật khi mode === 'meta-catalog'
  const isMetaView = mode === 'meta-catalog';
  const visibleMetaColumnCount = Object.values(visibleMetaColumns).filter(Boolean).length;
  const allVisibleMetaProductsSelected = filteredMetaProducts.length > 0
    && filteredMetaProducts.every((product) => selectedMetaProductIds.includes(product.id));

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
      <ProductGrid
        hideOverviewCards={hideOverviewCards}
        totalProductsCount={totalProductsCount}
        inStockCount={inStockCount}
        lowStockCount={lowStockCount}
        totalStockValue={totalStockValue}
        syncAlert={syncAlert}
        onCloseSyncAlert={() => setSyncAlert(null)}
      />

      {isMetaView && (
        <div className="overflow-visible rounded-xl border border-slate-200 bg-white shadow-sm">
          <ProductFilterToolbar
            viewCatalogId={viewCatalogId}
            isLoadingCatalogs={isLoadingCatalogs}
            catalogs={catalogs}
            onCatalogChange={(nextCatalogId) => {
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
            isMetaFilterOpen={isMetaFilterOpen}
            setIsMetaFilterOpen={setIsMetaFilterOpen}
            isMetaColumnsOpen={isMetaColumnsOpen}
            setIsMetaColumnsOpen={setIsMetaColumnsOpen}
            metaAvailabilityFilter={metaAvailabilityFilter}
            setMetaAvailabilityFilter={setMetaAvailabilityFilter}
            selectedMetaProductIdsCount={selectedMetaProductIds.length}
            visibleMetaColumns={visibleMetaColumns}
            setVisibleMetaColumns={setVisibleMetaColumns}
            metaCatalogName={metaCatalogName}
            filteredMetaProductsCount={filteredMetaProducts.length}
            metaProductsError={metaProductsError}
          />
          <MetaCatalogTableSection
            visibleMetaColumns={visibleMetaColumns}
            visibleMetaColumnCount={visibleMetaColumnCount}
            allVisibleMetaProductsSelected={allVisibleMetaProductsSelected}
            filteredMetaProducts={filteredMetaProducts}
            metaProductsCount={metaProducts.length}
            isLoadingMetaProducts={isLoadingMetaProducts}
            searchTerm={searchTerm}
            metaAvailabilityFilter={metaAvailabilityFilter}
            selectedMetaProductIds={selectedMetaProductIds}
            setSelectedMetaProductIds={setSelectedMetaProductIds}
            metaHasNextPage={metaHasNextPage}
            metaNextCursor={metaNextCursor}
            onLoadMoreMetaProducts={() => {
              if (metaNextCursor) void loadMetaCatalogProducts(viewCatalogId, metaNextCursor, true);
            }}
          />
        </div>
      )}

      {/* Product List Table */}
      <ProductTable
        isMetaView={isMetaView}
        filteredProducts={filteredProducts}
        selectedProductIds={selectedProductIds}
        setSelectedProductIds={setSelectedProductIds}
        onOpenEditModal={handleOpenEditModal}
        onDeleteProduct={onDeleteProduct}
      />

      {/* Add / Edit Product Modal */}
      <ProductFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        editingProduct={editingProduct}
        formData={formData}
        setFormData={setFormData}
        onSubmitForm={handleSubmitForm}
      />

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
