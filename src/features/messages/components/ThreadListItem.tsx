import React from 'react';
import { AlertTriangle, CheckCheck, Pin, Trash2 } from 'lucide-react';
import { formatDate, formatPhoneWithCountryCode } from '../../../utils/crmUtils';
import { STATUS_CONFIG } from '../constants';
import type { ConversationStatus, MessageThread } from '../types';

export interface SlaWarning {
  label: string;
  minutes: number;
  isSevere: boolean;
}

interface ThreadListItemProps {
  thread: MessageThread;
  isSelected: boolean;
  threadStatuses: Record<string, ConversationStatus>;
  onSelectThread: (threadId: string, phone: string, messageIds: string[]) => void;
  togglePinThread: (threadId: string) => void;
  onDeleteThread?: (id: string) => void;
  isAdmin: boolean;
  slaWarning: SlaWarning | null;
}

export const ThreadListItem: React.FC<ThreadListItemProps> = ({
  thread,
  isSelected,
  threadStatuses,
  onSelectThread,
  togglePinThread,
  onDeleteThread,
  isAdmin,
  slaWarning,
}) => {
  const hasUnread = thread.unreadCount > 0;
  const isAgentLast = thread.lastMessage.sender === 'agent';
  const threadTime = new Date(thread.lastMessage.timestamp);
  const isToday = threadTime.toDateString() === new Date().toDateString();
  const timeString = isToday
    ? threadTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    : formatDate(threadTime);

  const currentStatusKey = threadStatuses[thread.threadId] || 'consulting';
  const currentStatus = STATUS_CONFIG[currentStatusKey];

  return (
    <div
      onClick={() => onSelectThread(thread.threadId, thread.customerPhone, thread.messages.map((m) => m.id))}
      className={`group px-3 py-3 flex items-start space-x-3 cursor-pointer transition relative ${
        isSelected ? 'bg-[#f0f2f5] border-l-4 border-[#1fa855]' : 'hover:bg-[#f5f6f6]'
      }`}
    >
      {/* Avatar with Dicebear Adventurer / custom photo & online dot */}
      <div className="relative shrink-0 mt-0.5">
        <div className="w-11 h-11 rounded-full bg-emerald-50 border border-slate-200/80 flex items-center justify-center shadow-sm overflow-hidden">
          <img
            src={
              thread.customer?.avatar ||
              `https://api.dicebear.com/10.x/clay/svg?topProbability=0&patternProbability=0&seed=${encodeURIComponent(
                thread.customer?.phone || thread.customerPhone || thread.customerName || thread.threadId
              )}`
            }
            alt="avatar"
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
        <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white"></span>
      </div>

      {/* Thread Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className={`text-xs truncate ${hasUnread ? 'font-black text-slate-950' : 'font-bold text-slate-800'}`}>
            {thread.customerName}
          </span>
          <span className={`text-[10px] shrink-0 ml-1 ${hasUnread ? 'text-[#1fa855] font-bold' : 'text-slate-400'}`}>
            {timeString}
          </span>
        </div>

        {/* Phone & Status / Group Tags */}
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          <span className="text-[10px] text-slate-500 truncate font-mono">
            {formatPhoneWithCountryCode(thread.customerPhone, thread.customer?.country) ||
              thread.customerPhone ||
              'WhatsApp'}
          </span>

          {/* Pipeline Status Tag */}
          <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold border ${currentStatus.bg} ${currentStatus.text} ${currentStatus.border}`}>
            {currentStatus.label}
          </span>

          {/* CRM Group Tag */}
          {thread.customer && (
            <span className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-slate-100 text-slate-600 border border-slate-200">
              {thread.customer.totalOrders >= 2 ? 'VIP' : thread.customer.totalOrders === 1 ? '1 Đơn' : 'Mới'}
            </span>
          )}

          {/* SLA Waiting Warning */}
          {slaWarning && (
            <span
              className={`text-[9px] px-1.5 py-0.2 rounded font-bold border flex items-center gap-0.5 ${
                slaWarning.isSevere
                  ? 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse'
                  : 'bg-amber-100 text-amber-800 border-amber-300'
              }`}
              title={`Khách đang chờ phản hồi (${slaWarning.minutes} phút)`}
            >
              <AlertTriangle className="w-2.5 h-2.5" />
              <span>{slaWarning.label}</span>
            </span>
          )}
        </div>

        {/* Last Message Snippet */}
        <div className="flex items-center justify-between mt-1">
          <p className={`text-xs truncate pr-1 flex items-center gap-1 ${hasUnread ? 'text-slate-900 font-bold' : 'text-slate-500'}`}>
            {isAgentLast && <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb] shrink-0" />}
            <span className="truncate">
              {(() => {
                const c = thread.lastMessage.content;
                if (
                  c.startsWith('data:image/') ||
                  c.startsWith('/uploads/') ||
                  c.startsWith('/api/meta/media/') ||
                  c.match(/^https?:\/\/.*\.(png|jpg|jpeg|gif|webp)/i)
                ) {
                  const parts = c.split('\n');
                  const cap = parts.slice(1).join(' ');
                  return cap ? `📷 ${cap}` : '📷 [Hình ảnh]';
                }
                if (
                  c.toLowerCase().startsWith('[image') ||
                  c.toLowerCase().startsWith('[hình ảnh') ||
                  c.toLowerCase() === '[photo]'
                ) {
                  return `📷 ${c.replace(/\[image message\]/gi, '[Hình ảnh]').replace(/\[image\]/gi, '[Hình ảnh]')}`;
                }
                return c;
              })()}
            </span>
          </p>

          <div className="flex items-center space-x-1.5 shrink-0">
            {thread.isPinned && (
              <Pin className="w-3.5 h-3.5 rotate-45 shrink-0" stroke="#1fa855" fill="#1fa855" strokeWidth={2.2} />
            )}
            {hasUnread && (
              <span className="min-w-4.5 h-4.5 px-1 bg-[#1fa855] rounded-full text-[10px] text-white font-extrabold flex items-center justify-center shadow-2xs">
                {thread.unreadCount}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Pin & Admin Quick Action buttons on hover */}
      <div className="absolute right-2.5 top-2.5 hidden group-hover:flex items-center space-x-1.5 z-10 animate-in fade-in duration-100">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            togglePinThread(thread.threadId);
          }}
          className={`w-7 h-7 rounded-full border shadow-sm flex items-center justify-center transition-all cursor-pointer hover:scale-110 ${
            thread.isPinned ? 'bg-[#e6f7f2] border-[#1fa855] hover:bg-[#d1f2e8]' : 'bg-white hover:bg-[#f1f5f9] border-[#cbd5e1]'
          }`}
          title={thread.isPinned ? 'Bỏ ghim hội thoại' : 'Ghim hội thoại lên đầu'}
        >
          <Pin
            className="w-3.5 h-3.5 rotate-45"
            stroke={thread.isPinned ? '#1fa855' : '#334155'}
            fill={thread.isPinned ? '#1fa855' : 'none'}
            strokeWidth={2.2}
          />
        </button>

        {isAdmin && onDeleteThread && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (window.confirm(`[ADMIN] Xóa toàn bộ hội thoại với ${thread.customerName}?`)) {
                onDeleteThread(thread.customer?.id || thread.threadId || thread.lastMessage.customerId);
              }
            }}
            className="w-7 h-7 rounded-full bg-white hover:bg-[#ffe4e6] border border-[#cbd5e1] hover:border-[#e11d48] shadow-sm flex items-center justify-center transition-all cursor-pointer hover:scale-110"
            title="Xóa hội thoại"
          >
            <Trash2 className="w-3.5 h-3.5" stroke="#64748b" strokeWidth={2} />
          </button>
        )}
      </div>
    </div>
  );
};
