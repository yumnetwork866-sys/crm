import React, { useEffect, useState } from 'react';
import {
  MessageSquare,
  Search,
  Send,
  CheckCheck,
  Check,
  User,
  ShoppingBag,
  Filter,
  ArrowUpRight,
  Trash2,
  Video,
  MoreVertical,
  Paperclip,
  Smile,
  Zap,
  Sparkles,
  Pin,
  Clock,
  X,
  Info,
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
  Volume2,
  VolumeX,
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
  Reply
} from 'lucide-react';
import { Customer, CentralMessage, MessageChannel, AppUser } from '../../types';
import { getCustomerGroup, formatVND, CUSTOMER_GROUPS, formatPhoneWithCountryCode } from '../../utils/crmUtils';
import { INITIAL_USERS } from '../../data/mockData';
import { EXTENDED_EMOJIS, POPULAR_EMOJIS, QUICK_TEMPLATES, STATUS_CONFIG } from '../../features/messages/constants';
import type { ActiveMessageFilter, ConversationStatus, InternalNote } from '../../features/messages/types';
import { extractImageInfo, parseMessageContent } from '../../features/messages/utils/messageContent';
import { useBusinessPhones } from '../../features/messages/hooks/useBusinessPhones';
import { useMessageComposer } from '../../features/messages/hooks/useMessageComposer';
import { useMessageInteractions } from '../../features/messages/hooks/useMessageInteractions';
import { useMessagePreferences } from '../../features/messages/hooks/useMessagePreferences';
import { useMessageThreads } from '../../features/messages/hooks/useMessageThreads';
import { useMessageViewport } from '../../features/messages/hooks/useMessageViewport';
import { useWhatsAppSessionWindow } from '../../features/messages/hooks/useWhatsAppSessionWindow';
import { playPopSound } from '../../features/messages/utils/playPopSound';
import { BusinessPhoneSelector } from '../../features/messages/components/BusinessPhoneSelector';
import { LoadOlderMessagesButton } from '../../features/messages/components/LoadOlderMessagesButton';
import { MessageLightbox } from '../../features/messages/components/MessageLightbox';
import { MessageSecurityBanner } from '../../features/messages/components/MessageSecurityBanner';

interface CentralizedMessageViewProps {
  messages: CentralMessage[];
  customers: Customer[];
  currentUser?: AppUser | null;
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
  selectedCustomerId,
  onSelectCustomerThread,
  onSendMessage,
  onOpenAddOrder,
  onSelectCustomerDetail,
  onDeleteThread,
  onDeleteMessage,
  hasOlderMessages = false,
  isLoadingOlderMessages = false,
  onLoadOlderMessages,
}) => {
  const [activeFilter, setActiveFilter] = useState<ActiveMessageFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [isChatSearchOpen, setIsChatSearchOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(true);
  const [drawerTab, setDrawerTab] = useState<'overview' | 'notes'>('overview');
  const {
    soundEnabled,
    setSoundEnabled,
    internalNotes,
    threadStatuses,
    pinnedThreadIds,
    togglePinThread,
    updateThreadStatus: handleUpdateThreadStatus,
    addInternalNote,
    deleteInternalNote: handleDeleteInternalNote,
  } = useMessagePreferences();

  // Media lightbox is view-only state; composer media state lives in useMessageComposer.
  const [previewLightboxImg, setPreviewLightboxImg] = useState<string | null>(null);

  const [newNoteText, setNewNoteText] = useState('');

  const isAdmin = currentUser?.role === 'Admin';

  const handleAddInternalNote = (customerId: string) => {
    if (!newNoteText.trim()) return;
    const note: InternalNote = {
      id: `note_${Date.now()}`,
      author: currentUser?.name || 'Nguyễn Văn Ánh',
      content: newNoteText.trim(),
      timestamp: new Date().toISOString(),
    };
    addInternalNote(customerId, note);
    setNewNoteText('');
  };

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

  // Auto-mark active thread as read
  useEffect(() => {
    if (activeThread && activeThread.unreadCount > 0) {
      onSelectCustomerThread(activeThread.threadId, activeThread.customerPhone, activeThread.messages.map((m) => m.id));
    }
  }, [activeThread?.threadId, activeThread?.unreadCount, activeThread?.customerPhone, onSelectCustomerThread]);

  const { currentTime, session24hInfo } = useWhatsAppSessionWindow(activeThread);

  const {
    businessPhones,
    selectedPhoneId,
    selectBusinessPhone: handleSelectBusinessPhone,
  } = useBusinessPhones();
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
    replyingToMessage,
    setReplyingToMessage,
    textareaRef,
    fileInputRef,
    filteredSlashTemplates,
    handleSelectSlashTemplate,
    handleApplyTemplate,
    handleAddEmoji,
    handlePaste,
    handleFileSelect,
    handleSend,
    handleKeyDown,
    handleReplyMessage: startReplyMessage,
  } = useMessageComposer({ activeThread, selectedPhoneId, soundEnabled, onSendMessage });
  const {
    messageReactions,
    activeReactionPickerMsgId,
    setActiveReactionPickerMsgId,
    showExpandedReactionPickerMsgId,
    setShowExpandedReactionPickerMsgId,
    highlightedMessageId,
    copiedMsgId,
    handleJumpToQuotedMessage,
    handleCopyMessage,
    handleReactMessage,
    handleReplyMessage,
  } = useMessageInteractions({
    activeThread,
    selectedPhoneId,
    onReplyMessage: startReplyMessage,
  });

  const getSlaWarning = (thread: { messages: CentralMessage[]; lastMessage: CentralMessage }) => {
    if (thread.lastMessage.sender !== 'customer') return null;
    const elapsedMs = currentTime - new Date(thread.lastMessage.timestamp).getTime();
    const minutes = Math.floor(elapsedMs / (1000 * 60));
    if (minutes < 15) return null;
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      return { label: `Chờ > ${hours}h`, minutes, isSevere: true };
    }
    return { label: `Chờ ${minutes}p`, minutes, isSevere: false };
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 h-full w-full overflow-hidden">
      {/* Main WhatsApp 3-Column Studio */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 h-full w-full bg-white overflow-hidden">
        
        {/* ========================================================
            COLUMN 1: THREAD LIST & SEARCH (Fixed width flex panel)
           ======================================================== */}
        <div className={`${isDrawerOpen ? 'w-full lg:w-[320px] xl:w-[360px]' : 'w-full lg:w-[380px] xl:w-[420px]'} bg-[#f0f2f5] border-r border-slate-300 flex flex-col h-full overflow-hidden select-none shrink-0 transition-all duration-200`}>
          
          {/* WhatsApp Left Header with Integrated WABA Phone Selector */}
          <div className="p-2.5 bg-[#f0f2f5] border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
            <BusinessPhoneSelector
              phones={businessPhones}
              selectedPhoneId={selectedPhoneId}
              onSelect={handleSelectBusinessPhone}
            />

            <div className="flex items-center space-x-1 text-slate-600 shrink-0">
              <button
                onClick={() => setActiveFilter(activeFilter === 'unread' ? 'all' : 'unread')}
                className={`p-1.5 rounded-lg border transition cursor-pointer ${
                  activeFilter === 'unread'
                    ? 'bg-[#008069] text-white border-[#008069] shadow-xs'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 shadow-2xs'
                }`}
                title="Lọc tin chưa đọc"
              >
                <Filter className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Search Box */}
          <div className="px-3 py-2 bg-[#f0f2f5] border-b border-slate-200">
            <div className="relative flex items-center bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 focus-within:border-[#00a884] focus-within:ring-1 focus-within:ring-[#00a884] shadow-2xs transition">
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
          <div className="px-3 py-2 bg-[#f0f2f5] border-b border-slate-200 flex space-x-1.5 overflow-x-auto no-scrollbar shrink-0">
            {([
              { id: 'all', label: `Tất cả (${threads.length})` },
              { id: 'unread', label: `Chưa đọc (${threads.reduce((sum, t) => sum + t.unreadCount, 0)})` },
              { id: 'vip', label: 'Khách VIP' },
              { id: 'repeat', label: 'Đã mua 1 lần' },
              { id: 'new', label: 'Khách mới' },
            ] satisfies Array<{ id: ActiveMessageFilter; label: string }>).map((f) => (
              <button
                key={f.id}
                onClick={() => setActiveFilter(f.id)}
                className={`px-3 py-1 rounded-lg text-[11px] transition whitespace-nowrap cursor-pointer ${
                  activeFilter === f.id
                    ? 'bg-[#008069] text-white border border-[#008069] font-bold shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 font-semibold shadow-2xs'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Thread List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 bg-white whatsapp-scrollbar">
            {filteredThreads.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                Không tìm thấy đoạn chat nào phù hợp.
              </div>
            ) : (
              filteredThreads.map((thread) => {
                const isSelected = activeThread?.threadId === thread.threadId;
                const hasUnread = thread.unreadCount > 0;
                const isAgentLast = thread.lastMessage.sender === 'agent';
                const threadTime = new Date(thread.lastMessage.timestamp);
                const isToday = threadTime.toDateString() === new Date().toDateString();
                const timeString = isToday
                  ? threadTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                  : threadTime.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });

                const slaWarning = getSlaWarning(thread);
                const currentStatusKey = threadStatuses[thread.threadId] || 'consulting';
                const currentStatus = STATUS_CONFIG[currentStatusKey];

                return (
                  <div
                    key={thread.threadId}
                    onClick={() => onSelectCustomerThread(thread.threadId, thread.customerPhone, thread.messages.map((m) => m.id))}
                    className={`group px-3 py-3 flex items-start space-x-3 cursor-pointer transition relative ${
                      isSelected
                        ? 'bg-[#f0f2f5] border-l-4 border-[#008069]'
                        : 'hover:bg-[#f5f6f6]'
                    }`}
                  >
                    {/* Avatar with Dicebear Adventurer / custom photo & online dot */}
                    <div className="relative shrink-0 mt-0.5">
                      <div className="w-11 h-11 rounded-full bg-emerald-50 border border-slate-200/80 flex items-center justify-center shadow-sm overflow-hidden">
                        <img
                          src={thread.customer?.avatar || `https://api.dicebear.com/10.x/adventurer/svg?seed=${encodeURIComponent(thread.customerPhone || thread.customerName || thread.threadId)}`}
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
                        <span className={`text-[10px] shrink-0 ml-1 ${hasUnread ? 'text-[#00a884] font-bold' : 'text-slate-400'}`}>
                          {timeString}
                        </span>
                      </div>

                      {/* Phone & Status / Group Tags */}
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className="text-[10px] text-slate-500 truncate font-mono">
                          {formatPhoneWithCountryCode(thread.customerPhone, thread.customer?.country) || thread.customerPhone || 'WhatsApp'}
                        </span>
                        
                        {/* Pipeline Status Tag */}
                        <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold border ${currentStatus.bg} ${currentStatus.text} ${currentStatus.border}`}>
                          {currentStatus.label}
                        </span>

                        {/* CRM Group Tag */}
                        {thread.customer && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-slate-100 text-slate-600 border border-slate-200">
                            {thread.customer.totalOrders >= 2 ? 'VIP' : (thread.customer.totalOrders === 1 ? '1 Đơn' : 'Mới')}
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
                          {isAgentLast && (
                            <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb] shrink-0" />
                          )}
                          <span className="truncate">
                            {(() => {
                              const c = thread.lastMessage.content;
                              if (c.startsWith('data:image/') || c.startsWith('/uploads/') || c.startsWith('/api/meta/media/') || c.match(/^https?:\/\/.*\.(png|jpg|jpeg|gif|webp)/i)) {
                                const parts = c.split('\n');
                                const cap = parts.slice(1).join(' ');
                                return cap ? `📷 ${cap}` : '📷 [Hình ảnh]';
                              }
                              if (c.toLowerCase().startsWith('[image') || c.toLowerCase().startsWith('[hình ảnh') || c.toLowerCase() === '[photo]') {
                                return `📷 ${c.replace(/\[image message\]/gi, '[Hình ảnh]').replace(/\[image\]/gi, '[Hình ảnh]')}`;
                              }
                              return c;
                            })()}
                          </span>
                        </p>

                        <div className="flex items-center space-x-1.5 shrink-0">
                          {thread.isPinned && (
                            <Pin className="w-3.5 h-3.5 rotate-45 shrink-0" stroke="#008069" fill="#008069" strokeWidth={2.2} />
                          )}
                          {hasUnread && (
                            <span className="min-w-[18px] h-[18px] px-1 bg-[#25d366] rounded-full text-[10px] text-white font-extrabold flex items-center justify-center shadow-2xs">
                              {thread.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Pin & Admin Quick Action buttons on hover (Clean standalone circular buttons) */}
                    <div className="absolute right-2.5 top-2.5 hidden group-hover:flex items-center space-x-1.5 z-10 animate-in fade-in duration-100">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePinThread(thread.threadId);
                        }}
                        className={`w-7 h-7 rounded-full border shadow-sm flex items-center justify-center transition-all cursor-pointer hover:scale-110 ${
                          thread.isPinned
                            ? 'bg-[#e6f7f2] border-[#008069] hover:bg-[#d1f2e8]'
                            : 'bg-white hover:bg-[#f1f5f9] border-[#cbd5e1]'
                        }`}
                        title={thread.isPinned ? 'Bỏ ghim hội thoại' : 'Ghim hội thoại lên đầu'}
                      >
                        <Pin
                          className="w-3.5 h-3.5 rotate-45"
                          stroke={thread.isPinned ? '#008069' : '#334155'}
                          fill={thread.isPinned ? '#008069' : 'none'}
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
              })
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
                        src={activeCustomer?.avatar || `https://api.dicebear.com/10.x/adventurer/svg?seed=${encodeURIComponent(activeThread.customerPhone || activeThread.customerName || activeThread.threadId)}`}
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
                      {session24hInfo && (
                        <div
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold border flex items-center gap-1 select-none shadow-2xs ${
                            session24hInfo.isExpired
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : session24hInfo.hours < 2
                              ? 'bg-rose-50 text-rose-700 border-rose-300 animate-pulse'
                              : session24hInfo.hours < 12
                              ? 'bg-amber-50 text-amber-800 border-amber-300'
                              : 'bg-emerald-50 text-[#00793d] border-emerald-300'
                          }`}
                          title={`Cửa sổ 24h phản hồi miễn phí Meta WhatsApp Business. ${
                            session24hInfo.isExpired
                              ? 'Đã hết hạn 24h - Cần gửi Template có phí để tiếp tục nhắn tin'
                              : `Hết hạn lúc ${session24hInfo.expiresAt}. Nhắn tin tự do không mất phí template.`
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              session24hInfo.isExpired
                                ? 'bg-rose-500'
                                : session24hInfo.hours < 2
                                ? 'bg-rose-500 animate-ping'
                                : session24hInfo.hours < 12
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                            }`}
                          ></span>
                          <span>{session24hInfo.formattedTime}</span>
                        </div>
                      )}

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
                      {activeCustomer?.owner && (
                        <span className="text-[11px] text-slate-500 flex items-center gap-1">
                          <span>• Phụ trách:</span>
                          <span className="font-semibold text-slate-700">{activeCustomer.owner}</span>
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Right Action Icons in Header */}
                <div className="flex items-center space-x-2 text-slate-600 shrink-0">
                  {/* Sound Mute/Unmute Toggle */}
                  <button
                    onClick={() => {
                      const updated = !soundEnabled;
                      setSoundEnabled(updated);
                      if (updated) playPopSound();
                    }}
                    className={`p-2 rounded-lg border transition cursor-pointer ${
                      soundEnabled
                        ? 'bg-white text-[#008069] border-slate-300 hover:bg-slate-50 shadow-2xs'
                        : 'bg-slate-100 text-slate-400 border-slate-200'
                    }`}
                    title={soundEnabled ? 'Âm thanh thông báo: Bật' : 'Âm thanh thông báo: Tắt'}
                  >
                    {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                  </button>

                  <button
                    onClick={() => setIsChatSearchOpen(!isChatSearchOpen)}
                    className={`p-2 rounded-lg border transition cursor-pointer ${
                      isChatSearchOpen
                        ? 'bg-[#008069] text-white border-[#008069] shadow-xs'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 shadow-2xs'
                    }`}
                    title="Tìm kiếm trong đoạn chat"
                  >
                    <Search className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => setIsDrawerOpen(!isDrawerOpen)}
                    className={`p-2 rounded-lg border transition cursor-pointer ${
                      isDrawerOpen
                        ? 'bg-[#008069] text-white border-[#008069] shadow-xs'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 shadow-2xs'
                    }`}
                    title="Bật/Tắt Hồ sơ CRM"
                  >
                    <Menu className="w-4 h-4" />
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

                {groupedMessagesByDate.map((group, groupIndex) => (
                  <div key={groupIndex} className="space-y-2">
                    
                    {/* Date Divider Pill */}
                    <div className="flex justify-center my-3 sticky top-1 z-10">
                      <span className="bg-white/90 backdrop-blur-sm px-3 py-1 rounded-lg text-[11px] font-bold text-slate-600 shadow-sm border border-slate-200/80">
                        {group.dateLabel}
                      </span>
                    </div>

                    {group.msgs.map((msg, msgIdx) => {
                      const isAgent = msg.sender === 'agent';
                      const senderName = isAgent ? (msg.agentName || currentUser?.name || 'Nguyễn Văn Ánh') : msg.customerName;
                      const timeFormatted = new Date(msg.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
                      const reaction = messageReactions[msg.id];

                      // Check if speaker changed from previous and next messages
                      const prevMsg = msgIdx > 0 ? group.msgs[msgIdx - 1] : null;
                      const nextMsg = msgIdx < group.msgs.length - 1 ? group.msgs[msgIdx + 1] : null;

                      const isSpeakerChangedFromPrev = !prevMsg || prevMsg.sender !== msg.sender || (isAgent && (prevMsg.agentName || '') !== (msg.agentName || '')) || (!isAgent && (prevMsg.customerName || '') !== (msg.customerName || ''));
                      const isSpeakerChangedToNext = !nextMsg || nextMsg.sender !== msg.sender || (isAgent && (nextMsg.agentName || '') !== (msg.agentName || '')) || (!isAgent && (nextMsg.customerName || '') !== (msg.customerName || ''));

                      const isFirstOfTurn = isSpeakerChangedFromPrev;
                      const shouldShowAvatar = isSpeakerChangedToNext;

                      const isHighlighted = highlightedMessageId === msg.id;

                      // Dynamic avatar sources with robust fallbacks
                      const customerAvatarSrc = activeCustomer?.avatar || `https://api.dicebear.com/10.x/adventurer/svg?seed=${encodeURIComponent(msg.customerPhone || msg.customerName || activeThread?.customerPhone || activeThread?.threadId || 'Customer')}`;
                      const matchedUser = INITIAL_USERS.find((u) => u.name.toLowerCase() === senderName.toLowerCase())
                        || (currentUser && currentUser.name.toLowerCase() === senderName.toLowerCase() ? currentUser : null);
                      const agentAvatarSrc = matchedUser?.avatar || (currentUser?.avatar && isAgent ? currentUser.avatar : `https://api.dicebear.com/10.x/avataaars/svg?seed=${encodeURIComponent(senderName || 'Agent')}`);

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
                                      e.currentTarget.src = `https://api.dicebear.com/10.x/adventurer/svg?seed=${encodeURIComponent(msg.customerName || 'C')}`;
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
                            <div className="mr-1.5 mb-1 flex items-center bg-white/90 backdrop-blur-xs border border-slate-200/90 rounded-full p-0.5 shadow-2xs opacity-0 group-hover:opacity-100 transition-opacity duration-150 shrink-0">
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
                            </div>
                          )}

                          {/* Authentic WhatsApp Message Bubble */}
                          <div
                            data-msg-id={msg.id}
                            className={`relative max-w-[80%] sm:max-w-[62%] px-3 pt-1.5 pb-1.5 text-xs select-text transition-all duration-300 ${
                              isAgent
                                ? `whatsapp-bubble-out ${isFirstOfTurn ? 'rounded-[7.5px] rounded-tr-none' : 'rounded-[7.5px]'}`
                                : `whatsapp-bubble-in ${isFirstOfTurn ? 'rounded-[7.5px] rounded-tl-none' : 'rounded-[7.5px]'}`
                            } ${
                              isHighlighted
                                ? 'scale-[1.04] shadow-md z-20 origin-center'
                                : ''
                            }`}
                          >
                            {/* Floating WhatsApp Reaction Picker Bar (Absolute floating overlay, zero layout shift) */}
                            {activeReactionPickerMsgId === msg.id && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className={`absolute -top-11 ${isAgent ? 'right-0' : 'left-0'} flex items-center space-x-1 bg-white/95 backdrop-blur-md px-2 py-1 rounded-full shadow-lg border border-slate-200 z-30 animate-in fade-in zoom-in-95 duration-150`}
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

                                <div className="w-[1px] h-4 bg-slate-200 mx-0.5" />

                                {/* WhatsApp '+' Button to open extended emoji palette */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowExpandedReactionPickerMsgId(showExpandedReactionPickerMsgId === msg.id ? null : msg.id);
                                  }}
                                  className={`w-7 h-7 flex items-center justify-center rounded-full transition-all cursor-pointer hover:scale-110 shadow-2xs ${
                                    showExpandedReactionPickerMsgId === msg.id
                                      ? 'bg-[#00a884] text-white'
                                      : 'bg-[#f0f2f5] text-[#54656f] hover:bg-[#e2e5e9] hover:text-[#111b21]'
                                  }`}
                                  title="Thêm biểu cảm khác (+)"
                                >
                                  <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
                                </button>
                              </div>
                            )}

                            {/* Extended WhatsApp Reaction Palette Popover */}
                            {showExpandedReactionPickerMsgId === msg.id && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className={`absolute -top-52 ${isAgent ? 'right-0' : 'left-0'} w-64 bg-white border border-slate-200 rounded-2xl p-2.5 shadow-2xl z-40 animate-in fade-in zoom-in-95 duration-150`}
                              >
                                <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-100 px-1">
                                  <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Tất cả biểu cảm</span>
                                  <button
                                    type="button"
                                    onClick={() => setShowExpandedReactionPickerMsgId(null)}
                                    className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                                <div className="grid grid-cols-6 gap-1 max-h-40 overflow-y-auto pr-0.5 custom-scrollbar">
                                  {EXTENDED_EMOJIS.map((emoji) => {
                                    const isSelected = reaction === emoji;
                                    return (
                                      <button
                                        key={emoji}
                                        type="button"
                                        onClick={() => {
                                          handleReactMessage(msg, emoji);
                                        }}
                                        className={`w-8 h-8 flex items-center justify-center text-lg rounded-xl hover:scale-125 transition-transform duration-100 cursor-pointer ${
                                          isSelected ? 'bg-emerald-100 scale-110 shadow-2xs' : 'hover:bg-slate-100'
                                        }`}
                                        title={emoji}
                                      >
                                        {emoji}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                            {/* SVG Tail for First Message in Cluster */}
                            {isFirstOfTurn && (
                              isAgent ? (
                                <svg viewBox="0 0 8 13" height="13" width="8" className="absolute top-0 -right-2 text-[#d9fdd3] fill-current pointer-events-none drop-shadow-xs">
                                  <path d="M2.812 0H8v11.193l-6.467-8.625C0.474 1.156 1.042 0 2.812 0z" />
                                </svg>
                              ) : (
                                <svg viewBox="0 0 8 13" height="13" width="8" className="absolute top-0 -left-2 text-white fill-current pointer-events-none drop-shadow-xs">
                                  <path d="M5.188 0H0v11.193l6.467-8.625C7.526 1.156 6.958 0 5.188 0z" />
                                </svg>
                              )
                            )}

                            {/* Sender Info for Outgoing Agent Message */}
                            {isAgent && (
                              <div className="flex items-center justify-between gap-2 mb-1 pb-0.5 border-b border-[#bbf7d0]/80 text-[10.5px] select-none">
                                <span className="font-bold text-[#00793d] flex items-center gap-1 truncate">
                                  <span className="truncate">{senderName}</span>
                                  {senderName === (currentUser?.name || 'Nguyễn Văn Ánh') && (
                                    <span className="text-[9px] font-semibold bg-[#bbf7d0] text-[#006e57] px-1 py-0.2 rounded-xs ml-0.5">
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
                                    className="mb-1.5 p-1.5 px-2 rounded-md bg-black/5 hover:bg-black/10 active:scale-95 border-l-[3.5px] border-[#00a884] flex flex-col justify-center transition-all cursor-pointer select-none group/quote"
                                    title="Click để nhảy về tin nhắn được trả lời"
                                  >
                                    <div className="flex items-center gap-1 text-[11px] font-bold text-[#00a884] leading-tight truncate group-hover/quote:underline">
                                      <Reply className="w-3 h-3 shrink-0" />
                                      <span>{replyQuote.senderName || 'Tin nhắn được trả lời'}</span>
                                    </div>
                                    <p className="text-[11.5px] text-[#54656f] truncate leading-tight mt-0.5 max-w-sm">
                                      {replyQuote.content?.startsWith('/uploads/') || replyQuote.content?.startsWith('data:image/') || replyQuote.content?.startsWith('/api/meta/media/')
                                        ? '📷 [Hình ảnh]'
                                        : replyQuote.content || 'Nội dung tin nhắn'}
                                    </p>
                                  </div>
                                );
                              };

                              // 1. Image Message (Uploaded file, Base64, Link, Meta Cloud Media or Incoming Webhook)
                              if (imgInfo.isImage && imgInfo.imgUrl) {
                                return (
                                  <div className="space-y-1">
                                    {renderQuoteHeader()}
                                    <div
                                      onClick={() => setPreviewLightboxImg(imgInfo.imgUrl)}
                                      className="relative rounded-lg overflow-hidden cursor-pointer group border border-slate-200 shadow-2xs max-w-sm max-h-72 bg-slate-900/5 min-h-[120px] flex items-center justify-center"
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
                                      <div className="text-[13.5px] leading-relaxed whitespace-pre-wrap text-[#111b21] break-words font-normal pt-1">
                                        <span>{imgInfo.caption}</span>
                                        <span className="float-right ml-2.5 -mb-0.5 mt-1 text-[11px] text-[#667781] flex items-center gap-0.5 select-none font-normal">
                                          <span>{timeFormatted}</span>
                                          {isAgent && (
                                            <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb] shrink-0" />
                                          )}
                                        </span>
                                      </div>
                                    )}
                                    {!imgInfo.caption && (
                                      <div className="flex justify-end pt-0.5">
                                        <span className="text-[11px] text-[#667781] flex items-center gap-0.5 select-none">
                                          <span>{timeFormatted}</span>
                                          {isAgent && (
                                            <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb] shrink-0" />
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
                                const caption = content.replace(/^\[(image message|image|hình ảnh|photo)\]?:?\s*/i, '').replace(/[\[\]]/g, '').trim();
                                return (
                                  <div className="space-y-1.5 min-w-[220px]">
                                    {renderQuoteHeader()}
                                    <div className="p-3 bg-slate-100/90 rounded-lg border border-slate-200 flex items-center gap-2.5">
                                      <div className="w-9 h-9 rounded-lg bg-emerald-100 text-[#008069] flex items-center justify-center shrink-0">
                                        <ImageIcon className="w-5 h-5" />
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <p className="text-xs font-bold text-slate-800 truncate">Hình ảnh WhatsApp</p>
                                        <p className="text-[10px] text-slate-500">Đang đồng bộ từ Meta Cloud...</p>
                                      </div>
                                    </div>
                                    {caption && (
                                      <div className="text-[13px] leading-relaxed whitespace-pre-wrap text-[#111b21] font-normal pt-0.5">
                                        <span>{caption}</span>
                                        <span className="float-right ml-2.5 -mb-0.5 mt-1 text-[11px] text-[#667781] flex items-center gap-0.5 select-none font-normal">
                                          <span>{timeFormatted}</span>
                                          {isAgent && (
                                            <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb] shrink-0" />
                                          )}
                                        </span>
                                      </div>
                                    )}
                                    {!caption && (
                                      <div className="flex justify-end pt-0.5">
                                        <span className="text-[11px] text-[#667781] flex items-center gap-0.5 select-none">
                                          <span>{timeFormatted}</span>
                                          {isAgent && (
                                            <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb] shrink-0" />
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
                                      <span>{bodyLines}</span>
                                      <span className="float-right ml-2.5 -mb-0.5 mt-1 text-[11px] text-[#667781] flex items-center gap-0.5 select-none font-normal">
                                        <span>{timeFormatted}</span>
                                        {isAgent && (
                                          <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb] shrink-0" />
                                        )}
                                      </span>
                                    </div>
                                  </div>
                                );
                              }

                              return (
                                <div className="space-y-1">
                                  {renderQuoteHeader()}
                                  <div className="text-[13.5px] leading-relaxed whitespace-pre-wrap text-[#111b21] break-words font-normal">
                                    <span>{content}</span>
                                    <span className="float-right ml-3 -mb-0.5 mt-1 text-[11px] text-[#667781] flex items-center gap-0.5 select-none font-normal">
                                      <span>{timeFormatted}</span>
                                      {isAgent && (
                                        <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb] shrink-0 inline-block" />
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

                          {/* Incoming Customer Message: Right side Action Buttons (React + Reply) in a Unified Pill */}
                          {!isAgent && (
                            <div className="ml-1.5 mb-1 flex items-center bg-white/90 backdrop-blur-xs border border-slate-200/90 rounded-full p-0.5 shadow-2xs opacity-0 group-hover:opacity-100 transition-opacity duration-150 shrink-0">
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
                ))}

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
                        <span className="text-xs font-bold text-[#008069] group-hover:underline">
                          {tmpl.title}
                        </span>
                        <span className="text-[10px] font-mono bg-emerald-100 text-[#008069] px-1.5 py-0.5 rounded font-bold">
                          {tmpl.code}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 truncate mt-0.5">{tmpl.content}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Popups: Emoji Picker, Quick Templates, Attach Menu */}
              {showEmojiPicker && (
                <div className="absolute bottom-16 left-4 bg-white border border-slate-300 rounded-2xl p-3 shadow-2xl z-30 animate-fadeIn grid grid-cols-7 gap-2">
                  {POPULAR_EMOJIS.map((em) => (
                    <button
                      key={em}
                      onClick={() => handleAddEmoji(em)}
                      className="w-8 h-8 text-lg hover:bg-slate-100 rounded-lg flex items-center justify-center transition hover:scale-110 cursor-pointer"
                    >
                      {em}
                    </button>
                  ))}
                </div>
              )}

              {showTemplatePicker && (
                <div className="absolute bottom-16 left-12 bg-white border border-slate-300 rounded-2xl p-3 shadow-2xl z-30 w-80 max-h-72 overflow-y-auto animate-fadeIn divide-y divide-slate-100">
                  <div className="flex items-center justify-between pb-2 mb-1">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                      Mẫu Tin Nhắn Nhanh (Canned Reply)
                    </span>
                    <button onClick={() => setShowTemplatePicker(false)} className="text-slate-400 hover:text-slate-600">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {QUICK_TEMPLATES.map((tmpl) => (
                    <div
                      key={tmpl.code}
                      onClick={() => handleApplyTemplate(tmpl.content)}
                      className="p-2 hover:bg-emerald-50 rounded-xl cursor-pointer transition group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#008069] group-hover:underline">
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

              {showAttachMenu && (
                <div className="absolute bottom-16 left-8 bg-white border border-slate-300 rounded-2xl p-2 shadow-2xl z-30 w-56 animate-fadeIn space-y-1">
                  <button
                    onClick={() => {
                      if (fileInputRef.current) fileInputRef.current.click();
                      setShowAttachMenu(false);
                    }}
                    className="w-full px-3 py-2 text-left text-xs font-bold text-slate-800 hover:bg-slate-50 rounded-xl flex items-center space-x-2.5 transition cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                      <ImageIcon className="w-4 h-4" />
                    </div>
                    <span>Gửi Hình Ảnh / Bill</span>
                  </button>

                  <button
                    onClick={() => {
                      if (activeCustomer) onOpenAddOrder(activeCustomer);
                      setShowAttachMenu(false);
                    }}
                    className="w-full px-3 py-2 text-left text-xs font-bold text-slate-800 hover:bg-emerald-50 hover:text-emerald-800 rounded-xl flex items-center space-x-2.5 transition cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-lg bg-emerald-100 text-[#008069] flex items-center justify-center shrink-0">
                      <ShoppingBag className="w-4 h-4" />
                    </div>
                    <span>Tạo Đơn Hàng Mới</span>
                  </button>

                  <button
                    onClick={() => {
                      handleApplyTemplate('📄 BÁO GIÁ SẢN PHẨM:\n- Combo 2 Hộp Thảo Mộc: 700.000đ\n- Quà tặng: 1 Bình Giữ Nhiệt Cao Cấp\n- Miễn phí vận chuyển tận nhà (COD).');
                      setShowAttachMenu(false);
                    }}
                    className="w-full px-3 py-2 text-left text-xs font-bold text-slate-800 hover:bg-blue-50 hover:text-blue-800 rounded-xl flex items-center space-x-2.5 transition cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <span>Gửi Báo Giá Mẫu</span>
                  </button>
                </div>
              )}

              {/* Hidden File Input for Media Upload */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
              />

              {/* WhatsApp Authentic Reply Preview Banner */}
              {replyingToMessage && (
                <div className="px-3.5 pt-2.5 pb-1 bg-[#f0f2f5] border-t border-[#d1d7db] flex items-center justify-between gap-3 shrink-0 animate-fadeIn">
                  <div className="flex-1 min-w-0 bg-white/90 rounded-lg p-2 border-l-4 border-[#00a884] shadow-2xs">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#00a884]">
                      <Reply className="w-3.5 h-3.5 shrink-0" />
                      <span>Đang trả lời {replyingToMessage.sender === 'agent' ? 'Chính mình' : (replyingToMessage.customerName || 'Khách hàng')}</span>
                    </div>
                    <p className="text-xs text-slate-600 truncate mt-0.5 max-w-xl">
                      {replyingToMessage.content.startsWith('/uploads/') || replyingToMessage.content.startsWith('data:image/') || replyingToMessage.content.startsWith('/api/meta/media/')
                        ? '📷 [Hình ảnh]'
                        : replyingToMessage.content}
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
                <div className="px-3.5 pt-2 pb-1.5 bg-[#f0f2f5] border-t border-[#d1d7db] flex items-center gap-3 shrink-0 animate-fadeIn">
                  <div className="relative group rounded-xl overflow-hidden border-2 border-[#00a884] bg-white shadow-xs w-14 h-14 shrink-0">
                    <img src={pendingImage} alt="attached thumbnail" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setPendingImage(null)}
                      className="absolute top-0.5 right-0.5 bg-black/75 hover:bg-rose-600 text-white rounded-full p-0.5 shadow transition cursor-pointer"
                      title="Xóa ảnh"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-emerald-100 text-[#008069] border border-emerald-200">
                      Ảnh đính kèm
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPendingImage(null)}
                    className="text-xs font-semibold text-slate-400 hover:text-rose-600 px-2 py-1 rounded hover:bg-slate-200/50 transition cursor-pointer"
                  >
                    Xóa
                  </button>
                </div>
              )}

              {/* Active Sender Identity Banner */}
              <div className="px-3.5 py-1.5 bg-[#e9edef] border-t border-[#d1d7db] flex items-center justify-between gap-2 text-xs select-none">
                <div className="flex items-center space-x-2 min-w-0">
                  <div className="relative shrink-0">
                    <img
                      src={currentUser?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                      alt={currentUser?.name || 'User'}
                      className="w-5 h-5 rounded-full object-cover border border-slate-300 shadow-2xs"
                    />
                    <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border border-white"></span>
                  </div>
                  <div className="text-[11.5px] text-slate-700 truncate flex items-center gap-1.5">
                    <span>Đang nhắn tin với tư cách:</span>
                    <strong className="text-slate-900 font-bold truncate">{currentUser?.name || 'Nguyễn Văn Ánh'}</strong>
                    <span className="px-1.5 py-0.2 rounded-full text-[9.5px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                      {currentUser?.role || 'Admin'}
                    </span>
                  </div>
                </div>

                {activeCustomer?.owner && (
                  <div className="text-[10.5px] text-slate-500 hidden sm:flex items-center gap-1 shrink-0">
                    <span>Phụ trách khách:</span>
                    <span className={`font-semibold px-1.5 py-0.2 rounded text-[10px] ${
                      activeCustomer.owner === currentUser?.name
                        ? 'bg-emerald-100 text-[#00793d] font-bold'
                        : 'bg-slate-200 text-slate-700'
                    }`}>
                      {activeCustomer.owner === currentUser?.name ? `${activeCustomer.owner} (Chính bạn)` : activeCustomer.owner}
                    </span>
                  </div>
                )}
              </div>

              {/* WhatsApp Authentic Input Bar */}
              <div className="p-2.5 bg-[#f0f2f5] border-t border-[#d1d7db] shrink-0 flex items-center space-x-1.5 z-10">
                {/* Emoji Trigger */}
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="p-2 text-[#54656f] hover:text-[#111b21] hover:bg-slate-200/60 rounded-full transition cursor-pointer"
                  title="Emoji"
                >
                  <Smile className="w-5 h-5" />
                </button>

                {/* Attachment Menu Trigger */}
                <button
                  type="button"
                  onClick={() => setShowAttachMenu(!showAttachMenu)}
                  className="p-2 text-[#54656f] hover:text-[#111b21] hover:bg-slate-200/60 rounded-full transition cursor-pointer"
                  title="Đính kèm hình ảnh, đơn hàng"
                >
                  <Paperclip className="w-5 h-5" />
                </button>

                {/* Quick Canned Template Trigger */}
                <button
                  type="button"
                  onClick={() => setShowTemplatePicker(!showTemplatePicker)}
                  className="p-2 text-amber-600 hover:text-amber-700 hover:bg-amber-100/60 rounded-full transition cursor-pointer"
                  title="Mẫu tin nhắn nhanh (/)"
                >
                  <Zap className="w-5 h-5 fill-amber-500 text-amber-500" />
                </button>

                {/* Textarea Input with Clipboard Paste support */}
                <div className="flex-1 bg-white rounded-lg px-3.5 py-2 transition shadow-2xs">
                  <textarea
                    ref={textareaRef}
                    rows={1}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onPaste={handlePaste}
                    placeholder={pendingImage ? "Nhập chú thích cho ảnh (Tùy chọn)..." : "Nhập tin nhắn (Gõ / để chọn câu trả lời nhanh)..."}
                    className="w-full bg-transparent text-[14px] text-[#111b21] focus:outline-none resize-none placeholder-[#8696a0] max-h-24 leading-5"
                  />
                </div>

                {/* Mic vs Send Button */}
                {inputText.trim() || pendingImage ? (
                  <button
                    type="button"
                    onClick={() => handleSend()}
                    className="w-10 h-10 rounded-full bg-[#00a884] hover:bg-[#008069] text-white flex items-center justify-center transition shadow-md cursor-pointer shrink-0"
                    title="Gửi tin nhắn (Enter)"
                  >
                    <Send className="w-4 h-4 ml-0.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleApplyTemplate('Dạ em gửi lời chào đến anh/chị ạ!')}
                    className="w-10 h-10 rounded-full text-[#54656f] hover:text-[#111b21] hover:bg-slate-200/60 flex items-center justify-center transition cursor-pointer shrink-0"
                    title="Ghi âm thoại (Mic)"
                  >
                    <Mic className="w-5 h-5" />
                  </button>
                )}
              </div>
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
        {isDrawerOpen && activeThread && (
          <div className="w-full lg:w-[320px] xl:w-[360px] bg-white border-l border-slate-300 flex flex-col h-full overflow-hidden select-none shrink-0">
            
            {/* Drawer Header */}
            <div className="p-3.5 bg-[#f0f2f5] border-b border-slate-300 flex items-center justify-between shrink-0">
              <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <User className="w-4 h-4 text-[#008069]" />
                <span>Hồ Sơ CRM Khách Hàng</span>
              </h3>
              <button
                onClick={() => setIsDrawerOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition cursor-pointer"
                title="Thu gọn"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tab Switcher: Overview vs Internal Notes */}
            <div className="p-1.5 bg-slate-100 border-b border-slate-200 grid grid-cols-2 gap-1 shrink-0">
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
                <span>Ghi Chú ({internalNotes[activeCustomer?.id || activeThread.threadId]?.length || 0})</span>
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
                        src={activeCustomer?.avatar || `https://api.dicebear.com/10.x/adventurer/svg?seed=${encodeURIComponent(activeThread.customerPhone || activeThread.customerName || activeThread.threadId)}`}
                        alt="avatar"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <h4 className="text-sm font-extrabold text-slate-900">{activeThread.customerName}</h4>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">{formatPhoneWithCountryCode(activeThread.customerPhone, activeCustomer?.country) || activeThread.customerPhone}</p>
                    
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
                          className="w-full py-2.5 px-3 bg-[#008069] hover:bg-[#006a57] text-white font-bold rounded-xl text-xs transition flex items-center justify-center space-x-1.5 cursor-pointer shadow-sm hover:shadow"
                        >
                          <ShoppingBag className="w-4 h-4" />
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
                        <span>Sale phụ trách:</span>
                        <span className="font-semibold text-slate-800">{activeCustomer.owner || 'Chưa phân công'}</span>
                      </div>
                    </div>
                  )}

                  {/* Customer Journey Timeline */}
                  <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-2">
                    <span className="font-bold text-slate-800 text-[11px] flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#008069]" />
                      <span>Hành Trình Khách Hàng (Timeline)</span>
                    </span>

                    <div className="space-y-2 pl-2 border-l-2 border-slate-300 ml-1.5 pt-1">
                      <div className="relative pl-3 text-[11px]">
                        <span className="absolute -left-[17px] top-1 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white"></span>
                        <p className="font-bold text-slate-900">Đang trò chuyện trực tiếp</p>
                        <p className="text-[10px] text-slate-500">Phiên chat WhatsApp Webhook</p>
                      </div>

                      {activeCustomer && activeCustomer.orders && activeCustomer.orders.length > 0 && (
                        <div className="relative pl-3 text-[11px]">
                          <span className="absolute -left-[17px] top-1 w-2 h-2 rounded-full bg-blue-500 ring-2 ring-white"></span>
                          <p className="font-bold text-slate-900">Đã mua {activeCustomer.orders.length} đơn hàng</p>
                          <p className="text-[10px] text-slate-500">Đơn gần nhất: {activeCustomer.orders[0].orderCode}</p>
                        </div>
                      )}

                      <div className="relative pl-3 text-[11px]">
                        <span className="absolute -left-[17px] top-1 w-2 h-2 rounded-full bg-purple-500 ring-2 ring-white"></span>
                        <p className="font-bold text-slate-900">Đăng ký & Đồng thuận Opt-In</p>
                        <p className="text-[10px] text-slate-500">Yum Network WABA Channel</p>
                      </div>
                    </div>
                  </div>

                  {/* Automation Sequence Progress */}
                  {activeCustomer?.automationSequence && (
                    <div className="border border-slate-200 rounded-xl p-3 space-y-2 bg-slate-50">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800 text-[11px] flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                          Tiến Trình Chăm Sóc (+3, +5, +7, +15)
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
                        <span>Đơn hàng gần đây ({activeCustomer.orders.length})</span>
                      </div>

                      <div className="space-y-1.5">
                        {activeCustomer.orders.slice(0, 3).map((ord) => (
                          <div key={ord.id} className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-[11px] space-y-0.5">
                            <div className="flex items-center justify-between font-bold text-slate-900">
                              <span>{ord.orderCode}</span>
                              <span className="text-emerald-700">{formatVND(ord.totalAmount)}</span>
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-slate-500">
                              <span>{new Date(ord.date).toLocaleDateString('vi-VN')}</span>
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
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-[11px] text-amber-800 flex items-start gap-1.5">
                    <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>Ghi chú nội bộ chỉ hiển thị cho nhân viên Yum CRM, khách hàng không thể nhìn thấy.</span>
                  </div>

                  {/* Add Note Form */}
                  <div className="space-y-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    <textarea
                      rows={2}
                      value={newNoteText}
                      onChange={(e) => setNewNoteText(e.target.value)}
                      placeholder="Thêm ghi chú cho khách hàng này (vd: Khách thích nhận hàng chiều, đã giảm giá 10%)..."
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:outline-none focus:border-[#008069]"
                    />
                    <div className="flex justify-end">
                      <button
                        onClick={() => handleAddInternalNote(activeCustomer?.id || activeThread.threadId)}
                        disabled={!newNoteText.trim()}
                        className="px-3 py-1.5 bg-[#008069] hover:bg-[#006a57] disabled:opacity-50 text-white font-bold text-xs rounded-lg transition flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Lưu Ghi Chú</span>
                      </button>
                    </div>
                  </div>

                  {/* Notes List */}
                  <div className="space-y-2">
                    {(() => {
                      const notes = internalNotes[activeCustomer?.id || activeThread.threadId] || [];
                      if (notes.length === 0) {
                        return (
                          <div className="p-6 text-center text-slate-400 text-xs">
                            Chưa có ghi chú nội bộ nào cho khách hàng này.
                          </div>
                        );
                      }

                      return notes.map((note) => (
                        <div key={note.id} className="p-2.5 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-1 relative group">
                          <div className="flex items-center justify-between text-[10px] text-slate-500">
                            <span className="font-bold text-slate-800">{note.author}</span>
                            <span>{new Date(note.timestamp).toLocaleDateString('vi-VN')} {new Date(note.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <p className="text-xs text-slate-700 whitespace-pre-wrap">{note.content}</p>

                          <button
                            onClick={() => handleDeleteInternalNote(activeCustomer?.id || activeThread.threadId, note.id)}
                            className="absolute top-2 right-2 hidden group-hover:block text-slate-400 hover:text-rose-600 transition"
                            title="Xóa ghi chú"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

      </div>

      <MessageLightbox imageUrl={previewLightboxImg} onClose={() => setPreviewLightboxImg(null)} />

    </div>
  );
};
