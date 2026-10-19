import React from 'react';
import { Eye, Image as ImageIcon, Mic, Plus, Reply, Smile } from 'lucide-react';
import type { AppUser, CentralMessage, Customer } from '../../../types';
import { EmojiPicker } from '../../../components/Common/EmojiPicker';
import { MessageDeliveryStatusIcon } from '../../../components/Messages/MessageDeliveryStatusIcon';
import {
  getCustomerAvatar,
  getDiceBearAvatar,
  STAFF_DICEBEAR_STYLE,
} from '../../../utils/crmUtils';
import { extractFirstUrl, renderFormattedMessage } from '../../../utils/formatMessageText';
import { getUserRoleTextStyle } from '../../../utils/roleColors';
import type { AiProfile } from '../hooks/useAiProfile';
import type { MessageThread } from '../types';
import {
  extractAudioInfo,
  extractDocumentInfo,
  extractImageInfo,
  extractProductInfo,
  extractWhatsAppOrderInfo,
  formatMessagePreview,
  parseMessageContent,
} from '../utils/messageContent';
import { DocumentMessageCard } from './DocumentMessageCard';
import { LinkPreviewCard } from './LinkPreviewCard';
import { ProductMessageCard } from './ProductMessageCard';
import { VoiceMessagePlayer } from './VoiceMessagePlayer';
import { WhatsAppOrderCard } from './WhatsAppOrderCard';

const TranslateIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" {...props}>
    <path d="M4.545 6.714 4.11 8H3l1.862-5h1.284L8 8H6.833l-.435-1.286zm1.634-.736L5.5 3.956h-.049l-.679 2.022z" />
    <path d="M0 2a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v3h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-3H2a2 2 0 0 1-2-2zm2-1a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1zm7.138 9.995q.289.451.63.846c-.748.575-1.673 1.001-2.768 1.292.178.217.451.635.555.867 1.125-.359 2.08-.844 2.886-1.494.777.665 1.739 1.165 2.93 1.472.133-.254.414-.673.629-.89-1.125-.253-2.057-.694-2.82-1.284.681-.747 1.222-1.651 1.621-2.757H14V8h-3v1.047h.765c-.318.844-.74 1.546-1.272 2.13a6 6 0 0 1-.415-.492 2 2 0 0 1-.94.31" />
  </svg>
);

export interface MessageBubbleProps {
  msg: CentralMessage;
  prevMsg: CentralMessage | null;
  nextMsg: CentralMessage | null;
  activeThread: MessageThread;
  activeCustomer: Customer | null;
  users: AppUser[];
  effectiveCurrentUser?: AppUser | null;
  aiProfile?: AiProfile;
  reaction?: string;
  activeReactionPickerMsgId: string | null;
  onSetActiveReactionPickerMsgId: (id: string | null) => void;
  showExpandedReactionPickerMsgId: string | null;
  onSetShowExpandedReactionPickerMsgId: (id: string | null) => void;
  highlightedMessageId: string | null;
  onReactMessage: (msg: CentralMessage, emoji: string) => void | Promise<void>;
  onReplyMessage: (msg: CentralMessage) => void;
  onJumpToQuotedMessage: (messageId: string) => void;
  onPreviewImage: (imgUrl: string) => void;
  onImageLoad: () => void;
  onRetryMessage?: (messageId: string) => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  msg,
  prevMsg,
  nextMsg,
  activeThread,
  activeCustomer,
  users,
  effectiveCurrentUser,
  aiProfile,
  reaction,
  activeReactionPickerMsgId,
  onSetActiveReactionPickerMsgId,
  showExpandedReactionPickerMsgId,
  onSetShowExpandedReactionPickerMsgId,
  highlightedMessageId,
  onReactMessage,
  onReplyMessage,
  onJumpToQuotedMessage,
  onPreviewImage,
  onImageLoad,
  onRetryMessage: requestedRetryMessage,
}) => {
  const onRetryMessage = msg.errorCode === '131026' ? undefined : requestedRetryMessage;
  const isAgent = msg.sender === 'agent';
  const isAiMessage = Boolean(
    msg.isAi
    || (msg.agentName && /trợ lý ai|ai assistant|yum assistant|^🤖/i.test(msg.agentName.trim()))
  );
  const normalizedAgentName = msg.agentName?.trim().toLowerCase() || '';
  const matchedUser = isAgent && !isAiMessage
    ? (users.find((user) => (
        msg.agentId
          ? user.id === msg.agentId
          : user.name.trim().toLowerCase() === normalizedAgentName
            || user.email.trim().toLowerCase() === normalizedAgentName
      )) || (
        effectiveCurrentUser
        && (
          msg.agentId === effectiveCurrentUser.id
          || (!msg.agentId && (
            effectiveCurrentUser.name.trim().toLowerCase() === normalizedAgentName
            || effectiveCurrentUser.email.trim().toLowerCase() === normalizedAgentName
          ))
        )
          ? effectiveCurrentUser
          : null
      ))
    : null;
  const senderName = isAgent
    ? (isAiMessage ? (aiProfile?.name || msg.agentName || 'Trợ lý AI') : (matchedUser?.name || msg.agentName || 'Nhân viên'))
    : (msg.customerName || 'Khách Hàng');
  const timeFormatted = new Date(msg.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

  const isSpeakerChangedFromPrev = !prevMsg || prevMsg.sender !== msg.sender || (isAgent && (prevMsg.agentId || prevMsg.agentName || '') !== (msg.agentId || msg.agentName || '')) || (!isAgent && (prevMsg.customerName || '') !== (msg.customerName || ''));
  const isSpeakerChangedToNext = !nextMsg || nextMsg.sender !== msg.sender || (isAgent && (nextMsg.agentId || nextMsg.agentName || '') !== (msg.agentId || msg.agentName || '')) || (!isAgent && (nextMsg.customerName || '') !== (msg.customerName || ''));

  const isFirstOfTurn = isSpeakerChangedFromPrev;
  const shouldShowAvatar = isSpeakerChangedToNext;

  const isHighlighted = highlightedMessageId === msg.id;

  const customerAvatarSrc = getCustomerAvatar(activeCustomer?.avatar, activeCustomer?.phone || msg.customerPhone || msg.customerName || activeThread?.customerPhone || activeThread?.threadId || 'Customer');

  const isCurrentAgent = Boolean(
    isAgent &&
    effectiveCurrentUser &&
    (
      msg.agentId === effectiveCurrentUser.id
      || (!msg.agentId && normalizedAgentName && (
        normalizedAgentName === effectiveCurrentUser.name.trim().toLowerCase()
        || normalizedAgentName === effectiveCurrentUser.email.trim().toLowerCase()
      ))
    )
  );

  const agentAvatarSrc = matchedUser?.avatar
    || getDiceBearAvatar(matchedUser?.name || senderName || 'Agent', STAFF_DICEBEAR_STYLE);
  const displayedAgentAvatarSrc = isAiMessage ? aiProfile?.avatarUrl : agentAvatarSrc;

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
            onClick={() => onReactMessage(msg, emoji)}
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
            onSetShowExpandedReactionPickerMsgId(showExpandedReactionPickerMsgId === msg.id ? null : msg.id);
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
                void onReactMessage(msg, emoji);
              }}
              onClose={() => onSetShowExpandedReactionPickerMsgId(null)}
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
      id={`msg-${msg.id}`}
      data-msg-id={msg.id}
      className={`flex items-end group w-full ${isAgent ? 'justify-end' : 'justify-start'} ${isFirstOfTurn ? 'mt-3' : 'mt-0.5'}`}
    >
      {/* Customer Avatar on the Left (Incoming) */}
      {!isAgent && (
        <div className="w-8 h-8 mr-2 shrink-0 self-end mb-0.5">
          {shouldShowAvatar ? (
            <div className="w-8 h-8 rounded-full overflow-hidden bg-white shadow-2xs flex items-center justify-center" title={msg.customerName || 'Khách hàng'}>
              <img
                src={customerAvatarSrc}
                alt={msg.customerName || 'Customer'}
                className="w-full h-full object-cover"
                loading="lazy"
                onError={(e) => {
                  e.currentTarget.src = getDiceBearAvatar(activeCustomer?.phone || msg.customerPhone || msg.customerName || 'C');
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
              onReplyMessage(msg);
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
                onSetActiveReactionPickerMsgId(activeReactionPickerMsgId === msg.id ? null : msg.id);
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
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            className="w-6 h-6 rounded-full text-[#667781] hover:text-[#111b21] hover:bg-[#f0f2f5] flex items-center justify-center transition cursor-pointer hover:scale-105"
            title="Dịch tin nhắn"
            aria-label="Dịch tin nhắn"
          >
            <TranslateIcon className="w-3.5 h-3.5" />
          </button>
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
                    onJumpToQuotedMessage(replyQuote.id);
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

            const whatsappOrder = extractWhatsAppOrderInfo(content);
            if (whatsappOrder.isOrder) {
              return (
                <div className="space-y-1">
                  {renderQuoteHeader()}
                  <WhatsAppOrderCard
                    messageId={msg.id}
                    orderInfo={whatsappOrder}
                    timeFormatted={timeFormatted}
                  />
                </div>
              );
            }

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
              const imageUrl = imgInfo.imgUrl;
              return (
                <div className="space-y-1">
                  {renderQuoteHeader()}
                  <div
                    onClick={() => onPreviewImage(imageUrl)}
                    className="relative rounded-lg overflow-hidden cursor-pointer group border border-slate-200 shadow-2xs max-w-sm max-h-72 bg-slate-900/5 min-h-30 flex items-center justify-center"
                  >
                    <img
                      src={imgInfo.imgUrl}
                      alt="Hình ảnh"
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                      loading="eager"
                      onLoad={onImageLoad}
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
            <div className="inline-flex max-w-full items-start gap-1.5 text-right text-[11px] text-rose-600">
              <span className="leading-snug break-words">
                {msg.errorMessage || 'Meta từ chối gửi tin nhắn'}
                {onRetryMessage && (
                  <button
                    type="button"
                    onClick={() => onRetryMessage(msg.id)}
                    className="ml-1 inline cursor-pointer whitespace-nowrap text-[11px] font-bold text-rose-600 underline underline-offset-2 transition hover:text-rose-800"
                  >
                    Thử lại
                  </button>
                )}
              </span>
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
                onSetActiveReactionPickerMsgId(activeReactionPickerMsgId === msg.id ? null : msg.id);
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
            onClick={(e) => e.stopPropagation()}
            className="w-6 h-6 rounded-full text-[#667781] hover:text-[#111b21] hover:bg-[#f0f2f5] flex items-center justify-center transition cursor-pointer hover:scale-105"
            title="Dịch tin nhắn"
            aria-label="Dịch tin nhắn"
          >
            <TranslateIcon className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onReplyMessage(msg);
            }}
            className="w-6 h-6 rounded-full text-[#667781] hover:text-[#111b21] hover:bg-[#f0f2f5] flex items-center justify-center transition cursor-pointer hover:scale-105"
            title="Trả lời tin nhắn này"
          >
            <Reply className="w-3.5 h-3.5 text-[#667781]" />
          </button>
        </div>
      )}

      {/* Agent / configured AI avatar on the right. */}
      {isAgent && displayedAgentAvatarSrc && (
        <div className="w-8 h-8 ml-2 shrink-0 self-end mb-0.5">
          {shouldShowAvatar ? (
            <div className="w-8 h-8 rounded-full overflow-hidden bg-emerald-50 shadow-2xs flex items-center justify-center" title={senderName}>
              <img
                src={displayedAgentAvatarSrc}
                alt={senderName}
                className="w-full h-full object-cover"
                loading="lazy"
                onError={(e) => {
                  if (isAiMessage) e.currentTarget.style.display = 'none';
                  else e.currentTarget.src = getDiceBearAvatar(senderName || 'A', STAFF_DICEBEAR_STYLE);
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
};
