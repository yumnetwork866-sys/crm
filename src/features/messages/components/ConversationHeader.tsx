import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronLeft, MoreVertical, PanelRight, Search, X } from 'lucide-react';
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
  onOpenDrawer: () => void;
  isAutoTranslateEnabled?: boolean;
  onToggleAutoTranslate?: () => void;
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
  onOpenDrawer,
  isAutoTranslateEnabled,
  onToggleAutoTranslate,
}) => {
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
  const statusMenuRef = useRef<HTMLDivElement>(null);
  const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);
  const actionsMenuRef = useRef<HTMLDivElement>(null);
  const actionsButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setIsActionsMenuOpen(false);
    setIsStatusMenuOpen(false);
  }, [activeThread.threadId]);

  useEffect(() => {
    if (!isActionsMenuOpen) return;
    const close = () => setIsActionsMenuOpen(false);
    const handlePointerDown = (event: PointerEvent) => {
      if (!actionsMenuRef.current?.contains(event.target as Node)) close();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      close();
      actionsButtonRef.current?.focus();
    };
    const frame = requestAnimationFrame(() => actionsMenuRef.current?.querySelector<HTMLButtonElement>('[role="menuitemcheckbox"]')?.focus());
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', close);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', close);
    };
  }, [isActionsMenuOpen]);

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
      <div
        onClick={(event) => {
          const target = event.target as HTMLElement;
          if (!target.closest('button, [role="menu"], [role="listbox"]')) onOpenDrawer();
        }}
        title="Mở hồ sơ khách hàng"
        className="p-2 sm:p-3 bg-white border-b border-slate-200 flex items-center justify-between shrink-0 shadow-sm z-10 cursor-pointer"
      >
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
          <button
            type="button"
            onClick={onOpenDrawer}
            aria-label={`Mở hồ sơ khách hàng ${activeThread.customerName}`}
            aria-expanded={isDrawerOpen}
            title="Mở hồ sơ khách hàng"
            className="relative shrink-0 cursor-pointer rounded-full transition hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1fa855]/40 focus-visible:ring-offset-2"
          >
            <span className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center font-bold text-sm shadow-sm overflow-hidden">
              <img
                src={getCustomerAvatar(activeCustomer?.avatar, activeCustomer?.phone || activeThread.customerPhone || activeThread.customerName || activeThread.threadId)}
                alt="avatar"
                className="w-full h-full object-cover"
              />
            </span>
            <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white"></span>
          </button>

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
              <button
                type="button"
                onClick={onOpenDrawer}
                aria-label="Mở hồ sơ khách hàng từ số điện thoại"
                aria-expanded={isDrawerOpen}
                title="Mở hồ sơ khách hàng"
                className="cursor-pointer rounded font-mono text-xs transition hover:text-[#1fa855] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1fa855]/40"
              >
                {formatPhoneWithCountryCode(activeThread.customerPhone, activeCustomer?.country) || activeThread.customerPhone}
              </button>
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

        {/* Minimal chat actions: search and overflow menu. */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => {
              setIsActionsMenuOpen(false);
              onToggleChatSearch();
            }}
            aria-label="Tìm kiếm trong đoạn chat"
            aria-expanded={isChatSearchOpen}
            className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1fa855]/40 ${
              isChatSearchOpen ? 'bg-emerald-50 text-[#1fa855]' : 'text-[#111b21] hover:bg-black/5'
            }`}
            title="Tìm kiếm trong đoạn chat"
          >
            <Search data-colored="true" strokeWidth={2} className="h-5 w-5" />
          </button>

          <div ref={actionsMenuRef} className="relative">
            <button
              ref={actionsButtonRef}
              type="button"
              onClick={() => {
                setIsStatusMenuOpen(false);
                setIsActionsMenuOpen((open) => !open);
              }}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  setIsActionsMenuOpen(true);
                }
              }}
              aria-label="Tùy chọn cuộc trò chuyện"
              aria-haspopup="menu"
              aria-expanded={isActionsMenuOpen}
              className={`flex h-9 w-9 items-center justify-center rounded-full text-[#111b21] transition-colors cursor-pointer hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1fa855]/40 ${isActionsMenuOpen ? 'bg-black/5' : ''}`}
              title="Tùy chọn cuộc trò chuyện"
            >
              <MoreVertical data-colored="true" strokeWidth={2} className="h-5 w-5" />
            </button>

            {isActionsMenuOpen && (
              <div
                role="menu"
                aria-label="Tùy chọn cuộc trò chuyện"
                className="absolute right-0 top-full z-50 mt-2 w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl"
                onKeyDown={(event) => {
                  if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
                    event.preventDefault();
                    event.currentTarget.querySelector<HTMLButtonElement>('[role="menuitemcheckbox"]')?.focus();
                  } else if (event.key === 'Tab') {
                    setIsActionsMenuOpen(false);
                    actionsButtonRef.current?.focus();
                  }
                }}
              >
                <button
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={isDrawerOpen}
                  onClick={() => {
                    setIsActionsMenuOpen(false);
                    actionsButtonRef.current?.focus();
                    onToggleDrawer();
                  }}
                  className="flex h-10 w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 text-left text-xs text-slate-700 hover:bg-slate-100 focus:bg-slate-100 focus:outline-none"
                >
                  <PanelRight className="h-4 w-4 shrink-0" />
                  <span className="flex-1">Hồ sơ khách hàng</span>
                  {isDrawerOpen && <Check data-colored="true" className="h-4 w-4 text-[#1fa855]" />}
                </button>
              </div>
            )}
          </div>
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
