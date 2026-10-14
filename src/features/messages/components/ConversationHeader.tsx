import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronLeft, Menu, Search, X } from 'lucide-react';
import type { AppUser, Customer } from '../../../types';
import {
  formatPhoneWithCountryCode,
  getCustomerAvatar,
  getDiceBearAvatar,
  getOwnerAvatar,
  STAFF_DICEBEAR_STYLE,
} from '../../../utils/crmUtils';
import { findUserByName, getUserRoleTextStyle } from '../../../utils/roleColors';
import { STATUS_CONFIG } from '../constants';
import type { ConversationStatus, MessageThread } from '../types';
import { WhatsAppSessionCountdown } from './WhatsAppSessionCountdown';

export interface ConversationHeaderProps {
  activeThread: MessageThread;
  activeCustomer: Customer | null;
  users: AppUser[];
  threadStatuses: Record<string, ConversationStatus>;
  onUpdateThreadStatus: (threadId: string, status: ConversationStatus) => void;
  onSelectUserForInfo: (user: AppUser) => void;
  onBackToThreads: () => void;
  isChatSearchOpen: boolean;
  onToggleChatSearch: () => void;
  chatSearchQuery: string;
  onChatSearchQueryChange: (query: string) => void;
  onCloseChatSearch: () => void;
  isDrawerOpen: boolean;
  onToggleDrawer: () => void;
}

export const ConversationHeader: React.FC<ConversationHeaderProps> = ({
  activeThread,
  activeCustomer,
  users,
  threadStatuses,
  onUpdateThreadStatus,
  onSelectUserForInfo,
  onBackToThreads,
  isChatSearchOpen,
  onToggleChatSearch,
  chatSearchQuery,
  onChatSearchQueryChange,
  onCloseChatSearch,
  isDrawerOpen,
  onToggleDrawer,
}) => {
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
  const statusMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isStatusMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (isStatusMenuOpen && !statusMenuRef.current?.contains(event.target as Node)) {
        setIsStatusMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isStatusMenuOpen]);

  const currentStatusKey = (threadStatuses[activeThread.threadId] || 'consulting') as ConversationStatus;
  const currentStatusConfig = STATUS_CONFIG[currentStatusKey];

  return (
    <>
      {/* WhatsApp Active Chat Header */}
      <div className="p-2 sm:p-3 bg-[#f0f2f5] border-b border-slate-300 flex items-center justify-between shrink-0 shadow-sm z-10">
        <div className="flex items-center space-x-3 min-w-0">
          <button
            type="button"
            onClick={onBackToThreads}
            className="-ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-200 sm:hidden"
            title="Quay lại danh sách hội thoại"
            aria-label="Quay lại danh sách hội thoại"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="relative shrink-0">
            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center font-bold text-sm shadow-sm overflow-hidden">
              <img
                src={getCustomerAvatar(activeCustomer?.avatar, activeCustomer?.phone || activeThread.customerPhone || activeThread.customerName || activeThread.threadId)}
                alt="avatar"
                className="w-full h-full object-cover"
              />
            </div>
            <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white"></span>
          </div>

          <div className="min-w-0">
            <div className="flex items-center space-x-2 flex-wrap">
              <h2 className="text-sm font-extrabold text-slate-900 leading-tight truncate">
                {activeThread.customerName}
              </h2>

              {/* 24h Countdown Chip */}
              <WhatsAppSessionCountdown activeThread={activeThread} />

              {/* Pipeline Status Selector Dropdown */}
              <div ref={statusMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setIsStatusMenuOpen((prev) => !prev)}
                  aria-haspopup="listbox"
                  aria-expanded={isStatusMenuOpen}
                  className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full border cursor-pointer focus:outline-none shadow-2xs transition ${currentStatusConfig.bg} ${currentStatusConfig.text} ${currentStatusConfig.border}`}
                  title="Trạng thái tư vấn cuộc trò chuyện"
                >
                  <span>{currentStatusConfig.emoji}</span>
                  <span>{currentStatusConfig.label}</span>
                  <ChevronDown className={`w-2.5 h-2.5 text-slate-500 transition-transform ${isStatusMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {isStatusMenuOpen && (
                  <div
                    role="listbox"
                    aria-label="Trạng thái tư vấn cuộc trò chuyện"
                    className="absolute left-0 top-full mt-1.5 z-50 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-xl"
                  >
                    {(Object.keys(STATUS_CONFIG) as ConversationStatus[]).map((statusKey) => {
                      const config = STATUS_CONFIG[statusKey];
                      const isSelected = statusKey === currentStatusKey;
                      return (
                        <button
                          key={statusKey}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => {
                            onUpdateThreadStatus(activeThread.threadId, statusKey);
                            setIsStatusMenuOpen(false);
                          }}
                          className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition cursor-pointer ${
                            isSelected
                              ? `${config.bg} ${config.text} font-bold`
                              : 'text-slate-700 hover:bg-slate-100 font-medium'
                          }`}
                        >
                          <span className="flex items-center gap-1.5">
                            <span>{config.emoji}</span>
                            <span>{config.label}</span>
                          </span>
                          {isSelected && <Check className="h-3.5 w-3.5 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>

            <p className="text-xs text-slate-500 flex items-center space-x-2 truncate flex-wrap">
              <span className="font-mono">{formatPhoneWithCountryCode(activeThread.customerPhone, activeCustomer?.country) || activeThread.customerPhone}</span>
              {activeCustomer?.owner && !['chưa phân công', 'unassigned'].includes(activeCustomer.owner.trim().toLowerCase()) && (
                <span className="text-[11px] text-slate-500 flex items-center gap-1.5">
                  <span>• Phụ trách:</span>
                  <img
                    src={getOwnerAvatar(activeCustomer.owner)}
                    alt={activeCustomer.owner}
                    className="w-4 h-4 rounded-full object-cover shrink-0 bg-slate-100 inline-block"
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
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Right Action Icons in Header */}
        <div className="flex items-center space-x-2 text-slate-600 shrink-0">

          <button
            onClick={onToggleChatSearch}
            aria-pressed={isChatSearchOpen}
            className={`p-2 rounded-lg border transition cursor-pointer ${
              isChatSearchOpen
                ? 'bg-[#1fa855] text-white border-[#1fa855] shadow-xs'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 shadow-2xs'
            }`}
            title="Tìm kiếm trong đoạn chat"
          >
            <Search
              className="chat-header-action-icon w-4 h-4"
            />
          </button>

          <button
            onClick={onToggleDrawer}
            aria-pressed={isDrawerOpen}
            className={`p-2 rounded-lg border transition cursor-pointer ${
              isDrawerOpen
                ? 'bg-[#1fa855] text-white border-[#1fa855] shadow-xs'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 shadow-2xs'
            }`}
            title="Bật/Tắt Hồ sơ CRM"
          >
            <Menu
              className="chat-header-action-icon w-4 h-4"
            />
          </button>
        </div>
      </div>

      {/* Inline Search Bar inside Chat */}
      {isChatSearchOpen && (
        <div className="p-2.5 bg-white border-b border-slate-300 flex items-center space-x-2 z-10 animate-fadeIn">
          <Search className="w-4 h-4 text-slate-400 ml-1" />
          <input
            type="text"
            value={chatSearchQuery}
            onChange={(e) => onChatSearchQueryChange(e.target.value)}
            placeholder="Tìm kiếm tin nhắn trong cuộc trò chuyện này..."
            className="flex-1 bg-transparent text-xs text-slate-900 focus:outline-none placeholder-slate-400"
            autoFocus
          />
          {chatSearchQuery && (
            <button onClick={() => onChatSearchQueryChange('')} className="p-1 text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={onCloseChatSearch}
            className="text-xs text-slate-500 font-semibold hover:text-slate-800 px-2"
          >
            Đóng
          </button>
        </div>
      )}
    </>
  );
};
