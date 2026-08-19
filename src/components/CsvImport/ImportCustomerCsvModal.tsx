import React, { useState } from 'react';
import { X, Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle2, UserPlus, Info } from 'lucide-react';
import type { Customer, CustomerStatus, LeadSource, Gender } from '../../types';
import { parseCsvContent, downloadCsvFile } from '../../utils/csvParser';

interface ImportCustomerCsvModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportCustomers: (newCustomers: Customer[]) => void;
  existingCustomersCount: number;
}

const SAMPLE_CSV_CUSTOMER = `Họ Tên,SĐT,Giới Tính,Địa Chỉ,Email,Ghi Chú,Nguồn Lead,Trạng Thái
"Ahmad Zakaria","+60 12 888 9911","Nam","Bukit Bintang, 55100 Kuala Lumpur","ahmad.z@gmail.com","Quan tâm bộ mỹ phẩm da dầu","Facebook","New Lead"
"Siti Aminah","+60 17 333 4455","Nữ","Subang Jaya, 47500 Selangor","siti.aminah@yahoo.com","Thường đặt giao giờ hành chính","TikTok","Contacted"
"Nguyễn Thị Hương","0918112233","Nữ","Georgetown, 10040 Penang","huong.nguyen@gmail.com","Khách quen hỏi mua combo serum","Zalo","Quoted"`;

export const ImportCustomerCsvModal: React.FC<ImportCustomerCsvModalProps> = ({
  isOpen,
  onClose,
  onImportCustomers,
  existingCustomersCount,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'paste'>('upload');
  const [pasteText, setPasteText] = useState('');
  const [fileName, setFileName] = useState('');
  const [parsedCustomers, setParsedCustomers] = useState<Partial<Customer>[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [skipDuplicates, setSkipDuplicates] = useState(true);

  if (!isOpen) return null;

  const handleDownloadSample = () => {
    downloadCsvFile('Mau_Nhap_Khach_Hang_VietCRM.csv', SAMPLE_CSV_CUSTOMER);
  };

  const processCsvRawText = (rawText: string, fileLabel?: string) => {
    setParseError(null);
    if (!rawText.trim()) {
      setParseError('Dữ liệu CSV rỗng. Vui lòng chọn file hoặc dán dữ liệu CSV.');
      setParsedCustomers([]);
      return;
    }

    const { headers, rows, errors } = parseCsvContent(rawText);

    if (errors.length > 0) {
      setParseError(errors.join('; '));
      setParsedCustomers([]);
      return;
    }

    if (rows.length === 0) {
      setParseError('Không đọc được dòng dữ liệu nào từ file CSV.');
      setParsedCustomers([]);
      return;
    }

    // Helper map key
    const findValue = (row: Record<string, string>, possibleKeys: string[]) => {
      for (const k of Object.keys(row)) {
        const normalized = k.toLowerCase().replace(/[^a-z0-9áàảãạăắằẳẵặâấầẩẫậđéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵ]/g, '');
        for (const pk of possibleKeys) {
          if (normalized.includes(pk)) return row[k];
        }
      }
      return '';
    };

    const newCustList: Partial<Customer>[] = rows.map((r, idx) => {
      const name = findValue(r, ['hoten', 'ten', 'name', 'fullname', 'khachhang']) || `Khách Hàng CSV ${idx + 1}`;
      const phone = findValue(r, ['sdt', 'phone', 'dienthoai', 'mobile', 'whatsapp']) || `09${Math.floor(10000000 + Math.random() * 90000000)}`;
      const genderRaw = findValue(r, ['gioitinh', 'gender', 'sex']).toLowerCase();
      let gender: Gender = 'Nữ';
      if (genderRaw.includes('nam') || genderRaw.includes('male') || genderRaw === 'm') gender = 'Nam';
      else if (genderRaw.includes('khac') || genderRaw.includes('other')) gender = 'Khác';

      const address = findValue(r, ['diachi', 'address', 'location', 'tinh thanh']) || 'Kuala Lumpur, Malaysia';
      const email = findValue(r, ['email', 'thu']) || undefined;
      const note = findValue(r, ['ghichu', 'note', 'node', 'ghichukhach']) || '';
      const sourceRaw = findValue(r, ['nguon', 'source', 'kenh']) || 'Facebook';
      const statusRaw = findValue(r, ['trangthai', 'status']) || 'New Lead';

      let source: LeadSource = 'Facebook';
      if (/tiktok/i.test(sourceRaw)) source = 'TikTok';
      else if (/google/i.test(sourceRaw)) source = 'Google';
      else if (/website/i.test(sourceRaw)) source = 'Website';
      else if (/zalo/i.test(sourceRaw)) source = 'Zalo';
      else if (/referral/i.test(sourceRaw)) source = 'Referral';
      else if (/direct/i.test(sourceRaw)) source = 'Direct';

      let status: CustomerStatus = 'New Lead';
      if (/contacted/i.test(statusRaw) || /da lien he/i.test(statusRaw)) status = 'Contacted';
      else if (/quoted/i.test(statusRaw) || /da bao gia/i.test(statusRaw)) status = 'Quoted';
      else if (/won/i.test(statusRaw) || /da mua/i.test(statusRaw) || /thanh cong/i.test(statusRaw)) status = 'Won';
      else if (/lost/i.test(statusRaw) || /that bai/i.test(statusRaw)) status = 'Lost';

      return {
        name,
        phone,
        gender,
        address,
        email,
        note,
        source,
        status,
        campaign: 'Import CSV ' + new Date().toLocaleDateString('vi-VN'),
        owner: 'Nguyễn Văn Ánh',
        whatsappOptIn: true,
      };
    });

    if (fileLabel) setFileName(fileLabel);
    setParsedCustomers(newCustList);
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
    if (parsedCustomers.length === 0) return;

    const formattedCustomers: Customer[] = parsedCustomers.map((c, idx) => ({
      id: `cust_csv_${Date.now()}_${idx}`,
      phone: c.phone || '0900000000',
      name: c.name || 'Khách Hàng Mới',
      gender: c.gender || 'Nữ',
      address: c.address || 'Malaysia',
      email: c.email,
      note: c.note || '',
      source: c.source || 'Facebook',
      campaign: c.campaign || 'Import CSV',
      firstContact: new Date().toISOString().split('T')[0],
      lastContact: new Date().toISOString().split('T')[0],
      owner: 'Nguyễn Văn Ánh',
      status: c.status || 'New Lead',
      notes: [
        {
          id: `n_imp_${Date.now()}_${idx}`,
          author: 'Hệ Thống',
          content: 'Được nhập danh sách hàng loạt qua file CSV.',
          createdAt: new Date().toLocaleString('vi-VN'),
          type: 'system',
        },
      ],
      totalOrders: 0,
      totalSpent: 0,
      interestedProducts: [],
      whatsappOptIn: true,
      whatsappOptInDate: new Date().toISOString().split('T')[0],
      orders: [],
    }));

    onImportCustomers(formattedCustomers);
    onClose();
    alert(`Đã nhập thành công ${formattedCustomers.length} khách hàng mới vào hệ thống CRM!`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center space-x-2 text-indigo-400">
            <FileSpreadsheet className="w-6 h-6" />
            <h3 className="font-bold text-lg text-white">Nhập Danh Sách Khách Hàng Bằng CSV</h3>
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
          {/* Top Instructions & Sample Download */}
          <div className="bg-indigo-950/30 border border-indigo-500/20 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="text-xs text-slate-300 space-y-1">
              <p className="font-semibold text-indigo-300 flex items-center gap-1.5">
                <Info className="w-4 h-4" />
                <span>Hướng dẫn cấu trúc file CSV</span>
              </p>
              <p className="text-slate-400">
                File CSV gồm các cột: <strong className="text-slate-200">Họ Tên, SĐT, Giới Tính, Địa Chỉ, Email, Ghi Chú, Nguồn Lead, Trạng Thái</strong>.
              </p>
            </div>
            <button
              onClick={handleDownloadSample}
              className="px-3.5 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Tải Mẫu CSV (.csv)</span>
            </button>
          </div>

          {/* Toggle Tab: File Upload vs Raw Text */}
          <div className="flex border-b border-slate-800 text-xs font-medium">
            <button
              onClick={() => setActiveTab('upload')}
              className={`pb-2.5 px-4 transition border-b-2 cursor-pointer ${
                activeTab === 'upload'
                  ? 'border-indigo-500 text-indigo-400 font-bold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Tải File CSV Từ Máy Tính
            </button>
            <button
              onClick={() => setActiveTab('paste')}
              className={`pb-2.5 px-4 transition border-b-2 cursor-pointer ${
                activeTab === 'paste'
                  ? 'border-indigo-500 text-indigo-400 font-bold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Dán Dữ Liệu CSV
            </button>
          </div>

          {/* Upload Tab */}
          {activeTab === 'upload' ? (
            <div className="border-2 border-dashed border-slate-700 hover:border-indigo-500/60 rounded-xl p-6 text-center transition bg-slate-800/30">
              <Upload className="w-8 h-8 mx-auto text-indigo-400 mb-2" />
              <p className="text-sm font-semibold text-white">Chọn file .csv hoặc kéo thả vào đây</p>
              <p className="text-xs text-slate-400 mt-1">Hỗ trợ định dạng CSV mã hóa UTF-8</p>

              <input
                type="file"
                accept=".csv,.txt"
                onChange={handleFileUpload}
                className="hidden"
                id="customer-csv-input"
              />
              <label
                htmlFor="customer-csv-input"
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
                placeholder={`Dán nội dung CSV vào đây...\nVí dụ:\nHọ Tên,SĐT,Giới Tính,Địa Chỉ\nNguyễn Văn A,0901234567,Nam,Kuala Lumpur`}
                rows={5}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
              />
              <button
                onClick={() => processCsvRawText(pasteText, 'Dữ liệu dán tay')}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                Xử Lý Dữ Liệu Dán
              </button>
            </div>
          )}

          {/* Error Banner */}
          {parseError && (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs p-3 rounded-xl flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{parseError}</span>
            </div>
          )}

          {/* Preview Table */}
          {parsedCustomers.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Đã đọc thành công {parsedCustomers.length} khách hàng</span>
                </span>
                <span className="text-xs text-slate-400">Xem trước dữ liệu sẽ nhập</span>
              </div>

              <div className="max-h-56 overflow-y-auto border border-slate-800 rounded-xl bg-slate-950/60">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-800/80 text-slate-300 border-b border-slate-800 font-semibold sticky top-0">
                      <th className="py-2.5 px-3">Họ Tên</th>
                      <th className="py-2.5 px-3">SĐT</th>
                      <th className="py-2.5 px-3">Giới Tính</th>
                      <th className="py-2.5 px-3">Địa Chỉ</th>
                      <th className="py-2.5 px-3">Nguồn</th>
                      <th className="py-2.5 px-3">Ghi Chú</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50 text-slate-300">
                    {parsedCustomers.map((c, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/30">
                        <td className="py-2 px-3 font-semibold text-white">{c.name}</td>
                        <td className="py-2 px-3 font-mono text-indigo-300">{c.phone}</td>
                        <td className="py-2 px-3">{c.gender}</td>
                        <td className="py-2 px-3 text-slate-400 truncate max-w-[150px]">{c.address}</td>
                        <td className="py-2 px-3">
                          <span className="bg-slate-800 px-2 py-0.5 rounded text-[10px] text-indigo-300">
                            {c.source}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-slate-400 truncate max-w-[150px]">{c.note || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-900/80">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition cursor-pointer"
          >
            Hủy Bỏ
          </button>

          <button
            onClick={handleConfirmImport}
            disabled={parsedCustomers.length === 0}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/30 flex items-center space-x-2 transition cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Xác Nhận Nhập ({parsedCustomers.length} Khách Hàng)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
