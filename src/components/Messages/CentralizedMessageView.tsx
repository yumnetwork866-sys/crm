import React, { useState, useMemo } from 'react';
import {
  MessageSquare,
  Search,
  Send,
  CheckCheck,
  User,
  ShoppingBag,
  Filter,
  ArrowUpRight,
} from 'lucide-react';
import { Customer, CentralMessage, MessageChannel, AppUser } from '../../types';
import { getCustomerGroup } from '../../utils/crmUtils';

interface CentralizedMessageViewProps {
  messages: CentralMessage[];
  customers: Customer[];
  currentUser?: AppUser | null;
  selectedCustomerId?: string | null;
  onSelectCustomerThread: (customerId: string) => void;
  onSendMessage: (customerId: string, content: string, channel: MessageChannel) => void;
  onOpenAddOrder: (customer: Customer) => void;
  onSelectCustomerDetail: (customer: Customer) => void;
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
}) => {
  const [readFilter, setReadFilter] = useState<'all' | 'unread'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [inputText, setInputText] = useState('');

  // Group messages by customerId to create thread list
  const threads = useMemo(() => {
    const map = new Map<
      string,
      {
        customer: Customer | null;
        customerName: string;
        customerPhone: string;
        lastMessage: CentralMessage;
        unreadCount: number;
        messages: CentralMessage[];
      }
    >();

    // 1. Group existing central messages
    messages.forEach((msg) => {
      const existing = map.get(msg.customerId);
      const cust = customers.find((c) => c.id === msg.customerId || c.phone === msg.customerPhone) || null;

      if (!existing) {
        map.set(msg.customerId, {
          customer: cust,
          customerName: msg.customerName || cust?.name || 'Khách Hàng',
          customerPhone: msg.customerPhone || cust?.phone || '',
          lastMessage: msg,
          unreadCount: !msg.isRead && msg.sender === 'customer' ? 1 : 0,
          messages: [msg],
        });
      } else {
        existing.messages.push(msg);
        existing.lastMessage = msg;
        if (!msg.isRead && msg.sender === 'customer') {
          existing.unreadCount += 1;
        }
      }
    });

    // 2. Ensure all CRM customers (including newly added/imported ones like Hoàng Tuấn) appear in thread list
    customers.forEach((cust) => {
      if (!map.has(cust.id)) {
        const logs = cust.automationSequence?.logs || [];
        const custMsgs: CentralMessage[] = logs.map((log, index) => ({
          id: `log_${cust.id}_${index}`,
          customerId: cust.id,
          customerName: cust.name,
          customerPhone: cust.phone,
          sender: 'agent',
          agentName: cust.owner || 'Nguyễn Văn Ánh',
          channel: 'WhatsApp',
          content: log.message,
          timestamp: log.sentAt || cust.lastContact || new Date().toISOString(),
          isRead: true,
        }));

        const lastMsg: CentralMessage = custMsgs.length > 0 ? custMsgs[custMsgs.length - 1] : {
          id: `init_${cust.id}`,
          customerId: cust.id,
          customerName: cust.name,
          customerPhone: cust.phone,
          sender: 'agent',
          agentName: cust.owner || 'Nguyễn Văn Ánh',
          channel: 'WhatsApp',
          content: `Bắt đầu hội thoại WhatsApp với ${cust.name}`,
          timestamp: cust.lastContact || new Date().toISOString(),
          isRead: true,
        };

        map.set(cust.id, {
          customer: cust,
          customerName: cust.name,
          customerPhone: cust.phone,
          lastMessage: lastMsg,
          unreadCount: 0,
          messages: custMsgs,
        });
      }
    });

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.lastMessage.timestamp).getTime() - new Date(a.lastMessage.timestamp).getTime()
    );
  }, [messages, customers]);

  // Filter threads based on search & unread status
  const filteredThreads = useMemo(() => {
    return threads.filter((t) => {
      if (readFilter === 'unread' && t.unreadCount === 0) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = t.customerName.toLowerCase().includes(q);
        const matchesPhone = t.customerPhone.includes(q);
        const matchesContent = t.messages.some((m) => m.content.toLowerCase().includes(q));
        if (!matchesName && !matchesPhone && !matchesContent) return false;
      }
      return true;
    });
  }, [threads, readFilter, searchQuery]);

  // Active thread selection
  const activeThread = useMemo(() => {
    if (!selectedCustomerId && filteredThreads.length > 0) {
      return filteredThreads[0];
    }
    return threads.find((t) => t.customer?.id === selectedCustomerId || t.lastMessage.customerId === selectedCustomerId) || filteredThreads[0] || null;
  }, [threads, filteredThreads, selectedCustomerId]);

  const activeCustomer = activeThread?.customer || null;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeThread) return;

    onSendMessage(activeThread.lastMessage.customerId, inputText.trim(), 'WhatsApp');
    setInputText('');
  };

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 text-slate-900 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 border border-emerald-300 text-[#00793d] flex items-center justify-center font-bold text-xl shrink-0 shadow-sm">
            <MessageSquare className="w-6 h-6 text-[#00793d]" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-extrabold tracking-tight text-slate-900">Hộp Thư Tin Nhắn WhatsApp</h1>
              <span className="bg-emerald-100 text-[#00793d] border border-emerald-300 text-[10px] px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00793d] animate-ping"></span>
                WhatsApp Cloud API (Meta Graph Sync)
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Quản lý tập trung tin nhắn WhatsApp từ khách hàng với thông báo đẩy thời gian thực và âm thanh cảnh báo.
            </p>
          </div>
        </div>
      </div>

      {/* Main Inbox Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[720px] bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        
        {/* Left Sidebar: Threads List & Search (4 Cols) */}
        <div className="lg:col-span-4 bg-white border-r border-slate-200 flex flex-col h-full overflow-hidden">
          
          {/* Search & Read Filter */}
          <div className="p-3 bg-slate-50 border-b border-slate-200 space-y-2">
            <div className="flex items-center space-x-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm tên, SĐT WhatsApp, nội dung..."
                  className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#00793d]"
                />
              </div>

              <button
                onClick={() => setReadFilter(readFilter === 'all' ? 'unread' : 'all')}
                className={`p-1.5 rounded-xl border text-xs font-semibold flex items-center space-x-1 cursor-pointer transition ${
                  readFilter === 'unread'
                    ? 'bg-rose-100 text-rose-700 border-rose-300'
                    : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                }`}
                title="Lọc tin chưa đọc"
              >
                <Filter className="w-3.5 h-3.5" />
                <span className="text-[11px] hidden sm:inline">{readFilter === 'unread' ? 'Chưa đọc' : 'Tất cả'}</span>
              </button>
            </div>
          </div>

          {/* Threads List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {filteredThreads.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                Không tìm thấy hội thoại WhatsApp nào phù hợp.
              </div>
            ) : (
              filteredThreads.map((thread) => {
                const isSelected = activeThread?.lastMessage.customerId === thread.lastMessage.customerId;
                const hasUnread = thread.unreadCount > 0;

                return (
                  <div
                    key={thread.lastMessage.customerId}
                    onClick={() => onSelectCustomerThread(thread.lastMessage.customerId)}
                    className={`p-3.5 flex items-start space-x-3 cursor-pointer transition hover:bg-slate-50 ${
                      isSelected ? 'bg-emerald-50/80 border-l-4 border-[#00793d]' : ''
                    }`}
                  >
                    <div className="relative shrink-0">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 border border-emerald-300 text-[#00793d] flex items-center justify-center font-bold text-sm">
                        {thread.customerName.charAt(0)}
                      </div>
                      {hasUnread && (
                        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-rose-500 rounded-full border-2 border-white flex items-center justify-center text-[9px] text-white font-extrabold">
                          {thread.unreadCount}
                        </span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs truncate ${hasUnread ? 'font-black text-slate-900' : 'font-semibold text-slate-800'}`}>
                          {thread.customerName}
                        </span>
                        <span className="text-[10px] text-slate-400 shrink-0 ml-1">
                          {new Date(thread.lastMessage.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <div className="flex items-center space-x-1.5 mt-0.5">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-[#00793d] border border-emerald-300">
                          WhatsApp
                        </span>
                        <span className="text-[10px] text-slate-500 truncate">{thread.customerPhone}</span>
                      </div>

                      <p className={`text-xs mt-1 truncate ${hasUnread ? 'text-slate-900 font-bold' : 'text-slate-500'}`}>
                        {thread.lastMessage.sender === 'agent' && <span className="text-[#00793d] font-semibold">Bạn: </span>}
                        {thread.lastMessage.content}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Center Panel: Active WhatsApp Chat Messages (8 Cols) */}
        <div className="lg:col-span-8 bg-slate-50 flex flex-col h-full overflow-hidden">
          {activeThread ? (
            <>
              {/* Chat Thread Header */}
              <div className="p-3.5 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-full bg-emerald-100 text-[#00793d] border border-emerald-300 flex items-center justify-center font-bold text-sm">
                    {activeThread.customerName.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="text-sm font-bold text-slate-900">{activeThread.customerName}</h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-[#00793d] border border-emerald-300">
                        WhatsApp
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">{activeThread.customerPhone} • {activeCustomer?.owner || 'Sale Rep'}</p>
                  </div>
                </div>

                {activeCustomer && (
                  <button
                    onClick={() => onSelectCustomerDetail(activeCustomer)}
                    className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer text-xs flex items-center gap-1 font-semibold border border-slate-300"
                    title="Xem chi tiết hồ sơ CRM"
                  >
                    <span>Hồ sơ CRM</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Chat Messages Log Stream */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50">
                <div className="text-center my-1">
                  <span className="px-3 py-1 bg-white rounded-full text-[10px] text-slate-500 border border-slate-200 shadow-sm">
                    Kênh giao tiếp WhatsApp Business API (Meta Graph)
                  </span>
                </div>

                {activeThread.messages.map((msg) => {
                  const isAgent = msg.sender === 'agent';
                  const senderName = isAgent
                    ? (msg.agentName || currentUser?.name || 'Nguyễn Văn Ánh')
                    : msg.customerName;

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isAgent ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs shadow-sm space-y-1 ${
                          isAgent
                            ? 'bg-[#d9fdd3] text-slate-900 rounded-tr-none border border-[#b2f2a7]'
                            : 'bg-white text-slate-800 rounded-tl-none border border-slate-200'
                        }`}
                      >
                        <div className={`flex items-center justify-between gap-4 text-[10px] pb-0.5 ${isAgent ? 'text-[#00793d] font-bold' : 'text-slate-400 font-semibold'}`}>
                          <span>{senderName}</span>
                          <span className="text-slate-400 font-normal">{new Date(msg.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>

                        <p className="leading-relaxed whitespace-pre-wrap text-slate-900">{msg.content}</p>

                        {isAgent && (
                          <div className="flex justify-end pt-0.5 text-[10px]">
                            <CheckCheck className="w-3.5 h-3.5 text-[#00793d]" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Send Form */}
              <form onSubmit={handleSend} className="p-3 bg-white border-t border-slate-200 shrink-0 flex items-center space-x-2">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Nhập phản hồi tin nhắn WhatsApp cho khách..."
                  className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-4 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#00793d] placeholder-slate-400"
                />
                <button
                  type="submit"
                  disabled={!inputText.trim()}
                  className="px-4 py-2 bg-[#00793d] hover:bg-[#006232] disabled:opacity-50 text-white font-bold rounded-xl text-xs transition flex items-center space-x-1.5 cursor-pointer shadow-sm"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Gửi</span>
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8 text-center text-slate-400 text-xs">
              Chọn một hội thoại WhatsApp bên trái để xem tin nhắn.
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
