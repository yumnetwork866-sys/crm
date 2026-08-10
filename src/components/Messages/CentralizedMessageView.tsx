import React, { useState, useMemo } from 'react';
import {
  MessageSquare,
  Search,
  Send,
  CheckCheck,
  Phone,
  User,
  ShoppingBag,
  Sparkles,
  Zap,
  Filter,
  PlusCircle,
  Clock,
  ShieldCheck,
  Tag,
  ArrowUpRight,
  Bot,
  BellRing,
  RefreshCw,
} from 'lucide-react';
import { Customer, CentralMessage, MessageChannel } from '../../types';
import { getCustomerGroup } from '../../utils/crmUtils';

interface CentralizedMessageViewProps {
  messages: CentralMessage[];
  customers: Customer[];
  selectedCustomerId?: string | null;
  onSelectCustomerThread: (customerId: string) => void;
  onSendMessage: (customerId: string, content: string, channel: MessageChannel) => void;
  onSimulateIncoming: () => void;
  onOpenAddOrder: (customer: Customer) => void;
  onSelectCustomerDetail: (customer: Customer) => void;
}

export const CentralizedMessageView: React.FC<CentralizedMessageViewProps> = ({
  messages,
  customers,
  selectedCustomerId,
  onSelectCustomerThread,
  onSendMessage,
  onSimulateIncoming,
  onOpenAddOrder,
  onSelectCustomerDetail,
}) => {
  const [activeChannelFilter, setActiveChannelFilter] = useState<string>('all');
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

    // Process all messages in order
    messages.forEach((msg) => {
      const existing = map.get(msg.customerId);
      const cust = customers.find((c) => c.id === msg.customerId) || null;

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
        existing.lastMessage = msg; // assuming messages are sorted chronologically
        if (!msg.isRead && msg.sender === 'customer') {
          existing.unreadCount += 1;
        }
      }
    });

    // Convert map to array and sort by last message timestamp (descending)
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.lastMessage.timestamp).getTime() - new Date(a.lastMessage.timestamp).getTime()
    );
  }, [messages, customers]);

  // Filter threads based on user inputs
  const filteredThreads = useMemo(() => {
    return threads.filter((t) => {
      // Channel filter
      if (activeChannelFilter !== 'all' && t.lastMessage.channel !== activeChannelFilter) {
        return false;
      }
      // Read filter
      if (readFilter === 'unread' && t.unreadCount === 0) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = t.customerName.toLowerCase().includes(q);
        const matchesPhone = t.customerPhone.includes(q);
        const matchesContent = t.messages.some((m) => m.content.toLowerCase().includes(q));
        if (!matchesName && !matchesPhone && !matchesContent) return false;
      }
      return true;
    });
  }, [threads, activeChannelFilter, readFilter, searchQuery]);

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

    const channel = activeThread.lastMessage.channel || 'WhatsApp';
    onSendMessage(activeThread.lastMessage.customerId, inputText.trim(), channel);
    setInputText('');
  };

  const handleQuickReply = (text: string) => {
    if (!activeThread) return;
    const channel = activeThread.lastMessage.channel || 'WhatsApp';
    onSendMessage(activeThread.lastMessage.customerId, text, channel);
  };

  const getChannelBadge = (channel: MessageChannel) => {
    switch (channel) {
      case 'WhatsApp':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-[#00793d] border border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30">WhatsApp</span>;
      case 'Zalo':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-300 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30">Zalo</span>;
      case 'Facebook':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-300 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-500/30">Facebook</span>;
      case 'TikTok':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-800 border border-slate-400 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600">TikTok</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-300">LiveChat</span>;
    }
  };

  const quickReplies = [
    'Chào anh/chị! Em hỗ trợ tư vấn sản phẩm cho mình ạ.',
    'Dạ mẫu sản phẩm này hiện đang có sẵn hàng tại kho.',
    'Em đã lên đơn thành công và tạo mã vận đơn cho mình rồi ạ!',
    'Cảm ơn anh/chị đã ủng hộ YumNetwork CRM!',
  ];

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600/30 border border-indigo-500/40 text-indigo-400 flex items-center justify-center font-bold text-xl shrink-0 shadow-inner">
            <MessageSquare className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-extrabold tracking-tight">Hộp Thư Tin Nhắn Tập Trung</h1>
              <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] px-2.5 py-0.5 rounded-full font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                Meta Graph & Omnichannel Sync
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Quản lý đồng bộ tin nhắn khách hàng từ WhatsApp, Facebook, Zalo & TikTok với thông báo đẩy thời gian thực.
            </p>
          </div>
        </div>

        {/* Action Button to Simulate Incoming Message */}
        <button
          onClick={onSimulateIncoming}
          className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-xl text-xs transition shadow-lg shadow-indigo-600/30 flex items-center space-x-2 shrink-0 cursor-pointer"
          title="Nhấp để tạo tin nhắn giả lập từ khách hàng mới hoặc sẵn có"
        >
          <BellRing className="w-4 h-4 text-amber-300 animate-bounce" />
          <span>Giả Lập Tin Nhắn Đến</span>
        </button>
      </div>

      {/* Main Inbox Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[720px] bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
        
        {/* Left Sidebar: Threads List & Filters (4 Cols) */}
        <div className="lg:col-span-4 bg-slate-900/90 border-r border-slate-800 flex flex-col h-full overflow-hidden">
          
          {/* Channel Filters */}
          <div className="p-3 bg-slate-950/60 border-b border-slate-800 space-y-2.5">
            <div className="flex items-center space-x-1 overflow-x-auto pb-1 no-scrollbar">
              {[
                { id: 'all', label: 'Tất cả' },
                { id: 'WhatsApp', label: 'WhatsApp' },
                { id: 'Zalo', label: 'Zalo' },
                { id: 'Facebook', label: 'Facebook' },
                { id: 'TikTok', label: 'TikTok' },
              ].map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveChannelFilter(c.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                    activeChannelFilter === c.id
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {/* Search & Read Filter */}
            <div className="flex items-center space-x-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm tên, SĐT, nội dung..."
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <button
                onClick={() => setReadFilter(readFilter === 'all' ? 'unread' : 'all')}
                className={`p-1.5 rounded-xl border text-xs font-semibold flex items-center space-x-1 cursor-pointer transition ${
                  readFilter === 'unread'
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                    : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
                }`}
                title="Lọc tin chưa đọc"
              >
                <Filter className="w-3.5 h-3.5" />
                <span className="text-[11px] hidden sm:inline">{readFilter === 'unread' ? 'Chưa đọc' : 'Tất cả'}</span>
              </button>
            </div>
          </div>

          {/* Threads List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
            {filteredThreads.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                Không tìm thấy hội thoại nào phù hợp.
              </div>
            ) : (
              filteredThreads.map((thread) => {
                const isSelected = activeThread?.lastMessage.customerId === thread.lastMessage.customerId;
                const hasUnread = thread.unreadCount > 0;

                return (
                  <div
                    key={thread.lastMessage.customerId}
                    onClick={() => onSelectCustomerThread(thread.lastMessage.customerId)}
                    className={`p-3.5 flex items-start space-x-3 cursor-pointer transition hover:bg-slate-800/50 ${
                      isSelected ? 'bg-indigo-950/40 border-l-4 border-indigo-500' : ''
                    }`}
                  >
                    <div className="relative shrink-0">
                      <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 text-slate-200 flex items-center justify-center font-bold text-sm">
                        {thread.customerName.charAt(0)}
                      </div>
                      {hasUnread && (
                        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-rose-500 rounded-full border-2 border-slate-900 flex items-center justify-center text-[9px] text-white font-extrabold">
                          {thread.unreadCount}
                        </span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs truncate ${hasUnread ? 'font-black text-white' : 'font-semibold text-slate-200'}`}>
                          {thread.customerName}
                        </span>
                        <span className="text-[10px] text-slate-500 shrink-0 ml-1">
                          {new Date(thread.lastMessage.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <div className="flex items-center space-x-1.5 mt-0.5">
                        {getChannelBadge(thread.lastMessage.channel)}
                        <span className="text-[10px] text-slate-400 truncate">{thread.customerPhone}</span>
                      </div>

                      <p className={`text-xs mt-1 truncate ${hasUnread ? 'text-slate-100 font-medium' : 'text-slate-400'}`}>
                        {thread.lastMessage.sender === 'agent' && <span className="text-indigo-400">Bạn: </span>}
                        {thread.lastMessage.content}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Center Panel: Active Chat Messages (5 Cols) */}
        <div className="lg:col-span-5 bg-slate-950/40 flex flex-col h-full overflow-hidden border-r border-slate-800">
          {activeThread ? (
            <>
              {/* Chat Thread Header */}
              <div className="p-3.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-full bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 flex items-center justify-center font-bold text-sm">
                    {activeThread.customerName.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="text-sm font-bold text-white">{activeThread.customerName}</h3>
                      {getChannelBadge(activeThread.lastMessage.channel)}
                    </div>
                    <p className="text-xs text-slate-400">{activeThread.customerPhone} • {activeCustomer?.owner || 'Sale Rep'}</p>
                  </div>
                </div>

                {activeCustomer && (
                  <button
                    onClick={() => onSelectCustomerDetail(activeCustomer)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer text-xs flex items-center gap-1 font-semibold border border-slate-700"
                    title="Xem chi tiết hồ sơ CRM"
                  >
                    <span>Hồ sơ CRM</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Chat Messages Log Stream */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3">
                <div className="text-center my-1">
                  <span className="px-3 py-1 bg-slate-900 rounded-full text-[10px] text-slate-400 border border-slate-800">
                    Kênh giao tiếp mã hóa Meta Business APIs • {activeThread.lastMessage.channel}
                  </span>
                </div>

                {activeThread.messages.map((msg) => {
                  const isAgent = msg.sender === 'agent';
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isAgent ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs shadow-sm space-y-1 ${
                          isAgent
                            ? 'bg-indigo-600 text-white rounded-tr-none border border-indigo-500'
                            : 'bg-slate-800 text-slate-100 rounded-tl-none border border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-4 text-[10px] opacity-75 pb-0.5">
                          <span className="font-semibold">{isAgent ? 'Nhân viên Sale' : msg.customerName}</span>
                          <span>{new Date(msg.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>

                        <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>

                        {isAgent && (
                          <div className="flex justify-end pt-0.5 text-[10px] text-indigo-200">
                            <CheckCheck className="w-3.5 h-3.5 text-indigo-300" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Quick Template Replies */}
              <div className="px-3 py-2 bg-slate-900 border-t border-slate-800 shrink-0 flex items-center space-x-1.5 overflow-x-auto no-scrollbar">
                <span className="text-[10px] font-bold text-indigo-400 shrink-0 flex items-center gap-1">
                  <Zap className="w-3 h-3" /> Mẫu nhanh:
                </span>
                {quickReplies.map((qr, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleQuickReply(qr)}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-[10px] transition shrink-0 border border-slate-700/60 cursor-pointer"
                  >
                    {qr.length > 22 ? qr.substring(0, 22) + '...' : qr}
                  </button>
                ))}
              </div>

              {/* Send Form */}
              <form onSubmit={handleSend} className="p-3 bg-slate-900 border-t border-slate-800 shrink-0 flex items-center space-x-2">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={`Nhập phản hồi gửi qua ${activeThread.lastMessage.channel}...`}
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 placeholder-slate-400"
                />
                <button
                  type="submit"
                  disabled={!inputText.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition flex items-center space-x-1.5 cursor-pointer shadow-md shadow-indigo-600/20"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Gửi</span>
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8 text-center text-slate-500 text-xs">
              Chọn một hội thoại bên trái để xem lịch sử tin nhắn.
            </div>
          )}
        </div>

        {/* Right Panel: Customer Info & Quick Actions (3 Cols) */}
        <div className="lg:col-span-3 bg-slate-900/70 p-4 h-full overflow-y-auto space-y-4">
          {activeCustomer ? (
            <>
              {/* Customer Profile Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center space-y-2">
                <div className="w-14 h-14 mx-auto rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center text-xl font-black shadow-lg">
                  {activeCustomer.name.charAt(0)}
                </div>
                <h4 className="text-sm font-bold text-white">{activeCustomer.name}</h4>
                <p className="text-xs text-slate-400">{activeCustomer.phone}</p>
                <div className="pt-2 flex items-center justify-center gap-1 text-[10px]">
                  <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full font-semibold">
                    {activeCustomer.status}
                  </span>
                  <span className="px-2 py-0.5 bg-slate-800 text-slate-300 border border-slate-700 rounded-full">
                    {activeCustomer.source}
                  </span>
                </div>
              </div>

              {/* Financial Stats */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-400">
                  <span>Tổng đơn hàng:</span>
                  <span className="font-bold text-white">{activeCustomer.totalOrders} đơn</span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Tổng chi tiêu:</span>
                  <span className="font-bold text-emerald-400">
                    RM {(activeCustomer.totalSpent || 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Nhóm CRM:</span>
                  <span className="font-bold text-purple-300">
                    {getCustomerGroup(activeCustomer)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Sale Phụ Trách:</span>
                  <span className="font-semibold text-slate-200">{activeCustomer.owner}</span>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="space-y-2">
                <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Thao Tác Nhanh</h5>
                
                <button
                  onClick={() => onOpenAddOrder(activeCustomer)}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition flex items-center justify-center space-x-2 cursor-pointer shadow-md shadow-emerald-600/20"
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>+ Tạo Đơn Hàng Mới</span>
                </button>

                <button
                  onClick={() => onSelectCustomerDetail(activeCustomer)}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl text-xs transition border border-slate-700 flex items-center justify-center space-x-2 cursor-pointer"
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Xem Chi Tiết Customer</span>
                </button>
              </div>
            </>
          ) : (
            <div className="p-6 text-center text-slate-500 text-xs">
              Chưa chọn khách hàng.
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
