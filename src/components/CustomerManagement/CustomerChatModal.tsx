import React, { useState } from 'react';
import { X, Send, CheckCheck, ShieldAlert, Sparkles, User } from 'lucide-react';
import type { Customer, CentralMessage, AppUser } from '../../types';
import { isSamePhoneNumber } from '../../utils/crmUtils';
import { INITIAL_USERS } from '../../data/mockData';

interface CustomerChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer | null;
  currentUser?: AppUser | null;
  centralMessages?: CentralMessage[];
  onSendMessage: (customerId: string, text: string, phone?: string, name?: string) => void;
}

export const CustomerChatModal: React.FC<CustomerChatModalProps> = ({
  isOpen,
  onClose,
  customer,
  currentUser,
  centralMessages = [],
  onSendMessage,
}) => {
  const [inputText, setInputText] = useState('');

  if (!isOpen || !customer) return null;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    onSendMessage(customer.id, inputText.trim(), customer.phone, customer.name);
    setInputText('');
  };

  const activeCentralMsgs = centralMessages.filter((m) => {
    const matchId = Boolean(m.customerId && customer.id && m.customerId === customer.id);
    const matchPhone = isSamePhoneNumber(m.customerPhone || m.customerId, customer.phone || customer.id);
    return matchId || matchPhone;
  });

  const displayMessages = activeCentralMsgs.map((m) => ({
    id: m.id,
    senderName: m.sender === 'agent' ? (m.agentName || currentUser?.name || 'Nguyễn Văn Ánh') : m.customerName,
    time: new Date(m.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    content: m.content,
    isAgent: m.sender === 'agent',
  }));

  const isOptedIn = Boolean(customer.whatsappOptIn || displayMessages.length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl flex flex-col h-[650px] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700/80 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
              <img
                src={customer.avatar || `https://api.dicebear.com/10.x/adventurer/svg?seed=${encodeURIComponent(customer.phone || customer.name)}`}
                alt="avatar"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">{customer.name}</h3>
                {isOptedIn ? (
                  <span className="text-[10px] bg-emerald-100 dark:bg-emerald-500/20 text-[#00793d] dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30 px-2 py-0.5 rounded-full font-medium">
                    ✓ Opt-In Policy (WABA)
                  </span>
                ) : (
                  <span className="text-[10px] bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-500/30 px-2 py-0.5 rounded-full font-medium">
                    ! Chưa Opt-In
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">{customer.phone}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-900 dark:text-slate-400 hover:text-black dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
            title="Đóng"
          >
            <X className="w-5 h-5 text-slate-900 dark:text-slate-400" />
          </button>
        </div>

        {/* WhatsApp Policy Compliance Header */}
        <div className="px-4 py-2 bg-amber-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-700 dark:text-slate-300 flex items-center space-x-2 shrink-0">
          <ShieldAlert className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>WhatsApp Business Platform: Tin nhắn tuân thủ chính sách Opt-In của khách hàng.</span>
        </div>

        {/* Chat Messages Body */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-white dark:bg-slate-950/60">
          
          <div className="text-center my-2">
            <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800/80 rounded-full text-[11px] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
              Bắt đầu hội thoại WhatsApp với {customer.name}
            </span>
          </div>

          {displayMessages.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              Chưa có tin nhắn WhatsApp nào cho khách hàng này.
            </div>
          ) : (
            displayMessages.map((msg, index) => {
              const agentAvatar = (currentUser?.name === msg.senderName && currentUser?.avatar)
                ? currentUser.avatar
                : (INITIAL_USERS.find((u) => u.name.toLowerCase() === msg.senderName.toLowerCase())?.avatar || `https://api.dicebear.com/10.x/avataaars/svg?seed=${encodeURIComponent(msg.senderName)}`);
              const customerAvatar = customer.avatar || `https://api.dicebear.com/10.x/adventurer/svg?seed=${encodeURIComponent(customer.phone || customer.name)}`;

              return (
                <div key={index} className={`flex items-end gap-2 ${msg.isAgent ? 'justify-end' : 'justify-start'}`}>
                  {!msg.isAgent && (
                    <div className="w-7 h-7 rounded-full overflow-hidden bg-white border border-slate-200 shrink-0 shadow-2xs mb-0.5">
                      <img src={customerAvatar} alt={customer.name} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-xs shadow-sm space-y-1 ${
                    msg.isAgent
                      ? 'bg-[#d9fdd3] text-slate-900 rounded-tr-none border border-[#b2f2a7]'
                      : 'bg-slate-100 text-slate-900 rounded-tl-none border border-slate-200'
                  }`}>
                    <div className={`flex items-center justify-between gap-4 text-[10px] pb-0.5 ${msg.isAgent ? 'text-[#00793d] font-bold' : 'text-slate-500 font-semibold'}`}>
                      <span>{msg.senderName}</span>
                      <span className="text-slate-400 font-normal">{msg.time}</span>
                    </div>
                    <p className="text-xs leading-relaxed whitespace-pre-wrap text-slate-900">
                      {msg.content}
                    </p>
                    {msg.isAgent && (
                      <div className="flex items-center justify-end space-x-1 text-[10px] text-[#00793d] pt-0.5">
                        <CheckCheck className="w-3.5 h-3.5 text-[#00793d]" />
                      </div>
                    )}
                  </div>
                  {msg.isAgent && (
                    <div className="w-7 h-7 rounded-full overflow-hidden bg-emerald-50 border border-emerald-300 shrink-0 shadow-2xs mb-0.5" title={msg.senderName}>
                      <img src={agentAvatar} alt={msg.senderName} className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
              );
            })
          )}

        </div>

        {/* Sender Identity Banner */}
        <div className="px-4 py-1.5 bg-slate-100 dark:bg-slate-800/70 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 shrink-0 select-none">
          <div className="flex items-center space-x-2 truncate">
            <img
              src={currentUser?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
              alt={currentUser?.name || 'User'}
              className="w-4 h-4 rounded-full object-cover border border-slate-300 shrink-0"
            />
            <span className="text-[11px] truncate">
              Đang nhắn với tư cách: <strong className="text-slate-900 dark:text-white font-bold">{currentUser?.name || 'Nguyễn Văn Ánh'}</strong>
              <span className="ml-1 px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">
                {currentUser?.role || 'Admin'}
              </span>
            </span>
          </div>
        </div>

        {/* Footer Input */}
        <form onSubmit={handleSend} className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shrink-0 flex items-center space-x-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Nhập tin nhắn WhatsApp gửi riêng cho khách..."
            className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#00793d] placeholder-slate-400"
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="px-4 py-2 bg-[#00793d] hover:bg-[#006232] disabled:opacity-50 text-white font-semibold rounded-xl text-xs transition flex items-center space-x-1.5 cursor-pointer shadow-sm"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Gửi</span>
          </button>
        </form>

      </div>
    </div>
  );
};
