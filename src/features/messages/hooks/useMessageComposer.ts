import { useMemo, useRef, useState } from 'react';
import type { ChangeEvent, ClipboardEvent, FormEvent, KeyboardEvent } from 'react';
import type { CentralMessage, MessageChannel } from '../../../types';
import { QUICK_TEMPLATES } from '../constants';
import type { MessageThread } from '../types';
import { playPopSound } from '../utils/playPopSound';

interface UseMessageComposerOptions {
  activeThread: MessageThread | null;
  selectedPhoneId: string;
  soundEnabled: boolean;
  onSendMessage: (
    customerId: string,
    content: string,
    channel: MessageChannel,
    customerPhone?: string,
    customerName?: string,
    senderPhoneId?: string,
    replyTo?: NonNullable<CentralMessage['replyTo']>
  ) => void;
}

export function useMessageComposer({
  activeThread,
  selectedPhoneId,
  soundEnabled,
  onSendMessage,
}: UseMessageComposerOptions) {
  const [inputText, setInputText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [replyingToMessage, setReplyingToMessage] = useState<CentralMessage | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredSlashTemplates = useMemo(() => {
    if (!inputText.startsWith('/')) return [];
    const keyword = inputText.slice(1).toLowerCase().trim();
    if (!keyword) return QUICK_TEMPLATES;
    return QUICK_TEMPLATES.filter((template) =>
      template.code.toLowerCase().includes(keyword)
      || template.title.toLowerCase().includes(keyword)
      || template.content.toLowerCase().includes(keyword)
    );
  }, [inputText]);

  const focusComposer = () => textareaRef.current?.focus();

  const selectSlashTemplate = (content: string) => {
    setInputText(content);
    focusComposer();
  };

  const applyTemplate = (content: string) => {
    setInputText(content);
    setShowTemplatePicker(false);
    focusComposer();
  };

  const addEmoji = (emoji: string) => {
    setInputText((current) => current + emoji);
    setShowEmojiPicker(false);
    focusComposer();
  };

  const attachFile = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === 'string') setPendingImage(event.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const imageItem = Array.from(event.clipboardData?.items || [])
      .find((item) => item.type.startsWith('image/'));
    attachFile(imageItem?.getAsFile() || null);
  };

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    attachFile(event.target.files?.[0] || null);
    event.target.value = '';
  };

  const closePickers = () => {
    setShowTemplatePicker(false);
    setShowEmojiPicker(false);
    setShowAttachMenu(false);
  };

  const send = (event?: FormEvent) => {
    event?.preventDefault();
    if (!activeThread) return;
    const text = inputText.trim();
    if (!text && !pendingImage) return;

    const targetId = activeThread.customer?.id || activeThread.lastMessage.customerId || activeThread.threadId;
    const targetPhone = activeThread.customerPhone || activeThread.customer?.phone || activeThread.lastMessage.customerPhone;
    const targetName = activeThread.customerName || activeThread.customer?.name || activeThread.lastMessage.customerName;
    const replyTo = replyingToMessage ? {
      id: replyingToMessage.id,
      senderName: replyingToMessage.sender === 'agent'
        ? 'Chính mình'
        : (replyingToMessage.customerName || 'Khách hàng'),
      content: (replyingToMessage.content || '').replace(/^\[reply:\{.*?\}\]\n/, '').slice(0, 150),
    } : undefined;
    let content = pendingImage ? `${pendingImage}${text ? `\n${text}` : ''}` : text;
    if (replyTo) content = `[reply:${JSON.stringify(replyTo)}]\n${content}`;

    onSendMessage(targetId, content, 'WhatsApp', targetPhone, targetName, selectedPhoneId, replyTo);
    if (soundEnabled) playPopSound();

    if (pendingImage?.startsWith('data:image/')) {
      void fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: pendingImage, folder: 'chat' }),
      }).catch(() => undefined);
    }

    setInputText('');
    setPendingImage(null);
    setReplyingToMessage(null);
    closePickers();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  };

  const startReply = (message: CentralMessage) => {
    setReplyingToMessage(message);
    setTimeout(focusComposer, 50);
  };

  return {
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
    handleSelectSlashTemplate: selectSlashTemplate,
    handleApplyTemplate: applyTemplate,
    handleAddEmoji: addEmoji,
    handlePaste,
    handleFileSelect,
    handleSend: send,
    handleKeyDown,
    handleReplyMessage: startReply,
  };
}
