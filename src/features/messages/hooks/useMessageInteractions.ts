import { useEffect, useState } from 'react';
import type { CentralMessage } from '../../../types';
import { api } from '../../../utils/apiClient';
import type { MessageThread } from '../types';

interface UseMessageInteractionsOptions {
  activeThread: MessageThread | null;
  selectedPhoneId: string;
  onReplyMessage: (message: CentralMessage) => void;
}

export function useMessageInteractions({
  activeThread,
  selectedPhoneId,
  onReplyMessage,
}: UseMessageInteractionsOptions) {
  const [messageReactions, setMessageReactions] = useState<Record<string, string>>({});
  const [activeReactionPickerMsgId, setActiveReactionPickerMsgId] = useState<string | null>(null);
  const [showExpandedReactionPickerMsgId, setShowExpandedReactionPickerMsgId] = useState<string | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);

  useEffect(() => {
    const closeReactionPickers = () => {
      setActiveReactionPickerMsgId(null);
      setShowExpandedReactionPickerMsgId(null);
    };
    window.addEventListener('click', closeReactionPickers);
    return () => window.removeEventListener('click', closeReactionPickers);
  }, []);

  const jumpToQuotedMessage = (messageId: string) => {
    if (!messageId) return;
    setHighlightedMessageId(messageId);
    setTimeout(() => {
      const target = document.querySelector(`[data-msg-id="${messageId}"]`)
        || document.getElementById(`msg-${messageId}`);
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 30);
    setTimeout(() => {
      setHighlightedMessageId((current) => current === messageId ? null : current);
    }, 2500);
  };

  const copyMessage = (messageId: string, content: string) => {
    void navigator.clipboard.writeText(content);
    setCopiedMsgId(messageId);
    setTimeout(() => setCopiedMsgId(null), 2000);
  };

  const reactToMessage = async (message: CentralMessage, emoji: string) => {
    const nextEmoji = messageReactions[message.id] === emoji ? '' : emoji;
    setMessageReactions((current) => ({ ...current, [message.id]: nextEmoji }));
    setActiveReactionPickerMsgId(null);
    setShowExpandedReactionPickerMsgId(null);

    try {
      await api.post('/meta/messages/react', {
        messageId: message.id,
        emoji: nextEmoji,
        customerPhone: activeThread?.customerPhone || activeThread?.customer?.phone || message.customerPhone,
        customerId: message.customerId,
        senderPhoneId: selectedPhoneId,
      });
    } catch (error) {
      console.warn('Real reaction dispatch offline fallback:', error);
    }
  };

  const replyToMessage = (message: CentralMessage) => {
    setActiveReactionPickerMsgId(null);
    setShowExpandedReactionPickerMsgId(null);
    onReplyMessage(message);
  };

  return {
    messageReactions,
    activeReactionPickerMsgId,
    setActiveReactionPickerMsgId,
    showExpandedReactionPickerMsgId,
    setShowExpandedReactionPickerMsgId,
    highlightedMessageId,
    copiedMsgId,
    handleJumpToQuotedMessage: jumpToQuotedMessage,
    handleCopyMessage: copyMessage,
    handleReactMessage: reactToMessage,
    handleReplyMessage: replyToMessage,
  };
}
