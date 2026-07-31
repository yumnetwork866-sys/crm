import React, { useState } from 'react';
import { X, Upload, Download, ShoppingBag, AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { Customer, CustomerOrder, Product } from '../../types';
import { parseCsvContent, downloadCsvFile } from '../../utils/csvParser';
import { formatVND } from '../../utils/crmUtils';

interface ImportOrderCsvModalProps {
  isOpen: boolean;
  onClose: () => void;
  customers: Customer[];
  products: Product[];
  onImportOrders: (importedOrders: { customerPhone: string; order: CustomerOrder }[]) => void;
}

const SAMPLE_CSV_ORDER = `Mã Đơn,SĐT Khách Hàng,Tên Khách Hàng,Tên Sản Phẩm,Số Lượng,Đơn Giá,Trạng Thái,Ngày Lập,Ghi Chú
"DH-IMP-801","+60 12 888 9911","Ahmad Zakaria","Bộ Sản Phẩm Chống Lão Hóa Premium",1,2800000,"Completed","2026-07-22","Khách mua qua tư vấn Facebook"
"DH-IMP-802","0908123456","Nguyễn Thị Minh Châu","Kem Dưỡng Da Collagen Premium",2,1800000,"Completed","2026-07-23","Giao hỏa tốc"
"DH-IMP-803","0987654321","Trần Hoài Nam","Sữa Rửa Mặt Dịu Nhẹ Balance",1,450000,"Processing","2026-07-24","Chờ xác nhận giao hàng"`;

export const ImportOrderCsvModal: React.FC<ImportOrderCsvModalProps> = ({
  isOpen,
  onClose,
  customers,
  products,
  onImportOrders,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'paste'>('upload');
  const [pasteText, setPasteText] = useState('');
  const [fileName, setFileName] = useState('');
  const [parsedOrders, setParsedOrders] = useState<
    { customerPhone: string; customerName: string; order: CustomerOrder }[]
  >([]);
  const [parseError, setParseError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDownloadSample = () => {
    downloadCsvFile('Mau_Nhap_Don_Hang_VietCRM.csv', SAMPLE_CSV_ORDER);
  };

  const processCsvRawText = (rawText: string, fileLabel?: string) => {
    setParseError(null);
    if (!rawText.trim()) {
      setParseError('Dữ liệu CSV rỗng. Vui lòng chọn file hoặc dán dữ liệu CSV.');
      setParsedOrders([]);
      return;
    }

    const { headers, rows, errors } = parseCsvContent(rawText);

    if (errors.length > 0) {
      setParseError(errors.join('; '));
      setParsedOrders([]);
      return;
    }

    if (rows.length === 0) {
      setParseError('Không đọc được dòng dữ liệu nào từ file CSV.');
      setParsedOrders([]);
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

    const newOrdersList: { customerPhone: string; customerName: string; order: CustomerOrder }[] = [];

    rows.forEach((r, idx) => {
      const code = findValue(r, ['madon', 'code', 'ordercode', 'ma']) || `DH-CSV-${Date.now()}-${idx + 1}`;
      const customerPhone = findValue(r, ['sdt', 'phone', 'dienthoai', 'mobile']) || '0908123456';
      const customerName = findValue(r, ['tenkhachhang', 'khachhang', 'name', 'ten']) || 'Khách Hàng CSV';
      const productName = findValue(r, ['tensanpham', 'sanpham', 'product', 'item']) || products[0]?.name || 'Sản phẩm VietCRM';
      const qtyStr = findValue(r, ['soluong', 'quantity', 'qty']) || '1';
      const quantity = Math.max(1, parseInt(qtyStr, 10) || 1);

      const priceStr = findValue(r, ['dongia', 'price', 'gia', 'giaban']) || '500000';
      const price = Math.max(0, parseInt(priceStr.replace(/[^0-9]/g, ''), 10) || 500000);

      const statusRaw = findValue(r, ['trangthai', 'status']).toLowerCase();
      let status: CustomerOrder['status'] = 'Completed';
      if (/processing/i.test(statusRaw) || /dang xu ly/i.test(statusRaw)) status = 'Processing';
      else if (/cancelled/i.test(statusRaw) || /da huy/i.test(statusRaw)) status = 'Cancelled';

      const dateStr = findValue(r, ['ngay', 'date', 'ngaylap']) || new Date().toISOString().split('T')[0];
      const notes = findValue(r, ['ghichu', 'note', 'mota']) || 'Nhập từ CSV';

      const totalAmount = quantity * price;

      const order: CustomerOrder = {
        id: `ord_csv_${Date.now()}_${idx}`,
        orderCode: code,
        customerId: '', // will be mapped or created
        date: dateStr,
        products: [
          {
            productId: products[0]?.id || 'prd_001',
            productName: productName,
            quantity: quantity,
            price: price,
          },
        ],
        totalAmount: totalAmount,
        status: status,
        notes: notes,
      };

      newOrdersList.push({ customerPhone, customerName, order });
    });

    if (fileLabel) setFileName(fileLabel);
    setParsedOrders(newOrdersList);
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
    if (parsedOrders.length === 0) return;

    onImportOrders(parsedOrders.map((o) => ({ customerPhone: o.customerPhone, order: o.order })));
    onClose();
    alert(`Đã nhập thành công ${parsedOrders.length} đơn hàng vào hệ thống!`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center space-x-2 text-indigo-400">
            <ShoppingBag className="w-6 h-6" />
            <h3 className="font-bold text-lg text-white">Nhập Danh Sách Đơn Hàng Bằng CSV</h3>
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
                <span>Cấu trúc dữ liệu đơn hàng CSV</span>
              </p>
              <p className="text-slate-400">
                Gồm cột: <strong className="text-slate-200">Mã Đơn, SĐT Khách Hàng, Tên Khách Hàng, Tên Sản Phẩm, Số Lượng, Đơn Giá, Trạng Thái, Ngày Lập, Ghi Chú</strong>.
              </p>
            </div>
            <button
              onClick={handleDownloadSample}
              className="px-3.5 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Tải Mẫu Đơn CSV (.csv)</span>
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
              <p className="text-sm font-semibold text-white">Chọn file .csv đơn hàng</p>
              <input
                type="file"
                accept=".csv,.txt"
                onChange={handleFileUpload}
                className="hidden"
                id="order-csv-input"
              />
              <label
                htmlFor="order-csv-input"
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
                placeholder="Dán nội dung CSV đơn hàng vào đây..."
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
          {parsedOrders.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Đã đọc {parsedOrders.length} đơn hàng</span>
                </span>
                <span className="text-slate-400">Xem trước danh sách đơn hàng</span>
              </div>

              <div className="max-h-56 overflow-y-auto border border-slate-800 rounded-xl bg-slate-950/60">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-800/80 text-slate-300 border-b border-slate-800 font-semibold sticky top-0">
                      <th className="py-2.5 px-3">Mã Đơn</th>
                      <th className="py-2.5 px-3">SĐT Khách</th>
                      <th className="py-2.5 px-3">Sản Phẩm</th>
                      <th className="py-2.5 px-3">Thành Tiền</th>
                      <th className="py-2.5 px-3">Trạng Thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50 text-slate-300">
                    {parsedOrders.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/30">
                        <td className="py-2 px-3 font-mono font-semibold text-white">{item.order.orderCode}</td>
                        <td className="py-2 px-3 font-mono text-indigo-300">{item.customerPhone}</td>
                        <td className="py-2 px-3">{item.order.products[0]?.productName}</td>
                        <td className="py-2 px-3 font-bold text-emerald-400">
                          {formatVND(item.order.totalAmount)}
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              item.order.status === 'Completed'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-amber-500/20 text-amber-300'
                            }`}
                          >
                            {item.order.status}
                          </span>
                        </td>
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
            disabled={parsedOrders.length === 0}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/30 flex items-center space-x-2 transition cursor-pointer"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Xác Nhận Nhập ({parsedOrders.length} Đơn Hàng)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
