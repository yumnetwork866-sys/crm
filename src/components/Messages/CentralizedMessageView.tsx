import React, { useState, useMemo, useRef, useEffect } from 'react';
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
  Phone,
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
  ShieldCheck,
  ShieldAlert,
  ChevronRight,
  ChevronLeft,
  Mic,
  Copy,
  CheckCircle2,
  FileText,
  Plus,
  RefreshCw,
  Tag,
  DollarSign,
  Calendar,
  Layers,
  ChevronDown
} from 'lucide-react';
import { Customer, CentralMessage, MessageChannel, AppUser } from '../../types';
import { getCustomerGroup, isSamePhoneNumber, formatVND, CUSTOMER_GROUPS } from '../../utils/crmUtils';

export interface BusinessPhoneNumber {
  id: string;
  verifiedName: string;
  displayPhoneNumber: string;
  qualityRating?: string;
}

export const DEFAULT_BUSINESS_PHONES: BusinessPhoneNumber[] = [
  {
    id: 'phone_601110716895',
    verifiedName: 'Yum Network WABA (Chính)',
    displayPhoneNumber: '+60 11-1071 6895',
    qualityRating: 'GREEN',
  },
  {
    id: 'phone_60123456789',
    verifiedName: 'Yum CSKH & Tư Vấn 01',
    displayPhoneNumber: '+60 12 345 6789',
    qualityRating: 'GREEN',
  },
  {
    id: 'phone_84988123456',
    verifiedName: 'Yum Hotline Việt Nam',
    displayPhoneNumber: '+84 988 123 456',
    qualityRating: 'GREEN',
  }
];

interface CentralizedMessageViewProps {
  messages: CentralMessage[];
  customers: Customer[];
  currentUser?: AppUser | null;
  selectedCustomerId?: string | null;
  onSelectCustomerThread: (customerId: string) => void;
  onSendMessage: (
    customerId: string,
    content: string,
    channel: MessageChannel,
    customerPhone?: string,
    customerName?: string,
    senderPhoneId?: string
  ) => void;
  onOpenAddOrder: (customer: Customer) => void;
  onSelectCustomerDetail: (customer: Customer) => void;
  onDeleteThread?: (customerId: string) => void;
  onDeleteMessage?: (messageId: string) => void;
}

// Canned Quick Reply Templates
const QUICK_TEMPLATES = [
  {
    code: '/chao',
    title: 'Chào hỏi & Tư vấn',
    content: 'Dạ em chào anh/chị! Em là chuyên viên tư vấn từ YumNetwork. Em có thể hỗ trợ thông tin gì cho mình hôm nay ạ?'
  },
  {
    code: '/gia',
    title: 'Báo giá Combo Ưu đãi',
    content: 'Dạ hiện tại bên em đang có chương trình trợ giá đặc biệt: Mua Combo 2 tặng 1 kèm Miễn phí vận chuyển tận nơi. Anh/chị xem qua nhé ạ!'
  },
  {
    code: '/stk',
    title: 'Thông tin Thanh toán / COD',
    content: 'Dạ bên em hỗ trợ 2 hình thức thanh toán: 1. Nhận hàng kiểm tra thanh toán (COD), 2. Chuyển khoản ngân hàng nhận thêm quà tặng tri ân.'
  },
  {
    code: '/hdsd',
    title: 'Hướng dẫn sử dụng',
    content: 'Dạ để đạt hiệu quả tối ưu nhất, anh/chị dùng đều đặn 2 lần/ngày sau bữa ăn 30 phút và uống nhiều nước giúp em nhé ạ!'
  },
  {
    code: '/voucher',
    title: 'Tặng Voucher 20%',
    content: '🎁 Tri ân khách hàng thân thiết: YumNetwork gửi tặng anh/chị mã giảm giá VOUCHER20 giảm ngay 20% cho đơn hàng tiếp theo!'
  }
];

const POPULAR_EMOJIS = ['👍', '❤️', '😊', '🙏', '🔥', '🎉', '👏', '💯', '✨', '💐', '👌', '⭐', '📦', '💬'];

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
}) => {
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'vip' | 'repeat' | 'new'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [isChatSearchOpen, setIsChatSearchOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(true);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [pinnedThreadIds, setPinnedThreadIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('yumcrm_pinned_threads');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [messageReactions, setMessageReactions] = useState<Record<string, string>>({});
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isAdmin = currentUser?.role === 'Admin';

  const togglePinThread = (threadId: string) => {
    setPinnedThreadIds((prev) => {
      const updated = prev.includes(threadId) ? prev.filter((id) => id !== threadId) : [...prev, threadId];
      try {
        localStorage.setItem('yumcrm_pinned_threads', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  // Group messages by customer ID and normalized phone number into single unified threads
  const threads = useMemo(() => {
    const map = new Map<
      string,
      {
        threadId: string;
        customer: Customer | null;
        customerName: string;
        customerPhone: string;
        lastMessage: CentralMessage;
        unreadCount: number;
        messages: CentralMessage[];
        isPinned: boolean;
      }
    >();

    messages.forEach((msg) => {
      const rawPhone = msg.customerPhone || (msg.customerId && msg.customerId.startsWith('cust_') ? msg.customerId.replace('cust_', '') : '');
      const cleanPhone = rawPhone.replace(/\D/g, '');
      const phoneKey = cleanPhone.length >= 7 ? cleanPhone.slice(-9) : (msg.customerId || 'unknown');

      const cust = customers.find((c) => {
        return (msg.customerId && c.id === msg.customerId) || isSamePhoneNumber(c.phone, rawPhone || msg.customerId);
      }) || null;

      const threadKey = cust?.id || (cleanPhone.length >= 7 ? cleanPhone.slice(-9) : phoneKey);

      const existing = map.get(threadKey);

      if (!existing) {
        map.set(threadKey, {
          threadId: threadKey,
          customer: cust,
          customerName: msg.customerName || cust?.name || 'Khách Hàng',
          customerPhone: msg.customerPhone || cust?.phone || (cleanPhone ? `+${cleanPhone}` : ''),
          lastMessage: msg,
          unreadCount: !msg.isRead && msg.sender === 'customer' ? 1 : 0,
          messages: [msg],
          isPinned: pinnedThreadIds.includes(threadKey),
        });
      } else {
        existing.messages.push(msg);
        existing.lastMessage = msg;
        if (cust && !existing.customer) existing.customer = cust;
        if (!existing.customerPhone && (msg.customerPhone || cust?.phone)) {
          existing.customerPhone = msg.customerPhone || cust?.phone || '';
        }
        if (cust && !existing.customerName && cust.name) {
          existing.customerName = cust.name;
        }
        if (!msg.isRead && msg.sender === 'customer') {
          existing.unreadCount += 1;
        }
      }
    });

    // Sort: Pinned threads first, then by lastMessage timestamp desc
    return Array.from(map.values()).sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return new Date(b.lastMessage.timestamp).getTime() - new Date(a.lastMessage.timestamp).getTime();
    });
  }, [messages, customers, pinnedThreadIds]);

  // Filter threads based on search & filter tabs
  const filteredThreads = useMemo(() => {
    return threads.filter((t) => {
      if (activeFilter === 'unread' && t.unreadCount === 0) return false;
      if (activeFilter === 'vip' && (!t.customer || t.customer.totalOrders < 2)) return false;
      if (activeFilter === 'repeat' && (!t.customer || t.customer.totalOrders !== 1)) return false;
      if (activeFilter === 'new' && t.customer && t.customer.totalOrders > 0) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = t.customerName.toLowerCase().includes(q);
        const matchesPhone = t.customerPhone.includes(q);
        const matchesContent = t.messages.some((m) => m.content.toLowerCase().includes(q));
        if (!matchesName && !matchesPhone && !matchesContent) return false;
      }
      return true;
    });
  }, [threads, activeFilter, searchQuery]);

  // Active thread selection
  const activeThread = useMemo(() => {
    if (!threads.length) return null;
    if (!selectedCustomerId) return filteredThreads[0] || threads[0];

    return (
      threads.find((t) => {
        return (
          t.threadId === selectedCustomerId ||
          (t.customer && t.customer.id === selectedCustomerId) ||
          t.lastMessage.customerId === selectedCustomerId ||
          isSamePhoneNumber(t.customerPhone, selectedCustomerId)
        );
      }) || filteredThreads[0] || threads[0] || null
    );
  }, [threads, filteredThreads, selectedCustomerId]);

  const activeCustomer = activeThread?.customer || null;
  const groupKey = activeCustomer ? getCustomerGroup(activeCustomer) : 'group_1';
  const groupInfo = CUSTOMER_GROUPS[groupKey];

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeThread?.messages?.length, activeThread?.threadId]);

  // Filter messages inside active thread if searching in chat
  const displayedActiveMessages = useMemo(() => {
    if (!activeThread) return [];
    if (!chatSearchQuery.trim()) return activeThread.messages;
    const q = chatSearchQuery.toLowerCase();
    return activeThread.messages.filter((m) => m.content.toLowerCase().includes(q));
  }, [activeThread, chatSearchQuery]);

  // Group active thread messages by calendar date (Date Divider Pill)
  const groupedMessagesByDate = useMemo(() => {
    const groups: { dateLabel: string; msgs: CentralMessage[] }[] = [];
    displayedActiveMessages.forEach((msg) => {
      const msgDate = new Date(msg.timestamp);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      let dateLabel = msgDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
      if (msgDate.toDateString() === today.toDateString()) {
        dateLabel = 'Hôm nay';
      } else if (msgDate.toDateString() === yesterday.toDateString()) {
        dateLabel = 'Hôm qua';
      }

      const lastGroup = groups[groups.length - 1];
      if (lastGroup && lastGroup.dateLabel === dateLabel) {
        lastGroup.msgs.push(msg);
      } else {
        groups.push({ dateLabel, msgs: [msg] });
      }
    });
    return groups;
  }, [displayedActiveMessages]);

  const [businessPhones, setBusinessPhones] = useState<BusinessPhoneNumber[]>(DEFAULT_BUSINESS_PHONES);
  const [selectedPhoneId, setSelectedPhoneId] = useState<string>(() => {
    return localStorage.getItem('yumcrm_active_waba_phone') || 'phone_601110716895';
  });

  // Load configured or dynamic Meta phone numbers
  useEffect(() => {
    let isMounted = true;
    const loadPhones = async () => {
      try {
        const res = await fetch('/api/meta/config').catch(() => null);
        if (res && res.ok) {
          const cfg = await res.json();
          if (cfg.whatsappWabaId && cfg.hasAccessToken) {
            const pRes = await fetch('/api/meta/fetch-phone-numbers', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ wabaId: cfg.whatsappWabaId }),
            }).catch(() => null);

            if (pRes && pRes.ok) {
              const pData = await pRes.json();
              if (pData.success && Array.isArray(pData.phoneNumbers) && pData.phoneNumbers.length > 0) {
                if (isMounted) {
                  const mapped = pData.phoneNumbers.map((p: any) => ({
                    id: p.id,
                    verifiedName: p.verifiedName || 'Yum Network WABA',
                    displayPhoneNumber: p.displayPhoneNumber || p.id,
                    qualityRating: p.qualityRating || 'GREEN',
                  }));
                  setBusinessPhones(mapped);
                  const saved = localStorage.getItem('yumcrm_active_waba_phone');
                  const match = mapped.find((m: any) => m.id === saved || m.id === cfg.whatsappPhoneNumberId);
                  if (match) {
                    setSelectedPhoneId(match.id);
                  } else {
                    setSelectedPhoneId(mapped[0].id);
                  }
                  return;
                }
              }
            }
          }
          if (cfg.whatsappPhoneNumberId && isMounted) {
            const match = DEFAULT_BUSINESS_PHONES.find(
              (p) => p.id === cfg.whatsappPhoneNumberId || p.displayPhoneNumber.replace(/\D/g, '') === cfg.whatsappPhoneNumberId.replace(/\D/g, '')
            );
            if (match) {
              setSelectedPhoneId(match.id);
            }
          }
        }
      } catch (err) {
        console.warn('Failed to load Meta WABA phone numbers:', err);
      }
    };
    loadPhones();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSelectBusinessPhone = (phoneId: string) => {
    setSelectedPhoneId(phoneId);
    try {
      localStorage.setItem('yumcrm_active_waba_phone', phoneId);
      // Auto-sync selection with backend config if it's a real Meta phone ID
      if (!phoneId.startsWith('phone_')) {
        fetch('/api/meta/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ whatsappPhoneNumberId: phoneId }),
        }).catch(() => {});
      }
    } catch {}
  };

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !activeThread) return;

    const targetId = activeThread.customer?.id || activeThread.lastMessage.customerId || activeThread.threadId;
    const targetPhone = activeThread.customerPhone || activeThread.customer?.phone || activeThread.lastMessage.customerPhone;
    const targetName = activeThread.customerName || activeThread.customer?.name || activeThread.lastMessage.customerName;

    onSendMessage(targetId, inputText.trim(), 'WhatsApp', targetPhone, targetName, selectedPhoneId);
    setInputText('');
    setShowTemplatePicker(false);
    setShowEmojiPicker(false);
    setShowAttachMenu(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleApplyTemplate = (content: string) => {
    setInputText(content);
    setShowTemplatePicker(false);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleAddEmoji = (emoji: string) => {
    setInputText((prev) => prev + emoji);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMsgId(id);
    setTimeout(() => setCopiedMsgId(null), 2000);
  };

  const handleReactMessage = (id: string, emoji: string) => {
    setMessageReactions((prev) => ({
      ...prev,
      [id]: prev[id] === emoji ? '' : emoji
    }));
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
            {/* Integrated Business Phone Dropdown */}
            <div className="relative min-w-0 flex-1">
              <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-[#008069]">
                <Phone className="w-3.5 h-3.5" />
              </div>
              <select
                id="waba-phone-select"
                value={selectedPhoneId}
                onChange={(e) => handleSelectBusinessPhone(e.target.value)}
                className="w-full appearance-none bg-white hover:bg-slate-50 text-slate-900 font-bold text-xs pl-8 pr-7 py-1.5 rounded-lg border border-slate-300 focus:border-[#008069] focus:ring-1 focus:ring-emerald-500/20 focus:outline-none transition cursor-pointer shadow-xs truncate"
                title="Chọn số Doanh nghiệp gửi tin (WABA)"
              >
                {businessPhones.map((phone) => (
                  <option key={phone.id} value={phone.id}>
                    {phone.displayPhoneNumber} — {phone.verifiedName}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1.5 text-slate-400">
                <ChevronDown className="w-3.5 h-3.5" />
              </div>
            </div>

            <div className="flex items-center space-x-1 text-slate-600 shrink-0">
              <button
                onClick={() => setActiveFilter(activeFilter === 'unread' ? 'all' : 'unread')}
                className={`p-1.5 rounded-full transition cursor-pointer ${activeFilter === 'unread' ? 'bg-[#00a884] text-white shadow-sm' : 'hover:bg-slate-200'}`}
                title="Lọc tin chưa đọc"
              >
                <Filter className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Search Box */}
          <div className="px-3 py-2 bg-white border-b border-slate-200">
            <div className="relative flex items-center bg-[#f0f2f5] rounded-lg px-2.5 py-1.5 focus-within:bg-white focus-within:ring-1 focus-within:ring-[#00a884] transition">
              <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm hoặc bắt đầu đoạn chat mới..."
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
          <div className="px-3 py-2 bg-white border-b border-slate-200 flex space-x-1.5 overflow-x-auto no-scrollbar shrink-0">
            {[
              { id: 'all', label: `Tất cả (${threads.length})` },
              { id: 'unread', label: `Chưa đọc (${threads.reduce((sum, t) => sum + t.unreadCount, 0)})` },
              { id: 'vip', label: 'Khách VIP' },
              { id: 'repeat', label: 'Đã mua 1 lần' },
              { id: 'new', label: 'Khách mới' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setActiveFilter(f.id as any)}
                className={`px-3 py-1 rounded-full text-[11px] font-semibold transition whitespace-nowrap cursor-pointer ${
                  activeFilter === f.id
                    ? 'bg-[#008069] text-white shadow-sm'
                    : 'bg-[#f0f2f5] text-slate-600 hover:bg-slate-200'
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

                return (
                  <div
                    key={thread.threadId}
                    onClick={() => onSelectCustomerThread(thread.threadId)}
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

                      {/* Phone & CRM Group Tag */}
                      <div className="flex items-center space-x-1.5 mt-0.5">
                        <span className="text-[10px] text-slate-500 truncate font-mono">
                          {thread.customerPhone || 'WhatsApp'}
                        </span>
                        {thread.customer && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-slate-100 text-slate-600 border border-slate-200">
                            {thread.customer.totalOrders >= 2 ? 'VIP' : (thread.customer.totalOrders === 1 ? '1 Đơn' : 'Mới')}
                          </span>
                        )}
                      </div>

                      {/* Last Message Snippet */}
                      <div className="flex items-center justify-between mt-1">
                        <p className={`text-xs truncate pr-1 flex items-center gap-1 ${hasUnread ? 'text-slate-900 font-bold' : 'text-slate-500'}`}>
                          {isAgentLast && (
                            <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb] shrink-0" />
                          )}
                          <span className="truncate">{thread.lastMessage.content}</span>
                        </p>

                        <div className="flex items-center space-x-1 shrink-0">
                          {thread.isPinned && (
                            <Pin className="w-3 h-3 text-slate-400 fill-slate-400" />
                          )}
                          {hasUnread && (
                            <span className="min-w-[18px] h-[18px] px-1 bg-[#25d366] rounded-full text-[10px] text-white font-extrabold flex items-center justify-center">
                              {thread.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Pin & Admin Quick Action buttons on hover */}
                    <div className="absolute right-2 top-2 hidden group-hover:flex items-center space-x-1 bg-white/90 shadow px-1.5 py-0.5 rounded-lg border border-slate-200">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePinThread(thread.threadId);
                        }}
                        className="p-1 text-slate-400 hover:text-[#008069] transition cursor-pointer"
                        title={thread.isPinned ? 'Bỏ ghim' : 'Ghim lên đầu'}
                      >
                        <Pin className={`w-3 h-3 ${thread.isPinned ? 'text-[#008069] fill-[#008069]' : ''}`} />
                      </button>

                      {isAdmin && onDeleteThread && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`[ADMIN] Xóa toàn bộ hội thoại với ${thread.customerName}?`)) {
                              onDeleteThread(thread.customer?.id || thread.threadId || thread.lastMessage.customerId);
                            }
                          }}
                          className="p-1 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                          title="Xóa hội thoại"
                        >
                          <Trash2 className="w-3 h-3" />
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
                <div className="flex items-center space-x-3">
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

                  <div>
                    <div className="flex items-center space-x-2">
                      <h2 className="text-sm font-extrabold text-slate-900 leading-tight">
                        {activeThread.customerName}
                      </h2>
                      {activeCustomer?.whatsappOptIn && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-emerald-100 text-[#00793d] border border-emerald-300 flex items-center gap-0.5">
                          <Check className="w-2.5 h-2.5" />
                          Opt-In
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 flex items-center space-x-1.5">
                      <span className="font-mono">{activeThread.customerPhone}</span>
                      <span>•</span>
                      <span>{activeCustomer?.owner || 'Sale Rep: Nguyễn Văn Ánh'}</span>
                    </p>
                  </div>
                </div>

                {/* Right Action Icons in Header */}
                <div className="flex items-center space-x-1.5 text-slate-600">
                  <button
                    onClick={() => setIsChatSearchOpen(!isChatSearchOpen)}
                    className={`p-2 rounded-full transition cursor-pointer ${isChatSearchOpen ? 'bg-slate-200 text-[#008069]' : 'hover:bg-slate-200'}`}
                    title="Tìm kiếm trong đoạn chat"
                  >
                    <Search className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => setIsDrawerOpen(!isDrawerOpen)}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-sm ${
                      isDrawerOpen
                        ? 'bg-[#008069] text-white border-[#008069]'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                    title="Bật/Tắt Hồ Sơ CRM Khách Hàng"
                  >
                    <User className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Hồ sơ CRM</span>
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
              <div className="flex-1 p-4 overflow-y-auto space-y-4 whatsapp-chat-bg whatsapp-scrollbar">
                
                {/* Security Encryption Banner */}
                <div className="flex justify-center my-2">
                  <div className="bg-[#ffeecd] border border-[#f0dfbe] text-[#54656f] text-[11px] px-3.5 py-1.5 rounded-lg shadow-sm max-w-md text-center flex items-center space-x-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                    <span>Tin nhắn được mã hóa qua Meta Graph Cloud API chính thức của WhatsApp Business.</span>
                  </div>
                </div>

                {groupedMessagesByDate.map((group, groupIndex) => (
                  <div key={groupIndex} className="space-y-2">
                    
                    {/* Date Divider Pill */}
                    <div className="flex justify-center my-3 sticky top-1 z-10">
                      <span className="bg-white/90 backdrop-blur-sm px-3 py-1 rounded-lg text-[11px] font-bold text-slate-600 shadow-sm border border-slate-200/80">
                        {group.dateLabel}
                      </span>
                    </div>

                    {group.msgs.map((msg) => {
                      const isAgent = msg.sender === 'agent';
                      const senderName = isAgent ? (msg.agentName || currentUser?.name || 'Nguyễn Văn Ánh') : msg.customerName;
                      const timeFormatted = new Date(msg.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
                      const reaction = messageReactions[msg.id];

                      return (
                        <div
                          key={msg.id}
                          className={`flex flex-col group ${isAgent ? 'items-end' : 'items-start'}`}
                        >
                          <div className={`relative max-w-[82%] sm:max-w-[70%] ${isAgent ? 'whatsapp-bubble-out' : 'whatsapp-bubble-in'} px-3.5 py-2 text-xs space-y-1`}>
                            
                            {/* Sender Header */}
                            <div className="flex items-center justify-between gap-3 text-[10px] pb-0.5 font-bold">
                              <span className={isAgent ? 'text-[#008069]' : 'text-indigo-600'}>
                                {senderName}
                              </span>
                            </div>

                            {/* Message Body Content */}
                            <p className="text-[13px] leading-relaxed whitespace-pre-wrap text-slate-900 break-words font-normal">
                              {msg.content}
                            </p>

                            {/* Time & Double Check status inside bubble */}
                            <div className="flex items-center justify-end space-x-1 text-[10px] text-slate-500 pt-0.5 select-none">
                              <span>{timeFormatted}</span>
                              {isAgent && (
                                <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />
                              )}
                            </div>

                            {/* Active Reaction Badge */}
                            {reaction && (
                              <span className="absolute -bottom-2 right-2 bg-white px-1.5 py-0.5 rounded-full text-xs shadow border border-slate-200">
                                {reaction}
                              </span>
                            )}

                            {/* Hover Action Menu (Reactions, Copy, Delete) */}
                            <div className={`absolute top-0 ${isAgent ? '-left-20' : '-right-20'} hidden group-hover:flex items-center space-x-1 bg-white/95 backdrop-blur-sm p-1 rounded-full shadow-md border border-slate-200 z-20`}>
                              {/* Quick Reaction Emojis */}
                              {['👍', '❤️', '🙏'].map((emoji) => (
                                <button
                                  key={emoji}
                                  onClick={() => handleReactMessage(msg.id, emoji)}
                                  className="w-5 h-5 flex items-center justify-center text-xs hover:scale-125 transition cursor-pointer"
                                  title="Thả cảm xúc"
                                >
                                  {emoji}
                                </button>
                              ))}

                              {/* Copy Text */}
                              <button
                                onClick={() => handleCopyMessage(msg.id, msg.content)}
                                className="p-1 text-slate-500 hover:text-slate-900 transition cursor-pointer"
                                title="Sao chép nội dung"
                              >
                                {copiedMsgId === msg.id ? (
                                  <Check className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>

                              {/* Admin Delete */}
                              {isAdmin && onDeleteMessage && (
                                <button
                                  onClick={() => {
                                    if (window.confirm('Xóa tin nhắn này?')) {
                                      onDeleteMessage(msg.id);
                                    }
                                  }}
                                  className="p-1 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                                  title="Xóa tin nhắn"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>

                          </div>
                        </div>
                      );
                    })}

                  </div>
                ))}

                <div ref={chatEndRef} />
              </div>

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
                <div className="absolute bottom-16 left-8 bg-white border border-slate-300 rounded-2xl p-2 shadow-2xl z-30 w-48 animate-fadeIn space-y-1">
                  <button
                    onClick={() => {
                      if (activeCustomer) onOpenAddOrder(activeCustomer);
                      setShowAttachMenu(false);
                    }}
                    className="w-full px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-emerald-50 rounded-xl flex items-center space-x-2 transition cursor-pointer"
                  >
                    <ShoppingBag className="w-4 h-4 text-emerald-600" />
                    <span>Tạo Đơn Hàng Mới</span>
                  </button>
                  <button
                    onClick={() => {
                      handleApplyTemplate('Dạ em gửi anh/chị thông tin tài khoản và xác nhận đơn hàng ạ: ...');
                      setShowAttachMenu(false);
                    }}
                    className="w-full px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-blue-50 rounded-xl flex items-center space-x-2 transition cursor-pointer"
                  >
                    <FileText className="w-4 h-4 text-blue-600" />
                    <span>Gửi Báo Giá / Bill</span>
                  </button>
                </div>
              )}

              {/* WhatsApp Authentic Input Bar */}
              <div className="p-3 bg-[#f0f2f5] border-t border-slate-300 shrink-0 flex items-center space-x-2 z-10">
                {/* Emoji Trigger */}
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className={`p-2 rounded-full text-slate-600 hover:bg-slate-200 transition cursor-pointer ${showEmojiPicker ? 'text-[#008069]' : ''}`}
                  title="Emoji"
                >
                  <Smile className="w-5 h-5" />
                </button>

                {/* Attachment Menu Trigger */}
                <button
                  type="button"
                  onClick={() => setShowAttachMenu(!showAttachMenu)}
                  className={`p-2 rounded-full text-slate-600 hover:bg-slate-200 transition cursor-pointer ${showAttachMenu ? 'text-[#008069]' : ''}`}
                  title="Đính kèm tài liệu, đơn hàng"
                >
                  <Paperclip className="w-5 h-5" />
                </button>

                {/* Quick Canned Template Trigger */}
                <button
                  type="button"
                  onClick={() => setShowTemplatePicker(!showTemplatePicker)}
                  className={`p-2 rounded-full text-amber-600 hover:bg-amber-100 transition cursor-pointer ${showTemplatePicker ? 'bg-amber-100' : ''}`}
                  title="Mẫu tin nhắn nhanh (/)"
                >
                  <Zap className="w-5 h-5 fill-amber-500 text-amber-500" />
                </button>

                {/* Textarea Input */}
                <div className="flex-1 bg-white rounded-xl border border-slate-300 focus-within:border-[#00a884] focus-within:ring-1 focus-within:ring-[#00a884] px-3.5 py-1.5 transition">
                  <textarea
                    ref={textareaRef}
                    rows={1}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Nhập tin nhắn WhatsApp (Nhấn Enter để gửi, Shift+Enter xuống dòng)..."
                    className="w-full bg-transparent text-xs text-slate-900 focus:outline-none resize-none placeholder-slate-400 max-h-24 leading-5"
                  />
                </div>

                {/* Send Button */}
                <button
                  type="button"
                  onClick={() => handleSend()}
                  disabled={!inputText.trim()}
                  className="w-10 h-10 rounded-full bg-[#00a884] hover:bg-[#008069] disabled:opacity-50 text-white flex items-center justify-center transition shadow-md cursor-pointer shrink-0"
                  title="Gửi tin nhắn"
                >
                  <Send className="w-4 h-4" />
                </button>
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
          <div className="w-full lg:w-[320px] xl:w-[360px] bg-white border-l border-slate-300 flex flex-col h-full overflow-y-auto whatsapp-scrollbar select-none shrink-0">
            
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

            <div className="p-4 space-y-4 text-xs">
              
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
                <p className="text-xs text-slate-500 font-mono mt-0.5">{activeThread.customerPhone}</p>
                
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
                      className="w-full py-2 px-3 bg-[#008069] hover:bg-[#006232] text-white font-bold rounded-xl text-xs transition flex items-center justify-center space-x-1.5 cursor-pointer shadow-sm"
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      <span>+ Lên Đơn Hàng Mới</span>
                    </button>

                    <button
                      onClick={() => onSelectCustomerDetail(activeCustomer)}
                      className="w-full py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs transition flex items-center justify-center space-x-1.5 cursor-pointer border border-slate-300"
                    >
                      <span>Xem Hồ Sơ Chi Tiết</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
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

            </div>
          </div>
        )}

      </div>
    </div>
  );
};
