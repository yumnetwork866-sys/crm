import React, { useState, useRef } from 'react';
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
  Loader2
} from 'lucide-react';

interface ProductManagementViewProps {
  products: Product[];
  onAddProduct: (product: Partial<Product>) => void;
  onEditProduct: (product: Product) => void;
  onDeleteProduct: (productId: string) => void;
  onImportProducts?: (products: Product[]) => void;
}

const CATEGORIES = ['Tất cả danh mục', 'Mỹ Phẩm', 'Thực Phẩm Chức Năng', 'Thời Trang', 'Gia Dụng', 'Khác'];

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

      {/* Control Bar */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo tên SP, Mã SP, SKU..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Filters & Add button */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          
          <div className="flex items-center space-x-1.5 text-xs text-slate-400">
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
          </div>

          <div className="flex items-center space-x-1.5 text-xs text-slate-400">
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
          </div>

          <button
            onClick={() => setIsImportCsvOpen(true)}
            className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 transition active:scale-95 cursor-pointer"
            title="Nhập danh sách sản phẩm hàng loạt bằng file CSV"
          >
            <Upload className="w-4 h-4" />
            <span>Nhập CSV</span>
          </button>

          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition active:scale-95 cursor-pointer ml-auto md:ml-0"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm Sản Phẩm</span>
          </button>

        </div>

      </div>

      {/* Product List Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
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
                <th className="py-3 px-4 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
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
          onImportProducts={(importedPrds) => {
            if (onImportProducts) {
              onImportProducts(importedPrds);
            }
          }}
        />
      )}

    </div>
  );
};
