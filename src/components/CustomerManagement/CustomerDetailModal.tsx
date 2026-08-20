import React, { useState } from 'react';
import {
  X, User, Phone, Mail, Globe, Calendar, Tag, DollarSign,
  ShoppingBag, FileText, Send, Sparkles, Plus, CheckCircle2,
  Clock, ShieldCheck, ShieldAlert, MessageSquare, Briefcase
} from 'lucide-react';
import type { Customer, CustomerStatus } from '../../types';
import { CUSTOMER_GROUPS, formatVND, formatDate, formatDateTime, getCustomerGroup, getStatusColorClass, getOwnerBadgeClass } from '../../utils/crmUtils';

interface CustomerDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer | null;
  onOpenAddOrder: (customer: Customer) => void;
  onOpenChat: (customer: Customer) => void;
  onAddNote: (customerId: string, noteText: string) => void;
  onUpdateStatus: (customerId: string, status: CustomerStatus) => void;
  onToggleOptIn: (customerId: string) => void;
}

export const CustomerDetailModal: React.FC<CustomerDetailModalProps> = ({
  isOpen,
  onClose,
  customer,
  onOpenAddOrder,
  onOpenChat,
  onAddNote,
  onUpdateStatus,
  onToggleOptIn,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'orders' | 'notes' | 'automation'>('overview');
  const [newNoteText, setNewNoteText] = useState('');

  if (!isOpen || !customer) return null;

  const groupKey = getCustomerGroup(customer);
  const groupInfo = CUSTOMER_GROUPS[groupKey];

  const isOptedIn = Boolean(customer.whatsappOptIn);

  const handleAddNoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim()) return;
    onAddNote(customer.id, newNoteText.trim());
    setNewNoteText('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden my-6 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
              <img
                src={customer.avatar || `https://api.dicebear.com/10.x/adventurer/svg?seed=${encodeURIComponent(customer.phone || customer.name)}`}
                alt="avatar"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold text-slate-900">{customer.name}</h2>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${groupInfo.badgeColor}`}>
                  {groupInfo.name}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                SĐT: <span className="text-slate-700 font-medium">{customer.phone}</span> • Thị trường: Malaysia (MY) • Giới tính: <span className="text-indigo-600 font-semibold">{customer.gender || 'Nữ'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => onOpenChat(customer)}
              className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold shadow transition flex items-center space-x-1"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Chat WhatsApp</span>
            </button>

            <button
              onClick={() => onOpenAddOrder(customer)}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow transition flex items-center space-x-1"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>+ Đơn Hàng</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
              title="Đóng"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 bg-slate-50 border-b border-slate-200 flex space-x-4 shrink-0 text-xs font-medium text-slate-500">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3 border-b-2 transition ${
              activeTab === 'overview'
                ? 'border-indigo-600 text-indigo-600 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            Thông Tin Chi Tiết
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`py-3 border-b-2 transition flex items-center space-x-1 ${
              activeTab === 'orders'
                ? 'border-indigo-600 text-indigo-600 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            <span>Đơn Hàng ({customer.totalOrders})</span>
          </button>
          <button
            onClick={() => setActiveTab('notes')}
            className={`py-3 border-b-2 transition flex items-center space-x-1 ${
              activeTab === 'notes'
                ? 'border-indigo-600 text-indigo-600 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            <span>Ghi Chú ({customer.notes?.length || 0})</span>
          </button>
          <button
            onClick={() => setActiveTab('automation')}
            className={`py-3 border-b-2 transition flex items-center space-x-1 ${
              activeTab === 'automation'
                ? 'border-indigo-600 text-indigo-600 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Tiến Trình Automation</span>
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50 text-slate-900">
          
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              
              {/* Quick Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
                  <div className="text-xs text-slate-600 font-semibold">Tổng Số Đơn Hàng</div>
                  <div className="text-2xl font-bold text-slate-900 mt-1">{customer.totalOrders} đơn</div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Lần mua gần nhất: {formatDate(customer.lastPurchaseDate)}
                  </div>
                </div>

                <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
                  <div className="text-xs text-slate-600 font-semibold">Tổng Chi Tiêu (VND)</div>
                  <div className="text-2xl font-bold text-emerald-600 mt-1">{formatVND(customer.totalSpent)}</div>
                  <div className="text-[11px] text-slate-500 mt-1">LTV Khách hàng</div>
                </div>

                <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
                  <div className="text-xs text-slate-600 font-semibold mb-1.5">Trạng Thái & Phụ Trách</div>
                  <div className="flex items-center space-x-2">
                    <select
                      value={customer.status}
                      onChange={(e) => onUpdateStatus(customer.id, e.target.value as CustomerStatus)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-bold border focus:outline-none cursor-pointer transition shadow-sm ${getStatusColorClass(customer.status)}`}
                    >
                      <option value="New Lead" className="bg-white text-purple-800 font-bold">New Lead</option>
                      <option value="Contacted" className="bg-white text-blue-800 font-bold">Contacted</option>
                      <option value="Quoted" className="bg-white text-amber-800 font-bold">Quoted</option>
                      <option value="Won" className="bg-white text-emerald-800 font-bold">Won</option>
                      <option value="Lost" className="bg-white text-rose-800 font-bold">Lost</option>
                    </select>
                  </div>
                  <div className="flex items-center space-x-1 text-xs mt-2">
                    <span className="text-slate-500 font-medium">Sales:</span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs border ${getOwnerBadgeClass(customer.owner)}`}>
                      <User className="w-3 h-3 shrink-0" />
                      <span>{customer.owner}</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Basic Info & Source Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Basic Info */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3 text-xs shadow-sm">
                  <h4 className="font-bold text-slate-900 text-sm flex items-center space-x-2 border-b border-slate-200 pb-2">
                    <User className="w-4 h-4 text-indigo-600" />
                    <span>1. Thông Tin Cơ Bản</span>
                  </h4>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-slate-500">Họ và Tên:</span>
                      <p className="font-medium text-slate-900">{customer.name}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Số Điện Thoại:</span>
                      <p className="font-medium text-slate-900">{customer.phone}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Giới Tính:</span>
                      <p className="font-medium text-indigo-600">{customer.gender || 'Nữ'}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Email:</span>
                      <p className="font-medium text-slate-900">{customer.email || 'N/A'}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-500">Địa Chỉ (Malaysia):</span>
                      <p className="font-medium text-slate-900">{customer.address || 'Chưa cập nhật'}</p>
                    </div>
                    {customer.note && (
                      <div className="col-span-2 bg-amber-50 p-2 rounded-lg border border-amber-200 mt-1">
                        <span className="text-amber-700 font-semibold block mb-0.5">Ghi Chú Thông Tin (Node):</span>
                        <p className="text-slate-700 text-xs italic">{customer.note}</p>
                      </div>
                    )}
                    <div className="col-span-2 pt-1 flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="text-slate-500 text-xs">WhatsApp Opt-In:</span>
                        {isOptedIn ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            ✓ Opt-in Marketing
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            ! No Opt-in (Chưa nhắn WABA)
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => onToggleOptIn(customer.id)}
                        className="text-[10px] text-indigo-600 hover:text-indigo-800 underline cursor-pointer font-medium"
                        title="Chuyển đổi trạng thái Opt-In thủ công"
                      >
                        Đổi trạng thái
                      </button>
                    </div>
                  </div>
                </div>

                {/* Lead Source */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3 text-xs shadow-sm">
                  <h4 className="font-bold text-slate-900 text-sm flex items-center space-x-2 border-b border-slate-200 pb-2">
                    <Globe className="w-4 h-4 text-indigo-600" />
                    <span>2. Nguồn Khách (Lead Source)</span>
                  </h4>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-slate-500">Kênh Tiếp Cận:</span>
                      <p className="font-medium text-indigo-600">{customer.source}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Chiến Dịch:</span>
                      <p className="font-medium text-slate-900">{customer.campaign}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Tập QC (Ad Set):</span>
                      <p className="font-medium text-slate-900">{customer.adSet || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Trang Đích:</span>
                      <p className="font-medium text-slate-900">{customer.landingPage || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Lần Đầu Liên Hệ:</span>
                      <p className="font-medium text-slate-900">{formatDate(customer.firstContact)}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Lần Gần Nhất:</span>
                      <p className="font-medium text-slate-900">{formatDate(customer.lastContact)}</p>
                    </div>
                  </div>
                </div>

              </div>

              {/* Interested Products */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2 text-xs shadow-sm">
                <span className="font-bold text-slate-700">Sản Phẩm Khách Quan Tâm:</span>
                <div className="flex flex-wrap gap-2 pt-1">
                  {customer.interestedProducts && customer.interestedProducts.length > 0 ? (
                    customer.interestedProducts.map((p) => (
                      <span key={p} className="px-2.5 py-1 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg text-xs">
                        {p}
                      </span>
                    ))
                  ) : (
                    <span className="text-slate-500">Chưa chọn sản phẩm quan tâm.</span>
                  )}
                </div>
              </div>

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
              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-xs space-y-2 shadow-sm">
                <div className="flex items-center space-x-2 text-emerald-800 font-bold">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>Quy Trình Chăm Sóc Khách Sau Mua (Automation WhatsApp)</span>
                </div>
                <p className="text-slate-700 font-medium">
                  CRM tự động xếp lịch gửi tin nhắn Ngày +3 (Cảm ơn), Ngày +5 (Hỏi trải nghiệm), Ngày +7 (Giải đáp & Gợi ý), Ngày +15 (Gửi voucher tái mua).
                </p>
              </div>

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
              <div className="space-y-2">
                <h5 className="font-bold text-xs text-slate-900">Lịch Sử Tin Nhắn Tự Động Đã Kích Hoạt</h5>
                {(!customer.automationSequence?.logs || customer.automationSequence.logs.length === 0) ? (
                  <div className="p-4 bg-white border border-slate-200 rounded-xl text-center text-xs text-slate-600 shadow-sm">
                    Chưa có lịch sử tự động. Bấm "Chạy Automation" ở góc trên màn hình để khởi động!
                  </div>
                ) : (
                  customer.automationSequence.logs.map((log, idx) => (
                    <div key={idx} className="bg-white border border-slate-200 p-3 rounded-xl text-xs space-y-1 shadow-sm">
                      <div className="flex justify-between text-slate-600 text-[11px]">
                        <span className="font-bold text-emerald-700">{log.stepName}</span>
                        <span className="font-semibold text-slate-500">{formatDateTime(log.sentAt)}</span>
                      </div>
                      <p className="text-slate-900 italic font-medium">"{log.message}"</p>
                    </div>
                  ))
                )}
              </div>

            </div>
          )}

        </div>

      </div>
    </div>
  );
};
