import React, { useState } from 'react';
import {
  ArrowUpRight,
  Clock,
  Edit3,
  Plus,
  ShoppingBag,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import type { AppUser, Customer } from '../../../types';
import {
  CUSTOMER_GROUPS,
  formatDate,
  formatPhoneWithCountryCode,
  formatVND,
  getCustomerGroup,
  getOwnerAvatar,
} from '../../../utils/crmUtils';
import { findUserByName, getUserRoleTextStyle } from '../../../utils/roleColors';
import type { InternalNote, MessageThread } from '../types';

interface CustomerChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeThread: MessageThread | null;
  activeCustomer: Customer | null;
  users: AppUser[];
  internalNotes: Record<string, InternalNote[]>;
  onOpenAddOrder: (customer: Customer) => void;
  onSelectCustomerDetail: (customer: Customer) => void;
  onAddInternalNote: (customerId: string, note: InternalNote) => void;
  onDeleteInternalNote: (customerId: string, noteId: string) => void;
  onSelectUserForInfo: (user: AppUser) => void;
  currentUserName: string;
}

export const CustomerChatDrawer: React.FC<CustomerChatDrawerProps> = ({
  isOpen,
  onClose,
  activeThread,
  activeCustomer,
  users,
  internalNotes,
  onOpenAddOrder,
  onSelectCustomerDetail,
  onAddInternalNote,
  onDeleteInternalNote,
  onSelectUserForInfo,
  currentUserName,
}) => {
  const [drawerTab, setDrawerTab] = useState<'overview' | 'notes'>('overview');
  const [newNoteText, setNewNoteText] = useState('');

  if (!isOpen || !activeThread) return null;

  const groupKey = activeCustomer ? getCustomerGroup(activeCustomer) : 'group_1';
  const groupInfo = CUSTOMER_GROUPS[groupKey];
  const activeThreadId = activeCustomer?.id || activeThread.threadId;
  const currentNotes = internalNotes[activeThreadId] || [];

  const handleSaveNote = () => {
    if (!newNoteText.trim()) return;
    const note: InternalNote = {
      id: `note_${Date.now()}`,
      author: currentUserName || 'Tư vấn viên',
      content: newNoteText.trim(),
      timestamp: new Date().toISOString(),
    };
    onAddInternalNote(activeThreadId, note);
    setNewNoteText('');
  };

  return (
    <div className="w-full lg:w-80 xl:w-88 bg-white border-l border-slate-200 flex flex-col h-full shadow-lg z-20 shrink-0 select-none animate-in slide-in-from-right duration-200">
      {/* Drawer Header */}
      <div className="p-3.5 border-b border-slate-200 flex items-center justify-between bg-[#f0f2f5]">
        <div className="flex items-center space-x-2">
          <span className="font-extrabold text-xs text-slate-800">Thông Tin Khách Hàng</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition cursor-pointer"
          title="Đóng bảng thông tin"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Drawer Tabs */}
      <div className="grid grid-cols-2 p-1.5 bg-slate-100 border-b border-slate-200 gap-1">
        <button
          onClick={() => setDrawerTab('overview')}
          className={`py-1 px-2 rounded-md text-[11px] font-bold text-center transition cursor-pointer ${
            drawerTab === 'overview'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          👤 Tổng Quan
        </button>
        <button
          onClick={() => setDrawerTab('notes')}
          className={`py-1 px-2 rounded-md text-[11px] font-bold text-center transition cursor-pointer flex items-center justify-center gap-1 ${
            drawerTab === 'notes'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Edit3 className="w-3 h-3 text-amber-600" />
          <span>Ghi Chú ({currentNotes.length})</span>
        </button>
      </div>

      {/* Drawer Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs whatsapp-scrollbar">
        {drawerTab === 'overview' ? (
          <>
            {/* Profile Card */}
            <div className="text-center pb-3 border-b border-slate-200">
              <div className="w-16 h-16 rounded-full bg-emerald-50 border border-slate-200/80 flex items-center justify-center font-extrabold text-xl shadow-md mx-auto mb-2 overflow-hidden">
                <img
                  src={
                    activeCustomer?.avatar ||
                    `https://api.dicebear.com/10.x/clay/svg?topProbability=0&patternProbability=0&seed=${encodeURIComponent(
                      activeCustomer?.phone ||
                        activeThread.customerPhone ||
                        activeThread.customerName ||
                        activeThread.threadId
                    )}`
                  }
                  alt="avatar"
                  className="w-full h-full object-cover"
                />
              </div>
              <h4 className="text-sm font-extrabold text-slate-900">{activeThread.customerName}</h4>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                {formatPhoneWithCountryCode(activeThread.customerPhone, activeCustomer?.country) ||
                  activeThread.customerPhone}
              </p>

              {/* Group Badge */}
              <div className="mt-2 inline-block">
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${groupInfo.badgeColor}`}>
                  {groupInfo.name}
                </span>
              </div>
            </div>

            {/* Action Buttons: Chốt Đơn & Xem Profile */}
            <div className="space-y-2">
              {activeCustomer ? (
                <>
                  <button
                    onClick={() => onOpenAddOrder(activeCustomer)}
                    className="w-full py-2.5 px-3 bg-[#1fa855] hover:bg-[#006a57] text-white font-bold rounded-xl text-xs transition flex items-center justify-center space-x-1.5 cursor-pointer shadow-sm hover:shadow"
                  >
                    <ShoppingBag className="chat-primary-action-icon w-4 h-4" />
                    <span>+ Lên Đơn Hàng Mới</span>
                  </button>

                  <button
                    onClick={() => onSelectCustomerDetail(activeCustomer)}
                    className="w-full py-2.5 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 hover:text-indigo-800 font-bold rounded-xl text-xs transition flex items-center justify-center space-x-1.5 cursor-pointer border border-indigo-200 hover:border-indigo-300 shadow-2xs"
                  >
                    <span>Xem Hồ Sơ Chi Tiết</span>
                    <ArrowUpRight className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-[11px]">
                  Khách hàng này đến từ tin nhắn Webhook mới và chưa tạo hồ sơ khách hàng đầy đủ trong CRM.
                </div>
              )}
            </div>

            {/* Financial Summary */}
            {activeCustomer && (
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-slate-600">
                  <span>Tổng số đơn:</span>
                  <strong className="text-slate-900 font-extrabold">{activeCustomer.totalOrders} đơn</strong>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Tổng chi tiêu:</span>
                  <strong className="text-emerald-700 font-extrabold">{formatVND(activeCustomer.totalSpent)}</strong>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Thị trường:</span>
                  <span className="font-semibold text-slate-800">Malaysia (MY)</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Phụ trách:</span>
                  <div className="flex items-center gap-1.5">
                    {activeCustomer.owner &&
                    !['chưa phân công', 'unassigned', ''].includes(activeCustomer.owner.trim().toLowerCase()) ? (
                      <>
                        <img
                          src={getOwnerAvatar(activeCustomer.owner)}
                          alt={activeCustomer.owner}
                          className="w-4 h-4 rounded-full object-cover border border-slate-200 shrink-0 bg-slate-100"
                          onError={(e) => {
                            e.currentTarget.src = `https://api.dicebear.com/10.x/avataaars/svg?seed=${encodeURIComponent(
                              activeCustomer.owner
                            )}`;
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const ownerUser = findUserByName(users, activeCustomer.owner);
                            if (ownerUser) onSelectUserForInfo(ownerUser);
                          }}
                          disabled={!findUserByName(users, activeCustomer.owner)}
                          className="font-semibold hover:underline disabled:cursor-default disabled:no-underline"
                          style={getUserRoleTextStyle(findUserByName(users, activeCustomer.owner))}
                        >
                          {activeCustomer.owner}
                        </button>
                      </>
                    ) : (
                      <span className="text-slate-400">Chưa phân công</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Customer Journey Timeline */}
            <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-2">
              <span className="font-bold text-slate-800 text-[11px] flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#1fa855]" />
                <span>Timeline</span>
              </span>

              <div className="space-y-2 pl-2 border-l-2 border-slate-300 ml-1.5 pt-1">
                <div className="relative pl-3 text-[11px]">
                  <span className="absolute -left-4.25 top-1 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white"></span>
                  <p className="font-bold text-slate-900">Đang trò chuyện trực tiếp</p>
                  <p className="text-[10px] text-slate-500">Phiên chat WhatsApp Webhook</p>
                </div>

                {activeCustomer && activeCustomer.orders && activeCustomer.orders.length > 0 && (
                  <div className="relative pl-3 text-[11px]">
                    <span className="absolute -left-4.25 top-1 w-2 h-2 rounded-full bg-blue-500 ring-2 ring-white"></span>
                    <p className="font-bold text-slate-900">Đã mua {activeCustomer.orders.length} đơn hàng</p>
                    <p className="text-[10px] text-slate-500">Đơn gần nhất: {activeCustomer.orders[0].orderCode}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Automation Sequence Progress */}
            {activeCustomer?.automationSequence && (
              <div className="border border-slate-200 rounded-xl p-3 space-y-2 bg-slate-50">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 text-[11px] flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    Tiến Trình Chăm Sóc
                  </span>
                  <span className="text-[10px] font-bold text-emerald-700">
                    Bước {activeCustomer.automationSequence.currentStep}/4
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-1 pt-1">
                  {['+3', '+5', '+7', '+15'].map((step, idx) => {
                    const isDone = (activeCustomer.automationSequence?.currentStep || 0) > idx;
                    const isCurrent = (activeCustomer.automationSequence?.currentStep || 0) === idx + 1;

                    return (
                      <div
                        key={step}
                        className={`p-1.5 rounded-lg text-center font-bold text-[10px] border ${
                          isDone
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : isCurrent
                            ? 'bg-amber-100 text-amber-800 border-amber-300 animate-pulse'
                            : 'bg-white text-slate-400 border-slate-200'
                        }`}
                      >
                        Ngày {step}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recent Orders List */}
            {activeCustomer && activeCustomer.orders && activeCustomer.orders.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between font-bold text-slate-800 text-[11px]">
                  <span>Đơn hàng ({activeCustomer.orders.length})</span>
                </div>

                <div className="space-y-1.5">
                  {activeCustomer.orders.slice(0, 3).map((ord) => (
                    <div key={ord.id} className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-[11px] space-y-0.5">
                      <div className="flex items-center justify-between font-bold text-slate-900">
                        <span>{ord.orderCode}</span>
                        <span className="text-emerald-700">{formatVND(ord.totalAmount)}</span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-500">
                        <span>{formatDate(ord.date)}</span>
                        <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-semibold">
                          {ord.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          /* Internal Notes Tab */
          <div className="space-y-3">
            {/* Add Note Form */}
            <div className="space-y-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              <textarea
                rows={2}
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                placeholder="Thêm ghi chú cho khách hàng này"
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:outline-none focus:border-[#1fa855]"
              />
              <div className="flex justify-end">
                <button
                  onClick={handleSaveNote}
                  disabled={!newNoteText.trim()}
                  className="px-3 py-1.5 bg-[#1fa855] hover:bg-[#006a57] disabled:opacity-50 text-white font-bold text-xs rounded-lg transition flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Lưu Ghi Chú</span>
                </button>
              </div>
            </div>

            {/* Notes List */}
            <div className="space-y-2">
              {currentNotes.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs">
                  Chưa có ghi chú nội bộ nào cho khách hàng này.
                </div>
              ) : (
                currentNotes.map((note) => (
                  <div key={note.id} className="p-2.5 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-1 relative group">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 pr-5 text-[10px] text-slate-500">
                      <span className="truncate font-bold text-slate-800">{note.author}</span>
                      <span className="whitespace-nowrap">
                        {formatDate(note.timestamp)}{' '}
                        {new Date(note.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 whitespace-pre-wrap">{note.content}</p>

                    <button
                      onClick={() => onDeleteInternalNote(activeThreadId, note.id)}
                      className="absolute top-2 right-2 hidden group-hover:block text-slate-400 hover:text-rose-600 transition cursor-pointer"
                      title="Xóa ghi chú"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
