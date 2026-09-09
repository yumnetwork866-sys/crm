import React, { useState } from 'react';
import {
  Calculator,
  CalendarClock,
  ExternalLink,
  Globe,
  MapPin,
  PackageSearch,
  Pencil,
  Phone,
  Plus,
  ReceiptText,
  StickyNote,
  User,
  WalletCards,
  X,
} from 'lucide-react';
import type { Customer, CustomerStatus } from '../../types';
import { CUSTOMER_GROUPS, formatVND, formatDate, formatDateTime, getCustomerGroup, getOwnerAvatar, getStatusColorClass } from '../../utils/crmUtils';
import { useAuth } from '../../contexts/AuthContext';
import { findUserByName, getUserRoleTextStyle } from '../../utils/roleColors';
import { UserInfoModal } from '../Common/UserInfoModal';

interface CustomerDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer | null;
  onOpenAddOrder: (customer: Customer) => void;
  onEditCustomer: (customer: Customer) => void;
  onAddNote: (customerId: string, noteText: string) => void;
  onUpdateStatus: (customerId: string, status: CustomerStatus) => void;
  onToggleOptIn: (customerId: string) => void;
}

export const CustomerDetailModal: React.FC<CustomerDetailModalProps> = ({
  isOpen,
  onClose,
  customer,
  onOpenAddOrder,
  onEditCustomer,
  onAddNote,
  onUpdateStatus,
  onToggleOptIn,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'orders' | 'notes' | 'automation'>('overview');
  const [newNoteText, setNewNoteText] = useState('');
  const [isOwnerInfoOpen, setIsOwnerInfoOpen] = useState(false);
  const { users, currentUser } = useAuth();

  if (!isOpen || !customer) return null;

  const ownerUser = findUserByName(users, customer.owner)
    ?? (currentUser?.name === customer.owner ? currentUser : undefined);

  const groupKey = getCustomerGroup(customer);
  const groupInfo = CUSTOMER_GROUPS[groupKey];

  const isOptedIn = Boolean(customer.whatsappOptIn);
  const averageOrderValue = customer.totalOrders > 0 ? customer.totalSpent / customer.totalOrders : 0;
  const marketName = customer.country || 'Malaysia';
  const landingPageUrl = customer.landingPage && /^https?:\/\//i.test(customer.landingPage)
    ? customer.landingPage
    : null;

  const handleAddNoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim()) return;
    onAddNote(customer.id, newNoteText.trim());
    setNewNoteText('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden my-6 flex flex-col max-h-[90vh]">

        {/* Customer identity, operations and quick actions */}
        <div className="shrink-0 border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
          <div className="flex items-start gap-4">
            <div className="flex min-w-0 flex-1 items-start gap-3.5">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm">
                <img
                  src={customer.avatar || `https://api.dicebear.com/10.x/clay/svg?topProbability=0&patternProbability=0&seed=${encodeURIComponent(customer.phone || customer.name)}`}
                  alt={customer.name}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-xl font-black text-slate-950">{customer.name}</h2>
                  <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${groupInfo.badgeColor}`}>
                    {groupInfo.name}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                  <a href={`tel:${customer.phone}`} className="inline-flex items-center gap-1 font-semibold hover:text-indigo-600">
                    <Phone className="h-3.5 w-3.5" /> {customer.phone}
                  </a>
                  <span>{marketName}</span>
                  <span>{customer.gender || 'Chưa cập nhật'}</span>
                </div>
                <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
                  <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                    Trạng thái
                    <select
                      value={customer.status}
                      onChange={(event) => onUpdateStatus(customer.id, event.target.value as CustomerStatus)}
                      className={`cursor-pointer rounded-lg border px-2.5 py-1 text-xs font-bold shadow-sm outline-none ${getStatusColorClass(customer.status)}`}
                    >
                      <option value="New Lead">New Lead</option>
                      <option value="Contacted">Contacted</option>
                      <option value="Quoted">Quoted</option>
                      <option value="Won">Won</option>
                      <option value="Lost">Lost</option>
                    </select>
                  </label>
                  <span className="text-slate-300">•</span>
                  <div className="inline-flex items-center gap-1.5 text-[11px]">
                    <span className="font-semibold text-slate-500">Phụ trách</span>
                    {ownerUser ? (
                      <button
                        type="button"
                        onClick={() => setIsOwnerInfoOpen(true)}
                        title={`Xem thông tin ${ownerUser.name}`}
                        className="inline-flex items-center gap-1.5 font-bold hover:underline"
                        style={getUserRoleTextStyle(ownerUser)}
                      >
                        <img
                          src={ownerUser.avatar || getOwnerAvatar(customer.owner)}
                          alt={ownerUser.name}
                          className="h-5 w-5 rounded-full border border-slate-200 object-cover"
                        />
                        {customer.owner}
                      </button>
                    ) : (
                      <span className="font-semibold text-slate-400">Chưa phân công</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => onEditCustomer(customer)}
                className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                title="Chỉnh sửa thông tin khách hàng"
                aria-label="Chỉnh sửa thông tin khách hàng"
              >
                <Pencil className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                title="Đóng"
                aria-label="Đóng chi tiết khách hàng"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="no-scrollbar flex shrink-0 gap-5 overflow-x-auto border-b border-slate-200 bg-slate-50 px-5 text-xs font-semibold text-slate-500 sm:px-6">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3 border-b-2 transition ${
              activeTab === 'overview'
                ? 'border-indigo-600 text-indigo-600 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            Tổng quan
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`py-3 border-b-2 transition flex items-center space-x-1 ${
              activeTab === 'orders'
                ? 'border-indigo-600 text-indigo-600 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            <span>Đơn hàng ({customer.totalOrders})</span>
          </button>
          <button
            onClick={() => setActiveTab('notes')}
            className={`py-3 border-b-2 transition flex items-center space-x-1 ${
              activeTab === 'notes'
                ? 'border-indigo-600 text-indigo-600 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            <span>Ghi chú ({customer.notes?.length || 0})</span>
          </button>
          <button
            onClick={() => setActiveTab('automation')}
            className={`py-3 border-b-2 transition flex items-center space-x-1 ${
              activeTab === 'automation'
                ? 'border-indigo-600 text-indigo-600 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            <span>Automation</span>
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 space-y-6 overflow-y-auto bg-slate-50 p-4 text-slate-900 sm:p-6">

          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">

              {/* Customer value metrics */}
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                    <ReceiptText className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold text-slate-500">Tổng đơn hàng</div>
                    <div className="mt-0.5 text-lg font-black text-slate-950">{customer.totalOrders} đơn</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                    <WalletCards className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold text-slate-500">Tổng chi tiêu</div>
                    <div className="mt-0.5 truncate text-lg font-black text-emerald-700">{formatVND(customer.totalSpent)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                    <Calculator className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold text-slate-500">Trung bình mỗi đơn</div>
                    <div className="mt-0.5 truncate text-lg font-black text-slate-950">{formatVND(averageOrderValue)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                    <CalendarClock className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold text-slate-500">Mua gần nhất</div>
                    <div className="mt-0.5 text-base font-black text-slate-950">{customer.lastPurchaseDate ? formatDate(customer.lastPurchaseDate) : '_'}</div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {/* Personal information */}
                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3.5">
                    <User className="h-4 w-4 text-indigo-600" />
                    <h4 className="text-sm font-bold text-slate-950">Thông tin cá nhân</h4>
                  </div>
                  <dl className="divide-y divide-slate-100 px-4 text-xs">
                    <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 py-3">
                      <dt className="font-medium text-slate-500">Họ và tên</dt>
                      <dd className="font-semibold text-slate-900">{customer.name}</dd>
                    </div>
                    <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 py-3">
                      <dt className="font-medium text-slate-500">Số điện thoại</dt>
                      <dd><a href={`tel:${customer.phone}`} className="font-semibold text-indigo-600 hover:underline">{customer.phone}</a></dd>
                    </div>
                    <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 py-3">
                      <dt className="font-medium text-slate-500">Email</dt>
                      <dd>
                        {customer.email ? (
                          <a href={`mailto:${customer.email}`} className="break-all font-semibold text-indigo-600 hover:underline">{customer.email}</a>
                        ) : (
                          <span className="font-medium text-slate-400">Chưa cập nhật</span>
                        )}
                      </dd>
                    </div>
                    <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 py-3">
                      <dt className="font-medium text-slate-500">Giới tính</dt>
                      <dd className="font-semibold text-slate-900">{customer.gender || 'Chưa cập nhật'}</dd>
                    </div>
                    <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 py-3">
                      <dt className="font-medium text-slate-500">Địa chỉ</dt>
                      <dd className="flex gap-1.5 font-semibold text-slate-900">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                        {customer.address || 'Chưa cập nhật'}
                      </dd>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 py-3">
                      <dt className="font-medium text-slate-500">WhatsApp Opt-In</dt>
                      <dd className="flex items-center gap-2">
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                          isOptedIn
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-rose-200 bg-rose-50 text-rose-700'
                        }`}>
                          {isOptedIn ? '✓ Opt-in Marketing' : '! Chưa Opt-in'}
                        </span>
                        <button
                          type="button"
                          onClick={() => onToggleOptIn(customer.id)}
                          className="text-[10px] font-semibold text-indigo-600 hover:underline"
                        >
                          Đổi trạng thái
                        </button>
                      </dd>
                    </div>
                  </dl>
                </section>

                {/* Acquisition source */}
                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3.5">
                    <Globe className="h-4 w-4 text-indigo-600" />
                    <h4 className="text-sm font-bold text-slate-950">Nguồn khách</h4>
                  </div>
                  <dl className="divide-y divide-slate-100 px-4 text-xs">
                    <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 py-3">
                      <dt className="font-medium text-slate-500">Kênh tiếp cận</dt>
                      <dd><span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 font-bold text-indigo-700">{customer.source || 'Trực tiếp'}</span></dd>
                    </div>
                    <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 py-3">
                      <dt className="font-medium text-slate-500">Chiến dịch</dt>
                      <dd className="font-semibold text-slate-900">
                        {customer.campaign && !['N/A', 'n/a', 'NA', 'na', 'Default Campaign'].includes(customer.campaign.trim())
                          ? customer.campaign
                          : 'Không có chiến dịch'}
                      </dd>
                    </div>
                    <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 py-3">
                      <dt className="font-medium text-slate-500">Tập quảng cáo</dt>
                      <dd className="font-semibold text-slate-900">
                        {customer.adSet && !['N/A', 'n/a', 'NA', 'na'].includes(customer.adSet.trim()) ? customer.adSet : 'Chưa có'}
                      </dd>
                    </div>
                    <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 py-3">
                      <dt className="font-medium text-slate-500">Trang đích</dt>
                      <dd className="min-w-0">
                        {landingPageUrl ? (
                          <a href={landingPageUrl} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1 font-semibold text-indigo-600 hover:underline">
                            <span className="truncate">{customer.landingPage}</span><ExternalLink className="h-3 w-3 shrink-0" />
                          </a>
                        ) : (
                          <span className="font-semibold text-slate-900">{customer.landingPage || 'Chưa có'}</span>
                        )}
                      </dd>
                    </div>
                    <div className="grid grid-cols-2 gap-4 py-3">
                      <div>
                        <dt className="font-medium text-slate-500">Liên hệ đầu tiên</dt>
                        <dd className="mt-1 font-semibold text-slate-900">{formatDate(customer.firstContact)}</dd>
                      </div>
                      <div>
                        <dt className="font-medium text-slate-500">Gần nhất</dt>
                        <dd className="mt-1 font-semibold text-slate-900">{formatDate(customer.lastContact)}</dd>
                      </div>
                    </div>
                  </dl>
                </section>
              </div>

              {customer.note && (
                <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-amber-800">
                    <StickyNote className="h-4 w-4" />
                    <h4 className="text-xs font-bold">Ghi chú khách hàng</h4>
                  </div>
                  <p className="mt-2 text-sm font-medium italic leading-relaxed text-slate-800">{customer.note}</p>
                </section>
              )}

              {/* Interested products */}
              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2">
                  <PackageSearch className="h-4 w-4 text-indigo-600" />
                  <h4 className="text-xs font-bold text-slate-800">Sản phẩm khách quan tâm</h4>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {customer.interestedProducts && customer.interestedProducts.length > 0 ? (
                    customer.interestedProducts.map((product) => (
                      <span key={product} className="rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                        {product}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs font-medium text-slate-500">Chưa chọn sản phẩm quan tâm.</span>
                  )}
                </div>
              </section>

            </div>
          )}

          {/* TAB 2: ORDERS */}
          {activeTab === 'orders' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-900">Lịch Sử Mua Hàng ({customer.orders.length} Đơn)</h4>
                <button
                  onClick={() => onOpenAddOrder(customer)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center space-x-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tạo Đơn Hàng Mới</span>
                </button>
              </div>

              {customer.orders.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl border border-slate-200 text-slate-500 text-xs shadow-sm">
                  Khách hàng chưa có đơn hàng nào. Bấm nút "Tạo Đơn Hàng Mới" để thêm!
                </div>
              ) : (
                customer.orders.map((ord) => (
                  <div key={ord.id} className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-sm">
                    <div className="flex items-center justify-between text-xs border-b border-slate-200 pb-2">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-indigo-600 text-sm">{ord.orderCode}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full font-bold text-[10px] border ${
                            ord.status === 'Completed'
                              ? 'bg-emerald-100 text-[#00793d] border-emerald-300'
                              : ord.status === 'Processing'
                              ? 'bg-amber-100 text-amber-800 border-amber-300'
                              : 'bg-rose-100 text-rose-700 border-rose-300'
                          }`}
                        >
                          {ord.status === 'Completed' ? '✓ Hoàn Tất' : ord.status === 'Processing' ? '⏳ Đang Xử Lý' : '✕ Đã Hủy'}
                        </span>
                      </div>
                      <span className="text-slate-400">{formatDate(ord.date)}</span>
                    </div>

                    <div className="space-y-1 text-xs">
                      {ord.products.map((p, i) => (
                        <div key={i} className="flex justify-between text-slate-700">
                          <span>{p.quantity}x {p.productName}</span>
                          <span>{formatVND(p.price * p.quantity)}</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-between items-center text-xs pt-2 border-t border-slate-200 font-bold text-slate-900">
                      <span>Tổng Tiền Đơn Hàng:</span>
                      <span className="text-emerald-600 text-sm">{formatVND(ord.totalAmount)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 3: NOTES */}
          {activeTab === 'notes' && (
            <div className="space-y-4">

              {/* Add Note Form */}
              <form onSubmit={handleAddNoteSubmit} className="space-y-2">
                <textarea
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  rows={2}
                  placeholder="Nhập nội dung ghi chú / kết quả trao đổi với khách..."
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={!newNoteText.trim()}
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold"
                  >
                    Lưu Ghi Chú
                  </button>
                </div>
              </form>

              {/* Notes Timeline */}
              <div className="space-y-3">
                {(!customer.notes || customer.notes.length === 0) ? (
                  <div className="text-center py-8 text-slate-500 text-xs">Chưa có ghi chú nào.</div>
                ) : (
                  customer.notes.map((n) => (
                    <div key={n.id} className="bg-white border border-slate-200 p-3 rounded-xl text-xs space-y-1 shadow-sm">
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span className="font-semibold text-indigo-600">{n.author}</span>
                        <span>{formatDateTime(n.createdAt)}</span>
                      </div>
                      <p className="text-slate-700">{n.content}</p>
                    </div>
                  ))
                )}
              </div>

            </div>
          )}

          {/* TAB 4: AUTOMATION */}
          {activeTab === 'automation' && (
            <div className="space-y-5">
              {/* Execution Steps */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                {[
                  { step: 1, day: 'Ngày +3', label: 'Lời Cảm Ơn & HDSD' },
                  { step: 2, day: 'Ngày +5', label: 'Hỏi Trải Nghiệm' },
                  { step: 3, day: 'Ngày +7', label: 'Giải Đáp & Gợi Ý' },
                  { step: 4, day: 'Ngày +15', label: 'Gửi Voucher 20%' },
                ].map((s) => {
                  const currentStep = customer.automationSequence?.currentStep || 0;
                  const isDone = currentStep >= s.step;
                  const isCurrent = currentStep === s.step - 1;

                  return (
                    <div
                      key={s.step}
                      className={`p-3 rounded-xl border text-xs text-center space-y-1 shadow-sm ${
                        isDone
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                          : isCurrent
                          ? 'bg-indigo-50 border-indigo-500 text-indigo-900 ring-2 ring-indigo-500'
                          : 'bg-white border-slate-200 text-slate-500'
                      }`}
                    >
                      <div className="font-bold">{s.day}</div>
                      <div className="text-[11px] font-medium">{s.label}</div>
                      <div className="pt-1">
                        {isDone ? (
                          <span className="text-[10px] font-bold text-emerald-700">✓ Đã Gửi</span>
                        ) : isCurrent ? (
                          <span className="text-[10px] font-bold text-amber-700">⏳ Tiếp Theo</span>
                        ) : (
                          <span className="text-[10px] font-semibold text-slate-500">Chờ Lịch</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Execution Logs */}
              {Boolean(customer.automationSequence?.logs && customer.automationSequence.logs.length > 0) && (
                <div className="space-y-2">
                  {customer.automationSequence!.logs.map((log, idx) => (
                    <div key={idx} className="bg-white border border-slate-200 p-3 rounded-xl text-xs space-y-1 shadow-sm">
                      <div className="flex justify-between text-slate-600 text-[11px]">
                        <span className="font-bold text-emerald-700">{log.stepName}</span>
                        <span className="font-semibold text-slate-500">{formatDateTime(log.sentAt)}</span>
                      </div>
                      <p className="text-slate-900 italic font-medium">"{log.message}"</p>
                    </div>
                  ))}
                </div>
              )}

            </div>
          )}

        </div>

      </div>
      <UserInfoModal
        user={isOwnerInfoOpen ? ownerUser ?? null : null}
        onClose={() => setIsOwnerInfoOpen(false)}
      />
    </div>
  );
};
