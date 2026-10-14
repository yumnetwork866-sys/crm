import React, { useRef, useState } from 'react';
import type { Product } from '../../../types';
import { api } from '../../../utils/apiClient';
import { Loader2, Save, Trash2, Upload, X } from 'lucide-react';
import { CATEGORIES } from './productTypes';

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingProduct: Product | null;
  formData: Partial<Product>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<Product>>>;
  onSubmitForm: (e: React.FormEvent) => void;
}

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  isOpen,
  onClose,
  editingProduct,
  formData,
  setFormData,
  onSubmitForm,
}) => {
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

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
          customFilename: formData.code || formData.name || 'product',
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative text-slate-900 dark:text-slate-100">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition cursor-pointer"
          title="Đóng"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
          {editingProduct ? 'Chỉnh Sửa Sản Phẩm' : 'Thêm Sản Phẩm Mới'}
        </h2>

        <form onSubmit={onSubmitForm} className="space-y-3">
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
              onClick={onClose}
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
  );
};
