import { getLastCustomerMessageTime } from '../utils/whatsappSession';
import { parseThreadId } from '../../../../shared/whatsappScope';
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal, Pin, PinOff, Trash2 } from 'lucide-react';
import { MessageDeliveryStatusIcon } from '../../../components/Messages/MessageDeliveryStatusIcon';
import { formatDate, formatPhoneWithCountryCode, getCustomerAvatar } from '../../../utils/crmUtils';
import { STATUS_CONFIG } from '../constants';
import type { ConversationStatus, MessageThread } from '../types';
import { formatMessagePreview } from '../utils/messageContent';

export interface SlaWarning {
  label: string;
  minutes: number;
  isSevere: boolean;
}

interface ThreadListItemProps {
  thread: MessageThread;
  isSelected: boolean;
  isSessionExpired?: boolean;
  status?: ConversationStatus;
  draftText?: string;
  onSelectThread: (threadId: string, phone: string, messageIds: string[]) => void;
  togglePinThread: (threadId: string) => void;
  onDeleteThread?: (id: string) => void;
  isAdmin: boolean;
  slaWarning: SlaWarning | null;
}

const ThreadListItemComponent: React.FC<ThreadListItemProps> = ({
  thread,
  isSelected,
  isSessionExpired = false,
  status,
  draftText,
  onSelectThread,
  togglePinThread,
  onDeleteThread,
  isAdmin,
  slaWarning,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const openMenu = () => {
    const rect = menuButtonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const height = isAdmin && onDeleteThread ? 88 : 52;
    setMenuPosition({
      top: rect.bottom + height + 6 <= window.innerHeight - 8
        ? rect.bottom + 6 : Math.max(8, rect.top - height - 6),
      left: Math.max(8, Math.min(rect.right - 184, window.innerWidth - 192)),
    });
    setIsMenuOpen(true);
  };

  useEffect(() => {
    if (!isMenuOpen) return;
    const close = () => setIsMenuOpen(false);
    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node) && !menuButtonRef.current?.contains(event.target as Node)) close();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      close();
      menuButtonRef.current?.focus();
    };
    const frame = requestAnimationFrame(() => menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus());
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [isMenuOpen]);

  const hasUnread = thread.unreadCount > 0;
  const trimmedDraft = draftText?.trim() || '';
  const hasDraft = Boolean(trimmedDraft);
  const isAgentLast = thread.lastMessage.sender === 'agent';
  const lastCustomerMessageTime = getLastCustomerMessageTime(thread);
  const threadTime = new Date(lastCustomerMessageTime ?? 0);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const isToday = threadTime.toDateString() === today.toDateString();
  const isYesterday = threadTime.toDateString() === yesterday.toDateString();
  const timeString = lastCustomerMessageTime === null ? '—' : isToday
    ? threadTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    : isYesterday ? 'Hôm qua' : formatDate(threadTime);

  const displayName = thread.customerName || formatPhoneWithCountryCode(thread.customerPhone, thread.customer?.country) || 'Khách WhatsApp';
  const currentStatusKey = status || 'consulting';
  const currentStatus = STATUS_CONFIG[currentStatusKey];

  return (
    <div
      onClick={() => onSelectThread(thread.threadId, thread.customerPhone, thread.messages.map((m) => m.id))}
      aria-current={isSelected ? 'true' : undefined}
      className={`group mx-1.5 my-0.5 flex min-h-[72px] items-center gap-3 rounded-xl px-3 py-2.5 cursor-pointer transition-colors relative ${
        isSelected ? 'bg-[#eaf7ef]' : isMenuOpen ? 'bg-[#f4f4f5]' : 'bg-white hover:bg-[#f4f4f5]'
      }`}
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-emerald-50 ring-1 ring-black/5">
        <img
          src={getCustomerAvatar(
            thread.customer?.avatar,
            thread.customer?.phone || thread.customerPhone || displayName || thread.threadId,
          )}
          alt={`Ảnh đại diện ${displayName}`}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </div>

      {/* Thread Info */}
      <div className="flex-1 min-w-0">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <span
              title={`${displayName} · ${currentStatus.label}${slaWarning ? ` · Khách chờ phản hồi ${slaWarning.minutes} phút` : ''}`}
              className={`min-w-0 truncate text-[15px] leading-5 ${hasUnread ? 'font-semibold text-slate-950' : 'font-normal text-slate-900'}`}
            >
              {displayName}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {isSessionExpired && (
              <span
                title="Đã hết phiên 24 giờ kể từ tin nhắn cuối của khách."
                className="whatsapp-session-expired-badge inline-flex h-4 shrink-0 items-center rounded-full bg-red-500 px-1.5 text-[9px] font-semibold text-white"
              >
                24h
              </span>
            )}
            <span title={lastCustomerMessageTime === null ? 'Chưa có tin nhắn từ khách' : 'Thời gian tin nhắn cuối của khách'} className={`shrink-0 text-[11px] leading-5 ${hasUnread ? 'font-semibold text-[#1fa855]' : 'text-[#667781]'}`}>
              {timeString}
            </span>
          </div>
        </div>

        {/* Last Message Snippet or Unsent Draft */}
        <div className="mt-0.5 flex min-w-0 items-center justify-between gap-1">
          <p className={`flex min-w-0 flex-1 items-center gap-1 truncate text-[13px] leading-5 ${hasUnread ? 'font-medium text-slate-700' : 'font-normal text-[#667781]'}`}>
            {hasDraft ? (
              <>
                <span className="shrink-0 font-medium text-rose-600">Nháp:</span>
                <span className="truncate font-normal text-[#667781]">
                  {trimmedDraft}
                </span>
              </>
            ) : (
              <>
                {isAgentLast && (
                  <span className="shrink-0">
                    <MessageDeliveryStatusIcon
                      status={thread.lastMessage.status}
                      isRealSent={thread.lastMessage.isRealSent}
                      errorMessage={thread.lastMessage.errorMessage}
                    />
                  </span>
                )}
                <span className="truncate">
                  {formatMessagePreview(thread.lastMessage.content)}
                </span>
              </>
            )}
          </p>

          <div className="flex shrink-0 items-center gap-1.5">
            {thread.isPinned && (
              <Pin className="w-3.5 h-3.5 rotate-45 shrink-0" stroke="#1fa855" fill="#1fa855" strokeWidth={2.2} />
            )}
            {hasUnread && (
              <span className="unread-count-badge min-w-4.5 h-4.5 px-1 bg-[#1fa855] rounded-full text-[10px] text-white font-extrabold flex items-center justify-center shadow-2xs">
                {thread.unreadCount}
              </span>
            )}
            <button
              ref={menuButtonRef}
              type="button"
              aria-label={`Thao tác hội thoại với ${thread.customerName}`}
              aria-haspopup="menu"
              aria-expanded={isMenuOpen}
              title="Thao tác hội thoại"
              onClick={(event) => {
                event.stopPropagation();
                if (isMenuOpen) setIsMenuOpen(false);
                else openMenu();
              }}
              onKeyDown={(event) => {
                if (event.key !== 'ArrowDown') return;
                event.preventDefault();
                event.stopPropagation();
                if (!isMenuOpen) openMenu();
                else menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
              }}
              className={`flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1fa855]/40 ${
                isMenuOpen ? 'bg-emerald-100 text-[#1fa855]' : `text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 ${isSelected ? '' : 'sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100'}`
              }`}
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {isMenuOpen && createPortal(
        <div
          ref={menuRef}
          role="menu"
          aria-label={`Thao tác hội thoại với ${thread.customerName}`}
          className="fixed z-[100] w-[184px] rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl"
          style={menuPosition}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if (event.key === 'Tab') {
              setIsMenuOpen(false);
              menuButtonRef.current?.focus();
              return;
            }
            if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));
            const current = items.indexOf(document.activeElement as HTMLButtonElement);
            const index = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
              : (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
            items[index]?.focus();
          }}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setIsMenuOpen(false);
              menuButtonRef.current?.focus();
              togglePinThread(thread.threadId);
            }}
            className="flex h-9 w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 text-left text-xs font-medium text-slate-700 hover:bg-emerald-50 focus:bg-emerald-50 focus:outline-none"
          >
            {thread.isPinned ? <PinOff className="h-4 w-4 text-[#1fa855]" /> : <Pin className="h-4 w-4 text-[#1fa855]" />}
            {thread.isPinned ? 'Bỏ ghim hội thoại' : 'Ghim hội thoại'}
          </button>
          {isAdmin && onDeleteThread && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setIsMenuOpen(false);
                menuButtonRef.current?.focus();
                if (window.confirm(`[ADMIN] Xóa toàn bộ hội thoại với ${thread.customerName}?`)) {
                  onDeleteThread(parseThreadId(thread.threadId).phoneId ? thread.threadId : thread.customer?.id || thread.threadId);
                }
              }}
              className="flex h-9 w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 text-left text-xs font-medium text-rose-600 hover:bg-rose-50 focus:bg-rose-50 focus:outline-none"
            >
              <Trash2 className="h-4 w-4" />
              Xóa hội thoại
            </button>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
};

export const ThreadListItem = React.memo(ThreadListItemComponent, (previous, next) =>
  previous.thread === next.thread
  && previous.isSelected === next.isSelected
  && previous.isSessionExpired === next.isSessionExpired
  && previous.status === next.status
  && previous.draftText === next.draftText
  && previous.onSelectThread === next.onSelectThread
  && previous.togglePinThread === next.togglePinThread
  && previous.onDeleteThread === next.onDeleteThread
  && previous.isAdmin === next.isAdmin
  && previous.slaWarning?.label === next.slaWarning?.label
  && previous.slaWarning?.minutes === next.slaWarning?.minutes
  && previous.slaWarning?.isSevere === next.slaWarning?.isSevere
);
