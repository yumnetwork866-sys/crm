import { useMemo, useRef, useState } from 'react';
import type { ChangeEvent, ClipboardEvent, FormEvent, KeyboardEvent } from 'react';
import type { CentralMessage, MessageChannel } from '../../../types';
import { QUICK_TEMPLATES } from '../constants';
import type { MessageThread } from '../types';
import { playPopSound } from '../utils/playPopSound';
import { api } from '../../../utils/apiClient';

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
  const [pendingDocument, setPendingDocument] = useState<{
    dataUrl: string;
    filename: string;
    filesize: number;
    mimeType: string;
  } | null>(null);
  const [replyingToMessage, setReplyingToMessage] = useState<CentralMessage | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);

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
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart ?? inputText.length;
      const end = textarea.selectionEnd ?? inputText.length;
      const next = inputText.slice(0, start) + emoji + inputText.slice(end);
      setInputText(next);
      requestAnimationFrame(() => {
        textarea.selectionStart = start + emoji.length;
        textarea.selectionEnd = start + emoji.length;
        textarea.focus();
      });
    } else {
      setInputText((current) => current + emoji);
    }
  };

  const attachFile = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result !== 'string') return;
      const dataUrl = event.target.result;
      if (file.type.startsWith('image/')) {
        setPendingImage(dataUrl);
        setPendingDocument(null);
      } else {
        setPendingDocument({
          dataUrl,
          filename: file.name,
          filesize: file.size,
          mimeType: file.type || 'application/pdf',
        });
        setPendingImage(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const fileItem = Array.from(event.clipboardData?.items || [])
      .find((item) => item.type.startsWith('image/') || item.type.includes('pdf') || item.type.includes('sheet') || item.type.includes('document'));
    if (fileItem) {
      attachFile(fileItem.getAsFile() || null);
    }
  };

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    attachFile(event.target.files?.[0] || null);
    event.target.value = '';
  };

  const handleDocumentSelect = (event: ChangeEvent<HTMLInputElement>) => {
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
    if (!text && !pendingImage && !pendingDocument) return;

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

    let content = text;
    if (pendingDocument) {
      content = `[document:${JSON.stringify({
        url: pendingDocument.dataUrl,
        filename: pendingDocument.filename,
        size: pendingDocument.filesize,
        mimeType: pendingDocument.mimeType,
      })}]${text ? `\n${text}` : ''}`;
    } else if (pendingImage) {
      content = `${pendingImage}${text ? `\n${text}` : ''}`;
    }

    if (replyTo) content = `[reply:${JSON.stringify(replyTo)}]\n${content}`;

    onSendMessage(targetId, content, 'WhatsApp', targetPhone, targetName, selectedPhoneId, replyTo);
    if (soundEnabled) playPopSound();

    if (pendingImage?.startsWith('data:image/')) {
      void api.post('/upload', { imageBase64: pendingImage, folder: 'chat' }).catch(() => undefined);
    } else if (pendingDocument?.dataUrl.startsWith('data:')) {
      void api.post('/upload', {
        fileBase64: pendingDocument.dataUrl,
        customFilename: pendingDocument.filename,
        folder: 'chat'
      }).catch(() => undefined);
    }

    setInputText('');
    setPendingImage(null);
    setPendingDocument(null);
    setReplyingToMessage(null);
    closePickers();
  };

  const sendVoiceMessage = (dataUrl: string) => {
    if (!activeThread || !dataUrl) return;

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

    let content = dataUrl;
    if (replyTo) content = `[reply:${JSON.stringify(replyTo)}]\n${content}`;

    onSendMessage(targetId, content, 'WhatsApp', targetPhone, targetName, selectedPhoneId, replyTo);
    if (soundEnabled) playPopSound();

    if (dataUrl.startsWith('data:audio/')) {
      void api.post('/upload', { audioBase64: dataUrl, folder: 'chat' }).catch(() => undefined);
    }

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
    pendingDocument,
    setPendingDocument,
    replyingToMessage,
    setReplyingToMessage,
    textareaRef,
    fileInputRef,
    documentInputRef,
    filteredSlashTemplates,
    handleSelectSlashTemplate: selectSlashTemplate,
    handleApplyTemplate: applyTemplate,
    handleAddEmoji: addEmoji,
    handlePaste,
    handleFileSelect,
    handleDocumentSelect,
    handleSend: send,
    handleSendVoiceMessage: sendVoiceMessage,
    handleKeyDown,
    handleReplyMessage: startReply,
  };
}
