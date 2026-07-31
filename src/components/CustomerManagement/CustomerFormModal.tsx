import React, { useState, useEffect } from 'react';
import { X, User, Phone, Mail, Globe, MapPin, Tag, Briefcase, FileText, CheckCircle2 } from 'lucide-react';
import { Customer, CustomerStatus, LeadSource, Gender } from '../../types';
import { INITIAL_PRODUCTS, SALES_REPS } from '../../data/mockData';

interface CustomerFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (customerData: Partial<Customer>) => void;
  initialData?: Customer | null;
}

const GENDER_OPTIONS: Gender[] = ['Nam', 'Nữ', 'Khác'];
const LEAD_SOURCES: LeadSource[] = ['Facebook', 'TikTok', 'Google', 'Website', 'Zalo', 'Referral', 'Direct'];
const STATUS_OPTIONS: CustomerStatus[] = ['New Lead', 'Contacted', 'Quoted', 'Won', 'Lost'];

export const CustomerFormModal: React.FC<CustomerFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
}) => {
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [gender, setGender] = useState<Gender>('Nữ');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');

  const [source, setSource] = useState<LeadSource>('Facebook');
  const [campaign, setCampaign] = useState('');
  const [adSet, setAdSet] = useState('');
  const [landingPage, setLandingPage] = useState('');
  const [firstContact, setFirstContact] = useState('');
  const [lastContact, setLastContact] = useState('');

  const [owner, setOwner] = useState(SALES_REPS[0]);
  const [status, setStatus] = useState<CustomerStatus>('New Lead');
  const [noteContent, setNoteContent] = useState('');
  const [whatsappOptIn, setWhatsappOptIn] = useState(true);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);

  useEffect(() => {
    if (initialData) {
      setPhone(initialData.phone || '');
      setName(initialData.name || '');
      setGender(initialData.gender || 'Nữ');
      setAddress(initialData.address || '');
      setEmail(initialData.email || '');
      setNote(initialData.note || '');

      setSource(initialData.source || 'Facebook');
      setCampaign(initialData.campaign || '');
      setAdSet(initialData.adSet || '');
      setLandingPage(initialData.landingPage || '');
      setFirstContact(initialData.firstContact || new Date().toISOString().split('T')[0]);
      setLastContact(initialData.lastContact || new Date().toISOString().split('T')[0]);

      setOwner(initialData.owner || SALES_REPS[0]);
      setStatus(initialData.status || 'New Lead');
      setWhatsappOptIn(initialData.whatsappOptIn ?? true);
      setSelectedProducts(initialData.interestedProducts || []);
    } else {
      setPhone('');
      setName('');
      setGender('Nữ');
      setAddress('Kuala Lumpur, Malaysia');
      setEmail('');
      setNote('');
      setSource('Facebook');
      setCampaign('Chiến dịch Mùa Hè 2026');
      setAdSet('Target Khách Hàng Quan Tâm');
      setLandingPage('/landing-sp');
      const today = new Date().toISOString().split('T')[0];
      setFirstContact(today);
      setLastContact(today);
      setOwner(SALES_REPS[0]);
      setStatus('New Lead');
      setNoteContent('Khách hàng mới tạo từ form');
      setWhatsappOptIn(true);
      setSelectedProducts([INITIAL_PRODUCTS[0]]);
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleProductToggle = (productName: string) => {
    setSelectedProducts((prev) =>
      prev.includes(productName)
        ? prev.filter((p) => p !== productName)
        : [...prev, productName]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      alert('Vui lòng nhập Tên và Số điện thoại khách hàng!');
      return;
    }

    onSave({
      id: initialData ? initialData.id : undefined,
      phone,
      name,
      gender,
      address: address.trim() || 'Malaysia',
      email: email.trim() ? email : undefined,
      note: note.trim(),
      source,
      campaign,
      adSet,
      landingPage,
      firstContact: firstContact || new Date().toISOString().split('T')[0],
      lastContact: lastContact || new Date().toISOString().split('T')[0],
      owner,
      status,
      whatsappOptIn,
      interestedProducts: selectedProducts,
      ...(noteContent && !initialData
        ? {
            notes: [
              {
                id: `n_${Date.now()}`,
                author: owner,
                content: noteContent,
                createdAt: new Date().toLocaleString('vi-VN'),
                type: 'note',
              },
            ],
          }
        : {}),
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden my-8">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-800/80 border-b border-slate-700/70 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <User className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-bold text-white">
              {initialData ? 'Chỉnh Sửa Thông Tin Khách Hàng' : 'Thêm Khách Hàng Mới'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-900 dark:text-slate-400 hover:text-black dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
            title="Đóng"
          >
            <X className="w-5 h-5 text-slate-900 dark:text-slate-400" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 text-slate-200 max-h-[80vh] overflow-y-auto">
          
          {/* Section 1: Basic Info */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2 text-indigo-400 font-semibold text-xs uppercase tracking-wider">
              <User className="w-4 h-4" />
              <span>1. Thông Tin Cơ Bản (Thị Trường Malaysia)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Họ và Tên Khách Hàng <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ví dụ: Siti Nurhaliza"
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Số Điện Thoại (WhatsApp) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+60 12 345 6789..."
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Giới Tính</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value as Gender)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  {GENDER_OPTIONS.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Email (Không bắt buộc)</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="khachhang@gmail.com"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Địa Chỉ Chi Tiết (Malaysia)</span>
                  </span>
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Ví dụ: Jalan Ampang, 50450 Kuala Lumpur, Malaysia"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  <span className="flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Ghi Chú Thông Tin Khách Hàng (Note)</span>
                  </span>
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder="Lưu ý thói quen, thời gian giao hàng, đặc điểm da/nhu cầu..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="sm:col-span-2 flex items-center space-x-3 pt-2">
                <input
                  type="checkbox"
                  id="whatsappOptIn"
                  checked={whatsappOptIn}
                  onChange={(e) => setWhatsappOptIn(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 bg-slate-800"
                />
                <label htmlFor="whatsappOptIn" className="text-xs text-slate-300 cursor-pointer">
                  Đồng ý nhận tin nhắn WhatsApp Business (Opt-in Policy)
                </label>
              </div>
            </div>
          </div>

          <hr className="border-slate-800" />

          {/* Section 2: Lead Source */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2 text-indigo-400 font-semibold text-xs uppercase tracking-wider">
              <Globe className="w-4 h-4" />
              <span>2. Nguồn Khách Hang (Lead Source)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Nguồn Tiếp Cận (Source)</label>
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value as LeadSource)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  {LEAD_SOURCES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Tên Chiến Dịch (Campaign)</label>
                <input
                  type="text"
                  value={campaign}
                  onChange={(e) => setCampaign(e.target.value)}
                  placeholder="Ví dụ: Tet Sale 2026 - Beauty"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Tập Quảng Cáo (Ad Set)</label>
                <input
                  type="text"
                  value={adSet}
                  onChange={(e) => setAdSet(e.target.value)}
                  placeholder="Ví dụ: Interest Skincare 25-40"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Trang Đích (Landing Page)</label>
                <input
                  type="text"
                  value={landingPage}
                  onChange={(e) => setLandingPage(e.target.value)}
                  placeholder="/landing-sp"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Lần Liên Hệ Đầu (First Contact)</label>
                <input
                  type="date"
                  value={firstContact}
                  onChange={(e) => setFirstContact(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Lần Liên Hệ Gần Nhất (Last Contact)</label>
                <input
                  type="date"
                  value={lastContact}
                  onChange={(e) => setLastContact(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          <hr className="border-slate-800" />

          {/* Section 3: Status & Assignment */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2 text-indigo-400 font-semibold text-xs uppercase tracking-wider">
              <Briefcase className="w-4 h-4" />
              <span>3. Trạng Thái & Nhân Viên Phụ Trách</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Nhân Viên Phụ Trách (Owner)</label>
                <select
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  {SALES_REPS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Trạng Thái Khách Hàng (Status)</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as CustomerStatus)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 font-medium"
                >
                  {STATUS_OPTIONS.map((st) => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              </div>
            </div>

            {!initialData && (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Ghi Chú Ban Đầu</label>
                <textarea
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  rows={2}
                  placeholder="Ghi chú về nhu cầu, mong muốn của khách..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            )}
          </div>

          <hr className="border-slate-800" />

          {/* Section 4: Interested Products */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2 text-indigo-400 font-semibold text-xs uppercase tracking-wider">
              <Tag className="w-4 h-4" />
              <span>4. Sản Phẩm Khách Quan Tâm</span>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              {INITIAL_PRODUCTS.map((prod) => {
                const isSelected = selectedProducts.includes(prod);
                return (
                  <button
                    type="button"
                    key={prod}
                    onClick={() => handleProductToggle(prod)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                      isSelected
                        ? 'bg-indigo-600 border-indigo-500 text-white shadow'
                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    {prod} {isSelected ? '✓' : ''}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 transition"
            >
              Hủy Bỏ
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition"
            >
              {initialData ? 'Lưu Thay Đổi' : 'Thêm Khách Hàng'}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
