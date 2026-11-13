import React, { useEffect, useId, useRef, useState } from 'react';
import {
  FileText,
  Loader2,
  Mic,
  Package,
  Paperclip,
  Pause,
  Play,
  Reply,
  RotateCw,
  Send,
  Settings,
  Smile,
  Sparkles,
  Square,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import { EmojiPicker } from '../../../components/Common/EmojiPicker';
import type { useMessageComposer } from '../hooks/useMessageComposer';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import { useSuggestedReplies } from '../hooks/useSuggestedReplies';
import type { BusinessPhoneNumber, MessageThread } from '../types';
import whatsappLogoUrl from '../../../assets/whatsapp.svg';
import { formatMessagePreview } from '../utils/messageContent';

export interface MessageComposerBarProps {
  composer: ReturnType<typeof useMessageComposer>;
  notifyTyping: (value: string) => void;
  stopTyping: () => void;
  onOpenProductPicker: () => void;
  onOpenQuickTemplatesModal: () => void;
  activeThread?: MessageThread | null;
  brandName?: string;
  senderPhone?: BusinessPhoneNumber;
  senderPhoneId?: string;
  showSenderIdentity?: boolean;
}

export const MessageComposerBar: React.FC<MessageComposerBarProps> = ({
  composer,
  notifyTyping,
  stopTyping,
  onOpenProductPicker,
  onOpenQuickTemplatesModal,
  activeThread = null,
  brandName,
  senderPhone,
  senderPhoneId,
  showSenderIdentity = false,
}) => {
  const {
    inputText,
    setInputText,
    showEmojiPicker,
    setShowEmojiPicker,
    showTemplatePicker,
    setShowTemplatePicker,
    isTemplatePickerActive,
    isSlashActive,
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
    handleSelectSlashTemplate,
    handleApplyTemplate,
    handleAddEmoji,
    handlePaste,
    handleFileSelect,
    handleDocumentSelect,
    handleSend,
    handleSendVoiceMessage,
    handleKeyDown,
  } = composer;
  const isSendDisabled = activeThread?.customer?.whatsappReachability === 'unreachable';

  const suggestedReplies = useSuggestedReplies({
    activeThread,
    brandName,
  });

  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
  const suggestionsButtonRef = useRef<HTMLButtonElement>(null);
  const suggestionsPanelRef = useRef<HTMLDivElement>(null);
  const suggestionsPanelId = useId();

  useEffect(() => { setIsSuggestionsOpen(false); }, [activeThread?.threadId, activeThread?.lastMessage.id]);
  useEffect(() => { if (!suggestedReplies.isVisible) setIsSuggestionsOpen(false); }, [suggestedReplies.isVisible]);

  useEffect(() => {
    if (!isSuggestionsOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!suggestionsPanelRef.current?.contains(target) && !suggestionsButtonRef.current?.contains(target)) setIsSuggestionsOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setIsSuggestionsOpen(false);
      suggestionsButtonRef.current?.focus();
    };
    const frame = requestAnimationFrame(() => {
      const panel = suggestionsPanelRef.current;
      (panel?.querySelector<HTMLButtonElement>('[data-suggestion]') || panel)?.focus();
    });
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSuggestionsOpen, suggestedReplies.suggestions.length, suggestedReplies.isLoading]);

  const handleApplySuggestion = (text: string) => {
    setIsSuggestionsOpen(false);
    setInputText(text);
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);
  };

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const maxHeight = 120;
    textarea.style.height = 'auto';
    const nextHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, [inputText, textareaRef]);

  const {
    isRecording,
    isRecorded,
    recordingDuration,
    recordedAudio,
    startRecording,
    stopRecording,
    cancelRecording,
    resetRecording,
  } = useVoiceRecorder();

  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [previewCurrentTime, setPreviewCurrentTime] = useState(0);

  const handleStartVoiceRecord = async () => {
    setIsSuggestionsOpen(false);
    setIsPreviewPlaying(false);
    setPreviewCurrentTime(0);
    await startRecording();
  };

  const handleStopVoiceRecord = async () => {
    await stopRecording();
  };

  const handleCancelVoiceRecord = () => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
    }
    setIsPreviewPlaying(false);
    setPreviewCurrentTime(0);
    cancelRecording();
  };

  const handleTogglePlayPreview = () => {
    const audio = previewAudioRef.current;
    if (!audio) return;
    if (isPreviewPlaying) {
      audio.pause();
      setIsPreviewPlaying(false);
    } else {
      audio.play().then(() => {
        setIsPreviewPlaying(true);
      }).catch((err) => {
        console.warn('Failed to play preview audio:', err);
        setIsPreviewPlaying(false);
      });
    }
  };

  const handleSeekPreview = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = previewAudioRef.current;
    if (!audio) return;
    const dur = recordedAudio?.duration || audio.duration || 0;
    if (!dur || !isFinite(dur)) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const newTime = ratio * dur;
    audio.currentTime = newTime;
    setPreviewCurrentTime(newTime);
  };

  const handleSendVoiceRecord = async () => {
    let audioToSend = recordedAudio;
    if (!audioToSend) {
      audioToSend = await stopRecording();
    }
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
    }
    setIsPreviewPlaying(false);
    setPreviewCurrentTime(0);

    if (audioToSend?.dataUrl) {
      handleSendVoiceMessage(audioToSend.dataUrl);
      resetRecording();
    }
  };

  const formatRecordingTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const previewTotalDuration = recordedAudio?.duration || (previewAudioRef.current && isFinite(previewAudioRef.current.duration) ? previewAudioRef.current.duration : 0);
  const previewPercent = previewTotalDuration > 0
    ? Math.min(100, (previewCurrentTime / previewTotalDuration) * 100)
    : 0;

  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const templatePickerRef = useRef<HTMLDivElement>(null);
  const templateButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isSuggestionsOpen || (!showEmojiPicker && !isTemplatePickerActive)) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (showEmojiPicker) {
        if (!emojiPickerRef.current?.contains(target) && !emojiButtonRef.current?.contains(target)) {
          setShowEmojiPicker(false);
        }
      }
      if (isTemplatePickerActive) {
        if (!templatePickerRef.current?.contains(target) && !templateButtonRef.current?.contains(target)) {
          setShowTemplatePicker(false);
          if (isSlashActive) setInputText('');
        }
      }
    };

    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowEmojiPicker(false);
        setShowTemplatePicker(false);
        if (isSlashActive) setInputText('');
        return;
      }

      if (isTemplatePickerActive && filteredSlashTemplates.length > 0) {
        if (document.activeElement !== textareaRef.current) {
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
              handleApplyTemplate(selected.content);
            }
            return;
          }
        }
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [
    isSuggestionsOpen,
    showEmojiPicker,
    setShowEmojiPicker,
    isTemplatePickerActive,
    setShowTemplatePicker,
    isSlashActive,
    setInputText,
    filteredSlashTemplates,
    activeSlashIndex,
    setActiveSlashIndex,
    handleApplyTemplate,
    textareaRef,
  ]);

  const senderIdentity = showSenderIdentity && senderPhoneId ? (
    <span
      className="inline-flex h-6 max-w-full items-center gap-1.5 rounded-full border border-slate-200/80 bg-white/95 px-2.5 text-[11px] text-[#667781] shadow-2xs"
      title={`Trả lời từ ${senderPhone?.verifiedName || 'WhatsApp'}`}
    >
      <img
        src={senderPhone?.profilePictureUrl || whatsappLogoUrl}
        alt={`Ảnh đại diện ${senderPhone?.verifiedName || 'WhatsApp'}`}
        className="h-3.5 w-3.5 shrink-0 rounded-full object-cover"
        onError={(event) => { event.currentTarget.src = whatsappLogoUrl; }}
      />
      <span className="truncate">Trả lời từ <span className="font-medium text-emerald-700">{senderPhone?.verifiedName || 'WhatsApp'}</span></span>
    </span>
  ) : null;

  return (
    <>
      {/* Unified Quick Templates Popup (Triggered by ⚡ button OR typing /) */}
      {isTemplatePickerActive && !isSuggestionsOpen && (
        <div
          ref={templatePickerRef}
          className="absolute bottom-16 left-3 sm:left-6 bg-white border border-slate-300 rounded-2xl p-3 shadow-2xl z-50 w-88 max-w-[calc(100vw-2rem)] max-h-80 overflow-hidden flex flex-col animate-fadeIn divide-y divide-slate-100"
        >
          <div className="flex items-center justify-between pb-2 mb-1 shrink-0">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
              Mẫu tin nhắn nhanh ({filteredSlashTemplates.length})
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setShowTemplatePicker(false);
                  if (isSlashActive) setInputText('');
                  onOpenQuickTemplatesModal();
                }}
                className="p-1 text-slate-400 hover:text-emerald-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                title="Quản lý và thêm mẫu tin nhắn"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowTemplatePicker(false);
                  if (isSlashActive) setInputText('');
                }}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                title="Đóng (Esc)"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="space-y-1 py-1 overflow-y-auto flex-1 pr-1">
            {filteredSlashTemplates.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                Không tìm thấy mẫu tin nhắn phù hợp
              </div>
            ) : (
              filteredSlashTemplates.map((tmpl, idx) => {
                const isSelected = idx === activeSlashIndex;
                return (
                  <div
                    key={tmpl.id || tmpl.code}
                    ref={(el) => {
                      if (isSelected) {
                        el?.scrollIntoView({ block: 'nearest' });
                      }
                    }}
                    onClick={() => handleApplyTemplate(tmpl.content)}
                    className={`p-2 rounded-xl cursor-pointer transition group ${
                      isSelected
                        ? 'bg-emerald-50 border border-emerald-300 ring-1 ring-emerald-300/50'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#1fa855] group-hover:underline truncate max-w-[210px]">
                        {tmpl.title}
                      </span>
                      <span className="text-[10px] font-mono bg-emerald-100 text-[#1fa855] px-1.5 py-0.5 rounded font-bold shrink-0 ml-1">
                        {tmpl.code}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 truncate mt-0.5">{tmpl.content}</p>
                  </div>
                );
              })
            )}
          </div>

          <div className="px-1 pt-2 text-[10px] text-slate-400 flex items-center font-medium shrink-0">
            <span>↑↓ Chọn</span>
          </div>
        </div>
      )}

      {/* Hidden File Input for Unified Upload (Images, PDF, Word, Excel, CSV, TXT) */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,text/csv"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Hidden File Input for Document Upload (PDF, Word, Excel, CSV, TXT) */}
      <input
        ref={documentInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,text/csv"
        className="hidden"
        onChange={handleDocumentSelect}
      />

      {/* WhatsApp Authentic Reply Preview Banner */}
      {replyingToMessage && (
        <div className="mx-3 mb-1.5 p-2 bg-white/95 backdrop-blur-xs rounded-xl border border-slate-200/90 shadow-xs flex items-center justify-between gap-3 shrink-0 animate-fadeIn">
          <div className="flex-1 min-w-0 bg-slate-50/90 rounded-lg p-2 border-l-4 border-[#1fa855]">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#1fa855]">
              <Reply className="w-3.5 h-3.5 shrink-0" />
              <span>Đang trả lời {replyingToMessage.sender === 'agent' ? 'Chính mình' : (replyingToMessage.customerName || 'Khách hàng')}</span>
            </div>
            <p className="text-xs text-slate-600 truncate mt-0.5 max-w-xl">
              {formatMessagePreview(replyingToMessage.content)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setReplyingToMessage(null)}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
            title="Hủy trả lời"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Attached Pending Image Thumbnail Strip (Inline inside input bar) */}
      {pendingImage && (
        <div className="mx-3 mb-1.5 px-3 py-2 bg-white/95 backdrop-blur-xs rounded-xl border border-slate-200/90 shadow-xs flex items-center justify-between gap-3 shrink-0 animate-fadeIn">
          <div className="relative group rounded-xl overflow-hidden border border-slate-300 bg-white shadow-xs w-14 h-14 shrink-0">
            <img src={pendingImage} alt="attached thumbnail" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => setPendingImage(null)}
              className="absolute top-1 right-1 w-5 h-5 rounded-full bg-white/90 hover:bg-white text-slate-500 hover:text-slate-800 border border-slate-200 shadow-xs flex items-center justify-center transition cursor-pointer"
              title="Xóa ảnh"
            >
              <X className="w-3 h-3 stroke-[2.5]" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => setPendingImage(null)}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
            title="Hủy ảnh đính kèm"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Attached Pending Document Preview Strip */}
      {pendingDocument && (
        <div className="mx-3 mb-1.5 px-3 py-2 bg-white/95 backdrop-blur-xs rounded-xl border border-slate-200/90 shadow-xs flex items-center justify-between gap-3 shrink-0 animate-fadeIn">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-600 border border-rose-200 flex flex-col items-center justify-center shrink-0 shadow-2xs">
              <FileText className="w-5 h-5" />
              <span className="text-[9px] font-black uppercase tracking-tight">
                {(pendingDocument.filename.split('.').pop() || 'FILE').toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-800 truncate" title={pendingDocument.filename}>
                {pendingDocument.filename}
              </p>
              <span className="text-[11px] text-slate-500 font-mono">
                {pendingDocument.filesize > 1024 * 1024
                  ? `${(pendingDocument.filesize / (1024 * 1024)).toFixed(1)} MB`
                  : `${Math.max(1, Math.round(pendingDocument.filesize / 1024))} KB`}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setPendingDocument(null)}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
            title="Hủy tài liệu đính kèm"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Keep suggestions collapsed until requested, next to the sender identity. */}
      {(senderIdentity || suggestedReplies.isVisible) && (
        <div className="relative mx-3 mb-1 flex min-w-0 shrink-0 items-center gap-2">
          {senderIdentity && <div className="min-w-0 flex-1">{senderIdentity}</div>}
          {suggestedReplies.isVisible && (
            <button
              ref={suggestionsButtonRef}
              type="button"
              onClick={() => {
                if (!isSuggestionsOpen) {
                  setShowEmojiPicker(false);
                  setShowTemplatePicker(false);
                  setShowAttachMenu(false);
                }
                setIsSuggestionsOpen((open) => !open);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') event.stopPropagation();
              }}
              aria-label="Gợi ý trả lời"
              aria-haspopup="dialog"
              aria-controls={suggestionsPanelId}
              aria-expanded={isSuggestionsOpen}
              className={`ml-auto inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-medium text-[#1fa855] shadow-2xs transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1fa855]/40 ${isSuggestionsOpen ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200/80 bg-white/95 hover:border-emerald-300 hover:bg-emerald-50'}`}
            >
              {suggestedReplies.isLoading
                ? <Loader2 data-colored="true" className="h-3.5 w-3.5 animate-spin" />
                : <Sparkles data-colored="true" className="h-3.5 w-3.5" />}
              Gợi ý
            </button>
          )}
          {suggestedReplies.isVisible && isSuggestionsOpen && (
            <div
              ref={suggestionsPanelRef}
              id={suggestionsPanelId}
              role="dialog"
              aria-label="Gợi ý trả lời"
              tabIndex={-1}
              className="absolute bottom-full right-0 z-50 mb-2 flex max-h-[min(20rem,50dvh)] w-80 max-w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xl focus:outline-none"
              onBlur={(event) => {
                const next = event.relatedTarget as Node | null;
                if (next && !event.currentTarget.contains(next) && !suggestionsButtonRef.current?.contains(next)) setIsSuggestionsOpen(false);
              }}
              onKeyDown={(event) => {
                if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
                const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[data-suggestion]'));
                if (!items.length) return;
                event.preventDefault();
                const current = items.indexOf(document.activeElement as HTMLButtonElement);
                const index = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
                  : current < 0 ? (event.key === 'ArrowUp' ? items.length - 1 : 0)
                  : (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
                items[index]?.focus();
              }}
            >
              <div className="flex shrink-0 items-center justify-between gap-2 px-1 pb-1.5">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-800"><Sparkles data-colored="true" className="h-3.5 w-3.5 text-[#1fa855]" />Gợi ý trả lời</span>
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={suggestedReplies.refreshSuggestions}
                    disabled={suggestedReplies.isLoading}
                    aria-label="Tạo lại gợi ý trả lời"
                    title="Tạo lại gợi ý"
                    className="flex h-6 w-6 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 transition cursor-pointer disabled:opacity-40"
                  >
                    <RotateCw className={`h-3.5 w-3.5 ${suggestedReplies.isLoading ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    type="button"
                    onClick={() => { setIsSuggestionsOpen(false); suggestionsButtonRef.current?.focus(); }}
                    aria-label="Đóng gợi ý trả lời"
                    title="Đóng"
                    className="flex h-6 w-6 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 transition cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {suggestedReplies.isLoading ? (
                <div role="status" className="flex items-center gap-2 px-2 py-4 text-xs text-slate-500">
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" />Đang tạo gợi ý...
                </div>
              ) : (
                <div className="min-h-0 space-y-1 overflow-y-auto whatsapp-scrollbar">
                  {suggestedReplies.suggestions.map((text, index) => (
                    <button
                      key={index}
                      type="button"
                      data-suggestion
                      onClick={() => handleApplySuggestion(text)}
                      className="group/suggestion flex w-full cursor-pointer items-start gap-2 rounded-xl px-2 py-2.5 text-left transition hover:bg-emerald-50 focus:bg-emerald-50 focus:outline-none"
                    >
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-medium text-slate-500 group-hover/suggestion:bg-emerald-100">{index + 1}</span>
                      <span className="min-w-0 flex-1 whitespace-pre-wrap break-words text-xs leading-5 text-slate-700">{text}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* WhatsApp Authentic Input Bar or Voice Recording Bar */}
      {isRecording ? (
        <div className="px-3 pb-3 pt-1 shrink-0 flex items-center space-x-2 z-10">
          {/* Cancel Recording (Trash) */}
          <button
            type="button"
            onClick={handleCancelVoiceRecord}
            className="w-10 h-10 rounded-full bg-white/90 text-rose-500 hover:text-rose-700 hover:bg-rose-50 border border-slate-200/80 shadow-2xs flex items-center justify-center transition cursor-pointer shrink-0"
            title="Hủy ghi âm"
          >
            <Trash2 className="w-5 h-5" />
          </button>

          {/* Recording Status: pulsing red dot, timer, and animated waveform */}
          <div className="flex-1 flex items-center gap-3 bg-white px-4 py-2 rounded-full border border-rose-200 shadow-xs">
            <div className="relative flex items-center justify-center shrink-0">
              <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping absolute opacity-75" />
              <span className="w-3 h-3 rounded-full bg-rose-600 relative" />
            </div>

            <span className="font-mono font-bold text-sm text-slate-800 min-w-12 select-none">
              {formatRecordingTimer(recordingDuration)}
            </span>

            {/* Animated waveform bars */}
            <div className="flex-1 flex items-center gap-1 h-5 overflow-hidden">
              {[40, 75, 50, 90, 60, 30, 80, 100, 45, 65, 85, 35, 70, 95, 55, 75, 40, 80].map((h, i) => (
                <span
                  key={i}
                  className="w-1 bg-rose-400 rounded-full animate-pulse transition-all duration-300"
                  style={{
                    height: `${Math.max(20, (h * ((i + recordingDuration) % 4 + 1)) % 100)}%`,
                    animationDelay: `${(i * 60) % 500}ms`,
                  }}
                />
              ))}
            </div>

            <span className="text-xs text-rose-600 font-medium hidden sm:inline select-none">
              Đang ghi âm giọng nói...
            </span>
          </div>

          {/* Stop Recording to Review / Listen */}
          <button
            type="button"
            onClick={handleStopVoiceRecord}
            className="w-10 h-10 rounded-full bg-rose-100 hover:bg-rose-200 text-rose-600 border border-rose-300 flex items-center justify-center transition cursor-pointer shrink-0 shadow-2xs"
            title="Dừng ghi âm để nghe lại"
          >
            <Square className="w-4 h-4 fill-current" />
          </button>

          {/* Send Voice Recording Immediately */}
          <button
            type="button"
            onClick={handleSendVoiceRecord}
            disabled={isSendDisabled}
            className="w-10 h-10 rounded-full bg-[#1fa855] hover:bg-[#1a924a] text-white flex items-center justify-center transition shadow-md cursor-pointer shrink-0"
            title="Gửi ngay tin nhắn thoại"
          >
            <Send className="w-4 h-4 ml-0.5" />
          </button>
        </div>
      ) : isRecorded ? (
        <div className="px-3 pb-3 pt-1 shrink-0 flex items-center space-x-2 z-10">
          {/* Cancel / Discard Recording to re-record */}
          <button
            type="button"
            onClick={handleCancelVoiceRecord}
            className="w-10 h-10 rounded-full bg-white/90 text-rose-500 hover:text-rose-700 hover:bg-rose-50 border border-slate-200/80 shadow-2xs flex items-center justify-center transition cursor-pointer shrink-0"
            title="Xóa bản ghi âm để thu lại"
          >
            <Trash2 className="w-5 h-5" />
          </button>

          {/* Audio Preview Player */}
          <div className="flex-1 flex items-center gap-3 bg-white px-4 py-2 rounded-full border border-emerald-200 shadow-xs min-w-0">
            {/* Play / Pause button */}
            <button
              type="button"
              onClick={handleTogglePlayPreview}
              className="w-8 h-8 rounded-full bg-[#1fa855] hover:bg-[#1a924a] text-white flex items-center justify-center transition shadow-2xs active:scale-95 cursor-pointer shrink-0"
              title={isPreviewPlaying ? 'Tạm dừng nghe lại' : 'Nghe lại bản ghi âm'}
            >
              {isPreviewPlaying ? (
                <Pause className="w-4 h-4 fill-current" />
              ) : (
                <Play className="w-4 h-4 fill-current ml-0.5" />
              )}
            </button>

            {/* Scrubber / Progress track */}
            <div className="flex-1 flex flex-col justify-center gap-1 min-w-0">
              <div
                onClick={handleSeekPreview}
                className="relative w-full h-3 flex items-center cursor-pointer group"
                title="Bấm để tua đoạn nghe lại"
              >
                <div className="w-full h-1 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#1fa855] rounded-full transition-all duration-75"
                    style={{ width: `${previewPercent}%` }}
                  />
                </div>
                <div
                  className="absolute w-2.5 h-2.5 bg-[#1fa855] rounded-full shadow-xs -ml-1 opacity-90 group-hover:scale-125 transition"
                  style={{ left: `${previewPercent}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                <span>
                  {formatRecordingTimer(
                    isPreviewPlaying || previewCurrentTime > 0
                      ? previewCurrentTime
                      : (recordedAudio?.duration || recordingDuration)
                  )}
                </span>
                <span className="text-[10px] text-emerald-700 font-semibold font-sans">
                  Bản ghi đã sẵn sàng
                </span>
              </div>
            </div>
          </div>

          {/* Send Recorded Voice Message */}
          <button
            type="button"
            onClick={handleSendVoiceRecord}
            disabled={isSendDisabled}
            className="w-10 h-10 rounded-full bg-[#1fa855] hover:bg-[#1a924a] text-white flex items-center justify-center transition shadow-md cursor-pointer shrink-0 animate-bounce duration-1000"
            title="Gửi tin nhắn thoại"
          >
            <Send className="w-4 h-4 ml-0.5" />
          </button>

          {/* Audio Element for Review Playback */}
          <audio
            ref={previewAudioRef}
            src={recordedAudio?.dataUrl}
            preload="auto"
            onTimeUpdate={(e) => setPreviewCurrentTime(e.currentTarget.currentTime)}
            onEnded={() => {
              setIsPreviewPlaying(false);
              setPreviewCurrentTime(0);
            }}
          />
        </div>
      ) : (
        <div className="group/composer shrink-0 z-10 px-3 pb-3 pt-1">
          <div className="flex min-h-12 min-w-0 items-center gap-1.5 rounded-full border border-slate-200/90 bg-white px-2 py-1.5 shadow-xs transition focus-within:border-[#1fa855]/70 focus-within:ring-2 focus-within:ring-[#1fa855]/15">
            <div className="flex shrink-0 items-center gap-0.5">
              {/* Attachment Button: Directly opens native file chooser for any file */}
              <button
                type="button"
                onClick={() => {
                  setIsSuggestionsOpen(false);
                  if (fileInputRef.current) fileInputRef.current.click();
                  setShowEmojiPicker(false);
                  setShowTemplatePicker(false);
                }}
                className="whatsapp-composer-action"
                data-tone="blue"
                title="Đính kèm tệp (Hình ảnh, PDF, Báo giá, Hóa đơn, Excel, Word...)"
                aria-label="Đính kèm tệp"
              >
                <Paperclip data-colored="true" strokeWidth={1.8} className="h-[18px] w-[18px]" />
              </button>

              {/* Emoji Trigger */}
              <div className="relative">
                <button
                  ref={emojiButtonRef}
                  type="button"
                  onClick={() => {
                    setIsSuggestionsOpen(false);
                    setShowEmojiPicker(!showEmojiPicker);
                    setShowAttachMenu(false);
                    setShowTemplatePicker(false);
                  }}
                  className="whatsapp-composer-action"
                  data-tone="emerald"
                  title="Biểu tượng cảm xúc"
                  aria-label="Biểu tượng cảm xúc"
                  aria-expanded={showEmojiPicker}
                >
                  <Smile data-colored="true" strokeWidth={1.8} className="h-[18px] w-[18px]" />
                </button>

                {showEmojiPicker && (
                  <div ref={emojiPickerRef} className="absolute bottom-full mb-3 left-0 z-50 animate-fadeIn">
                    <EmojiPicker
                      onSelect={handleAddEmoji}
                      onClose={() => setShowEmojiPicker(false)}
                      theme="whatsapp"
                      title="Biểu tượng cảm xúc"
                      className="flex w-80 sm:w-84 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-2xl"
                    />
                  </div>
                )}
              </div>

              {/* Catalog Product Picker Trigger */}
              <button
                type="button"
                onClick={() => {
                  setIsSuggestionsOpen(false);
                  onOpenProductPicker();
                  setShowEmojiPicker(false);
                  setShowTemplatePicker(false);
                }}
                className="whatsapp-composer-action"
                data-tone="violet"
                title="Gửi sản phẩm từ Meta Catalog"
                aria-label="Gửi sản phẩm Meta Catalog"
              >
                <Package data-colored="true" strokeWidth={1.8} className="h-[18px] w-[18px]" />
              </button>

              {/* Quick Canned Template Trigger */}
              <button
                ref={templateButtonRef}
                type="button"
                onClick={() => {
                  setIsSuggestionsOpen(false);
                  const willOpen = !isTemplatePickerActive;
                  setShowTemplatePicker(willOpen);
                  setShowEmojiPicker(false);
                  setShowAttachMenu(false);
                  if (isSlashActive) setInputText('');
                  if (willOpen) {
                    setActiveSlashIndex(0);
                    setTimeout(() => textareaRef.current?.focus(), 0);
                  }
                }}
                className="whatsapp-composer-action"
                data-tone="amber"
                title="Mẫu tin nhắn nhanh (/)"
                aria-label="Mẫu tin nhắn nhanh"
                aria-expanded={isTemplatePickerActive}
              >
                <Zap data-colored="true" strokeWidth={1.8} className="h-[18px] w-[18px]" />
              </button>
            </div>

            {/* Textarea Input with Clipboard Paste support */}
            <div className="flex min-h-9 min-w-0 flex-1 items-center px-1.5 py-1">
              <textarea
                ref={textareaRef}
                rows={1}
                value={inputText}
                onChange={(e) => {
                  setInputText(e.target.value);
                  notifyTyping(e.target.value);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) stopTyping();
                  handleKeyDown(event);
                }}
                onPaste={handlePaste}
                placeholder={
                  pendingImage
                    ? "Chú thích ảnh…"
                    : pendingDocument
                    ? "Ghi chú tài liệu…"
                    : "Nhập tin nhắn…"
                }
                aria-label="Nội dung tin nhắn"
                title="Gõ / để chọn mẫu tin nhắn nhanh"
                className="whatsapp-composer-input block w-full min-h-[20px] max-h-[120px] resize-none overflow-y-hidden bg-transparent text-[14px] leading-5 text-[#111b21] placeholder-[#8696a0] focus:outline-none"
              />
            </div>

            {/* Mic vs Send Button */}
            {inputText.trim() || pendingImage || pendingDocument ? (
              <button
                type="button"
                disabled={isSendDisabled}
                onClick={() => {
                  stopTyping();
                  handleSend();
                }}
                className="whatsapp-composer-send w-9 h-9 rounded-full bg-[#1fa855] text-white flex items-center justify-center cursor-pointer shrink-0 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
                aria-label="Gửi tin nhắn"
                title={isSendDisabled ? 'Chờ khách nhắn tin mới để mở lại khả năng gửi' : 'Gửi tin nhắn (Enter)'}
              >
                <Send data-colored="true" strokeWidth={1.9} className="w-[17px] h-[17px] ml-0.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStartVoiceRecord}
                className="whatsapp-composer-action whatsapp-composer-mic"
                data-tone="emerald"
                title="Ghi âm tin nhắn"
                aria-label="Ghi âm tin nhắn"
              >
                <Mic data-colored="true" strokeWidth={1.8} className="h-[18px] w-[18px]" />
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
};
