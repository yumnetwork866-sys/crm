import React, { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../contexts/AuthContext';
import { Permission } from '../../../lib/permissions';
import { queryKeys } from '../../../lib/queryClient';
import { api } from '../../../utils/apiClient';
import {
  ArrowUpRight,
  Clock,
  ChevronDown,
  Check,
  Edit3,
  Plus,
  Loader2,
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
import { getLastCustomerMessageTime } from '../utils/whatsappSession';

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
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const canRenameCustomer = hasPermission(Permission.CUSTOMERS_MANAGE);
  const [nameEditor, setNameEditor] = useState<{ customerId: string; value: string; error: string } | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const isEditingName = nameEditor !== null && nameEditor.customerId === activeCustomer?.id;
  const renameMutation = useMutation({
    mutationFn: ({ customerId, name }: { customerId: string; name: string }) =>
      api.patch<Pick<Customer, 'id' | 'name'>>(`/customers/${encodeURIComponent(customerId)}/name`, { name }),
    onSuccess: (saved) => {
      queryClient.setQueryData<Customer[]>(queryKeys.customers, (current) =>
        current?.map((customer) => customer.id === saved.id ? { ...customer, name: saved.name } : customer),
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.customers });
    },
  });

  useEffect(() => { setNameEditor(null); }, [isOpen, activeCustomer?.id]);

  const handleSaveName = async () => {
    if (!nameEditor || nameEditor.customerId !== activeCustomer?.id || !canRenameCustomer || renameMutation.isPending) return;
    const { customerId } = nameEditor;
    const name = nameEditor.value.trim();
    if (!name) {
      setNameEditor({ ...nameEditor, error: 'Tên khách hàng không được để trống' });
      return;
    }
    if (name === activeCustomer.name) {
      setNameEditor(null);
      return;
    }
    try {
      await renameMutation.mutateAsync({ customerId, name });
      setNameEditor((current) => current?.customerId === customerId ? null : current);
    } catch (error) {
      setNameEditor((current) => current?.customerId === customerId
        ? { ...current, error: error instanceof Error ? error.message : 'Không thể lưu tên khách hàng' } : current);
    }
  };

  const [newNoteText, setNewNoteText] = useState('');
  const activeThreadId = activeCustomer?.id || activeThread?.threadId || '';
  const currentNotes = activeCustomer?.notes || [];
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
  const owner = activeCustomer?.owner || '';
  const hasOwner = Boolean(owner && !['chưa phân công', 'chua phan cong', 'unassigned'].includes(owner.trim().toLowerCase()));
  const ownerUser = hasOwner ? findUserByName(users, owner) : undefined;
  const orders = [...(activeCustomer?.orders || [])].sort((first, second) =>
    (Date.parse(second.date) || 0) - (Date.parse(first.date) || 0),
  );
  const recentOrders = orders.slice(0, 3);
  const lastCustomerMessageAt = getLastCustomerMessageTime(activeThread);
  const timeline = [
    ...(activeCustomer?.firstContact ? [{ label: 'Tiếp nhận khách hàng', date: new Date(activeCustomer.firstContact), showTime: false }] : []),
    ...(lastCustomerMessageAt !== null ? [{ label: 'Khách nhắn tin gần nhất', date: new Date(lastCustomerMessageAt), showTime: true }] : []),
    ...(orders[0] ? [{ label: `Đơn hàng ${orders[0].orderCode}`, date: new Date(orders[0].date), showTime: false }] : []),
    ...(lastCustomerMessageAt === null ? [{ label: 'Tin nhắn gần nhất', date: new Date(activeThread.lastMessage.timestamp), showTime: true }] : []),
  ].filter((event) => Number.isFinite(event.date.getTime())).sort((first, second) => second.date.getTime() - first.date.getTime());
  const care = activeCustomer?.automationSequence;

  return (
    <div className="absolute inset-y-0 right-0 z-30 flex h-full w-full flex-col border-l border-slate-200 bg-white shadow-xl select-none animate-in slide-in-from-right duration-200 sm:w-80 xl:static xl:z-20 xl:w-88 xl:shrink-0 xl:shadow-lg">
      {/* Drawer Header */}
      <div className="px-3 py-2.5 flex items-center justify-between bg-white">
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1fa855]/40"
          aria-label="Đóng bảng thông tin"
          title="Đóng bảng thông tin"
        >
          <X className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            if (!activeCustomer || !canRenameCustomer || renameMutation.isPending) return;
            if (isEditingName) setNameEditor(null);
            else setNameEditor({ customerId: activeCustomer.id, value: activeCustomer.name || activeThread.customerName, error: '' });
          }}
          disabled={!activeCustomer || !canRenameCustomer || renameMutation.isPending}
          aria-label="Sửa tên khách hàng"
          aria-expanded={isEditingName}
          title={!canRenameCustomer ? 'Bạn chưa có quyền sửa khách hàng' : !activeCustomer ? 'Đang đồng bộ khách hàng' : 'Sửa tên khách hàng'}
          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1fa855]/40 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Edit3 data-colored="true" strokeWidth={1.8} className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 pb-6 pt-1 text-xs whatsapp-scrollbar">
        <section className="space-y-3 text-center" aria-label="Thông tin liên hệ">
          <div className="mx-auto flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-emerald-50 ring-1 ring-black/5">
            <img
              src={getCustomerAvatar(activeCustomer?.avatar, activeCustomer?.phone || activeThread.customerPhone || activeThread.customerName || activeThread.threadId)}
              alt={`Ảnh đại diện ${activeThread.customerName}`}
              className="h-full w-full object-cover"
            />
          </div>
          {isEditingName ? (
            <form
              className="mx-auto max-w-full space-y-2"
              onSubmit={(event) => event.preventDefault()}
              onKeyDown={(event) => {
                if (event.key === 'Escape' && !renameMutation.isPending) {
                  event.preventDefault();
                  setNameEditor(null);
                }
              }}
            >
              <div className="flex items-center gap-2">
                <input
                  ref={nameInputRef}
                  autoFocus
                  aria-label="Tên khách hàng"
                  aria-invalid={Boolean(nameEditor.error)}
                  value={nameEditor.value}
                  onChange={(event) => setNameEditor({ ...nameEditor, value: event.target.value, error: '' })}
                  disabled={renameMutation.isPending}
                  className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-center text-sm text-slate-900 focus:border-[#1fa855] focus:outline-none focus:ring-2 focus:ring-[#1fa855]/10 disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => { void handleSaveName(); }}
                  disabled={renameMutation.isPending || !nameEditor.value.trim()}
                  aria-label="Lưu tên khách hàng"
                  title={renameMutation.isPending ? 'Đang lưu...' : 'Lưu tên khách hàng'}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1fa855] text-white hover:bg-[#188c47] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1fa855]/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {renameMutation.isPending
                    ? <Loader2 className="chat-primary-action-icon h-4 w-4 animate-spin" />
                    : <Check className="chat-primary-action-icon h-4 w-4" />}
                </button>
              </div>
              {nameEditor.error && <p role="alert" className="text-left text-xs text-rose-600">{nameEditor.error}</p>}
            </form>
          ) : (
            <h4 className="select-text break-words text-[18px] font-semibold leading-6 text-slate-900">{activeThread.customerName}</h4>
          )}
          <p className="select-text break-words text-[13px] font-normal text-slate-500">
            {formatPhoneWithCountryCode(activeThread.customerPhone, activeCustomer?.country) || activeThread.customerPhone}
          </p>
          {activeCustomer ? (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => onOpenAddOrder(activeCustomer)}
                className="flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-[#1fa855] px-3 text-xs font-semibold text-white transition hover:bg-[#188c47] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1fa855]/40 focus-visible:ring-offset-2"
              >
                <ShoppingBag className="chat-primary-action-icon h-4 w-4" />
                Tạo đơn
              </button>
              <button
                type="button"
                onClick={() => onSelectCustomerDetail(activeCustomer)}
                className="flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-slate-100 px-3 text-xs font-medium text-slate-700 transition hover:bg-slate-200/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1fa855]/40"
              >
                Hồ sơ
                <ArrowUpRight className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <p className="flex items-center justify-center gap-1.5 py-1 text-[11px] text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Đang đồng bộ hồ sơ khách hàng...
            </p>
          )}
        </section>

        {activeCustomer && (
          <section className="space-y-3" aria-label="Thông tin CRM">
            <h3 className="text-[13px] font-semibold text-slate-900">Thông tin khách hàng</h3>
            <dl className="space-y-3">
              <div className="flex items-start justify-between gap-4">
                <dt className="shrink-0 leading-5 text-slate-500">Nhóm khách</dt>
                <dd className="min-w-0 text-right">
                  <span className={`inline-block max-w-full rounded-full px-2 py-0.5 text-[11px] font-medium ${groupInfo.badgeColor}`}>{groupInfo.name}</span>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="shrink-0 text-slate-500">Phụ trách</dt>
                <dd className="flex min-w-0 items-center gap-1.5">
                  {hasOwner ? (
                    <>
                      <img
                        src={getOwnerAvatar(owner)}
                        alt=""
                        className="h-5 w-5 shrink-0 rounded-full bg-slate-100 object-cover"
                        onError={(event) => { event.currentTarget.src = getDiceBearAvatar(owner, STAFF_DICEBEAR_STYLE); }}
                      />
                      <button
                        type="button"
                        title={owner}
                        disabled={!ownerUser}
                        onClick={() => { if (ownerUser) onSelectUserForInfo(ownerUser); }}
                        className="min-w-0 cursor-pointer truncate text-xs font-medium hover:underline disabled:cursor-default disabled:no-underline"
                        style={getUserRoleTextStyle(ownerUser)}
                      >
                        {owner}
                      </button>
                    </>
                  ) : <span className="text-slate-400">Chưa phân công</span>}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="shrink-0 text-slate-500">Thị trường</dt>
                <dd className="select-text text-right font-medium text-slate-700">{activeCustomer.country || 'Malaysia (MY)'}</dd>
              </div>
            </dl>
          </section>
        )}

        <section className="space-y-3" aria-label="Ghi chú nội bộ">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[13px] font-semibold text-slate-900">Ghi chú</h3>
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-100 px-1.5 text-[10px] text-slate-500">{currentNotes.length}</span>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-2.5 transition focus-within:border-[#1fa855]/50 focus-within:ring-2 focus-within:ring-[#1fa855]/10">
            <textarea
              rows={2}
              value={newNoteText}
              onChange={(event) => setNewNoteText(event.target.value)}
              placeholder="Thêm ghi chú cho khách hàng..."
              aria-label="Ghi chú cho khách hàng"
              className="block w-full resize-y border-0 bg-transparent p-0 text-xs leading-5 text-slate-800 focus:outline-none"
            />
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={handleSaveNote}
                disabled={!newNoteText.trim()}
                className="flex h-7 cursor-pointer items-center gap-1 rounded-full bg-[#1fa855] px-2.5 text-[11px] font-medium text-white transition hover:bg-[#188c47] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Plus className="chat-primary-action-icon h-3.5 w-3.5" />
                Thêm ghi chú
              </button>
            </div>
          </div>
          {currentNotes.length > 0 && (
            <div className="space-y-2">
              {currentNotes.map((note) => (
                <article key={note.id} className="group/note space-y-1.5 rounded-xl bg-slate-50/80 px-3 py-2.5">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-1.5 text-[10px] text-slate-500">
                    <span title={note.author} className="truncate font-medium text-slate-700">{note.author}</span>
                    <time className="whitespace-nowrap">{formatDateTime(note.createdAt)}</time>
                    {onDeleteNote && (
                      <button
                        type="button"
                        onClick={() => onDeleteNote(activeThreadId, note.id)}
                        className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1fa855]/40 sm:opacity-0 sm:group-hover/note:opacity-100 sm:group-focus-within/note:opacity-100"
                        title="Xóa ghi chú"
                        aria-label="Xóa ghi chú"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <p className="select-text whitespace-pre-wrap break-words text-xs leading-5 text-slate-700">{note.content}</p>
                </article>
              ))}
            </div>
          )}
        </section>

        {activeCustomer && (
          <section className="space-y-3" aria-label="Đơn hàng">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[13px] font-semibold text-slate-900">Đơn hàng</h3>
              {orders.length > 3 && (
                <button type="button" onClick={() => onSelectCustomerDetail(activeCustomer)} className="cursor-pointer text-[11px] font-medium text-[#1fa855] hover:underline">Xem tất cả</button>
              )}
            </div>
            <dl className="grid grid-cols-2 gap-4 rounded-2xl bg-slate-50 px-3 py-3">
              <div className="min-w-0 space-y-1">
                <dt className="text-[11px] text-slate-500">Tổng đơn hàng</dt>
                <dd className="text-[18px] font-semibold leading-6 text-slate-900">{activeCustomer.totalOrders}</dd>
              </div>
              <div className="min-w-0 space-y-1">
                <dt className="text-[11px] text-slate-500">Tổng chi tiêu</dt>
                <dd className="select-text break-words text-[14px] font-semibold leading-6 text-emerald-700">{formatVND(activeCustomer.totalSpent)}</dd>
              </div>
            </dl>
            {recentOrders.length > 0 && (
              <div className="space-y-3 pt-0.5">
                {recentOrders.map((order) => (
                  <div key={order.id} className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="min-w-0 truncate font-medium text-slate-800">{order.orderCode}</span>
                      <span className="shrink-0 font-medium text-slate-700">{formatVND(order.totalAmount)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-[10px] text-slate-500">
                      <time>{formatDate(order.date)}</time>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5">{order.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        <div className="space-y-1">
          <details key={`timeline-${activeThread.threadId}`} className="group/timeline">
            <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-2 rounded-lg text-[13px] font-medium text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1fa855]/40 [&::-webkit-details-marker]:hidden">
              <span className="flex items-center gap-2"><Clock className="h-4 w-4 text-slate-400" />Lịch sử khách hàng</span>
              <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open/timeline:rotate-180" />
            </summary>
            <ol className="mb-2 ml-2 mt-2 space-y-4 border-l border-slate-200 pl-4">
              {timeline.map((event) => (
                <li key={event.label} className="relative space-y-1">
                  <span aria-hidden="true" className="absolute -left-[20.5px] top-1 h-2 w-2 rounded-full bg-slate-300 ring-4 ring-white" />
                  <p className="text-xs font-medium text-slate-700">{event.label}</p>
                  <p className="text-[10px] text-slate-500">{event.showTime ? formatDateTime(event.date) : formatDate(event.date)}</p>
                </li>
              ))}
            </ol>
          </details>
          {care && (
            <details key={`care-${activeThread.threadId}`} className="group/care">
              <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-2 rounded-lg text-[13px] font-medium text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1fa855]/40 [&::-webkit-details-marker]:hidden">
                <span className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-slate-400" />Chăm sóc tự động</span>
                <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open/care:rotate-180" />
              </summary>
              <div className="space-y-2 pb-2 pt-1">
                <p className="text-[11px] text-slate-500">{care.currentStep > 0 ? `Bước ${Math.min(care.currentStep, 4)}/4` : care.active ? 'Chưa bắt đầu' : 'Chưa kích hoạt'}</p>
                <div className="grid grid-cols-4 gap-1.5">
                  {['+3', '+5', '+7', '+15'].map((step, index) => (
                    <div key={step} className={`rounded-lg px-1.5 py-2 text-center text-[10px] font-medium ${care.currentStep > index ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      Ngày {step}
                    </div>
                  ))}
                </div>
              </div>
            </details>
          )}
        </div>
      </div>
    </div>
  );
};
