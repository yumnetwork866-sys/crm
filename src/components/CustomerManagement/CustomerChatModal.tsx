import React, { useState } from 'react';
import { X, Send, MessageSquare } from 'lucide-react';
import { MessageDeliveryStatusIcon } from '../Messages/MessageDeliveryStatusIcon';
import type { Customer, CentralMessage, AppUser } from '../../types';
import { isSamePhoneNumber, formatPhoneWithCountryCode, getCustomerAvatar, getDiceBearAvatar, STAFF_DICEBEAR_STYLE } from '../../utils/crmUtils';
import { useAuth } from '../../contexts/AuthContext';
import { getUserRoleTextStyle } from '../../utils/roleColors';
import { renderFormattedMessage, extractFirstUrl } from '../../utils/formatMessageText';
import { LinkPreviewCard } from '../../features/messages/components/LinkPreviewCard';
import { ProductMessageCard } from '../../features/messages/components/ProductMessageCard';
import { extractProductInfo, isProductContent } from '../../features/messages/utils/messageContent';

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
  const { currentUser: authCurrentUser, users } = useAuth();
  const effectiveCurrentUser = authCurrentUser || currentUser;
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
    status: m.status,
    isRealSent: m.isRealSent,
    errorMessage: m.errorMessage,
  }));


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white border border-slate-200/90 rounded-3xl w-full max-w-2xl flex flex-col h-[680px] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-5 py-3.5 bg-white border-b border-slate-200/90 flex items-center justify-between shrink-0 shadow-2xs">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-slate-100 ring-2 ring-emerald-500/20 flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
                <img
                  src={getCustomerAvatar(customer.avatar, customer.phone || customer.name)}
                  alt="avatar"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#25D366] text-white flex items-center justify-center ring-2 ring-white shadow-2xs">
                <MessageSquare className="w-2.5 h-2.5 fill-white/30" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">{customer.name}</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  WhatsApp
                </span>
              </div>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                {formatPhoneWithCountryCode(customer.phone)}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full text-slate-400 hover:text-slate-800 hover:bg-slate-100 flex items-center justify-center transition cursor-pointer"
            title="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>


        {/* Chat Messages Body */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#efeae2]/45">
          
          <div className="text-center my-1.5">
            <span className="px-3.5 py-1 bg-white/90 rounded-full text-[11px] text-slate-600 border border-slate-200/90 shadow-2xs font-medium">
              Bắt đầu hội thoại WhatsApp với {customer.name}
            </span>
          </div>

          {displayMessages.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              Chưa có tin nhắn WhatsApp nào cho khách hàng này.
            </div>
          ) : (
            displayMessages.map((msg, index) => {
              const isCurrentAgent = Boolean(
                msg.isAgent &&
                effectiveCurrentUser &&
                (
                  !msg.senderName ||
                  msg.senderName.trim().toLowerCase() === effectiveCurrentUser.name.trim().toLowerCase() ||
                  msg.senderName.trim().toLowerCase() === effectiveCurrentUser.email.trim().toLowerCase()
                )
              );
              const matchedUser = isCurrentAgent
                ? effectiveCurrentUser
                : (users.find(
                    (u) =>
                      u.name.trim().toLowerCase() === msg.senderName.trim().toLowerCase() ||
                      u.email.trim().toLowerCase() === msg.senderName.trim().toLowerCase()
                  ) || (effectiveCurrentUser && effectiveCurrentUser.name.trim().toLowerCase() === msg.senderName.trim().toLowerCase() ? effectiveCurrentUser : null));

              const agentAvatar = (isCurrentAgent && effectiveCurrentUser?.avatar)
                ? effectiveCurrentUser.avatar
                : (matchedUser?.avatar || effectiveCurrentUser?.avatar || `https://api.dicebear.com/10.x/avataaars/svg?seed=${encodeURIComponent(msg.senderName)}`);
              const customerAvatar = customer.avatar || `https://api.dicebear.com/10.x/cutouts/svg?seed=${encodeURIComponent(customer.phone || customer.name)}`;

              return (
                <div key={index} className={`flex items-end gap-2 ${msg.isAgent ? 'justify-end' : 'justify-start'}`}>
                  {!msg.isAgent && (
                    <div className="w-7 h-7 rounded-full overflow-hidden bg-white border border-slate-200 shrink-0 shadow-2xs mb-0.5">
                      <img src={customerAvatar} alt={customer.name} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-xs shadow-2xs space-y-1 ${
                    msg.isAgent
                      ? 'bg-[#d9fdd3] text-slate-900 rounded-tr-xs border border-[#b2f2a7]/60'
                      : 'bg-white text-slate-900 rounded-tl-xs border border-slate-200/80'
                  }`}>
                    <div className={`flex items-center justify-between gap-4 text-[10px] pb-0.5 ${msg.isAgent ? 'text-[#00793d] font-bold' : 'text-slate-500 font-semibold'}`}>
                      <span style={msg.isAgent ? getUserRoleTextStyle(matchedUser) : undefined}>
                        {msg.senderName}
                      </span>
                      <span className="text-slate-400 font-normal">{msg.time}</span>
                    </div>
                    {extractFirstUrl(msg.content) && (
                      <LinkPreviewCard url={extractFirstUrl(msg.content)!} />
                    )}
                    {isProductContent(msg.content) ? (
                      <div className="pt-0.5">
                        <ProductMessageCard
                          productInfo={extractProductInfo(msg.content)}
                          timeFormatted={msg.time}
                          isAgent={msg.isAgent}
                          status={msg.status}
                          isRealSent={msg.isRealSent}
                          errorMessage={msg.errorMessage}
                        />
                      </div>
                    ) : (
                      <p className="text-xs leading-relaxed whitespace-pre-wrap text-slate-900">
                        {renderFormattedMessage(msg.content)}
                      </p>
                    )}
                    {msg.isAgent && (
                      <div className="flex items-center justify-end space-x-1 text-[10px] text-[#00793d] pt-0.5">
                        <MessageDeliveryStatusIcon
                          status={msg.status}
                          isRealSent={msg.isRealSent}
                          errorMessage={msg.errorMessage}
                        />
                      </div>
                    )}
                  </div>
                  {msg.isAgent && (
                    <div className="w-7 h-7 rounded-full overflow-hidden bg-emerald-50 border border-emerald-300 shrink-0 shadow-2xs mb-0.5" title={msg.senderName}>
                      <img
                        src={agentAvatar}
                        alt={msg.senderName}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = `https://api.dicebear.com/10.x/avataaars/svg?seed=${encodeURIComponent(msg.senderName)}`;
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })
          )}

        </div>

        {/* Sender Identity Banner */}
        <div className="px-4 py-1.5 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-600 shrink-0 select-none">
          <div className="flex items-center space-x-2 truncate">
            <img
              src={effectiveCurrentUser?.avatar || `https://api.dicebear.com/10.x/avataaars/svg?seed=${encodeURIComponent(effectiveCurrentUser?.name || 'Agent')}`}
              alt={effectiveCurrentUser?.name || 'User'}
              className="w-4 h-4 rounded-full object-cover border border-slate-300 shrink-0"
              onError={(e) => {
                e.currentTarget.src = `https://api.dicebear.com/10.x/avataaars/svg?seed=${encodeURIComponent(effectiveCurrentUser?.name || 'Agent')}`;
              }}
            />
            <span className="text-[11px] truncate">
              Đang nhắn với tư cách: <strong className="text-slate-900 font-bold">{effectiveCurrentUser?.name || 'Nguyễn Văn Ánh'}</strong>
              <span className="ml-1 px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-emerald-100 text-emerald-800">
                {effectiveCurrentUser?.role || 'Admin'}
              </span>
            </span>
          </div>
        </div>

        {/* Footer Input */}
        <form onSubmit={handleSend} className="p-3 bg-[#f0f2f5] border-t border-slate-200/80 shrink-0 flex items-center space-x-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Nhập tin nhắn WhatsApp gửi cho khách..."
            className="flex-1 bg-white border border-slate-300/80 rounded-full px-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-[#00a884] focus:ring-2 focus:ring-emerald-100 placeholder-slate-400 shadow-2xs"
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="w-10 h-10 rounded-full bg-[#00a884] hover:bg-[#008f6f] disabled:opacity-40 text-white flex items-center justify-center transition cursor-pointer shadow-xs shrink-0 active:scale-95"
            title="Gửi tin nhắn"
          >
            <Send className="w-4 h-4 ml-0.5" />
          </button>
        </form>

      </div>
    </div>
  );
};
