import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  User,
  Phone,
  Mail,
  Globe,
  MapPin,
  Tag,
  Briefcase,
  FileText,
  CheckCircle2,
  Package,
  Search,
} from 'lucide-react';
import type {
  Customer,
  CustomerGroupId,
  CustomerStatus,
  LeadSource,
  Gender,
  Product,
} from '../../types';
import { CUSTOMER_GROUPS, formatDateTime, getCustomerGroup } from '../../utils/crmUtils';
import { useAuth } from '../../contexts/AuthContext';

interface CustomerFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (customerData: Partial<Customer>) => void;
  initialData?: Customer | null;
  products?: Product[];
}

const GENDER_OPTIONS: Gender[] = ['Nam', 'Nữ', 'Khác'];
const LEAD_SOURCES: LeadSource[] = [
  'Facebook',
  'TikTok',
  'Google',
  'Website',
  'Zalo',
  'Referral',
  'Direct',
];
const STATUS_OPTIONS: CustomerStatus[] = ['New Lead', 'Contacted', 'Quoted', 'Won', 'Lost'];
const GROUP_OPTIONS: CustomerGroupId[] = ['group_1', 'group_2', 'group_3', 'group_4'];

export const CustomerFormModal: React.FC<CustomerFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  products = [],
}) => {
  const { users, currentUser } = useAuth();
  const ownerOptions = useMemo(() => {
    const names = users
      .filter((user) => user.status === 'active')
      .map((user) => user.name.trim())
      .filter(Boolean);
    if (currentUser?.name) names.push(currentUser.name.trim());
    if (initialData?.owner && !['', 'Chưa phân công', 'Unassigned'].includes(initialData.owner)) {
      names.push(initialData.owner.trim());
    }
    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b, 'vi'));
  }, [users, currentUser?.name, initialData?.owner]);
  const defaultOwner = currentUser?.name || ownerOptions[0] || 'Chưa phân công';

  const productOptions = useMemo(() => {
    const options = new Map<string, Product | null>();
    for (const p of products) {
      const name = p.name?.trim();
      if (name && !options.has(name)) options.set(name, p);
    }
    for (const interested of initialData?.interestedProducts || []) {
      const name = interested?.trim();
      if (name && !options.has(name)) options.set(name, null);
    }
    return Array.from(options, ([name, product]) => ({ name, product }));
  }, [products, initialData?.interestedProducts]);

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

  const [owner, setOwner] = useState('Chưa phân công');
  const [status, setStatus] = useState<CustomerStatus>('New Lead');
  const [group, setGroup] = useState<CustomerGroupId>('group_1');
  const [noteContent, setNoteContent] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [productSearch, setProductSearch] = useState('');

  const filteredProductOptions = useMemo(() => {
    const query = productSearch.trim().toLocaleLowerCase('vi');
    if (!query) return productOptions;

    return productOptions.filter(({ name, product }) =>
      [name, product?.code, product?.sku, product?.category]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase('vi').includes(query)),
    );
  }, [productOptions, productSearch]);

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

      setOwner(initialData.owner || defaultOwner);
      setStatus(initialData.status || 'New Lead');
      setGroup(getCustomerGroup(initialData));
      setSelectedProducts(initialData.interestedProducts || []);
      setProductSearch('');
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
      setOwner(defaultOwner);
      setStatus('New Lead');
      setGroup('group_1');
      setNoteContent('Khách hàng mới tạo từ form');
      setSelectedProducts(productOptions[0] ? [productOptions[0].name] : []);
      setProductSearch('');
    }
  }, [initialData, isOpen, defaultOwner, productOptions]);

  if (!isOpen) return null;

  const handleProductToggle = (productName: string) => {
    setSelectedProducts((prev) =>
      prev.includes(productName) ? prev.filter((p) => p !== productName) : [...prev, productName],
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
      group,
      interestedProducts: selectedProducts,
      ...(noteContent && !initialData
        ? {
            notes: [
              {
                id: `n_${Date.now()}`,
                author: owner,
                content: noteContent,
                createdAt: formatDateTime(new Date()),
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
        <form
          onSubmit={handleSubmit}
          className="p-6 space-y-6 text-slate-200 max-h-[80vh] overflow-y-auto"
        >
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
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Email (Không bắt buộc)
                </label>
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
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Nguồn Tiếp Cận (Source)
                </label>
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value as LeadSource)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  {LEAD_SOURCES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
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
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Lần Liên Hệ Gần Nhất (Last Contact)
                </label>
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

          {/* Section 3: Status, Group & Assignment */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2 text-indigo-400 font-semibold text-xs uppercase tracking-wider">
              <Briefcase className="w-4 h-4" />
              <span>3. Trạng Thái, Phân Nhóm & Nhân Viên Phụ Trách</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Nhân Viên Phụ Trách (Owner)
                </label>
                <select
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="Chưa phân công">Chưa phân công</option>
                  {ownerOptions.map((userName) => (
                    <option key={userName} value={userName}>
                      {userName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Trạng Thái Khách Hàng (Status)
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as CustomerStatus)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 font-medium"
                >
                  {STATUS_OPTIONS.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Phân Nhóm CRM
                </label>
                <select
                  value={group}
                  onChange={(e) => setGroup(e.target.value as CustomerGroupId)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 font-medium"
                >
                  {GROUP_OPTIONS.map((groupId) => (
                    <option key={groupId} value={groupId}>
                      {CUSTOMER_GROUPS[groupId].name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {!initialData && (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Ghi Chú Ban Đầu
                </label>
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
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center space-x-2 text-indigo-400 font-semibold text-xs uppercase tracking-wider">
                <Tag className="w-4 h-4" />
                <span>4. Sản Phẩm Khách Quan Tâm</span>
              </div>
              <span className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 text-[11px] font-semibold text-indigo-300">
                Đã chọn {selectedProducts.length}
              </span>
            </div>

            {productOptions.length > 0 ? (
              <>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    type="search"
                    value={productSearch}
                    onChange={(event) => setProductSearch(event.target.value)}
                    placeholder="Tìm theo tên, mã hoặc danh mục sản phẩm..."
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div className="grid max-h-64 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                  {filteredProductOptions.map(({ name: productName, product }) => {
                    const isSelected = selectedProducts.includes(productName);
                    return (
                      <label
                        key={productName}
                        className={`group flex cursor-pointer items-center gap-3 rounded-xl border p-2.5 transition ${
                          isSelected
                            ? 'border-indigo-500 bg-indigo-500/15 shadow-sm shadow-indigo-950/40'
                            : 'border-slate-700 bg-slate-800/70 hover:border-slate-600 hover:bg-slate-800'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleProductToggle(productName)}
                          className="h-4 w-4 shrink-0 cursor-pointer rounded border-slate-600 bg-slate-900 accent-indigo-600"
                        />

                        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-700 bg-slate-900 text-slate-500">
                          <Package className="h-5 w-5" />
                          {product?.image && (
                            <img
                              src={product.image}
                              alt={productName}
                              loading="lazy"
                              className="absolute inset-0 h-full w-full object-cover"
                              onError={(event) => {
                                event.currentTarget.style.display = 'none';
                              }}
                            />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div
                            className={`truncate text-sm font-semibold ${isSelected ? 'text-white' : 'text-slate-200'}`}
                            title={productName}
                          >
                            {productName}
                          </div>
                          <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[11px] text-slate-400">
                            {product?.code && (
                              <span className="shrink-0 font-medium text-slate-300">
                                {product.code}
                              </span>
                            )}
                            {product?.code && product?.category && (
                              <span aria-hidden="true">•</span>
                            )}
                            <span className="truncate">
                              {product?.category || 'Ngoài danh mục hiện tại'}
                            </span>
                          </div>
                        </div>

                        {isSelected && (
                          <CheckCircle2
                            className="h-4 w-4 shrink-0 text-indigo-400"
                            aria-hidden="true"
                          />
                        )}
                      </label>
                    );
                  })}

                  {filteredProductOptions.length === 0 && (
                    <div className="col-span-full rounded-xl border border-dashed border-slate-700 px-4 py-8 text-center text-xs text-slate-400">
                      Không tìm thấy sản phẩm phù hợp.
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-700 px-4 py-8 text-center">
                <Package className="mx-auto h-7 w-7 text-slate-600" />
                <p className="mt-2 text-xs text-slate-400">Chưa có sản phẩm trong danh mục.</p>
              </div>
            )}
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
