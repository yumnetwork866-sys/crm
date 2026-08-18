import React, { useState } from 'react';
import { X, Send, CheckCheck, ShieldAlert, Sparkles } from 'lucide-react';
import { Customer, CentralMessage } from '../../types';
import { isSamePhoneNumber } from '../../utils/crmUtils';

interface CustomerChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer | null;
  centralMessages?: CentralMessage[];
  onSendMessage: (customerId: string, text: string, phone?: string, name?: string) => void;
}

export const CustomerChatModal: React.FC<CustomerChatModalProps> = ({
  isOpen,
  onClose,
  customer,
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
    senderName: m.sender === 'agent' ? (m.agentName || 'Nguyễn Văn Ánh') : m.customerName,
    time: new Date(m.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    content: m.content,
    isAgent: m.sender === 'agent',
  }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden my-8 flex flex-col h-[650px]">
        
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700/80 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-[#00793d] dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30 flex items-center justify-center font-bold text-sm">
              WA
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">{customer.name}</h3>
                {customer.whatsappOptIn ? (
                  <span className="text-[10px] bg-emerald-100 dark:bg-emerald-500/20 text-[#00793d] dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30 px-2 py-0.5 rounded-full font-medium">
                    ✓ Opt-In Policy
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
            displayMessages.map((msg, index) => (
              <div key={index} className={`flex flex-col ${msg.isAgent ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs shadow-sm space-y-1 ${
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
              </div>
            ))
          )}

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
