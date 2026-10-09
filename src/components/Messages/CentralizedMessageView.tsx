import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  MessageSquare,
  Search,
  Send,
  AlertCircle,
  CheckCheck,
  Check,
  User,
  ShoppingBag,
  ArrowUpRight,
  Trash2,
  Video,
  MoreVertical,
  Paperclip,
  Smile,
  Zap,
  Pin,
  Clock,
  X,
  ShieldAlert,
  ChevronRight,
  ChevronLeft,
  Mic,
  Copy,
  CheckCircle2,
  FileText,
  Plus,
  Tag,
  DollarSign,
  Calendar,
  Layers,
  ChevronDown,
  Menu,

  Eye,
  Download,
  Image as ImageIcon,
  AlertTriangle,
  Flame,
  CheckCircle,
  HelpCircle,
  FileSpreadsheet,
  Edit3,
  SmilePlus,
  Reply,
  Pause,
  Play,
  Square,
  Package
} from 'lucide-react';
import type { Customer, CentralMessage, MessageChannel, AppUser } from '../../types';
import { getCustomerGroup, formatDate, formatVND, CUSTOMER_GROUPS, formatPhoneWithCountryCode, getOwnerAvatar } from '../../utils/crmUtils';
import { useAuth } from '../../contexts/AuthContext';
import { QUICK_TEMPLATES, STATUS_CONFIG } from '../../features/messages/constants';
import { EmojiPicker } from '../Common/EmojiPicker';
import type { ActiveMessageFilter, BusinessPhoneNumber, ConversationStatus, InternalNote } from '../../features/messages/types';
import { extractAudioInfo, extractDocumentInfo, extractImageInfo, extractProductInfo, formatMessagePreview, isProductContent, parseMessageContent } from '../../features/messages/utils/messageContent';
import { useMessageComposer } from '../../features/messages/hooks/useMessageComposer';
import { useVoiceRecorder } from '../../features/messages/hooks/useVoiceRecorder';
import { useMessageInteractions } from '../../features/messages/hooks/useMessageInteractions';
import { useMessagePreferences } from '../../features/messages/hooks/useMessagePreferences';
import { useMessageThreads } from '../../features/messages/hooks/useMessageThreads';
import { useMessageViewport } from '../../features/messages/hooks/useMessageViewport';
import { VoiceMessagePlayer } from '../../features/messages/components/VoiceMessagePlayer';
import { DocumentMessageCard } from '../../features/messages/components/DocumentMessageCard';
import { ProductMessageCard } from '../../features/messages/components/ProductMessageCard';
import { ProductPickerModal } from '../../features/messages/components/ProductPickerModal';
import { Permission } from '../../lib/permissions';
import { findUserByName, getUserRoleTextStyle } from '../../utils/roleColors';
import { api } from '../../utils/apiClient';
import { renderFormattedMessage, extractFirstUrl } from '../../utils/formatMessageText';
import { LinkPreviewCard } from '../../features/messages/components/LinkPreviewCard';

import { BusinessPhoneSelector } from '../../features/messages/components/BusinessPhoneSelector';
import { LoadOlderMessagesButton } from '../../features/messages/components/LoadOlderMessagesButton';
import { MessageLightbox } from '../../features/messages/components/MessageLightbox';
import { UserInfoModal } from '../Common/UserInfoModal';
import { MessageSecurityBanner } from '../../features/messages/components/MessageSecurityBanner';
import { ThreadListItem } from '../../features/messages/components/ThreadListItem';
import { CustomerChatDrawer } from '../../features/messages/components/CustomerChatDrawer';
import { WhatsAppSessionCountdown } from '../../features/messages/components/WhatsAppSessionCountdown';
import { MessageDeliveryStatusIcon } from './MessageDeliveryStatusIcon';

interface SavedMessageList {
  id: string;
  name: string;
  filter: ActiveMessageFilter;
}

interface CentralizedMessageViewProps {
  messages: CentralMessage[];
  customers: Customer[];
  currentUser?: AppUser | null;
  businessPhones: BusinessPhoneNumber[];
  selectedPhoneId: string;
  onSelectBusinessPhone: (phoneId: string) => void;
  selectedCustomerId?: string | null;
  onSelectCustomerThread: (customerId: string, customerPhone?: string, messageIds?: string[]) => void;
  onSendMessage: (
    customerId: string,
    content: string,
    channel: MessageChannel,
    customerPhone?: string,
    customerName?: string,
    senderPhoneId?: string,
    replyTo?: { id: string; senderName: string; content: string }
  ) => void;
  onRetryMessage?: (messageId: string) => void;
  onOpenAddOrder: (customer: Customer) => void;
  onSelectCustomerDetail: (customer: Customer) => void;
  onDeleteThread?: (customerId: string) => void;
  onDeleteMessage?: (messageId: string) => void;
  hasOlderMessages?: boolean;
  isLoadingOlderMessages?: boolean;
  onLoadOlderMessages?: () => Promise<unknown>;
}

export const CentralizedMessageView: React.FC<CentralizedMessageViewProps> = ({
  messages,
  customers,
  currentUser,
  businessPhones,
  selectedPhoneId,
  onSelectBusinessPhone,
  selectedCustomerId,
  onSelectCustomerThread,
  onSendMessage,
  onRetryMessage,
  onOpenAddOrder,
  onSelectCustomerDetail,
  onDeleteThread,
  onDeleteMessage,
  hasOlderMessages = false,
  isLoadingOlderMessages = false,
  onLoadOlderMessages,
}) => {
  const { currentUser: authCurrentUser, users, hasPermission } = useAuth();
  const effectiveCurrentUser = authCurrentUser || currentUser;

  const [activeFilter, setActiveFilter] = useState<ActiveMessageFilter>('all');
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const [activeSavedListId, setActiveSavedListId] = useState<string | null>(null);
  const [savedFilterLists, setSavedFilterLists] = useState<SavedMessageList[]>(() => {
    try {
      const savedLists = localStorage.getItem('whatsapp-saved-filter-lists');
      const parsedLists: unknown = savedLists ? JSON.parse(savedLists) : [];
      return Array.isArray(parsedLists) ? parsedLists as SavedMessageList[] : [];
    } catch {
      return [];
    }
  });
  const filterMenuRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [isChatSearchOpen, setIsChatSearchOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(true);
  const [selectedInfoUser, setSelectedInfoUser] = useState<AppUser | null>(null);
  const {
    soundEnabled,
    internalNotes,
    threadStatuses,
    pinnedThreadIds,
    togglePinThread,
    updateThreadStatus: handleUpdateThreadStatus,
    addInternalNote,
    deleteInternalNote: handleDeleteInternalNote,
  } = useMessagePreferences(selectedPhoneId);

  // Media lightbox is view-only state; composer media state lives in useMessageComposer.
  const [previewLightboxImg, setPreviewLightboxImg] = useState<string | null>(null);

  const isAdmin = hasPermission(Permission.MESSAGES_MANAGE);

  const { threads, filteredThreads, activeThread, groupedMessagesByDate } = useMessageThreads({
    messages,
    customers,
    pinnedThreadIds,
    activeFilter,
    searchQuery,
    selectedCustomerId,
    chatSearchQuery,
  });

  const activeCustomer = activeThread?.customer || null;
  const groupKey = activeCustomer ? getCustomerGroup(activeCustomer) : 'group_1';
  const groupInfo = CUSTOMER_GROUPS[groupKey];
  const {
    chatContainerRef,
    chatEndRef,
    showScrollBottomBtn,
    scrollToBottom,
    handleLoadOlderMessages,
  } = useMessageViewport({
    threadId: activeThread?.threadId,
    messageCount: activeThread?.messages.length || 0,
    isLoadingOlderMessages,
    onLoadOlderMessages,
  });
  const displayedMessages = useMemo(
    () => groupedMessagesByDate.flatMap((group) => group.msgs),
    [groupedMessagesByDate],
  );
  const virtualMessageRows = useMemo(() => {
    const rows: Array<{
      key: string;
      dateLabel: string;
      showDateDivider: boolean;
      messages: CentralMessage[];
      startIndex: number;
    }> = [];
    let messageOffset = 0;

    groupedMessagesByDate.forEach((group) => {
      for (let chunkStart = 0; chunkStart < group.msgs.length; chunkStart += 25) {
        const chunk = group.msgs.slice(chunkStart, chunkStart + 25);
        rows.push({
          key: `${group.dateLabel}-${chunk[0]?.id || chunkStart}`,
          dateLabel: group.dateLabel,
          showDateDivider: chunkStart === 0,
          messages: chunk,
          startIndex: messageOffset + chunkStart,
        });
      }
      messageOffset += group.msgs.length;
    });

    return rows;
  }, [groupedMessagesByDate]);
  const messageVirtualizer = useVirtualizer({
    count: virtualMessageRows.length,
    getScrollElement: () => chatContainerRef.current,
    estimateSize: (index) => Math.max(120, virtualMessageRows[index].messages.length * 78),
    getItemKey: (index) => virtualMessageRows[index]?.key || index,
    overscan: 2,
  });
  const messageRowIndexById = useMemo(() => {
    const lookup = new Map<string, number>();
    virtualMessageRows.forEach((row, rowIndex) => {
      row.messages.forEach((message) => lookup.set(message.id, rowIndex));
    });
    return lookup;
  }, [virtualMessageRows]);

  // Auto-mark active thread as read
  useEffect(() => {
    if (activeThread && activeThread.unreadCount > 0) {
      onSelectCustomerThread(activeThread.threadId, activeThread.customerPhone, activeThread.messages.map((m) => m.id));
    }
  }, [activeThread, onSelectCustomerThread]);

  const [slaCurrentTime, setSlaCurrentTime] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setSlaCurrentTime(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const {
    inputText,
    setInputText,
    showEmojiPicker,
    setShowEmojiPicker,
    showTemplatePicker,
    setShowTemplatePicker,
    showAttachMenu,
    setShowAttachMenu,
    pendingImage,
    setPendingImage,
    pendingDocument,
    setPendingDocument,
    replyingToMessage,
    setReplyingToMessage,
    textareaRef,
    fileInputRef,
    documentInputRef,
    filteredSlashTemplates,
    handleSelectSlashTemplate,
    handleApplyTemplate,
    handleAddEmoji,
    handlePaste,
    handleFileSelect,
    handleDocumentSelect,
    handleSend,
    handleSendVoiceMessage,
    handleKeyDown,
    handleReplyMessage: startReplyMessage,
  } = useMessageComposer({ activeThread, selectedPhoneId, soundEnabled, onSendMessage });

  const {
    recordingState,
    isRecording,
    isRecorded,
    recordingDuration,
    recordedAudio,
    startRecording,
    stopRecording,
    cancelRecording,
    resetRecording,
  } = useVoiceRecorder();

  const [isProductPickerOpen, setIsProductPickerOpen] = useState(false);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [previewCurrentTime, setPreviewCurrentTime] = useState(0);

  const handleStartVoiceRecord = async () => {
    setIsPreviewPlaying(false);
    setPreviewCurrentTime(0);
    await startRecording();
  };

  const handleStopVoiceRecord = async () => {
    await stopRecording();
  };

  const handleCancelVoiceRecord = () => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
    }
    setIsPreviewPlaying(false);
    setPreviewCurrentTime(0);
    cancelRecording();
  };

  const handleTogglePlayPreview = () => {
    const audio = previewAudioRef.current;
    if (!audio) return;
    if (isPreviewPlaying) {
      audio.pause();
      setIsPreviewPlaying(false);
    } else {
      audio.play().then(() => {
        setIsPreviewPlaying(true);
      }).catch((err) => {
        console.warn('Failed to play preview audio:', err);
        setIsPreviewPlaying(false);
      });
    }
  };

  const handleSeekPreview = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = previewAudioRef.current;
    if (!audio) return;
    const dur = recordedAudio?.duration || audio.duration || 0;
    if (!dur || !isFinite(dur)) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const newTime = ratio * dur;
    audio.currentTime = newTime;
    setPreviewCurrentTime(newTime);
  };

  const handleSendVoiceRecord = async () => {
    let audioToSend = recordedAudio;
    if (!audioToSend) {
      audioToSend = await stopRecording();
    }
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
    }
    setIsPreviewPlaying(false);
    setPreviewCurrentTime(0);

    if (audioToSend?.dataUrl) {
      handleSendVoiceMessage(audioToSend.dataUrl);
      resetRecording();
    }
  };

  const formatRecordingTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const previewTotalDuration = recordedAudio?.duration || (previewAudioRef.current && isFinite(previewAudioRef.current.duration) ? previewAudioRef.current.duration : 0);
  const previewPercent = previewTotalDuration > 0
    ? Math.min(100, (previewCurrentTime / previewTotalDuration) * 100)
    : 0;
  const {
    messageReactions,
    activeReactionPickerMsgId,
    setActiveReactionPickerMsgId,
    showExpandedReactionPickerMsgId,
    setShowExpandedReactionPickerMsgId,
    highlightedMessageId,
    copiedMsgId,
    handleJumpToQuotedMessage: jumpToQuotedMessage,
    handleCopyMessage,
    handleReactMessage,
    handleReplyMessage,
  } = useMessageInteractions({
    activeThread,
    selectedPhoneId,
    onReplyMessage: startReplyMessage,
  });
  const handleJumpToQuotedMessage = useCallback((messageId: string) => {
    const rowIndex = messageRowIndexById.get(messageId);
    if (rowIndex !== undefined) {
      messageVirtualizer.scrollToIndex(rowIndex, { align: 'center' });
    }
    window.setTimeout(() => jumpToQuotedMessage(messageId), 50);
  }, [jumpToQuotedMessage, messageRowIndexById, messageVirtualizer]);

  useEffect(() => {
    try {
      localStorage.setItem('whatsapp-saved-filter-lists', JSON.stringify(savedFilterLists));
    } catch {
      // Keep saved lists available for this session when browser storage is unavailable.
    }
  }, [savedFilterLists]);

  useEffect(() => {
    if (!isFilterMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!filterMenuRef.current?.contains(event.target as Node)) {
        setIsFilterMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isFilterMenuOpen]);

  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const templatePickerRef = useRef<HTMLDivElement>(null);
  const templateButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!showEmojiPicker && !showTemplatePicker) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (showEmojiPicker) {
        if (!emojiPickerRef.current?.contains(target) && !emojiButtonRef.current?.contains(target)) {
          setShowEmojiPicker(false);
        }
      }
      if (showTemplatePicker) {
        if (!templatePickerRef.current?.contains(target) && !templateButtonRef.current?.contains(target)) {
          setShowTemplatePicker(false);
        }
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowEmojiPicker(false);
        setShowTemplatePicker(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showEmojiPicker, setShowEmojiPicker, showTemplatePicker, setShowTemplatePicker]);

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

  const threadListRef = useRef<HTMLDivElement>(null);
  const threadVirtualizer = useVirtualizer({
    count: filteredThreads.length,
    getScrollElement: () => threadListRef.current,
    estimateSize: () => 92,
    getItemKey: (index) => filteredThreads[index]?.threadId || index,
    overscan: 8,
  });

  const selectBuiltInFilter = (filter: ActiveMessageFilter) => {
    setActiveFilter(filter);
    setActiveSavedListId(null);
  };

  const handleCreateSavedList = () => {
    const name = window.prompt('Tên danh sách mới:')?.trim();
    if (!name) return;

    const newList: SavedMessageList = {
      id: `list_${Date.now()}`,
      name,
      filter: activeFilter,
    };
    setSavedFilterLists((currentLists) => [...currentLists, newList]);
    setActiveSavedListId(newList.id);
    setIsFilterMenuOpen(false);
  };

  const getSlaWarning = (thread: { messages: CentralMessage[]; lastMessage: CentralMessage }) => {
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
    <div className="whatsapp-page flex-1 flex flex-col min-h-0 h-full w-full overflow-hidden">
      {/* Main WhatsApp 3-Column Studio */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 h-full w-full bg-white overflow-hidden">

        {/* ========================================================
            COLUMN 1: THREAD LIST & SEARCH (Fixed width flex panel)
           ======================================================== */}
        <div className={`${isDrawerOpen ? 'w-full lg:w-[320px] xl:w-90' : 'w-full lg:w-95 xl:w-105'} bg-[#f0f2f5] border-r border-slate-300 flex flex-col h-full overflow-hidden select-none shrink-0 transition-all duration-200`}>

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
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm tên, số ĐT, nội dung chat..."
                className="w-full bg-transparent text-xs text-slate-900 focus:outline-none placeholder:text-slate-400"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="p-0.5 text-slate-400 hover:text-slate-600">
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
                                setActiveFilter(savedList.filter);
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
                      onClick={handleCreateSavedList}
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
            {filteredThreads.length === 0 ? (
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
                        onSelectThread={onSelectCustomerThread}
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

        {/* ========================================================
            COLUMN 2: AUTHENTIC WHATSAPP CHAT CANVAS
           ======================================================== */}
        <div className="flex-1 bg-[#efeae2] flex flex-col h-full overflow-hidden min-w-0 relative">
          {activeThread ? (
            <>
              {/* WhatsApp Active Chat Header */}
              <div className="p-3 bg-[#f0f2f5] border-b border-slate-300 flex items-center justify-between shrink-0 shadow-sm z-10">
                <div className="flex items-center space-x-3 min-w-0">
                  <div className="relative shrink-0">
                    <div className="w-10 h-10 rounded-full bg-emerald-50 border border-slate-200/80 flex items-center justify-center font-bold text-sm shadow-sm overflow-hidden">
                      <img
                        src={activeCustomer?.avatar || `https://api.dicebear.com/10.x/clay/svg?topProbability=0&patternProbability=0&seed=${encodeURIComponent(activeCustomer?.phone || activeThread.customerPhone || activeThread.customerName || activeThread.threadId)}`}
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
                      <div className="relative">
                        <select
                          value={threadStatuses[activeThread.threadId] || 'consulting'}
                          onChange={(e) => handleUpdateThreadStatus(activeThread.threadId, e.target.value as ConversationStatus)}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border cursor-pointer appearance-none pr-5 focus:outline-none shadow-2xs ${
                            STATUS_CONFIG[threadStatuses[activeThread.threadId] || 'consulting'].bg
                          } ${STATUS_CONFIG[threadStatuses[activeThread.threadId] || 'consulting'].text} ${
                            STATUS_CONFIG[threadStatuses[activeThread.threadId] || 'consulting'].border
                          }`}
                          title="Trạng thái tư vấn cuộc trò chuyện"
                        >
                          <option value="consulting">💬 Đang tư vấn</option>
                          <option value="ordered">📦 Đã chốt đơn</option>
                          <option value="callback">📞 Hẹn gọi lại</option>
                          <option value="completed">✅ Hoàn thành</option>
                        </select>
                        <ChevronDown className="w-2.5 h-2.5 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500" />
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
                            className="w-4 h-4 rounded-full object-cover border border-slate-200 shrink-0 bg-slate-100 inline-block"
                            onError={(e) => {
                              e.currentTarget.src = `https://api.dicebear.com/10.x/avataaars/svg?seed=${encodeURIComponent(activeCustomer.owner)}`;
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const ownerUser = findUserByName(users, activeCustomer.owner);
                              if (ownerUser) setSelectedInfoUser(ownerUser);
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
                    onClick={() => setIsChatSearchOpen(!isChatSearchOpen)}
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
                    onClick={() => setIsDrawerOpen(!isDrawerOpen)}
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
                    onChange={(e) => setChatSearchQuery(e.target.value)}
                    placeholder="Tìm kiếm tin nhắn trong cuộc trò chuyện này..."
                    className="flex-1 bg-transparent text-xs text-slate-900 focus:outline-none placeholder-slate-400"
                    autoFocus
                  />
                  {chatSearchQuery && (
                    <button onClick={() => setChatSearchQuery('')} className="p-1 text-slate-400 hover:text-slate-600">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setIsChatSearchOpen(false);
                      setChatSearchQuery('');
                    }}
                    className="text-xs text-slate-500 font-semibold hover:text-slate-800 px-2"
                  >
                    Đóng
                  </button>
                </div>
              )}

              {/* WhatsApp Messages Stream with Authentic Wallpaper Pattern */}
              <div
                ref={chatContainerRef}
                id="chat-messages-container"
                className="flex-1 p-4 overflow-y-auto space-y-4 whatsapp-chat-bg whatsapp-scrollbar"
              >
                <LoadOlderMessagesButton
                  visible={hasOlderMessages}
                  loading={isLoadingOlderMessages}
                  onLoad={handleLoadOlderMessages}
                />
                <MessageSecurityBanner />

                <div
                  className="relative w-full"
                  style={{ height: `${messageVirtualizer.getTotalSize()}px` }}
                >
                  {messageVirtualizer.getVirtualItems().map((virtualRow) => {
                    const row = virtualMessageRows[virtualRow.index];
                    return (
                  <div
                    key={row.key}
                    data-index={virtualRow.index}
                    ref={messageVirtualizer.measureElement}
                    className="absolute left-0 top-0 w-full space-y-2"
                    style={{ transform: `translateY(${virtualRow.start}px)` }}
                  >

                    {/* Date Divider Pill */}
                    {row.showDateDivider && (
                      <div className="flex justify-center my-3 select-none">
                        <span className="bg-white/95 px-3 py-1 rounded-lg text-[11px] font-bold text-slate-600 shadow-2xs border border-slate-200">
                          {row.dateLabel}
                        </span>
                      </div>
                    )}

                    {row.messages.map((msg, msgIdx) => {
                      const isAgent = msg.sender === 'agent';
                      const senderName = isAgent ? (msg.agentName || effectiveCurrentUser?.name || 'Nguyễn Văn Ánh') : (msg.customerName || 'Khách Hàng');
                      const timeFormatted = new Date(msg.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
                      const reaction = messageReactions[msg.id];

                      // Check if speaker changed from previous and next messages
                      const absoluteMessageIndex = row.startIndex + msgIdx;
                      const prevMsg = displayedMessages[absoluteMessageIndex - 1] || null;
                      const nextMsg = displayedMessages[absoluteMessageIndex + 1] || null;

                      const isSpeakerChangedFromPrev = !prevMsg || prevMsg.sender !== msg.sender || (isAgent && (prevMsg.agentName || '') !== (msg.agentName || '')) || (!isAgent && (prevMsg.customerName || '') !== (msg.customerName || ''));
                      const isSpeakerChangedToNext = !nextMsg || nextMsg.sender !== msg.sender || (isAgent && (nextMsg.agentName || '') !== (msg.agentName || '')) || (!isAgent && (nextMsg.customerName || '') !== (msg.customerName || ''));

                      const isFirstOfTurn = isSpeakerChangedFromPrev;
                      const shouldShowAvatar = isSpeakerChangedToNext;

                      const isHighlighted = highlightedMessageId === msg.id;

                      // Dynamic avatar sources with robust fallbacks
                      const customerAvatarSrc = activeCustomer?.avatar || `https://api.dicebear.com/10.x/clay/svg?topProbability=0&patternProbability=0&seed=${encodeURIComponent(activeCustomer?.phone || msg.customerPhone || msg.customerName || activeThread?.customerPhone || activeThread?.threadId || 'Customer')}`;

                      const isCurrentAgent = Boolean(
                        isAgent &&
                        effectiveCurrentUser &&
                        (
                          !msg.agentName ||
                          msg.agentName.trim().toLowerCase() === effectiveCurrentUser.name.trim().toLowerCase() ||
                          msg.agentName.trim().toLowerCase() === effectiveCurrentUser.email.trim().toLowerCase()
                        )
                      );

                      const matchedUser = isCurrentAgent
                        ? effectiveCurrentUser
                        : (users.find(
                            (u) =>
                              u.name.trim().toLowerCase() === senderName.trim().toLowerCase() ||
                              u.email.trim().toLowerCase() === senderName.trim().toLowerCase()
                          ) || (effectiveCurrentUser && effectiveCurrentUser.name.trim().toLowerCase() === senderName.trim().toLowerCase() ? effectiveCurrentUser : null));

                      const agentAvatarSrc = (isCurrentAgent && effectiveCurrentUser?.avatar)
                        ? effectiveCurrentUser.avatar
                        : (matchedUser?.avatar || effectiveCurrentUser?.avatar || `https://api.dicebear.com/10.x/avataaars/svg?seed=${encodeURIComponent(senderName || 'Agent')}`);

                      const renderReactionPicker = (agentMsg: boolean) => (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className={`absolute top-full mt-1.5 ${agentMsg ? 'right-0' : 'left-0'} flex items-center space-x-1 bg-white/95 backdrop-blur-md px-2 py-1 rounded-full shadow-lg border border-slate-200 z-40 animate-in fade-in zoom-in-95 duration-150 whitespace-nowrap`}
                        >
                          {['👍', '❤️', '😂', '😮', '😢', '🙏'].map((emoji) => {
                            const isSelected = reaction === emoji;
                            return (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => handleReactMessage(msg, emoji)}
                                className={`w-7 h-7 flex items-center justify-center text-base rounded-full hover:scale-135 transition-transform duration-150 cursor-pointer ${
                                  isSelected ? 'bg-emerald-100 scale-110 shadow-2xs' : 'hover:bg-slate-100'
                                }`}
                                title={`Thả ${emoji}`}
                              >
                                {emoji}
                              </button>
                            );
                          })}

                          <div className="w-px h-4 bg-slate-200 mx-0.5" />

                          {/* WhatsApp '+' Button to open extended emoji palette */}
                          <div className="relative">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowExpandedReactionPickerMsgId(showExpandedReactionPickerMsgId === msg.id ? null : msg.id);
                              }}
                              className={`w-7 h-7 flex items-center justify-center rounded-full transition-all cursor-pointer hover:scale-110 shadow-2xs ${
                                showExpandedReactionPickerMsgId === msg.id
                                  ? 'bg-[#1fa855] text-white'
                                  : 'bg-[#f0f2f5] text-[#54656f] hover:bg-[#e2e5e9] hover:text-[#111b21]'
                              }`}
                              title="Thêm biểu cảm khác (+)"
                            >
                              <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
                            </button>

                            {/* Extended WhatsApp Reaction Palette Popover anchored RIGHT BELOW the '+' button */}
                            {showExpandedReactionPickerMsgId === msg.id && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className={`absolute top-full mt-2 ${agentMsg ? 'right-0' : 'left-0'} z-50 animate-in fade-in zoom-in-95 duration-150`}
                              >
                                <EmojiPicker
                                  selectedEmoji={reaction}
                                  onSelect={(emoji) => {
                                    void handleReactMessage(msg, emoji);
                                  }}
                                  onClose={() => setShowExpandedReactionPickerMsgId(null)}
                                  title="Tất cả biểu cảm"
                                  theme="whatsapp"
                                  bodyMaxHeight="max-h-48"
                                  className="flex w-72 sm:w-80 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      );

                      return (
                        <div
                          key={msg.id}
                          id={`msg-${msg.id}`}
                          data-msg-id={msg.id}
                          className={`flex items-end group w-full ${isAgent ? 'justify-end' : 'justify-start'} ${isFirstOfTurn ? 'mt-3' : 'mt-0.5'}`}
                        >
                          {/* Customer Avatar on the Left (Incoming) */}
                          {!isAgent && (
                            <div className="w-8 h-8 mr-2 shrink-0 self-end mb-0.5">
                              {shouldShowAvatar ? (
                                <div className="w-8 h-8 rounded-full overflow-hidden bg-white border border-slate-200 shadow-2xs flex items-center justify-center" title={msg.customerName || 'Khách hàng'}>
                                  <img
                                    src={customerAvatarSrc}
                                    alt={msg.customerName || 'Customer'}
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                    onError={(e) => {
                                      e.currentTarget.src = `https://api.dicebear.com/10.x/clay/svg?topProbability=0&patternProbability=0&seed=${encodeURIComponent(activeCustomer?.phone || msg.customerPhone || msg.customerName || 'C')}`;
                                    }}
                                  />
                                </div>
                              ) : (
                                <div className="w-8 h-8" />
                              )}
                            </div>
                          )}

                          {/* Outgoing Message: Left side Action Buttons (Reply + React) in a Unified Pill */}
                          {isAgent && (
                            <div className={`mr-1.5 self-center flex items-center bg-white/90 backdrop-blur-xs border border-slate-200/90 rounded-full p-0.5 shadow-2xs transition-opacity duration-150 shrink-0 ${
                              activeReactionPickerMsgId === msg.id ? 'opacity-100 z-30' : 'opacity-0 group-hover:opacity-100'
                            }`}>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleReplyMessage(msg);
                                }}
                                className="w-6 h-6 rounded-full text-[#667781] hover:text-[#111b21] hover:bg-[#f0f2f5] flex items-center justify-center transition cursor-pointer hover:scale-105"
                                title="Trả lời tin nhắn này"
                              >
                                <Reply className="w-3.5 h-3.5" />
                              </button>
                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveReactionPickerMsgId(activeReactionPickerMsgId === msg.id ? null : msg.id);
                                  }}
                                  className={`w-6 h-6 rounded-full text-[#667781] hover:text-[#111b21] hover:bg-[#f0f2f5] flex items-center justify-center transition cursor-pointer hover:scale-105 ${
                                    activeReactionPickerMsgId === msg.id ? 'bg-[#f0f2f5] text-[#111b21]' : ''
                                  }`}
                                  title="Thả cảm xúc"
                                >
                                  <Smile className="w-3.5 h-3.5" strokeWidth={1.75} />
                                </button>
                                {activeReactionPickerMsgId === msg.id && renderReactionPicker(true)}
                              </div>
                            </div>
                          )}

                          {/* Message Bubble + Error Container */}
                          <div className={`flex flex-col ${isAgent ? 'items-end' : 'items-start'} max-w-[80%] sm:max-w-[62%]`}>
                            {/* Authentic WhatsApp Message Bubble */}
                            <div
                              data-msg-id={msg.id}
                              className={`relative px-3 pt-1.5 pb-1.5 text-xs select-text transition-all duration-300 ${
                                isAgent
                                  ? 'whatsapp-bubble-out rounded-[7.5px]'
                                  : 'whatsapp-bubble-in rounded-[7.5px]'
                              } ${
                                isHighlighted
                                  ? 'scale-[1.04] shadow-md z-20 origin-center'
                                  : ''
                              }`}
                            >
                            {/* Sender Info for Outgoing Agent Message */}
                            {isAgent && (
                              <div className="flex items-center justify-between gap-2 mb-1 pb-0.5 border-b border-emerald-600/30 text-[10.5px] select-none">
                                <span className="font-bold text-emerald-600 flex items-center gap-1 truncate">
                                  <span
                                    className="truncate"
                                    style={getUserRoleTextStyle(matchedUser)}
                                  >
                                    {senderName}
                                  </span>
                                  {(isCurrentAgent || senderName.trim().toLowerCase() === (effectiveCurrentUser?.name || '').trim().toLowerCase()) && (
                                    <span className="text-[9px] font-semibold bg-emerald-600/10 text-emerald-600 px-1 py-0.2 rounded-xs ml-0.5">
                                      Bạn
                                    </span>
                                  )}
                                </span>
                              </div>
                            )}

                            {/* Message Body Content with Inline Timestamp */}
                            {(() => {
                              const parsed = parseMessageContent(msg.content, msg.replyTo);
                              const content = parsed.cleanContent;
                              const replyQuote = parsed.replyTo;
                              const imgInfo = extractImageInfo(content);

                              const renderQuoteHeader = () => {
                                if (!replyQuote) return null;
                                return (
                                  <div
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleJumpToQuotedMessage(replyQuote.id);
                                    }}
                                    className="mb-1.5 p-1.5 px-2 rounded-md bg-black/5 hover:bg-black/10 active:scale-95 border-l-[3.5px] border-[#1fa855] flex flex-col justify-center transition-all cursor-pointer select-none group/quote"
                                    title="Click để nhảy về tin nhắn được trả lời"
                                  >
                                    <div className="flex items-center gap-1 text-[11px] font-bold text-[#1fa855] leading-tight truncate group-hover/quote:underline">
                                      <Reply className="w-3 h-3 shrink-0" />
                                      <span>{replyQuote.senderName || 'Tin nhắn được trả lời'}</span>
                                    </div>
                                    <p className="text-[11.5px] text-[#54656f] truncate leading-tight mt-0.5 max-w-sm">
                                      {formatMessagePreview(replyQuote.content) || 'Nội dung tin nhắn'}
                                    </p>
                                  </div>
                                );
                              };

                              // 0. Catalog Single Product Message
                              const productInfo = extractProductInfo(content);
                              if (productInfo.isProduct) {
                                return (
                                  <div className="space-y-1">
                                    {renderQuoteHeader()}
                                    <ProductMessageCard
                                      productInfo={productInfo}
                                      timeFormatted={timeFormatted}
                                      isAgent={isAgent}
                                      status={msg.status}
                                      isRealSent={msg.isRealSent}
                                      errorMessage={msg.errorMessage}
                                      onRetry={onRetryMessage ? () => onRetryMessage(msg.id) : undefined}
                                    />
                                  </div>
                                );
                              }

                              const docInfo = extractDocumentInfo(content);

                              // 1. Document / PDF / Quotation / Invoice Message
                              if (docInfo.isDocument) {
                                return (
                                  <div className="space-y-1">
                                    {renderQuoteHeader()}
                                    <DocumentMessageCard
                                      docUrl={docInfo.docUrl}
                                      filename={docInfo.filename}
                                      filesize={docInfo.filesize}
                                      caption={docInfo.caption}
                                      fileExt={docInfo.fileExt}
                                      timeFormatted={timeFormatted}
                                      isAgent={isAgent}
                                      status={msg.status}
                                      isRealSent={msg.isRealSent}
                                      errorMessage={msg.errorMessage}
                                      onRetry={onRetryMessage ? () => onRetryMessage(msg.id) : undefined}
                                    />
                                  </div>
                                );
                              }

                              const audioInfo = extractAudioInfo(content);

                              // 2. Voice / Audio Message (Recorded, Uploaded, Meta Media)
                              if (audioInfo.isAudio && audioInfo.audioUrl) {
                                return (
                                  <div className="space-y-1">
                                    {renderQuoteHeader()}
                                    <VoiceMessagePlayer
                                      src={audioInfo.audioUrl}
                                      caption={audioInfo.caption}
                                      timeFormatted={timeFormatted}
                                      isAgent={isAgent}
                                      status={msg.status}
                                      isRealSent={msg.isRealSent}
                                      errorMessage={msg.errorMessage}
                                      onRetry={onRetryMessage ? () => onRetryMessage(msg.id) : undefined}
                                    />
                                  </div>
                                );
                              }

                              // 2. Incoming voice message placeholder without direct media URL
                              if (audioInfo.isAudio && !audioInfo.audioUrl) {
                                return (
                                  <div className="space-y-1.5 min-w-55">
                                    {renderQuoteHeader()}
                                    <div className="p-3 bg-slate-100/90 rounded-lg border border-slate-200 flex items-center gap-2.5">
                                      <div className="w-9 h-9 rounded-lg bg-emerald-100 text-[#1fa855] flex items-center justify-center shrink-0">
                                        <Mic className="w-5 h-5" />
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <p className="text-xs font-bold text-slate-800 truncate">Tin nhắn thoại WhatsApp</p>
                                        <p className="text-[10px] text-slate-500">Đang đồng bộ từ Meta Cloud...</p>
                                      </div>
                                    </div>
                                    {audioInfo.caption && (
                                      <div className="text-[13px] leading-relaxed whitespace-pre-wrap text-[#111b21] font-normal pt-0.5">
                                        <span>{renderFormattedMessage(audioInfo.caption)}</span>
                                        <span className="float-right ml-2.5 -mb-0.5 mt-1 text-[11px] text-[#667781] flex items-center gap-0.5 select-none font-normal">
                                          <span>{timeFormatted}</span>
                                          {isAgent && (
                                            <MessageDeliveryStatusIcon
                                              status={msg.status}
                                              isRealSent={msg.isRealSent}
                                              errorMessage={msg.errorMessage}
                                              onRetry={onRetryMessage ? () => onRetryMessage(msg.id) : undefined}
                                            />
                                          )}
                                        </span>
                                      </div>
                                    )}
                                    {!audioInfo.caption && (
                                      <div className="flex justify-end pt-0.5">
                                        <span className="text-[11px] text-[#667781] flex items-center gap-0.5 select-none">
                                          <span>{timeFormatted}</span>
                                          {isAgent && (
                                            <MessageDeliveryStatusIcon
                                              status={msg.status}
                                              isRealSent={msg.isRealSent}
                                              errorMessage={msg.errorMessage}
                                              onRetry={onRetryMessage ? () => onRetryMessage(msg.id) : undefined}
                                            />
                                          )}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                );
                              }

                              // 3. Image Message (Uploaded file, Base64, Link, Meta Cloud Media or Incoming Webhook)
                              if (imgInfo.isImage && imgInfo.imgUrl) {
                                return (
                                  <div className="space-y-1">
                                    {renderQuoteHeader()}
                                    <div
                                      onClick={() => setPreviewLightboxImg(imgInfo.imgUrl)}
                                      className="relative rounded-lg overflow-hidden cursor-pointer group border border-slate-200 shadow-2xs max-w-sm max-h-72 bg-slate-900/5 min-h-30 flex items-center justify-center"
                                    >
                                      <img
                                        src={imgInfo.imgUrl}
                                        alt="Hình ảnh"
                                        className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                                        loading="eager"
                                        onLoad={() => scrollToBottom('auto')}
                                      />
                                      <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
                                        <Eye className="w-6 h-6 drop-shadow" />
                                      </div>
                                    </div>
                                    {imgInfo.caption && (
                                      <div className="text-[13.5px] leading-relaxed whitespace-pre-wrap text-[#111b21] wrap-break-word font-normal pt-1">
                                        <span>{renderFormattedMessage(imgInfo.caption)}</span>
                                        <span className="float-right ml-2.5 -mb-0.5 mt-1 text-[11px] text-[#667781] flex items-center gap-0.5 select-none font-normal">
                                          <span>{timeFormatted}</span>
                                          {isAgent && (
                                            <MessageDeliveryStatusIcon
                                              status={msg.status}
                                              isRealSent={msg.isRealSent}
                                              errorMessage={msg.errorMessage}
                                              onRetry={onRetryMessage ? () => onRetryMessage(msg.id) : undefined}
                                            />
                                          )}
                                        </span>
                                      </div>
                                    )}
                                    {!imgInfo.caption && (
                                      <div className="flex justify-end pt-0.5">
                                        <span className="text-[11px] text-[#667781] flex items-center gap-0.5 select-none">
                                          <span>{timeFormatted}</span>
                                          {isAgent && (
                                            <MessageDeliveryStatusIcon
                                              status={msg.status}
                                              isRealSent={msg.isRealSent}
                                              errorMessage={msg.errorMessage}
                                              onRetry={onRetryMessage ? () => onRetryMessage(msg.id) : undefined}
                                            />
                                          )}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                );
                              }

                              // 2. Incoming image placeholder or tag without direct URL like `[image]`, `[image message]`, `[Hình ảnh]`
                              if (
                                content.toLowerCase().startsWith('[image') ||
                                content.toLowerCase().startsWith('[hình ảnh') ||
                                content.toLowerCase() === '[image message]' ||
                                content.toLowerCase() === '[photo]'
                              ) {
                                const caption = content.replace(/^\[(image message|image|hình ảnh|photo)\]?:?\s*/i, '').replace(/\[|\]/g, '').trim();
                                return (
                                  <div className="space-y-1.5 min-w-55">
                                    {renderQuoteHeader()}
                                    <div className="p-3 bg-slate-100/90 rounded-lg border border-slate-200 flex items-center gap-2.5">
                                      <div className="w-9 h-9 rounded-lg bg-emerald-100 text-[#1fa855] flex items-center justify-center shrink-0">
                                        <ImageIcon className="w-5 h-5" />
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <p className="text-xs font-bold text-slate-800 truncate">Hình ảnh WhatsApp</p>
                                        <p className="text-[10px] text-slate-500">Đang đồng bộ từ Meta Cloud...</p>
                                      </div>
                                    </div>
                                    {caption && (
                                      <div className="text-[13px] leading-relaxed whitespace-pre-wrap text-[#111b21] font-normal pt-0.5">
                                        <span>{renderFormattedMessage(caption)}</span>
                                        <span className="float-right ml-2.5 -mb-0.5 mt-1 text-[11px] text-[#667781] flex items-center gap-0.5 select-none font-normal">
                                          <span>{timeFormatted}</span>
                                          {isAgent && (
                                            <MessageDeliveryStatusIcon
                                              status={msg.status}
                                              isRealSent={msg.isRealSent}
                                              errorMessage={msg.errorMessage}
                                              onRetry={onRetryMessage ? () => onRetryMessage(msg.id) : undefined}
                                            />
                                          )}
                                        </span>
                                      </div>
                                    )}
                                    {!caption && (
                                      <div className="flex justify-end pt-0.5">
                                        <span className="text-[11px] text-[#667781] flex items-center gap-0.5 select-none">
                                          <span>{timeFormatted}</span>
                                          {isAgent && (
                                            <MessageDeliveryStatusIcon
                                              status={msg.status}
                                              isRealSent={msg.isRealSent}
                                              errorMessage={msg.errorMessage}
                                              onRetry={onRetryMessage ? () => onRetryMessage(msg.id) : undefined}
                                            />
                                          )}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                );
                              }

                              // Special Interactive Card Templates (Orders, Quotations, Vouchers, Instructions)
                              if (
                                content.startsWith('📄 BÁO GIÁ') ||
                                content.startsWith('📦 ĐƠN HÀNG') ||
                                content.startsWith('🏷️ MÃ GIẢM GIÁ') ||
                                content.startsWith('🔥 SIÊU ƯU ĐÃI') ||
                                content.startsWith('💳 THÔNG TIN THANH TOÁN') ||
                                content.startsWith('🚚 CHÍNH SÁCH VẬN CHUYỂN') ||
                                content.startsWith('📋 HƯỚNG DẪN')
                              ) {
                                const lines = content.split('\n');
                                const headerTitle = lines[0];
                                const bodyLines = lines.slice(1).join('\n');
                                const isQuote = headerTitle.includes('BÁO GIÁ');
                                const isOrder = headerTitle.includes('ĐƠN HÀNG');
                                const isVoucher = headerTitle.includes('MÃ GIẢM GIÁ') || headerTitle.includes('ƯU ĐÃI');

                                return (
                                  <div className="space-y-1.5">
                                    {renderQuoteHeader()}
                                    <div className={`p-2 rounded-lg font-bold text-xs flex items-center justify-between border ${
                                      isOrder ? 'bg-emerald-100/80 text-emerald-900 border-emerald-300' :
                                      isQuote ? 'bg-blue-100/80 text-blue-900 border-blue-300' :
                                      isVoucher ? 'bg-purple-100/80 text-purple-900 border-purple-300' :
                                      'bg-amber-100/80 text-amber-900 border-amber-300'
                                    }`}>
                                      <span className="truncate">{headerTitle}</span>
                                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/90 font-mono shadow-2xs font-extrabold shrink-0">
                                        Yum Card
                                      </span>
                                    </div>
                                    <div className="text-[12.5px] leading-relaxed whitespace-pre-wrap text-[#111b21] font-normal pl-0.5">
                                      <span>{renderFormattedMessage(bodyLines)}</span>
                                      <span className="float-right ml-2.5 -mb-0.5 mt-1 text-[11px] text-[#667781] flex items-center gap-0.5 select-none font-normal">
                                        <span>{timeFormatted}</span>
                                        {isAgent && (
                                          <MessageDeliveryStatusIcon
                                            status={msg.status}
                                            isRealSent={msg.isRealSent}
                                            errorMessage={msg.errorMessage}
                                            onRetry={onRetryMessage ? () => onRetryMessage(msg.id) : undefined}
                                          />
                                        )}
                                      </span>
                                    </div>
                                  </div>
                                );
                              }

                              const firstUrl = extractFirstUrl(content);

                              return (
                                <div className="space-y-1.5">
                                  {renderQuoteHeader()}
                                  {firstUrl && <LinkPreviewCard url={firstUrl} />}
                                  <div className="text-[13.5px] leading-relaxed whitespace-pre-wrap text-[#111b21] wrap-break-word font-normal">
                                    <span>{renderFormattedMessage(content)}</span>
                                    <span className="float-right ml-3 -mb-0.5 mt-1 text-[11px] text-[#667781] flex items-center gap-0.5 select-none font-normal">
                                      <span>{timeFormatted}</span>
                                      {isAgent && (
                                        <MessageDeliveryStatusIcon
                                          status={msg.status}
                                          isRealSent={msg.isRealSent}
                                          errorMessage={msg.errorMessage}
                                          onRetry={onRetryMessage ? () => onRetryMessage(msg.id) : undefined}
                                        />
                                      )}
                                    </span>
                                  </div>
                                </div>
                              );
                            })()}

                            {/* Active Reaction Badge (Positioned overlapping bottom edge) */}
                            {reaction && (
                              <span className="absolute -bottom-2.5 right-2 bg-white px-1.5 py-0.5 rounded-full text-xs shadow border border-[#e9edef] z-10 select-none">
                                {reaction}
                              </span>
                            )}

                          </div>

                          {/* Failure Notice & Retry for Outgoing Agent Messages (Placed BELOW message bubble) */}
                          {isAgent && (msg.status === 'failed' || msg.isRealSent === false) && (
                            <div className="w-full flex justify-end mt-1">
                              <div className="inline-flex items-start sm:items-center gap-1.5 text-rose-600 text-[11px] text-right max-w-full">
                                <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5 sm:mt-0" />
                                <span className="leading-snug break-words">
                                  {msg.errorMessage || 'Meta từ chối gửi tin nhắn'}
                                </span>
                                {onRetryMessage && (
                                  <button
                                    type="button"
                                    onClick={() => onRetryMessage(msg.id)}
                                    className="ml-1 font-bold text-rose-600 hover:text-rose-800 underline underline-offset-2 text-[11px] shrink-0 transition cursor-pointer whitespace-nowrap"
                                  >
                                    Thử lại
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                          {/* Incoming Customer Message: Right side Action Buttons (React + Reply) in a Unified Pill */}
                          {!isAgent && (
                            <div className={`ml-1.5 self-center flex items-center bg-white/90 backdrop-blur-xs border border-slate-200/90 rounded-full p-0.5 shadow-2xs transition-opacity duration-150 shrink-0 ${
                              activeReactionPickerMsgId === msg.id ? 'opacity-100 z-30' : 'opacity-0 group-hover:opacity-100'
                            }`}>
                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveReactionPickerMsgId(activeReactionPickerMsgId === msg.id ? null : msg.id);
                                  }}
                                  className={`w-6 h-6 rounded-full text-[#667781] hover:text-[#111b21] hover:bg-[#f0f2f5] flex items-center justify-center transition cursor-pointer hover:scale-105 ${
                                    activeReactionPickerMsgId === msg.id ? 'bg-[#f0f2f5] text-[#111b21]' : ''
                                  }`}
                                  title="Thả cảm xúc"
                                >
                                  <Smile className="w-3.5 h-3.5" strokeWidth={1.75} />
                                </button>
                                {activeReactionPickerMsgId === msg.id && renderReactionPicker(false)}
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleReplyMessage(msg);
                                }}
                                className="w-6 h-6 rounded-full text-[#667781] hover:text-[#111b21] hover:bg-[#f0f2f5] flex items-center justify-center transition cursor-pointer hover:scale-105"
                                title="Trả lời tin nhắn này"
                              >
                                <Reply className="w-3.5 h-3.5 text-[#667781]" />
                              </button>
                            </div>
                          )}

                          {/* Agent Avatar on the Right (Outgoing) */}
                          {isAgent && (
                            <div className="w-8 h-8 ml-2 shrink-0 self-end mb-0.5">
                              {shouldShowAvatar ? (
                                <div className="w-8 h-8 rounded-full overflow-hidden bg-emerald-50 border border-emerald-300 shadow-2xs flex items-center justify-center" title={senderName}>
                                  <img
                                    src={agentAvatarSrc}
                                    alt={senderName}
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                    onError={(e) => {
                                      e.currentTarget.src = `https://api.dicebear.com/10.x/avataaars/svg?seed=${encodeURIComponent(senderName || 'A')}`;
                                    }}
                                  />
                                </div>
                              ) : (
                                <div className="w-8 h-8" />
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}

                  </div>
                    );
                  })}
                </div>

                <div ref={chatEndRef} />
              </div>

              {/* Floating WhatsApp Scroll-to-Bottom Quick Button */}
              {showScrollBottomBtn && (
                <button
                  type="button"
                  onClick={() => scrollToBottom('smooth')}
                  className="absolute bottom-20 right-6 w-9 h-9 rounded-full bg-white/95 text-[#54656f] hover:text-[#111b21] shadow-lg border border-slate-200 flex items-center justify-center transition hover:scale-110 active:scale-95 cursor-pointer z-20 animate-in fade-in zoom-in-95 duration-150"
                  title="Cuộn xuống tin nhắn mới nhất"
                >
                  <ChevronDown className="w-5 h-5" />
                </button>
              )}

              {/* Floating Slash Commands Autocomplete Popup */}
              {inputText.startsWith('/') && filteredSlashTemplates.length > 0 && (
                <div className="absolute bottom-16 left-16 bg-white border border-slate-300 rounded-2xl p-2 shadow-2xl z-30 w-80 max-h-64 overflow-y-auto animate-fadeIn divide-y divide-slate-100">
                  <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                    <span>Gợi ý câu trả lời nhanh ({filteredSlashTemplates.length})</span>
                    <span>Phím tắt /</span>
                  </div>
                  {filteredSlashTemplates.map((tmpl) => (
                    <div
                      key={tmpl.code}
                      onClick={() => handleSelectSlashTemplate(tmpl.content)}
                      className="p-2 hover:bg-emerald-50 rounded-xl cursor-pointer transition group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#1fa855] group-hover:underline">
                          {tmpl.title}
                        </span>
                        <span className="text-[10px] font-mono bg-emerald-100 text-[#1fa855] px-1.5 py-0.5 rounded font-bold">
                          {tmpl.code}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 truncate mt-0.5">{tmpl.content}</p>
                    </div>
                  ))}
                </div>
              )}


              {/* Hidden File Input for Unified Upload (Images, PDF, Word, Excel, CSV, TXT) */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,text/csv"
                className="hidden"
                onChange={handleFileSelect}
              />

              {/* Hidden File Input for Document Upload (PDF, Word, Excel, CSV, TXT) */}
              <input
                ref={documentInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,text/csv"
                className="hidden"
                onChange={handleDocumentSelect}
              />

              {/* WhatsApp Authentic Reply Preview Banner */}
              {replyingToMessage && (
                <div className="px-3.5 pt-2.5 pb-1 bg-[#f0f2f5] border-t border-[#d1d7db] flex items-center justify-between gap-3 shrink-0 animate-fadeIn">
                  <div className="flex-1 min-w-0 bg-white/90 rounded-lg p-2 border-l-4 border-[#1fa855] shadow-2xs">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#1fa855]">
                      <Reply className="w-3.5 h-3.5 shrink-0" />
                      <span>Đang trả lời {replyingToMessage.sender === 'agent' ? 'Chính mình' : (replyingToMessage.customerName || 'Khách hàng')}</span>
                    </div>
                    <p className="text-xs text-slate-600 truncate mt-0.5 max-w-xl">
                      {formatMessagePreview(replyingToMessage.content)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReplyingToMessage(null)}
                    className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
                    title="Hủy trả lời"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Attached Pending Image Thumbnail Strip (Inline inside input bar) */}
              {pendingImage && (
                <div className="px-3.5 pt-2 pb-1.5 bg-[#f0f2f5] border-t border-[#d1d7db] flex items-center justify-between gap-3 shrink-0 animate-fadeIn">
                  <div className="relative group rounded-xl overflow-hidden border border-slate-300 bg-white shadow-xs w-14 h-14 shrink-0">
                    <img src={pendingImage} alt="attached thumbnail" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setPendingImage(null)}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-white/90 hover:bg-white text-slate-500 hover:text-slate-800 border border-slate-200 shadow-xs flex items-center justify-center transition cursor-pointer"
                      title="Xóa ảnh"
                    >
                      <X className="w-3 h-3 stroke-[2.5]" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPendingImage(null)}
                    className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
                    title="Hủy ảnh đính kèm"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Attached Pending Document Preview Strip */}
              {pendingDocument && (
                <div className="px-3.5 pt-2 pb-1.5 bg-[#f0f2f5] border-t border-[#d1d7db] flex items-center justify-between gap-3 shrink-0 animate-fadeIn">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-600 border border-rose-200 flex flex-col items-center justify-center shrink-0 shadow-2xs">
                      <FileText className="w-5 h-5" />
                      <span className="text-[9px] font-black uppercase tracking-tight">
                        {(pendingDocument.filename.split('.').pop() || 'FILE').toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-800 truncate" title={pendingDocument.filename}>
                        {pendingDocument.filename}
                      </p>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {pendingDocument.filesize > 1024 * 1024
                          ? `${(pendingDocument.filesize / (1024 * 1024)).toFixed(1)} MB`
                          : `${Math.max(1, Math.round(pendingDocument.filesize / 1024))} KB`}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPendingDocument(null)}
                    className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
                    title="Hủy tài liệu đính kèm"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Active Sender Identity Banner */}
              <div className="px-3.5 py-1.5 bg-[#e9edef] border-t border-[#d1d7db] flex items-center justify-between gap-2 text-xs select-none">
                <div className="flex items-center space-x-2 min-w-0">
                  <div className="relative shrink-0">
                    <img
                      src={effectiveCurrentUser?.avatar || `https://api.dicebear.com/10.x/avataaars/svg?seed=${encodeURIComponent(effectiveCurrentUser?.name || 'Agent')}`}
                      alt={effectiveCurrentUser?.name || 'User'}
                      className="w-5 h-5 rounded-full object-cover border border-slate-300 shadow-2xs"
                      onError={(e) => {
                        e.currentTarget.src = `https://api.dicebear.com/10.x/avataaars/svg?seed=${encodeURIComponent(effectiveCurrentUser?.name || 'Agent')}`;
                      }}
                    />
                    <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border border-white"></span>
                  </div>
                  <div className="text-[11.5px] text-slate-700 truncate flex items-center gap-1.5">
                    <span>Đang nhắn tin với tư cách:</span>
                    <strong className="text-slate-900 font-bold truncate">{effectiveCurrentUser?.name || 'Nguyễn Văn Ánh'}</strong>
                    <span className="px-1.5 py-0.2 rounded-full text-[9.5px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                      {effectiveCurrentUser?.role || 'Admin'}
                    </span>
                  </div>
                </div>

                {activeCustomer?.owner && (
                  <div className="text-[10.5px] text-slate-500 hidden sm:flex items-center gap-1 shrink-0">
                    <span>Phụ trách khách:</span>
                    <span className={`font-semibold px-1.5 py-0.2 rounded text-[10px] ${
                      activeCustomer.owner === effectiveCurrentUser?.name
                        ? 'bg-emerald-100 text-emerald-600 font-bold'
                        : 'bg-slate-200 text-slate-700'
                    }`}>
                      {activeCustomer.owner === effectiveCurrentUser?.name ? `${activeCustomer.owner} (Chính bạn)` : activeCustomer.owner}
                    </span>
                  </div>
                )}
              </div>

              {/* WhatsApp Authentic Input Bar or Voice Recording Bar */}
              {isRecording ? (
                <div className="p-2.5 bg-[#f0f2f5] border-t border-[#d1d7db] shrink-0 flex items-center space-x-2 z-10">
                  {/* Cancel Recording (Trash) */}
                  <button
                    type="button"
                    onClick={handleCancelVoiceRecord}
                    className="w-10 h-10 rounded-full text-rose-500 hover:text-rose-700 hover:bg-rose-100 flex items-center justify-center transition cursor-pointer shrink-0"
                    title="Hủy ghi âm"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>

                  {/* Recording Status: pulsing red dot, timer, and animated waveform */}
                  <div className="flex-1 flex items-center gap-3 bg-white px-4 py-2 rounded-lg border border-rose-200 shadow-2xs">
                    <div className="relative flex items-center justify-center shrink-0">
                      <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping absolute opacity-75" />
                      <span className="w-3 h-3 rounded-full bg-rose-600 relative" />
                    </div>

                    <span className="font-mono font-bold text-sm text-slate-800 min-w-12 select-none">
                      {formatRecordingTimer(recordingDuration)}
                    </span>

                    {/* Animated waveform bars */}
                    <div className="flex-1 flex items-center gap-1 h-5 overflow-hidden">
                      {[40, 75, 50, 90, 60, 30, 80, 100, 45, 65, 85, 35, 70, 95, 55, 75, 40, 80].map((h, i) => (
                        <span
                          key={i}
                          className="w-1 bg-rose-400 rounded-full animate-pulse transition-all duration-300"
                          style={{
                            height: `${Math.max(20, (h * ((i + recordingDuration) % 4 + 1)) % 100)}%`,
                            animationDelay: `${(i * 60) % 500}ms`,
                          }}
                        />
                      ))}
                    </div>

                    <span className="text-xs text-rose-600 font-medium hidden sm:inline select-none">
                      Đang ghi âm giọng nói...
                    </span>
                  </div>

                  {/* Stop Recording to Review / Listen */}
                  <button
                    type="button"
                    onClick={handleStopVoiceRecord}
                    className="w-10 h-10 rounded-full bg-rose-100 hover:bg-rose-200 text-rose-600 border border-rose-300 flex items-center justify-center transition cursor-pointer shrink-0 shadow-2xs"
                    title="Dừng ghi âm để nghe lại"
                  >
                    <Square className="w-4 h-4 fill-current" />
                  </button>

                  {/* Send Voice Recording Immediately */}
                  <button
                    type="button"
                    onClick={handleSendVoiceRecord}
                    className="w-10 h-10 rounded-full bg-[#1fa855] hover:bg-[#1a924a] text-white flex items-center justify-center transition shadow-md cursor-pointer shrink-0"
                    title="Gửi ngay tin nhắn thoại"
                  >
                    <Send className="w-4 h-4 ml-0.5" />
                  </button>
                </div>
              ) : isRecorded ? (
                <div className="p-2.5 bg-[#f0f2f5] border-t border-[#d1d7db] shrink-0 flex items-center space-x-2 z-10">
                  {/* Cancel / Discard Recording to re-record */}
                  <button
                    type="button"
                    onClick={handleCancelVoiceRecord}
                    className="w-10 h-10 rounded-full text-rose-500 hover:text-rose-700 hover:bg-rose-100 flex items-center justify-center transition cursor-pointer shrink-0"
                    title="Xóa bản ghi âm để thu lại"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>

                  {/* Audio Preview Player */}
                  <div className="flex-1 flex items-center gap-3 bg-white px-3.5 py-1.5 rounded-lg border border-emerald-200 shadow-2xs min-w-0">
                    {/* Play / Pause button */}
                    <button
                      type="button"
                      onClick={handleTogglePlayPreview}
                      className="w-8 h-8 rounded-full bg-[#1fa855] hover:bg-[#1a924a] text-white flex items-center justify-center transition shadow-2xs active:scale-95 cursor-pointer shrink-0"
                      title={isPreviewPlaying ? 'Tạm dừng nghe lại' : 'Nghe lại bản ghi âm'}
                    >
                      {isPreviewPlaying ? (
                        <Pause className="w-4 h-4 fill-current" />
                      ) : (
                        <Play className="w-4 h-4 fill-current ml-0.5" />
                      )}
                    </button>

                    {/* Scrubber / Progress track */}
                    <div className="flex-1 flex flex-col justify-center gap-1 min-w-0">
                      <div
                        onClick={handleSeekPreview}
                        className="relative w-full h-3 flex items-center cursor-pointer group"
                        title="Bấm để tua đoạn nghe lại"
                      >
                        <div className="w-full h-1 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#1fa855] rounded-full transition-all duration-75"
                            style={{ width: `${previewPercent}%` }}
                          />
                        </div>
                        <div
                          className="absolute w-2.5 h-2.5 bg-[#1fa855] rounded-full shadow-xs -ml-1 opacity-90 group-hover:scale-125 transition"
                          style={{ left: `${previewPercent}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                        <span>
                          {formatRecordingTimer(
                            isPreviewPlaying || previewCurrentTime > 0
                              ? previewCurrentTime
                              : (recordedAudio?.duration || recordingDuration)
                          )}
                        </span>
                        <span className="text-[10px] text-emerald-700 font-semibold font-sans">
                          Bản ghi đã sẵn sàng
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Send Recorded Voice Message */}
                  <button
                    type="button"
                    onClick={handleSendVoiceRecord}
                    className="w-10 h-10 rounded-full bg-[#1fa855] hover:bg-[#1a924a] text-white flex items-center justify-center transition shadow-md cursor-pointer shrink-0 animate-bounce duration-1000"
                    title="Gửi tin nhắn thoại"
                  >
                    <Send className="w-4 h-4 ml-0.5" />
                  </button>

                  {/* Audio Element for Review Playback */}
                  <audio
                    ref={previewAudioRef}
                    src={recordedAudio?.dataUrl}
                    preload="auto"
                    onTimeUpdate={(e) => setPreviewCurrentTime(e.currentTarget.currentTime)}
                    onEnded={() => {
                      setIsPreviewPlaying(false);
                      setPreviewCurrentTime(0);
                    }}
                  />
                </div>
              ) : (
                <div className="p-2.5 bg-[#f0f2f5] border-t border-[#d1d7db] shrink-0 flex items-center space-x-1.5 z-10">
                  {/* Emoji Trigger */}
                  <div className="relative">
                    <button
                      ref={emojiButtonRef}
                      type="button"
                      onClick={() => {
                        setShowEmojiPicker(!showEmojiPicker);
                        setShowAttachMenu(false);
                        setShowTemplatePicker(false);
                      }}
                      className={`p-2 rounded-full transition cursor-pointer ${
                        showEmojiPicker
                          ? 'bg-slate-200 text-[#1fa855]'
                          : 'text-[#54656f] hover:text-[#111b21] hover:bg-slate-200/60'
                      }`}
                      title="Biểu tượng cảm xúc"
                      aria-label="Biểu tượng cảm xúc"
                      aria-expanded={showEmojiPicker}
                    >
                      <Smile className="w-5 h-5" />
                    </button>

                    {showEmojiPicker && (
                      <div ref={emojiPickerRef} className="absolute bottom-full mb-3 left-0 z-50 animate-fadeIn">
                        <EmojiPicker
                          onSelect={handleAddEmoji}
                          onClose={() => setShowEmojiPicker(false)}
                          theme="whatsapp"
                          title="Biểu tượng cảm xúc"
                          className="flex w-80 sm:w-84 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-2xl"
                        />
                      </div>
                    )}
                  </div>

                  {/* Attachment Button: Directly opens native file chooser for any file */}
                  <button
                    type="button"
                    onClick={() => {
                      if (fileInputRef.current) fileInputRef.current.click();
                      setShowEmojiPicker(false);
                      setShowTemplatePicker(false);
                    }}
                    className="p-2 text-[#54656f] hover:text-[#111b21] hover:bg-slate-200/60 rounded-full transition cursor-pointer"
                    title="Đính kèm tệp (Hình ảnh, PDF, Báo giá, Hóa đơn, Excel, Word...)"
                    aria-label="Đính kèm tệp"
                  >
                    <Paperclip className="w-5 h-5" />
                  </button>

                  {/* Catalog Product Picker Trigger */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsProductPickerOpen(true);
                      setShowEmojiPicker(false);
                      setShowTemplatePicker(false);
                    }}
                    className="p-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-100/70 rounded-full transition cursor-pointer"
                    title="Gửi sản phẩm từ Meta Catalog"
                    aria-label="Gửi sản phẩm Meta Catalog"
                  >
                    <Package className="w-5 h-5" />
                  </button>

                  {/* Quick Canned Template Trigger */}
                  <div className="relative">
                    <button
                      ref={templateButtonRef}
                      type="button"
                      onClick={() => {
                        setShowTemplatePicker(!showTemplatePicker);
                        setShowEmojiPicker(false);
                        setShowAttachMenu(false);
                      }}
                      className={`p-2 rounded-full transition cursor-pointer ${
                        showTemplatePicker
                          ? 'bg-amber-100 text-amber-700'
                          : 'text-amber-600 hover:text-amber-700 hover:bg-amber-100/60'
                      }`}
                      title="Mẫu tin nhắn nhanh (/)"
                      aria-label="Mẫu tin nhắn nhanh"
                      aria-expanded={showTemplatePicker}
                    >
                      <Zap className="w-5 h-5 fill-amber-500 text-amber-500" />
                    </button>

                    {showTemplatePicker && (
                      <div
                        ref={templatePickerRef}
                        className="absolute bottom-full mb-3 left-0 bg-white border border-slate-300 rounded-2xl p-3 shadow-2xl z-50 w-80 max-h-72 overflow-y-auto animate-fadeIn divide-y divide-slate-100"
                      >
                        <div className="flex items-center justify-between pb-2 mb-1">
                          <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                            <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                            Mẫu Tin Nhắn Nhanh (Canned Reply)
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowTemplatePicker(false)}
                            className="text-slate-400 hover:text-slate-600 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {QUICK_TEMPLATES.map((tmpl) => (
                          <div
                            key={tmpl.code}
                            onClick={() => {
                              handleApplyTemplate(tmpl.content);
                              setShowTemplatePicker(false);
                            }}
                            className="p-2 hover:bg-emerald-50 rounded-xl cursor-pointer transition group"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-[#1fa855] group-hover:underline">
                                {tmpl.title}
                              </span>
                              <span className="text-[10px] font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">
                                {tmpl.code}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-600 truncate mt-0.5">{tmpl.content}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Textarea Input with Clipboard Paste support */}
                  <div className="flex-1 bg-white rounded-lg px-3.5 py-2 transition shadow-2xs">
                    <textarea
                      ref={textareaRef}
                      rows={1}
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={handleKeyDown}
                      onPaste={handlePaste}
                      placeholder={
                        pendingImage
                          ? "Nhập chú thích cho ảnh (Tùy chọn)..."
                          : pendingDocument
                          ? "Nhập ghi chú cho tài liệu (Tùy chọn)..."
                          : "Nhập tin nhắn (Gõ / để chọn câu trả lời nhanh)..."
                      }
                      className="w-full bg-transparent text-[14px] text-[#111b21] focus:outline-none resize-none placeholder-[#8696a0] max-h-24 leading-5"
                    />
                  </div>

                  {/* Mic vs Send Button */}
                  {inputText.trim() || pendingImage || pendingDocument ? (
                    <button
                      type="button"
                      onClick={() => handleSend()}
                      className="w-10 h-10 rounded-full bg-[#1fa855] hover:bg-[#1fa855] text-white flex items-center justify-center transition shadow-md cursor-pointer shrink-0"
                      title="Gửi tin nhắn (Enter)"
                    >
                      <Send className="w-4 h-4 ml-0.5" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleStartVoiceRecord}
                      className="w-10 h-10 rounded-full text-[#54656f] hover:text-[#111b21] hover:bg-slate-200/60 flex items-center justify-center transition cursor-pointer shrink-0"
                      title="Ghi âm thoại thật (Microphone)"
                    >
                      <Mic className="w-5 h-5" />
                    </button>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
              <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center text-slate-400 mb-3">
                <MessageSquare className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-slate-700">WhatsApp Web CRM</h3>
              <p className="text-xs text-slate-500 max-w-sm mt-1">
                Chọn một cuộc trò chuyện ở danh sách bên trái để bắt đầu nhắn tin và chăm sóc khách hàng.
              </p>
            </div>
          )}
        </div>

        {/* ========================================================
            COLUMN 3: COLLAPSIBLE CRM CUSTOMER PROFILE & QUICK ORDER DRAWER
           ======================================================== */}
        <CustomerChatDrawer
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          activeThread={activeThread}
          activeCustomer={activeCustomer}
          users={users}
          internalNotes={internalNotes}
          onOpenAddOrder={onOpenAddOrder}
          onSelectCustomerDetail={onSelectCustomerDetail}
          onAddInternalNote={addInternalNote}
          onDeleteInternalNote={handleDeleteInternalNote}
          onSelectUserForInfo={setSelectedInfoUser}
          currentUserName={effectiveCurrentUser?.name || 'Tư vấn viên'}
        />

      </div>

      <MessageLightbox imageUrl={previewLightboxImg} onClose={() => setPreviewLightboxImg(null)} />
      <UserInfoModal user={selectedInfoUser} onClose={() => setSelectedInfoUser(null)} />

      {/* Meta Catalog Product Picker Modal */}
      <ProductPickerModal
        isOpen={isProductPickerOpen}
        onClose={() => setIsProductPickerOpen(false)}
        onSendProduct={(product, catalogId, customText) => {
          if (!activeThread) return;
          const tag = `[product:${JSON.stringify({
            catalog_id: catalogId,
            product_retailer_id: product.retailerId,
            name: product.name,
            price: product.price,
            currency: product.currency,
            image: product.imageUrl,
          })}]`;
          const finalContent = customText ? `${tag}\n${customText}` : tag;
          const targetId = activeThread.customer?.id || activeThread.lastMessage.customerId || activeThread.threadId;
          const targetPhone = activeThread.customerPhone || activeThread.customer?.phone || activeThread.lastMessage.customerPhone;
          const targetName = activeThread.customerName || activeThread.customer?.name || activeThread.lastMessage.customerName;
          onSendMessage(
            targetId,
            finalContent,
            'WhatsApp',
            targetPhone,
            targetName,
            selectedPhoneId
          );
        }}
      />

    </div>
  );
};
