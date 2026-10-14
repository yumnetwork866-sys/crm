import React, { useEffect, useRef, useState } from 'react';
import {
  FileText,
  Mic,
  Package,
  Paperclip,
  Pause,
  Play,
  Reply,
  Send,
  Settings,
  Smile,
  Square,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import { EmojiPicker } from '../../../components/Common/EmojiPicker';
import type { useMessageComposer } from '../hooks/useMessageComposer';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import { formatMessagePreview } from '../utils/messageContent';

export interface MessageComposerBarProps {
  composer: ReturnType<typeof useMessageComposer>;
  notifyTyping: (value: string) => void;
  stopTyping: () => void;
  onOpenProductPicker: () => void;
  onOpenQuickTemplatesModal: () => void;
}

export const MessageComposerBar: React.FC<MessageComposerBarProps> = ({
  composer,
  notifyTyping,
  stopTyping,
  onOpenProductPicker,
  onOpenQuickTemplatesModal,
}) => {
  const {
    inputText,
    setInputText,
    showEmojiPicker,
    setShowEmojiPicker,
    showTemplatePicker,
    setShowTemplatePicker,
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
    if (!showEmojiPicker && !showTemplatePicker) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (showEmojiPicker) {
        if (!emojiPickerRef.current?.contains(target) && !emojiButtonRef.current?.contains(target)) {
          setShowEmojiPicker(false);
        }
      }
      if (showTemplatePicker) {
        if (!templatePickerRef.current?.contains(target) && !templateButtonRef.current?.contains(target)) {
          setShowTemplatePicker(false);
        }
      }
    };

    const handleEscapeKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowEmojiPicker(false);
        setShowTemplatePicker(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscapeKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscapeKeyDown);
    };
  }, [showEmojiPicker, setShowEmojiPicker, showTemplatePicker, setShowTemplatePicker]);

  return (
    <>
      {/* Floating Slash Commands Autocomplete Popup */}
      {inputText.startsWith('/') && filteredSlashTemplates.length > 0 && (
        <div className="absolute bottom-16 left-16 bg-white border border-slate-300 rounded-2xl p-2 shadow-2xl z-30 w-84 max-h-72 overflow-y-auto animate-fadeIn divide-y divide-slate-100">
          <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Gợi ý câu trả lời nhanh ({filteredSlashTemplates.length})</span>
            <span>Phím tắt /</span>
          </div>
          <div className="space-y-1 py-1">
            {filteredSlashTemplates.map((tmpl, idx) => {
              const isSelected = idx === activeSlashIndex;
              return (
                <div
                  key={tmpl.id || tmpl.code}
                  onClick={() => handleSelectSlashTemplate(tmpl.content)}
                  className={`p-2 rounded-xl cursor-pointer transition group ${
                    isSelected
                      ? 'bg-emerald-50 border border-emerald-300 ring-1 ring-emerald-300/50'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#1fa855] group-hover:underline">
                      {tmpl.title}
                    </span>
                    <span className="text-[10px] font-mono bg-emerald-100 text-[#1fa855] px-1.5 py-0.5 rounded font-bold">
                      {tmpl.code}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 truncate mt-0.5">{tmpl.content}</p>
                </div>
              );
            })}
          </div>
          <div className="px-2 pt-1.5 text-[10px] text-slate-400 flex items-center justify-between font-medium">
            <span>↑↓ Chọn • Enter Chèn</span>
            <span>Esc Đóng</span>
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
        <div className="px-3.5 pt-2.5 pb-1 bg-[#f0f2f5] border-t border-[#d1d7db] flex items-center justify-between gap-3 shrink-0 animate-fadeIn">
          <div className="flex-1 min-w-0 bg-white/90 rounded-lg p-2 border-l-4 border-[#1fa855] shadow-2xs">
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
        <div className="px-3.5 pt-2 pb-1.5 bg-[#f0f2f5] border-t border-[#d1d7db] flex items-center justify-between gap-3 shrink-0 animate-fadeIn">
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
        <div className="px-3.5 pt-2 pb-1.5 bg-[#f0f2f5] border-t border-[#d1d7db] flex items-center justify-between gap-3 shrink-0 animate-fadeIn">
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

      {/* WhatsApp Authentic Input Bar or Voice Recording Bar */}
      {isRecording ? (
        <div className="p-2.5 bg-[#f0f2f5] border-t border-[#d1d7db] shrink-0 flex items-center space-x-2 z-10">
          {/* Cancel Recording (Trash) */}
          <button
            type="button"
            onClick={handleCancelVoiceRecord}
            className="w-10 h-10 rounded-full text-rose-500 hover:text-rose-700 hover:bg-rose-100 flex items-center justify-center transition cursor-pointer shrink-0"
            title="Hủy ghi âm"
          >
            <Trash2 className="w-5 h-5" />
          </button>

          {/* Recording Status: pulsing red dot, timer, and animated waveform */}
          <div className="flex-1 flex items-center gap-3 bg-white px-4 py-2 rounded-lg border border-rose-200 shadow-2xs">
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
            className="w-10 h-10 rounded-full bg-[#1fa855] hover:bg-[#1a924a] text-white flex items-center justify-center transition shadow-md cursor-pointer shrink-0"
            title="Gửi ngay tin nhắn thoại"
          >
            <Send className="w-4 h-4 ml-0.5" />
          </button>
        </div>
      ) : isRecorded ? (
        <div className="p-2.5 bg-[#f0f2f5] border-t border-[#d1d7db] shrink-0 flex items-center space-x-2 z-10">
          {/* Cancel / Discard Recording to re-record */}
          <button
            type="button"
            onClick={handleCancelVoiceRecord}
            className="w-10 h-10 rounded-full text-rose-500 hover:text-rose-700 hover:bg-rose-100 flex items-center justify-center transition cursor-pointer shrink-0"
            title="Xóa bản ghi âm để thu lại"
          >
            <Trash2 className="w-5 h-5" />
          </button>

          {/* Audio Preview Player */}
          <div className="flex-1 flex items-center gap-3 bg-white px-3.5 py-1.5 rounded-lg border border-emerald-200 shadow-2xs min-w-0">
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
        <div className="p-2.5 bg-[#f0f2f5] border-t border-[#d1d7db] shrink-0 flex items-end space-x-1.5 z-10">
          {/* Emoji Trigger */}
          <div className="relative">
            <button
              ref={emojiButtonRef}
              type="button"
              onClick={() => {
                setShowEmojiPicker(!showEmojiPicker);
                setShowAttachMenu(false);
                setShowTemplatePicker(false);
              }}
              className={`p-2 rounded-full transition cursor-pointer ${
                showEmojiPicker
                  ? 'bg-slate-200 text-[#1fa855]'
                  : 'text-[#54656f] hover:text-[#111b21] hover:bg-slate-200/60'
              }`}
              title="Biểu tượng cảm xúc"
              aria-label="Biểu tượng cảm xúc"
              aria-expanded={showEmojiPicker}
            >
              <Smile className="w-5 h-5" />
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

          {/* Attachment Button: Directly opens native file chooser for any file */}
          <button
            type="button"
            onClick={() => {
              if (fileInputRef.current) fileInputRef.current.click();
              setShowEmojiPicker(false);
              setShowTemplatePicker(false);
            }}
            className="p-2 text-[#54656f] hover:text-[#111b21] hover:bg-slate-200/60 rounded-full transition cursor-pointer"
            title="Đính kèm tệp (Hình ảnh, PDF, Báo giá, Hóa đơn, Excel, Word...)"
            aria-label="Đính kèm tệp"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          {/* Catalog Product Picker Trigger */}
          <button
            type="button"
            onClick={() => {
              onOpenProductPicker();
              setShowEmojiPicker(false);
              setShowTemplatePicker(false);
            }}
            className="p-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-100/70 rounded-full transition cursor-pointer"
            title="Gửi sản phẩm từ Meta Catalog"
            aria-label="Gửi sản phẩm Meta Catalog"
          >
            <Package className="w-5 h-5" />
          </button>

          {/* Quick Canned Template Trigger */}
          <div className="relative">
            <button
              ref={templateButtonRef}
              type="button"
              onClick={() => {
                setShowTemplatePicker(!showTemplatePicker);
                setShowEmojiPicker(false);
                setShowAttachMenu(false);
              }}
              className={`p-2 rounded-full transition cursor-pointer ${
                showTemplatePicker
                  ? 'bg-amber-100 text-amber-700'
                  : 'text-amber-600 hover:text-amber-700 hover:bg-amber-100/60'
              }`}
              title="Mẫu tin nhắn nhanh (/)"
              aria-label="Mẫu tin nhắn nhanh"
              aria-expanded={showTemplatePicker}
            >
              <Zap className="w-5 h-5 fill-amber-500 text-amber-500" />
            </button>

            {showTemplatePicker && (
              <div
                ref={templatePickerRef}
                className="absolute bottom-full mb-3 left-0 bg-white border border-slate-300 rounded-2xl p-3 shadow-2xl z-50 w-84 max-h-80 overflow-y-auto animate-fadeIn divide-y divide-slate-100"
              >
                <div className="flex items-center justify-between pb-2 mb-1">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                    Mẫu Tin Nhắn Nhanh ({templates.length})
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setShowTemplatePicker(false);
                        onOpenQuickTemplatesModal();
                      }}
                      className="p-1 text-slate-400 hover:text-emerald-700 hover:bg-slate-100 rounded-lg transition"
                      title="Quản lý và thêm mẫu tin nhắn"
                    >
                      <Settings className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowTemplatePicker(false)}
                      className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="space-y-1 py-1">
                  {templates.map((tmpl) => (
                    <div
                      key={tmpl.id || tmpl.code}
                      onClick={() => {
                        handleApplyTemplate(tmpl.content);
                        setShowTemplatePicker(false);
                      }}
                      className="p-2 hover:bg-emerald-50 rounded-xl cursor-pointer transition group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#1fa855] group-hover:underline">
                          {tmpl.title}
                        </span>
                        <span className="text-[10px] font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">
                          {tmpl.code}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 truncate mt-0.5">{tmpl.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Textarea Input with Clipboard Paste support */}
          <div className="flex-1 bg-white rounded-lg px-3.5 py-2 transition shadow-2xs">
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
                  ? "Nhập chú thích cho ảnh (Tùy chọn)..."
                  : pendingDocument
                  ? "Nhập ghi chú cho tài liệu (Tùy chọn)..."
                  : "Nhập tin nhắn (Gõ / để chọn câu trả lời nhanh)..."
              }
              className="block w-full max-h-[120px] resize-none overflow-y-hidden bg-transparent text-[14px] leading-5 text-[#111b21] placeholder-[#8696a0] focus:outline-none"
            />
          </div>

          {/* Mic vs Send Button */}
          {inputText.trim() || pendingImage || pendingDocument ? (
            <button
              type="button"
              onClick={() => {
                stopTyping();
                handleSend();
              }}
              className="w-10 h-10 rounded-full bg-[#1fa855] hover:bg-[#1fa855] text-white flex items-center justify-center transition shadow-md cursor-pointer shrink-0"
              title="Gửi tin nhắn (Enter)"
            >
              <Send className="w-4 h-4 ml-0.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStartVoiceRecord}
              className="w-10 h-10 rounded-full text-[#54656f] hover:text-[#111b21] hover:bg-slate-200/60 flex items-center justify-center transition cursor-pointer shrink-0"
              title="Ghi âm thoại thật (Microphone)"
            >
              <Mic className="w-5 h-5" />
            </button>
          )}
        </div>
      )}
    </>
  );
};
