import React, { useState } from 'react';
import { X, Upload, Download, Package, AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { Product } from '../../types';
import { parseCsvContent, downloadCsvFile } from '../../utils/csvParser';
import { formatVND } from '../../utils/crmUtils';

interface ImportProductCsvModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportProducts: (products: Product[]) => void;
}

const SAMPLE_CSV_PRODUCT = `Mã SP,Tên Sản Phẩm,Danh Mục,Giá Bán,Giá Vốn,Tồn Kho,SKU,Mô Tả
"SP-801","Kem Chống Nắng Ultra Light SPF50","Mỹ Phẩm",450000,180000,100,"SKU-SUN-801","Chống nắng kiềm dầu cho da nhạy cảm"
"SP-802","Việt Quất Sấy Khô Premium","Thực Phẩm Chức Năng",320000,120000,80 animate,"SKU-FOOD-802","Sản phẩm bổ sung Vitamin E & C"
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

    const { headers, rows, errors } = parseCsvContent(rawText);

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
        const normalized = k.toLowerCase().replace(/[^a-z0-9áàảãạăắằẳẵặâấầẩẫậđéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵ]/g, '');
        for (const pk of possibleKeys) {
          if (normalized.includes(pk)) return row[k];
        }
      }
      return '';
    };

    const newPrdList: Product[] = rows.map((r, idx) => {
      const code = findValue(r, ['masp', 'code', 'productcode', 'ma']) || `SP-${Math.floor(800 + Math.random() * 100)}`;
      const name = findValue(r, ['tensanpham', 'sanpham', 'name', 'ten']) || `Sản phẩm CSV ${idx + 1}`;
      const rawCategory = findValue(r, ['danhmuc', 'category', 'nhom']);
      
      let category: Product['category'] = 'Mỹ Phẩm';
      if (/thuc pham/i.test(rawCategory)) category = 'Thực Phẩm Chức Năng';
      else if (/thoi trang/i.test(rawCategory)) category = 'Thời Trang';
      else if (/gia dung/i.test(rawCategory)) category = 'Gia Dụng';
      else if (/khac/i.test(rawCategory)) category = 'Khác';

      const priceStr = findValue(r, ['giaban', 'price', 'gia', 'giabanvnd']) || '500000';
      const price = Math.max(0, parseInt(priceStr.replace(/[^0-9]/g, ''), 10) || 500000);

      const costPriceStr = findValue(r, ['giavon', 'cost', 'costprice']) || '200000';
      const costPrice = Math.max(0, parseInt(costPriceStr.replace(/[^0-9]/g, ''), 10) || 200000);

      const stockStr = findValue(r, ['tonkho', 'stock', 'soluong']) || '50';
      const stock = Math.max(0, parseInt(stockStr.replace(/[^0-9]/g, ''), 10) || 50);

      const sku = findValue(r, ['sku', 'masanpham', 'code2']) || `SKU-${Math.floor(8000 + Math.random() * 1000)}`;
      const description = findValue(r, ['mota', 'description', 'detail']) || 'Nhập từ CSV';

      return {
        id: `prd_csv_${Date.now()}_${idx}`,
        code,
        name,
        category,
        price,
        costPrice,
        stock,
        status: stock > 10 ? 'In Stock' : stock > 0 ? 'Low Stock' : 'Out of Stock',
        sku,
        description,
        image: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&q=80&w=300',
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

  const handleConfirmImport = () => {
    if (parsedProducts.length === 0) return;

    onImportProducts(parsedProducts);
    onClose();
    alert(`Đã nhập thành công ${parsedProducts.length} sản phẩm mới vào kho hàng!`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl my-8">
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
                Gồm cột: <strong className="text-slate-200">Mã SP, Tên Sản Phẩm, Danh Mục, Giá Bán, Giá Vốn, Tồn Kho, SKU, Mô Tả</strong>.
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
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Đã đọc {parsedProducts.length} sản phẩm</span>
                </span>
                <span className="text-slate-400">Xem trước danh sách sản phẩm</span>
              </div>

              <div className="max-h-56 overflow-y-auto border border-slate-800 rounded-xl bg-slate-950/60">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-800/80 text-slate-300 border-b border-slate-800 font-semibold sticky top-0">
                      <th className="py-2.5 px-3">Mã SP</th>
                      <th className="py-2.5 px-3">Tên Sản Phẩm</th>
                      <th className="py-2.5 px-3">Danh Mục</th>
                      <th className="py-2.5 px-3">Giá Bán</th>
                      <th className="py-2.5 px-3">Tồn Kho</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50 text-slate-300">
                    {parsedProducts.map((p, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/30">
                        <td className="py-2 px-3 font-mono font-semibold text-white">{p.code}</td>
                        <td className="py-2 px-3 font-semibold text-white">{p.name}</td>
                        <td className="py-2 px-3">{p.category}</td>
                        <td className="py-2 px-3 font-bold text-emerald-400">{formatVND(p.price)}</td>
                        <td className="py-2 px-3 font-mono text-indigo-300">{p.stock}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-900/80">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition cursor-pointer"
          >
            Hủy Bỏ
          </button>

          <button
            onClick={handleConfirmImport}
            disabled={parsedProducts.length === 0}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/30 flex items-center space-x-2 transition cursor-pointer"
          >
            <Package className="w-4 h-4" />
            <span>Xác Nhận Nhập ({parsedProducts.length} Sản Phẩm)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
