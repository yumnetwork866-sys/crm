import React, { useState } from 'react';
import { X, Upload, Download, Package, AlertCircle, CheckCircle2, Info, Loader2 } from 'lucide-react';
import type { Product } from '../../types';
import { parseCsvContent, downloadCsvFile, normalizeHeaderKey } from '../../utils/csvParser';
import { formatVND } from '../../utils/crmUtils';

interface ImportProductCsvModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportProducts: (products: Product[]) => void | Promise<void>;
}

const SAMPLE_CSV_PRODUCT = `Mã SP,Tên Sản Phẩm,Danh Mục,Giá Bán,Giá Vốn,Tồn Kho,SKU,Mô Tả
"SP-801","Kem Chống Nắng Ultra Light SPF50","Mỹ Phẩm",450000,180000,100,"SKU-SUN-801","Chống nắng kiềm dầu cho da nhạy cảm"
"SP-802","Việt Quất Sấy Khô Premium","Thực Phẩm Chức Năng",320000,120000,80,"SKU-FOOD-802","Sản phẩm bổ sung Vitamin E & C"
"SP-803","Áo Phông Cotton Form Rộng","Thời Trang",250000,90000,150,"SKU-FASH-803","Thấm hút mồ hôi tốt"`;

export const ImportProductCsvModal: React.FC<ImportProductCsvModalProps> = ({
  isOpen,
  onClose,
  onImportProducts,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'paste'>('upload');
  const [pasteText, setPasteText] = useState('');
  const [fileName, setFileName] = useState('');
  const [parsedProducts, setParsedProducts] = useState<Product[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [defaultPriceInput, setDefaultPriceInput] = useState<string>('');

  if (!isOpen) return null;

  const handleDownloadSample = () => {
    downloadCsvFile('Mau_Danh_Sach_San_Pham_VietCRM.csv', SAMPLE_CSV_PRODUCT);
  };

  const processCsvRawText = (rawText: string, fileLabel?: string) => {
    setParseError(null);
    if (!rawText.trim()) {
      setParseError('Dữ liệu CSV rỗng. Vui lòng chọn file hoặc dán dữ liệu CSV.');
      setParsedProducts([]);
      return;
    }

    const { headers: _headers, rows, errors } = parseCsvContent(rawText);

    if (errors.length > 0) {
      setParseError(errors.join('; '));
      setParsedProducts([]);
      return;
    }

    if (rows.length === 0) {
      setParseError('Không đọc được dòng dữ liệu nào từ file CSV.');
      setParsedProducts([]);
      return;
    }

    const findValue = (row: Record<string, string>, possibleKeys: string[]) => {
      for (const k of Object.keys(row)) {
        const normalized = normalizeHeaderKey(k);
        for (const pk of possibleKeys) {
          if (normalized.includes(pk)) return row[k]?.trim() || '';
        }
      }
      return '';
    };

    const timestamp = Date.now();
    const newPrdList: Product[] = rows.map((r, idx) => {
      const code =
        findValue(r, ['masp', 'masanpham', 'code', 'productcode', 'sku', 'barcode', 'ma']) ||
        `SP-${timestamp.toString().slice(-6)}-${idx + 1}`;

      const name =
        findValue(r, ['tensanpham', 'tensp', 'sanpham', 'name', 'productname', 'title', 'item', 'ten']) ||
        `Sản phẩm ${idx + 1}`;

      const rawCategory = findValue(r, ['danhmuc', 'category', 'nhom', 'nhomsanpham', 'phanloai']);
      let category: Product['category'] = 'Mỹ Phẩm';
      const normCat = normalizeHeaderKey(rawCategory);
      if (normCat.includes('thucpham')) category = 'Thực Phẩm Chức Năng';
      else if (normCat.includes('thoitrang')) category = 'Thời Trang';
      else if (normCat.includes('giadung')) category = 'Gia Dụng';
      else if (normCat.includes('khac')) category = 'Khác';
      else if (rawCategory) category = rawCategory as Product['category'];

      const priceStr = findValue(r, ['giaban', 'price', 'gia', 'giabanvnd', 'dongia', 'unitprice', 'retailprice']);
      const parsedPrice = priceStr ? parseInt(priceStr.replace(/[^0-9]/g, ''), 10) : 0;
      const price = isNaN(parsedPrice) ? 0 : Math.max(0, parsedPrice);

      const costPriceStr = findValue(r, ['giavon', 'cost', 'costprice', 'gianhap', 'von']);
      const parsedCost = costPriceStr ? parseInt(costPriceStr.replace(/[^0-9]/g, ''), 10) : 0;
      const costPrice = isNaN(parsedCost) ? 0 : Math.max(0, parsedCost);

      const stockStr = findValue(r, ['tonkho', 'stock', 'soluong', 'quantity', 'qty', 'ton']);
      const parsedStock = stockStr ? parseInt(stockStr.replace(/[^0-9]/g, ''), 10) : 0;
      const stock = isNaN(parsedStock) ? 0 : Math.max(0, parsedStock);

      const sku = findValue(r, ['sku', 'barcode', 'masanpham', 'ma']) || code;
      const description = findValue(r, ['mota', 'description', 'detail', 'thongtin', 'ghichu']) || '';
      const image = findValue(r, ['hinhanh', 'anh', 'image', 'photo', 'url', 'linkanh']) || '';

      return {
        id: `prd_csv_${timestamp}_${idx}`,
        code,
        name,
        category,
        price,
        costPrice,
        stock,
        status: stock === 0 ? 'Out of Stock' : stock < 15 ? 'Low Stock' : 'In Stock',
        sku,
        description,
        image,
      };
    });

    if (fileLabel) setFileName(fileLabel);
    setParsedProducts(newPrdList);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      processCsvRawText(text, file.name);
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleUpdateProductPrice = (index: number, newPrice: number) => {
    setParsedProducts((prev) => {
      const next = [...prev];
      if (next[index]) {
        next[index] = { ...next[index], price: Math.max(0, newPrice) };
      }
      return next;
    });
  };

  const handleUpdateProductStock = (index: number, newStock: number) => {
    setParsedProducts((prev) => {
      const next = [...prev];
      if (next[index]) {
        const stock = Math.max(0, Math.floor(newStock));
        const status: Product['status'] = stock === 0 ? 'Out of Stock' : stock < 15 ? 'Low Stock' : 'In Stock';
        next[index] = { ...next[index], stock, status };
      }
      return next;
    });
  };

  const handleApplyDefaultPriceToAllZero = () => {
    const num = parseInt(defaultPriceInput.replace(/[^0-9]/g, ''), 10);
    if (isNaN(num) || num <= 0) return;

    setParsedProducts((prev) =>
      prev.map((p) => (p.price === 0 ? { ...p, price: num } : p))
    );
  };

  const handleConfirmImport = async () => {
    if (parsedProducts.length === 0 || isSubmitting) return;

    try {
      setIsSubmitting(true);
      setParseError(null);
      await Promise.resolve(onImportProducts(parsedProducts));
      alert(`Đã lưu thành công ${parsedProducts.length} sản phẩm vào cơ sở dữ liệu!`);
      onClose();
    } catch (err: unknown) {
      console.error('Lỗi khi nhập sản phẩm:', err);
      const errMsg = err instanceof Error ? err.message : 'Lỗi khi lưu sản phẩm vào hệ thống. Vui lòng thử lại.';
      setParseError(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const zeroPriceCount = parsedProducts.filter((p) => p.price === 0).length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center space-x-2 text-indigo-400">
            <Package className="w-6 h-6" />
            <h3 className="font-bold text-lg text-white">Nhập Danh Sách Sản Phẩm Bằng CSV</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Instructions */}
          <div className="bg-indigo-950/30 border border-indigo-500/20 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="text-xs text-slate-300 space-y-1">
              <p className="font-semibold text-indigo-300 flex items-center gap-1.5">
                <Info className="w-4 h-4" />
                <span>Cấu trúc dữ liệu sản phẩm CSV</span>
              </p>
              <p className="text-slate-400">
                Hỗ trợ cột: <strong className="text-slate-200">Mã SP, Tên Sản Phẩm, Danh Mục, Giá Bán, Giá Vốn, Tồn Kho, SKU, Mô Tả</strong>. Tự động nhận diện dấu phẩy, chấm phẩy hoặc Tab.
              </p>
            </div>
            <button
              onClick={handleDownloadSample}
              className="px-3.5 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Tải Mẫu Sản Phẩm CSV (.csv)</span>
            </button>
          </div>

          {/* Toggle Tab */}
          <div className="flex border-b border-slate-800 text-xs font-medium">
            <button
              onClick={() => setActiveTab('upload')}
              className={`pb-2.5 px-4 transition border-b-2 cursor-pointer ${
                activeTab === 'upload'
                  ? 'border-indigo-500 text-indigo-400 font-bold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Tải File CSV
            </button>
            <button
              onClick={() => setActiveTab('paste')}
              className={`pb-2.5 px-4 transition border-b-2 cursor-pointer ${
                activeTab === 'paste'
                  ? 'border-indigo-500 text-indigo-400 font-bold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Dán CSV
            </button>
          </div>

          {activeTab === 'upload' ? (
            <div className="border-2 border-dashed border-slate-700 hover:border-indigo-500/60 rounded-xl p-6 text-center transition bg-slate-800/30">
              <Upload className="w-8 h-8 mx-auto text-indigo-400 mb-2" />
              <p className="text-sm font-semibold text-white">Chọn file .csv sản phẩm</p>
              <input
                type="file"
                accept=".csv,.txt"
                onChange={handleFileUpload}
                className="hidden"
                id="product-csv-input"
              />
              <label
                htmlFor="product-csv-input"
                className="inline-flex items-center space-x-2 mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-semibold text-white transition cursor-pointer"
              >
                <span>Chọn tệp CSV...</span>
              </label>

              {fileName && (
                <div className="mt-3 inline-flex items-center space-x-2 text-xs font-mono text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/20">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Đã chọn: {fileName}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="Dán nội dung CSV sản phẩm vào đây..."
                rows={5}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
              />
              <button
                onClick={() => processCsvRawText(pasteText, 'Dán tay')}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                Xử Lý Dữ Liệu
              </button>
            </div>
          )}

          {parseError && (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs p-3 rounded-xl flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{parseError}</span>
            </div>
          )}

          {/* Preview Table */}
          {parsedProducts.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs gap-2">
                <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Đã đọc {parsedProducts.length} sản phẩm thực tế từ file</span>
                </span>
                {zeroPriceCount > 0 && (
                  <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-300 px-3 py-1.5 rounded-lg text-xs">
                    <span>{zeroPriceCount} SP chưa có giá bán.</span>
                    <input
                      type="text"
                      placeholder="Nhập giá (VNĐ)"
                      value={defaultPriceInput}
                      onChange={(e) => setDefaultPriceInput(e.target.value)}
                      className="w-28 px-2 py-0.5 bg-slate-900 border border-amber-500/40 rounded text-white text-xs font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleApplyDefaultPriceToAllZero}
                      className="px-2 py-0.5 bg-amber-600 hover:bg-amber-500 text-white font-medium rounded text-xs transition cursor-pointer"
                    >
                      Áp dụng
                    </button>
                  </div>
                )}
              </div>

              <div className="max-h-64 overflow-y-auto border border-slate-800 rounded-xl bg-slate-950/60">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-800/80 text-slate-300 border-b border-slate-800 font-semibold sticky top-0">
                      <th className="py-2.5 px-3">Mã SP</th>
                      <th className="py-2.5 px-3">Tên Sản Phẩm</th>
                      <th className="py-2.5 px-3">Danh Mục</th>
                      <th className="py-2.5 px-3">Giá Bán</th>
                      <th className="py-2.5 px-3">Tồn Kho</th>
                      <th className="py-2.5 px-3">Mô Tả</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50 text-slate-300">
                    {parsedProducts.map((p, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/30">
                        <td className="py-2 px-3 font-mono font-semibold text-white whitespace-nowrap">{p.code}</td>
                        <td className="py-2 px-3 font-semibold text-white min-w-[180px]">{p.name}</td>
                        <td className="py-2 px-3 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[11px]">
                            {p.category}
                          </span>
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap">
                          <input
                            type="number"
                            min="0"
                            value={p.price || ''}
                            placeholder="0 đ"
                            onChange={(e) => handleUpdateProductPrice(idx, Number(e.target.value) || 0)}
                            className={`w-28 px-2 py-1 bg-slate-900 border rounded font-mono text-xs ${
                              p.price === 0
                                ? 'border-amber-500/50 text-amber-300'
                                : 'border-slate-700 text-emerald-400 font-bold'
                            }`}
                          />
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap">
                          <input
                            type="number"
                            min="0"
                            value={p.stock}
                            onChange={(e) => handleUpdateProductStock(idx, Number(e.target.value) || 0)}
                            className="w-20 px-2 py-1 bg-slate-900 border border-slate-700 rounded font-mono text-indigo-300 text-xs"
                          />
                        </td>
                        <td className="py-2 px-3 text-slate-400 max-w-[200px] truncate" title={p.description}>
                          {p.description || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-slate-400 italic">
                * Bạn có thể chỉnh sửa trực tiếp Giá Bán và Tồn Kho ở bảng trên trước khi bấm Xác Nhận Nhập.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-900/80">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 rounded-xl text-xs font-semibold transition cursor-pointer"
          >
            Hủy Bỏ
          </button>

          <button
            onClick={handleConfirmImport}
            disabled={parsedProducts.length === 0 || isSubmitting}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/30 flex items-center space-x-2 transition cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang Lưu Sản Phẩm...</span>
              </>
            ) : (
              <>
                <Package className="w-4 h-4" />
                <span>Xác Nhận Nhập ({parsedProducts.length} Sản Phẩm)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
