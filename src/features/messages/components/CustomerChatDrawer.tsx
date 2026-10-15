import React, { useState } from 'react';
import {
  ArrowUpRight,
  Check,
  Clock,
  Copy,
  Edit3,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  ShoppingBag,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import type { AppUser, Customer } from '../../../types';
import {
  CUSTOMER_GROUPS,
  formatDate,
  formatDateTime,
  formatPhoneWithCountryCode,
  formatVND,
  getCustomerGroup,
  getOwnerAvatar,
  getCustomerAvatar,
  getDiceBearAvatar,
  STAFF_DICEBEAR_STYLE,
} from '../../../utils/crmUtils';
import { findUserByName, getUserRoleTextStyle } from '../../../utils/roleColors';
import type { MessageThread } from '../types';

interface CustomerChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeThread: MessageThread | null;
  activeCustomer: Customer | null;
  users: AppUser[];
  onOpenAddOrder: (customer: Customer) => void;
  onSelectCustomerDetail: (customer: Customer) => void;
  onAddNote: (
    customerId: string,
    noteText: string,
    customerPhone?: string,
    customerName?: string
  ) => void;
  onDeleteNote?: (customerId: string, noteId: string) => void;
  onSelectUserForInfo: (user: AppUser) => void;
}

export const CustomerChatDrawer: React.FC<CustomerChatDrawerProps> = ({
  isOpen,
  onClose,
  activeThread,
  activeCustomer,
  users,
  onOpenAddOrder,
  onSelectCustomerDetail,
  onAddNote,
  onDeleteNote,
  onSelectUserForInfo,
}) => {
  const [drawerTab, setDrawerTab] = useState<'overview' | 'summary' | 'notes'>('overview');
  const [newNoteText, setNewNoteText] = useState('');
  const [summaryCache, setSummaryCache] = useState<
    Record<
      string,
      {
        summary: string;
        intent?: string;
        currentStatus?: string;
        suggestedAction?: string;
        source?: 'ai' | 'smart_analysis';
      }
    >
  >({});
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [copied, setCopied] = useState(false);
  const [savedToNote, setSavedToNote] = useState(false);

  const activeThreadId = activeCustomer?.id || activeThread?.threadId || '';
  const currentNotes = activeCustomer?.notes || [];
  const currentSummary = activeThread ? summaryCache[activeThread.threadId] : undefined;

  const fetchSummary = async (force = false) => {
    if (!activeThread || !isOpen) return;
    if (!force && summaryCache[activeThread.threadId]) return;

    setIsLoadingSummary(true);
    try {
      const token = localStorage.getItem('token') || '';
      const res = await fetch('/api/meta/messages/summarize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          phone: activeThread.customerPhone,
          customerName: activeThread.customerName,
          messages: (activeThread.messages || []).map((m) => ({
            sender: m.sender,
            content: m.content,
            timestamp: m.timestamp,
          })),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSummaryCache((prev) => ({
          ...prev,
          [activeThread.threadId]: data,
        }));
      }
    } catch (err) {
      console.error('Lỗi khi lấy tóm tắt hội thoại:', err);
    } finally {
      setIsLoadingSummary(false);
    }
  };

  const handleCopySummary = () => {
    if (!currentSummary?.summary) return;
    navigator.clipboard?.writeText(currentSummary.summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveToNotes = () => {
    if (!currentSummary?.summary || !activeThread) return;
    const noteContent = `[Tóm tắt AI]:\n${currentSummary.summary}`;
    onAddNote(
      activeThreadId,
      noteContent,
      activeThread.customerPhone,
      activeThread.customerName
    );
    setSavedToNote(true);
    setTimeout(() => setSavedToNote(false), 2500);
  };

  const handleSaveNote = () => {
    if (!newNoteText.trim() || !activeThread) return;
    onAddNote(
      activeThreadId,
      newNoteText.trim(),
      activeThread.customerPhone,
      activeThread.customerName
    );
    setNewNoteText('');
  };

  if (!isOpen || !activeThread) return null;

  const groupKey = activeCustomer ? getCustomerGroup(activeCustomer) : 'group_1';
  const groupInfo = CUSTOMER_GROUPS[groupKey];

  return (
    <div className="absolute inset-y-0 right-0 z-30 flex h-full w-full flex-col border-l border-slate-200 bg-white shadow-xl select-none animate-in slide-in-from-right duration-200 sm:w-80 xl:static xl:z-20 xl:w-88 xl:shrink-0 xl:shadow-lg">
      {/* Drawer Header */}
      <div className="p-3 border-b border-slate-200 flex items-center justify-end bg-[#f0f2f5]">
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition cursor-pointer"
          title="Đóng bảng thông tin"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Drawer Tabs */}
      <div className="grid grid-cols-3 p-1.5 bg-slate-100 border-b border-slate-200 gap-1">
        <button
          onClick={() => setDrawerTab('overview')}
          className={`py-1 px-1.5 rounded-md text-[11px] font-bold text-center transition cursor-pointer truncate ${
            drawerTab === 'overview'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-500 hover:text-slate-800'
          }`}
          title="Tổng quan thông tin"
        >
          👤 Tổng Quan
        </button>
        <button
          onClick={() => setDrawerTab('summary')}
          className={`py-1 px-1.5 rounded-md text-[11px] font-bold text-center transition cursor-pointer flex items-center justify-center gap-1 truncate ${
            drawerTab === 'summary'
              ? 'bg-white text-indigo-700 shadow-xs'
              : 'text-slate-500 hover:text-slate-800'
          }`}
          title="Tóm tắt cuộc trò chuyện"
        >
          <Sparkles className="w-3 h-3 text-indigo-600 shrink-0" />
          <span>Tóm Tắt</span>
        </button>
        <button
          onClick={() => setDrawerTab('notes')}
          className={`py-1 px-1.5 rounded-md text-[11px] font-bold text-center transition cursor-pointer flex items-center justify-center gap-1 truncate ${
            drawerTab === 'notes'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-500 hover:text-slate-800'
          }`}
          title="Ghi chú nội bộ"
        >
          <Edit3 className="w-3 h-3 text-amber-600 shrink-0" />
          <span>Ghi Chú ({currentNotes.length})</span>
        </button>
      </div>

      {/* Drawer Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs whatsapp-scrollbar">
        {drawerTab === 'overview' && (
          <>
            {/* Profile Card */}
            <div className="text-center pb-3 border-b border-slate-200">
              <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center font-extrabold text-xl shadow-md mx-auto mb-2 overflow-hidden">
                <img
                  src={getCustomerAvatar(
                    activeCustomer?.avatar,
                    activeCustomer?.phone ||
                      activeThread.customerPhone ||
                      activeThread.customerName ||
                      activeThread.threadId
                  )}
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
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-800 text-[11px] flex items-center justify-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  <span>Đang đồng bộ thông tin khách hàng vào CRM...</span>
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
                          className="w-4 h-4 rounded-full object-cover shrink-0 bg-slate-100"
                          onError={(e) => {
                            e.currentTarget.src = getDiceBearAvatar(activeCustomer.owner, STAFF_DICEBEAR_STYLE);
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
        )}

        {/* Tab 2: AI & Smart Conversation Summary */}
        {drawerTab === 'summary' && (
          <div className="space-y-3">
            {!currentSummary ? (
              <button
                type="button"
                onClick={() => fetchSummary(true)}
                disabled={isLoadingSummary}
                className="w-full py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-sm hover:shadow disabled:cursor-wait"
              >
                {isLoadingSummary ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Đang tạo tóm tắt...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-white" />
                    <span>Tạo Tóm Tắt</span>
                  </>
                )}
              </button>
            ) : (
              <div className="space-y-3">
                {/* Header bar with Refresh */}
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    <span className="font-extrabold text-slate-800 text-xs">Tóm Tắt AI</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider bg-indigo-100 text-indigo-700">
                      {currentSummary.source === 'ai' ? '🤖 Dify AI' : '⚡ Smart'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => fetchSummary(true)}
                    disabled={isLoadingSummary}
                    className="p-1 rounded-md hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition cursor-pointer disabled:opacity-40"
                    title="Tạo lại tóm tắt"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingSummary ? 'animate-spin text-indigo-600' : ''}`} />
                  </button>
                </div>

                {isLoadingSummary ? (
                  <div className="py-6 text-center space-y-2">
                    <Loader2 className="w-6 h-6 animate-spin text-indigo-600 mx-auto" />
                    <p className="text-xs text-slate-500 font-medium">Đang tạo tóm tắt...</p>
                  </div>
                ) : (
                  <>
                    {/* Highlight items */}
                    {currentSummary.intent && (
                      <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200 space-y-0.5">
                        <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wide flex items-center gap-1">
                          🎯 Nhu Cầu Chính
                        </span>
                        <p className="text-xs font-semibold text-slate-800">{currentSummary.intent}</p>
                      </div>
                    )}

                    {currentSummary.currentStatus && (
                      <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200 space-y-0.5">
                        <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wide flex items-center gap-1">
                          📌 Tiến Trình Hiện Tại
                        </span>
                        <p className="text-xs text-slate-700">{currentSummary.currentStatus}</p>
                      </div>
                    )}

                    {currentSummary.suggestedAction && (
                      <div className="bg-emerald-50 rounded-xl p-2.5 border border-emerald-200 space-y-0.5">
                        <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wide flex items-center gap-1">
                          💡 Gợi Ý Hành Động Tiếp Theo
                        </span>
                        <p className="text-xs font-medium text-emerald-900">{currentSummary.suggestedAction}</p>
                      </div>
                    )}

                    {/* Detailed Summary Box */}
                    {currentSummary.summary && (
                      <div className="text-slate-700 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-200 whitespace-pre-line leading-relaxed">
                        {currentSummary.summary}
                      </div>
                    )}

                    {/* Action buttons: Copy & Save to Note */}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleCopySummary}
                        className="flex-1 py-1.5 px-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold rounded-lg text-[11px] transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        {copied ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-700">Đã Chép</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-slate-500" />
                            <span>Sao Chép</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={handleSaveToNotes}
                        className="flex-1 py-1.5 px-2 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 font-bold rounded-lg text-[11px] transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        {savedToNote ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-700">Đã Lưu Ghi Chú</span>
                          </>
                        ) : (
                          <>
                            <FileText className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Lưu Vào Ghi Chú</span>
                          </>
                        )}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Internal Notes Tab */}
        {drawerTab === 'notes' && (
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
                        {formatDateTime(note.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 whitespace-pre-wrap">{note.content}</p>

                    {onDeleteNote && (
                      <button
                        onClick={() => onDeleteNote(activeThreadId, note.id)}
                        className="absolute top-2 right-2 hidden group-hover:block text-slate-400 hover:text-rose-600 transition cursor-pointer"
                        title="Xóa ghi chú"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
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
