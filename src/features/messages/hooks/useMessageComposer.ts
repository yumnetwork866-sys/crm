import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  ChangeEvent,
  ClipboardEvent,
  Dispatch,
  FormEvent,
  KeyboardEvent,
  SetStateAction,
} from 'react';
import type { CentralMessage, MessageChannel } from '../../../types';
import type { MessageThread } from '../types';
import { playPopSound } from '../utils/playPopSound';
import { formatMessagePreview } from '../utils/messageContent';
import { api } from '../../../utils/apiClient';
import { useQuickTemplates, interpolateTemplate } from './useQuickTemplates';

const DRAFTS_STORAGE_KEY = 'yumcrm_message_drafts_by_thread';

function readStoredDrafts(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(DRAFTS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const clean: Record<string, string> = {};
      for (const [key, val] of Object.entries(parsed)) {
        if (typeof val === 'string' && val.trim()) {
          clean[key] = val;
        }
      }
      return clean;
    }
  } catch {
    // Ignore storage read errors
  }
  return {};
}

interface PendingDocumentAttachment {
  dataUrl: string;
  filename: string;
  filesize: number;
  mimeType: string;
}

interface UseMessageComposerOptions {
  activeThread: MessageThread | null;
  selectedPhoneId: string;
  soundEnabled: boolean;
  brandName?: string;
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
  brandName = 'YumNetwork',
  onSendMessage,
}: UseMessageComposerOptions) {
  const { templates } = useQuickTemplates();
  const activeThreadId = activeThread?.threadId || '';

  const [draftsByThreadId, setDraftsByThreadId] = useState<Record<string, string>>(readStoredDrafts);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [activeSlashIndex, setActiveSlashIndex] = useState(0);
  const [pendingImagesByThreadId, setPendingImagesByThreadId] = useState<Record<string, string | null>>({});
  const [pendingDocumentsByThreadId, setPendingDocumentsByThreadId] = useState<
    Record<string, PendingDocumentAttachment | null>
  >({});
  const [replyingByThreadId, setReplyingByThreadId] = useState<Record<string, CentralMessage | null>>({});
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const persisted: Record<string, string> = {};
      for (const [threadId, text] of Object.entries(draftsByThreadId)) {
        if (text.trim()) {
          persisted[threadId] = text;
        }
      }
      if (Object.keys(persisted).length > 0) {
        localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(persisted));
      } else {
        localStorage.removeItem(DRAFTS_STORAGE_KEY);
      }
    } catch {
      // Ignore storage write errors
    }
  }, [draftsByThreadId]);

  const inputText = activeThreadId ? (draftsByThreadId[activeThreadId] ?? '') : '';

  const setInputText: Dispatch<SetStateAction<string>> = useCallback(
    (valueOrUpdater) => {
      if (!activeThreadId) return;
      setDraftsByThreadId((prev) => {
        const currentText = prev[activeThreadId] ?? '';
        const nextText =
          typeof valueOrUpdater === 'function' ? valueOrUpdater(currentText) : valueOrUpdater;
        if (nextText === currentText) return prev;
        if (!nextText) {
          if (!(activeThreadId in prev)) return prev;
          const next = { ...prev };
          delete next[activeThreadId];
          return next;
        }
        return { ...prev, [activeThreadId]: nextText };
      });
    },
    [activeThreadId]
  );

  const pendingImage = activeThreadId ? (pendingImagesByThreadId[activeThreadId] ?? null) : null;
  const setPendingImage = useCallback(
    (value: string | null) => {
      if (!activeThreadId) return;
      setPendingImagesByThreadId((prev) => ({ ...prev, [activeThreadId]: value }));
    },
    [activeThreadId]
  );

  const pendingDocument = activeThreadId ? (pendingDocumentsByThreadId[activeThreadId] ?? null) : null;
  const setPendingDocument = useCallback(
    (value: PendingDocumentAttachment | null) => {
      if (!activeThreadId) return;
      setPendingDocumentsByThreadId((prev) => ({ ...prev, [activeThreadId]: value }));
    },
    [activeThreadId]
  );

  const replyingToMessage = activeThreadId ? (replyingByThreadId[activeThreadId] ?? null) : null;
  const setReplyingToMessage = useCallback(
    (value: CentralMessage | null) => {
      if (!activeThreadId) return;
      setReplyingByThreadId((prev) => ({ ...prev, [activeThreadId]: value }));
    },
    [activeThreadId]
  );

  const isSlashActive = inputText.startsWith('/');
  const isTemplatePickerActive = showTemplatePicker || isSlashActive;

  const filteredSlashTemplates = useMemo(() => {
    if (!isTemplatePickerActive) return [];
    if (!isSlashActive) return templates;
    const keyword = inputText.slice(1).toLowerCase().trim();
    if (!keyword) return templates;
    return templates.filter((template) =>
      template.code.toLowerCase().includes(keyword)
      || template.title.toLowerCase().includes(keyword)
      || template.content.toLowerCase().includes(keyword)
    );
  }, [isTemplatePickerActive, isSlashActive, inputText, templates]);

  const focusComposer = () => textareaRef.current?.focus();

  const getInterpolatedContent = (content: string) => {
    return interpolateTemplate(content, {
      customerName: activeThread?.customerName || activeThread?.customer?.name,
      customerPhone: activeThread?.customerPhone || activeThread?.customer?.phone,
      brandName,
    });
  };

  const applyTemplate = (content: string) => {
    const interpolated = getInterpolatedContent(content);
    setInputText(interpolated);
    setShowTemplatePicker(false);
    setActiveSlashIndex(0);
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
      content: formatMessagePreview(replyingToMessage.content).slice(0, 150),
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
      content: formatMessagePreview(replyingToMessage.content).slice(0, 150),
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
    // Keyboard navigation when template popup is active
    if (isTemplatePickerActive && filteredSlashTemplates.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveSlashIndex((prev) => (prev + 1) % filteredSlashTemplates.length);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveSlashIndex((prev) => (prev - 1 + filteredSlashTemplates.length) % filteredSlashTemplates.length);
        return;
      }
      if ((event.key === 'Enter' || event.key === 'Tab') && !event.shiftKey) {
        event.preventDefault();
        const selected = filteredSlashTemplates[activeSlashIndex] || filteredSlashTemplates[0];
        if (selected) {
          applyTemplate(selected.content);
        }
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        setShowTemplatePicker(false);
        if (inputText.startsWith('/')) {
          setInputText('');
        }
        return;
      }
    }

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
    draftsByThreadId,
    showEmojiPicker,
    setShowEmojiPicker,
    showTemplatePicker,
    setShowTemplatePicker,
    isTemplatePickerActive,
    isSlashActive,
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
    templates,
    filteredSlashTemplates,
    activeSlashIndex,
    setActiveSlashIndex,
    handleSelectSlashTemplate: applyTemplate,
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
