import React, { useCallback, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ChevronDown } from 'lucide-react';
import type { AppUser, CentralMessage, Customer } from '../../../types';
import { getDiceBearAvatar, STAFF_DICEBEAR_STYLE } from '../../../utils/crmUtils';
import type { AiProfile } from '../hooks/useAiProfile';
import type { TypingUser } from '../hooks/useThreadTyping';
import type { MessageDateGroup, MessageThread } from '../types';
import { MessageBubble } from './MessageBubble';

export interface MessageVirtualListProps {
  chatContainerRef: React.RefObject<HTMLDivElement | null>;
  chatEndRef: React.RefObject<HTMLDivElement | null>;
  showScrollBottomBtn: boolean;
  scrollToBottom: (behavior?: 'smooth' | 'auto') => void;
  groupedMessagesByDate: MessageDateGroup[];
  displayedMessages: CentralMessage[];
  activeThread: MessageThread;
  activeCustomer: Customer | null;
  users: AppUser[];
  effectiveCurrentUser?: AppUser | null;
  aiProfile?: AiProfile;
  typingUsers: TypingUser[];
  messageReactions: Record<string, string>;
  activeReactionPickerMsgId: string | null;
  onSetActiveReactionPickerMsgId: (id: string | null) => void;
  showExpandedReactionPickerMsgId: string | null;
  onSetShowExpandedReactionPickerMsgId: (id: string | null) => void;
  highlightedMessageId: string | null;
  onReactMessage: (msg: CentralMessage, emoji: string) => void | Promise<void>;
  onReplyMessage: (msg: CentralMessage) => void;
  onJumpToQuotedMessage: (messageId: string) => void;
  onPreviewImage: (imgUrl: string) => void;
  onRetryMessage?: (messageId: string) => void;
  isLoadingOlderMessages?: boolean;
}

export const MessageVirtualList: React.FC<MessageVirtualListProps> = ({
  chatContainerRef,
  chatEndRef,
  showScrollBottomBtn,
  scrollToBottom,
  groupedMessagesByDate,
  displayedMessages,
  activeThread,
  activeCustomer,
  users,
  effectiveCurrentUser,
  aiProfile,
  typingUsers,
  messageReactions,
  activeReactionPickerMsgId,
  onSetActiveReactionPickerMsgId,
  showExpandedReactionPickerMsgId,
  onSetShowExpandedReactionPickerMsgId,
  highlightedMessageId,
  onReactMessage,
  onReplyMessage,
  onJumpToQuotedMessage,
  onPreviewImage,
  onRetryMessage,
  isLoadingOlderMessages = false,
}) => {
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

  const handleJumpToQuotedMessage = useCallback((messageId: string) => {
    const rowIndex = messageRowIndexById.get(messageId);
    if (rowIndex !== undefined) {
      messageVirtualizer.scrollToIndex(rowIndex, { align: 'center' });
    }
    window.setTimeout(() => onJumpToQuotedMessage(messageId), 50);
  }, [messageRowIndexById, messageVirtualizer, onJumpToQuotedMessage]);

  const handleImageLoad = useCallback(() => {
    scrollToBottom('auto');
  }, [scrollToBottom]);

  return (
    <>
      {/* WhatsApp Messages Stream with Authentic Wallpaper Pattern */}
      <div
        ref={chatContainerRef}
        id="chat-messages-container"
        className="flex-1 p-4 overflow-y-auto space-y-4 whatsapp-chat-bg whatsapp-scrollbar"
      >
        {isLoadingOlderMessages && (
          <div className="flex justify-center my-2 select-none">
            <span className="bg-white/95 px-3 py-1 rounded-lg text-[11px] font-semibold text-slate-500 shadow-2xs border border-slate-200">
              Đang tải tin nhắn cũ...
            </span>
          </div>
        )}
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
                  const absoluteMessageIndex = row.startIndex + msgIdx;
                  const prevMsg = displayedMessages[absoluteMessageIndex - 1] || null;
                  const nextMsg = displayedMessages[absoluteMessageIndex + 1] || null;

                  return (
                    <MessageBubble
                      key={msg.id}
                      msg={msg}
                      prevMsg={prevMsg}
                      nextMsg={nextMsg}
                      activeThread={activeThread}
                      activeCustomer={activeCustomer}
                      users={users}
                      effectiveCurrentUser={effectiveCurrentUser}
                      aiProfile={aiProfile}
                      reaction={messageReactions[msg.id] !== undefined ? messageReactions[msg.id] : (msg.reaction || undefined)}
                      activeReactionPickerMsgId={activeReactionPickerMsgId}
                      onSetActiveReactionPickerMsgId={onSetActiveReactionPickerMsgId}
                      showExpandedReactionPickerMsgId={showExpandedReactionPickerMsgId}
                      onSetShowExpandedReactionPickerMsgId={onSetShowExpandedReactionPickerMsgId}
                      highlightedMessageId={highlightedMessageId}
                      onReactMessage={onReactMessage}
                      onReplyMessage={onReplyMessage}
                      onJumpToQuotedMessage={handleJumpToQuotedMessage}
                      onPreviewImage={onPreviewImage}
                      onImageLoad={handleImageLoad}
                      onRetryMessage={onRetryMessage}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>

        {typingUsers.length > 0 && (
          <div className="flex flex-col items-end gap-1 px-4 pb-2 pt-1">
            {typingUsers.map((tUser) => {
              const matchedUser = users.find(
                (u) => u.id === tUser.id || u.name?.trim().toLowerCase() === tUser.name?.trim().toLowerCase()
              );
              const avatarSrc =
                tUser.avatar ||
                matchedUser?.avatar ||
                getDiceBearAvatar(tUser.name || 'Agent', STAFF_DICEBEAR_STYLE);

              return (
                <div
                  key={tUser.id}
                  className="flex flex-col items-end animate-fadeIn select-none"
                  title={`${tUser.name} đang soạn tin...`}
                >
                  {/* Staff Name Tag */}
                  <span className="text-[10px] font-semibold text-slate-500 mr-9 mb-1 leading-none">
                    {tUser.name}
                  </span>

                  <div className="flex items-end justify-end gap-2">
                    {/* Typing Bubble with 3 animated bouncing dots */}
                    <div
                      className="flex items-center justify-center rounded-2xl rounded-br-xs bg-[#d9fdd3] px-3.5 py-2.5 shadow-2xs min-h-[34px]"
                      aria-label={`${tUser.name} đang soạn tin`}
                    >
                      <svg className="w-7 h-3.5 text-[#54656f]" viewBox="0 0 24 12" fill="currentColor">
                        <circle cx="4" cy="6" r="2.5">
                          <animate attributeName="cy" values="6;2;6;6" dur="1s" repeatCount="indefinite" begin="0s" />
                          <animate attributeName="opacity" values="0.4;1;0.4;0.4" dur="1s" repeatCount="indefinite" begin="0s" />
                        </circle>
                        <circle cx="12" cy="6" r="2.5">
                          <animate attributeName="cy" values="6;2;6;6" dur="1s" repeatCount="indefinite" begin="0.2s" />
                          <animate attributeName="opacity" values="0.4;1;0.4;0.4" dur="1s" repeatCount="indefinite" begin="0.2s" />
                        </circle>
                        <circle cx="20" cy="6" r="2.5">
                          <animate attributeName="cy" values="6;2;6;6" dur="1s" repeatCount="indefinite" begin="0.4s" />
                          <animate attributeName="opacity" values="0.4;1;0.4;0.4" dur="1s" repeatCount="indefinite" begin="0.4s" />
                        </circle>
                      </svg>
                    </div>

                    {/* Staff Avatar */}
                    <div
                      className="w-7 h-7 rounded-full overflow-hidden bg-emerald-50 shrink-0 shadow-2xs mb-0.5"
                      title={tUser.name}
                    >
                      <img
                        src={avatarSrc}
                        alt={tUser.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = getDiceBearAvatar(tUser.name || 'Agent', STAFF_DICEBEAR_STYLE);
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

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
    </>
  );
};
