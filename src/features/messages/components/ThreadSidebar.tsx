import React, { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Check, ChevronDown, Plus, Search, X } from 'lucide-react';
import type { AppUser, CentralMessage } from '../../../types';
import type {
  ActiveMessageFilter,
  BusinessPhoneNumber,
  ConversationListResponse,
  ConversationStatus,
  MessageThread,
} from '../types';
import { queryKeys } from '../../../lib/queryClient';
import { api } from '../../../utils/apiClient';
import { BusinessPhoneSelector } from './BusinessPhoneSelector';
import { ThreadListItem, type SlaWarning } from './ThreadListItem';

interface SavedMessageList {
  id: string;
  name: string;
  filter: ActiveMessageFilter;
}

export interface ThreadSidebarProps {
  isCompactChatOpen: boolean;
  isDrawerOpen: boolean;
  businessPhones: BusinessPhoneNumber[];
  selectedPhoneId: string;
  onSelectBusinessPhone: (phoneId: string) => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  activeFilter: ActiveMessageFilter;
  onSelectActiveFilter: (filter: ActiveMessageFilter) => void;
  threads: MessageThread[];
  filteredThreads: MessageThread[];
  activeThread: MessageThread | null;
  threadStatuses: Record<string, ConversationStatus>;
  draftsByThreadId?: Record<string, string>;
  onSelectThread: (threadId: string, phone: string, messageIds: string[]) => void;
  togglePinThread: (threadId: string) => void;
  onDeleteThread?: (customerId: string) => void;
  isAdmin: boolean;
  effectiveCurrentUser?: AppUser | null;
  isLoadingThreads?: boolean;
}

export const ThreadSidebar: React.FC<ThreadSidebarProps> = ({
  isCompactChatOpen,
  isDrawerOpen,
  businessPhones,
  selectedPhoneId,
  onSelectBusinessPhone,
  searchQuery,
  onSearchQueryChange,
  activeFilter,
  onSelectActiveFilter,
  threads,
  filteredThreads,
  activeThread,
  threadStatuses,
  draftsByThreadId,
  onSelectThread,
  togglePinThread,
  onDeleteThread,
  isAdmin,
  effectiveCurrentUser,
  isLoadingThreads = false,
}) => {
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const [activeSavedListId, setActiveSavedListId] = useState<string | null>(null);
  const [savedFilterLists, setSavedFilterLists] = useState<SavedMessageList[]>([]);
  const filterMenuRef = useRef<HTMLDivElement>(null);
  const threadListRef = useRef<HTMLDivElement>(null);
  const [slaCurrentTime, setSlaCurrentTime] = useState(() => Date.now());

  const conversationsQuery = useQuery({
    queryKey: queryKeys.messageConversations(selectedPhoneId),
    queryFn: () =>
      api.get<ConversationListResponse>(
        `/meta/messages/conversations?limit=100&phoneNumberId=${encodeURIComponent(selectedPhoneId)}`
      ),
    enabled: Boolean(effectiveCurrentUser) && Boolean(selectedPhoneId),
    staleTime: 30_000,
  });
  const effectiveIsLoadingThreads = isLoadingThreads || conversationsQuery.isLoading;

  useEffect(() => {
    const timer = window.setInterval(() => setSlaCurrentTime(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!effectiveCurrentUser) return;
    let cancelled = false;
    void api.get<SavedMessageList[]>('/meta/messages/preferences/filters')
      .then(async (databaseLists) => {
        let legacyLists: SavedMessageList[] = [];
        try {
          const raw = localStorage.getItem('whatsapp-saved-filter-lists');
          const parsed: unknown = raw ? JSON.parse(raw) : [];
          if (Array.isArray(parsed)) legacyLists = parsed as SavedMessageList[];
        } catch {
          legacyLists = [];
        }

        if (databaseLists.length === 0 && legacyLists.length > 0) {
          const imported = await Promise.all(legacyLists.map((list) =>
            api.post<SavedMessageList>('/meta/messages/preferences/filters', {
              name: list.name,
              filter: list.filter,
            })
          ));
          if (!cancelled) setSavedFilterLists(imported);
        } else if (!cancelled) {
          setSavedFilterLists(databaseLists);
        }
        localStorage.removeItem('whatsapp-saved-filter-lists');
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [effectiveCurrentUser]);

  useEffect(() => {
    if (!isFilterMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (isFilterMenuOpen && !filterMenuRef.current?.contains(event.target as Node)) {
        setIsFilterMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isFilterMenuOpen]);

  const filterOptions = [
    { id: 'all', label: `Tất cả (${threads.length})` },
    { id: 'unread', label: `Chưa đọc (${threads.reduce((sum, thread) => sum + thread.unreadCount, 0)})` },
    { id: 'vip', label: 'Khách VIP' },
    { id: 'repeat', label: 'Đã mua 1 lần' },
    { id: 'new', label: 'Khách mới' },
  ] satisfies Array<{ id: ActiveMessageFilter; label: string }>;

  const visibleFilterOptions = activeFilter === 'all'
    ? filterOptions
    : [
        filterOptions[0],
        filterOptions.find((filterOption) => filterOption.id === activeFilter)!,
        ...filterOptions.filter((filterOption) => filterOption.id !== 'all' && filterOption.id !== activeFilter),
      ];

  const threadVirtualizer = useVirtualizer({
    count: filteredThreads.length,
    getScrollElement: () => threadListRef.current,
    estimateSize: () => 92,
    getItemKey: (index) => filteredThreads[index]?.threadId || index,
    overscan: 8,
  });

  const selectBuiltInFilter = (filter: ActiveMessageFilter) => {
    onSelectActiveFilter(filter);
    setActiveSavedListId(null);
  };

  const handleCreateSavedList = async () => {
    const name = window.prompt('Tên danh sách mới:')?.trim();
    if (!name) return;

    const newList = await api.post<SavedMessageList>('/meta/messages/preferences/filters', {
      name,
      filter: activeFilter,
    });
    setSavedFilterLists((currentLists) => [...currentLists, newList]);
    setActiveSavedListId(newList.id);
    setIsFilterMenuOpen(false);
  };

  const getSlaWarning = (thread: { messages: CentralMessage[]; lastMessage: CentralMessage }): SlaWarning | null => {
    if (thread.lastMessage.sender !== 'customer') return null;
    const elapsedMs = slaCurrentTime - new Date(thread.lastMessage.timestamp).getTime();
    const minutes = Math.floor(elapsedMs / (1000 * 60));
    if (minutes < 15) return null;
    if (minutes >= 60) {
      const hours = Math.min(Math.floor(minutes / 60), 24);
      return { label: `${hours}h`, minutes, isSevere: true };
    }
    return { label: `${minutes}p`, minutes, isSevere: false };
  };

  return (
    <div className={`${isCompactChatOpen ? 'hidden sm:flex' : 'flex'} ${isDrawerOpen ? 'w-full sm:w-2/5 lg:w-[320px] xl:w-90' : 'w-full sm:w-2/5 lg:w-95 xl:w-105'} bg-[#f0f2f5] border-r border-slate-300 flex-col h-full overflow-hidden select-none shrink-0 transition-all duration-200`}>

      {/* WhatsApp Left Header with Integrated WABA Phone Selector */}
      <div className="p-2.5 bg-[#f0f2f5] border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
        <BusinessPhoneSelector
          phones={businessPhones}
          selectedPhoneId={selectedPhoneId}
          onSelect={onSelectBusinessPhone}
        />
      </div>

      {/* Search Box */}
      <div className="px-3 py-2 bg-[#f0f2f5] border-b border-slate-200">
        <div className="relative flex items-center bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 focus-within:border-[#1fa855] focus-within:ring-1 focus-within:ring-[#1fa855] shadow-2xs transition">
          <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder="Tìm tên, số ĐT, nội dung chat..."
            className="w-full bg-transparent text-xs text-slate-900 focus:outline-none placeholder:text-slate-400"
          />
          {searchQuery && (
            <button onClick={() => onSearchQueryChange('')} className="p-0.5 text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* WhatsApp Filter Pills */}
      <div className="whatsapp-filter-shell relative px-3 py-2 bg-[#f0f2f5] border-b border-slate-200 shrink-0">
        <div className="flex min-w-0 items-center gap-1.5">
          <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
            {visibleFilterOptions.map((filterOption) => (
              <button
                key={filterOption.id}
                type="button"
                data-primary={filterOption.id === 'all'}
                aria-pressed={activeFilter === filterOption.id}
                onClick={() => selectBuiltInFilter(filterOption.id)}
                className={`whatsapp-filter-chip shrink-0 px-3 py-1 rounded-full text-[11px] transition whitespace-nowrap cursor-pointer ${
                  activeFilter === filterOption.id
                    ? 'bg-[#1fa855] text-white border border-[#1fa855] font-bold shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 font-semibold shadow-2xs'
                }`}
              >
                {filterOption.label}
              </button>
            ))}
          </div>

          <div ref={filterMenuRef} className="relative shrink-0">
            <button
              type="button"
              aria-label="Mở danh sách bộ lọc"
              aria-haspopup="menu"
              aria-expanded={isFilterMenuOpen}
              onClick={() => setIsFilterMenuOpen((isOpen) => !isOpen)}
              className={`flex h-8 w-8 items-center justify-center rounded-full border shadow-2xs transition cursor-pointer ${
                isFilterMenuOpen
                  ? 'bg-[#1fa855] text-white border-[#1fa855]'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
              title="Thêm hoặc chọn bộ lọc"
            >
              <ChevronDown className={`h-4 w-4 transition-transform ${isFilterMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isFilterMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-10 z-50 w-52 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl"
              >
                {savedFilterLists.length > 0 && (
                  <>
                    {savedFilterLists.map((savedList) => {
                      const isActive = activeSavedListId === savedList.id;
                      return (
                        <button
                          key={savedList.id}
                          type="button"
                          role="menuitemradio"
                          aria-checked={isActive}
                          onClick={() => {
                            onSelectActiveFilter(savedList.filter);
                            setActiveSavedListId(savedList.id);
                            setIsFilterMenuOpen(false);
                          }}
                          className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs transition cursor-pointer ${
                            isActive
                              ? 'bg-emerald-50 font-bold text-[#1fa855]'
                              : 'text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                            {isActive ? <Check className="h-4 w-4" /> : null}
                          </span>
                          <span className="truncate">{savedList.name}</span>
                        </button>
                      );
                    })}
                    <div className="my-1 border-t border-slate-200" />
                  </>
                )}

                {filterOptions.map((filterOption) => {
                  const isActive = activeFilter === filterOption.id;
                  return (
                    <button
                      key={filterOption.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={isActive}
                      onClick={() => {
                        selectBuiltInFilter(filterOption.id);
                        setIsFilterMenuOpen(false);
                      }}
                      className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs transition cursor-pointer ${
                        isActive
                          ? 'bg-emerald-50 font-bold text-[#1fa855]'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                        {isActive ? <Check className="h-4 w-4" /> : null}
                      </span>
                      <span>{filterOption.label}</span>
                    </button>
                  );
                })}

                <div className="my-1 border-t border-slate-200" />
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => void handleCreateSavedList()}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold text-slate-800 transition hover:bg-slate-100 cursor-pointer"
                >
                  <Plus className="h-4 w-4 shrink-0" />
                  <span>Thêm danh sách</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Thread List */}
      <div ref={threadListRef} className="flex-1 overflow-y-auto bg-white whatsapp-scrollbar">
        {effectiveIsLoadingThreads && filteredThreads.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            Đang tải danh sách hội thoại...
          </div>
        ) : filteredThreads.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            Không tìm thấy đoạn chat nào phù hợp.
          </div>
        ) : (
          <div
            className="relative w-full"
            style={{ height: `${threadVirtualizer.getTotalSize()}px` }}
          >
            {threadVirtualizer.getVirtualItems().map((virtualRow) => {
              const thread = filteredThreads[virtualRow.index];
              return (
                <div
                  key={thread.threadId}
                  data-index={virtualRow.index}
                  ref={threadVirtualizer.measureElement}
                  className="absolute left-0 top-0 w-full border-b border-slate-100"
                  style={{ transform: `translateY(${virtualRow.start}px)` }}
                >
                  <ThreadListItem
                    thread={thread}
                    isSelected={activeThread?.threadId === thread.threadId}
                    status={threadStatuses[thread.threadId]}
                    draftText={draftsByThreadId?.[thread.threadId]}
                    onSelectThread={onSelectThread}
                    togglePinThread={togglePinThread}
                    onDeleteThread={onDeleteThread}
                    isAdmin={isAdmin}
                    slaWarning={getSlaWarning(thread)}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
