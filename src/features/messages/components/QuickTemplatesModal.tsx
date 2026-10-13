import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  Plus,
  Edit2,
  Trash2,
  Search,
  Zap,
  Smile,
} from 'lucide-react';
import { EmojiPicker } from '../../../components/Common/EmojiPicker';
import type { QuickTemplate } from '../types';
import { useQuickTemplates } from '../hooks/useQuickTemplates';

interface QuickTemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TemplateFormErrors {
  title?: string;
  code?: string;
  content?: string;
}

export const QuickTemplatesModal: React.FC<QuickTemplatesModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { templates, addTemplate, updateTemplate, deleteTemplate } = useQuickTemplates();

  const [searchQuery, setSearchQuery] = useState('');
  const [editingTemplate, setEditingTemplate] = useState<QuickTemplate | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  // Form State
  const [formCode, setFormCode] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formErrors, setFormErrors] = useState<TemplateFormErrors>({});
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const contentInputRef = useRef<HTMLTextAreaElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);

  const formattedCode = formCode.trim() ? `/${formCode.trim().replace(/^\/+/, '')}` : '';
  const duplicateTemplate = useMemo(() => templates.find(
    (template) => formattedCode
      && template.code.toLowerCase() === formattedCode.toLowerCase()
      && template.id !== editingTemplate?.id,
  ), [editingTemplate?.id, formattedCode, templates]);
  const filteredTemplates = useMemo(() => {
    return templates.filter((item) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        item.code.toLowerCase().includes(q) ||
        item.title.toLowerCase().includes(q) ||
        item.content.toLowerCase().includes(q)
      );
    });
  }, [templates, searchQuery]);

  useEffect(() => {
    if (!isCreatingNew && !editingTemplate) return;
    const frame = requestAnimationFrame(() => titleInputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [editingTemplate, isCreatingNew]);

  useEffect(() => {
    if (!showEmojiPicker) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!emojiPickerRef.current?.contains(target) && !emojiButtonRef.current?.contains(target)) {
        setShowEmojiPicker(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowEmojiPicker(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showEmojiPicker]);

  if (!isOpen) return null;

  const handleStartCreate = () => {
    setEditingTemplate(null);
    setFormCode('');
    setFormTitle('');
    setFormContent('');
    setFormErrors({});
    setShowEmojiPicker(false);
    setIsCreatingNew(true);
  };

  const handleStartEdit = (tmpl: QuickTemplate) => {
    setIsCreatingNew(false);
    setEditingTemplate(tmpl);
    setFormCode(tmpl.code.replace(/^\/+/, ''));
    setFormTitle(tmpl.title);
    setFormContent(tmpl.content);
    setFormErrors({});
    setShowEmojiPicker(false);
  };

  const handleCancelForm = () => {
    setIsCreatingNew(false);
    setEditingTemplate(null);
    setFormErrors({});
    setShowEmojiPicker(false);
  };

  const handleInsertVariable = (varName: string) => {
    const textarea = contentInputRef.current;
    const start = textarea?.selectionStart ?? formContent.length;
    const end = textarea?.selectionEnd ?? formContent.length;
    setFormContent(`${formContent.slice(0, start)}${varName}${formContent.slice(end)}`);
    setFormErrors((current) => ({ ...current, content: undefined }));
    requestAnimationFrame(() => {
      if (!textarea) return;
      const caret = start + varName.length;
      textarea.selectionStart = caret;
      textarea.selectionEnd = caret;
      textarea.focus();
    });
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = formCode.trim();
    const cleanTitle = formTitle.trim();
    const cleanContent = formContent.trim();

    const errors: TemplateFormErrors = {};
    if (!cleanTitle) errors.title = 'Vui lòng nhập tiêu đề mẫu.';
    if (!cleanCode) errors.code = 'Vui lòng nhập phím tắt, ví dụ: chao hoặc gia.';
    else if (duplicateTemplate) errors.code = `Phím tắt ${formattedCode} đã được dùng cho mẫu “${duplicateTemplate.title}”.`;
    if (!cleanContent) errors.content = 'Vui lòng nhập nội dung tin nhắn.';
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    if (isCreatingNew) {
      addTemplate({
        code: formattedCode,
        title: cleanTitle,
        content: cleanContent,
      });
    } else if (editingTemplate) {
      updateTemplate(editingTemplate.id, {
        code: formattedCode,
        title: cleanTitle,
        content: cleanContent,
      });
    }

    handleCancelForm();
  };

  const handleDelete = (id: string, title: string) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa mẫu tin nhắn "${title}" không?`)) {
      deleteTemplate(id);
      if (editingTemplate?.id === id) {
        handleCancelForm();
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:px-6 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 shadow-2xs">
              <Zap className="w-5 h-5 fill-amber-500 text-amber-500" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                Quản lý Mẫu Tin Nhắn Nhanh
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* Top Actions: Search + Add Button */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm kiếm theo phím tắt, tiêu đề hoặc nội dung..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#1fa855] focus:border-transparent transition"
              />
            </div>

            <button
              type="button"
              onClick={handleStartCreate}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-[#1fa855] hover:bg-[#1a924a] text-white text-xs sm:text-sm font-semibold rounded-xl shadow-xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm Mẫu Mới</span>
            </button>
          </div>

          {/* Form Modal / Drawer if Creating or Editing */}
          {(isCreatingNew || editingTemplate) && (
            <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-4 sm:p-5 shadow-xs animate-fadeIn">
              <div className="mb-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleCancelForm}
                  className="shrink-0 rounded-lg p-1 text-slate-400 transition hover:bg-white hover:text-slate-600"
                  aria-label="Đóng biểu mẫu"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveForm} className="grid grid-cols-1 gap-4">
                <div className="space-y-3.5">
                  <div>
                    <label htmlFor="quick-template-title" className="mb-1 block text-xs font-semibold text-slate-700">
                      Tiêu đề <span className="text-rose-500">*</span>
                    </label>
                    <input
                      ref={titleInputRef}
                      id="quick-template-title"
                      type="text"
                      placeholder="Ví dụ: Chào hỏi khách hàng"
                      value={formTitle}
                      onChange={(event) => {
                        setFormTitle(event.target.value);
                        setFormErrors((current) => ({ ...current, title: undefined }));
                      }}
                      aria-invalid={Boolean(formErrors.title)}
                      className={`w-full rounded-xl border bg-white px-3 py-2 text-xs transition focus:outline-none focus:ring-2 sm:text-sm ${
                        formErrors.title
                          ? 'border-rose-300 focus:ring-rose-200'
                          : 'border-slate-200 focus:ring-[#1fa855]'
                      }`}
                    />
                    {formErrors.title && <p className="mt-1 text-[11px] text-rose-600">{formErrors.title}</p>}
                  </div>

                  <div>
                    <label htmlFor="quick-template-code" className="mb-1 block text-xs font-semibold text-slate-700">
                      Phím tắt kích hoạt <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs font-bold text-[#1fa855] sm:text-sm">
                        /
                      </span>
                      <input
                        id="quick-template-code"
                        type="text"
                        placeholder="chao"
                        value={formCode}
                        onChange={(event) => {
                          setFormCode(event.target.value.replace(/^\/+/, ''));
                          setFormErrors((current) => ({ ...current, code: undefined }));
                        }}
                        aria-invalid={Boolean(formErrors.code || duplicateTemplate)}
                        className={`w-full rounded-xl border bg-white py-2 pl-6 pr-3 font-mono text-xs font-bold text-[#1fa855] transition focus:outline-none focus:ring-2 sm:text-sm ${
                          formErrors.code || duplicateTemplate
                            ? 'border-rose-300 focus:ring-rose-200'
                            : 'border-slate-200 focus:ring-[#1fa855]'
                        }`}
                      />
                    </div>
                    {(formErrors.code || duplicateTemplate) && (
                      <p className="mt-1 text-[11px] text-rose-600">
                        {formErrors.code || `Phím tắt ${formattedCode} đã được dùng cho mẫu “${duplicateTemplate?.title}”.`}
                      </p>
                    )}
                  </div>

                  <div>
                    <div className="mb-1.5">
                      <label htmlFor="quick-template-content" className="block text-xs font-semibold text-slate-700">
                        Nội dung tin nhắn <span className="text-rose-500">*</span>
                      </label>
                    </div>
                    <textarea
                      ref={contentInputRef}
                      id="quick-template-content"
                      rows={6}
                      value={formContent}
                      onChange={(event) => {
                        setFormContent(event.target.value);
                        setFormErrors((current) => ({ ...current, content: undefined }));
                      }}
                      placeholder="Nhập nội dung mẫu câu trả lời tại đây..."
                      aria-invalid={Boolean(formErrors.content)}
                      className={`w-full resize-y rounded-xl border bg-white px-3 py-2 text-xs leading-relaxed transition focus:outline-none focus:ring-2 sm:text-sm ${
                        formErrors.content
                          ? 'border-rose-300 focus:ring-rose-200'
                          : 'border-slate-200 focus:ring-[#1fa855]'
                      }`}
                    />
                    {formErrors.content && <p className="mt-1 text-[11px] text-rose-600">{formErrors.content}</p>}

                    <div className="mt-2 flex items-start justify-between gap-2">
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { label: 'Tên khách', value: '{ten_khach}' },
                          { label: 'SĐT', value: '{sdt}' },
                          { label: 'Thương hiệu', value: '{thuong_hieu}' },
                        ].map((variable) => (
                          <button
                            key={variable.value}
                            type="button"
                            onClick={() => handleInsertVariable(variable.value)}
                            className="rounded-lg border border-emerald-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-emerald-700 transition hover:bg-emerald-50"
                            title={`Chèn ${variable.value}`}
                          >
                            + {variable.label}
                          </button>
                        ))}
                      </div>

                      <div className="relative shrink-0">
                        <button
                          ref={emojiButtonRef}
                          type="button"
                          onClick={() => setShowEmojiPicker((current) => !current)}
                          className={`flex h-8 w-8 items-center justify-center rounded-lg border transition ${
                            showEmojiPicker
                              ? 'border-emerald-300 bg-emerald-50 text-[#1fa855]'
                              : 'border-slate-200 bg-white text-slate-500 hover:border-emerald-300 hover:text-[#1fa855]'
                          }`}
                          title="Chèn emoji"
                          aria-label="Chèn emoji"
                          aria-expanded={showEmojiPicker}
                        >
                          <Smile className="h-4 w-4" />
                        </button>

                        {showEmojiPicker && (
                          <div ref={emojiPickerRef} className="absolute bottom-full right-0 z-50 mb-2 animate-fadeIn">
                            <EmojiPicker
                              onSelect={handleInsertVariable}
                              onClose={() => setShowEmojiPicker(false)}
                              theme="emerald"
                              title="Biểu tượng cảm xúc"
                              bodyMaxHeight="max-h-56"
                              className="flex w-80 max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 border-t border-emerald-100 pt-3">
                  <button
                    type="button"
                    onClick={handleCancelForm}
                    className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={Boolean(duplicateTemplate)}
                    className="rounded-xl bg-[#1fa855] px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-[#1a924a] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isCreatingNew ? 'Lưu mẫu' : 'Lưu'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Template List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredTemplates.length === 0 ? (
              <div className="col-span-full py-12 text-center text-slate-400">
                <Zap className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                <p className="text-sm font-medium text-slate-600">Không tìm thấy mẫu tin nhắn nào</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Thử tìm với từ khóa khác hoặc bấm "Thêm Mẫu Mới" ở trên.
                </p>
              </div>
            ) : (
              filteredTemplates.map((item) => (
                <div
                  key={item.id}
                  className="bg-white border border-slate-200 hover:border-emerald-300 rounded-2xl p-3.5 shadow-2xs hover:shadow-xs transition flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-mono text-xs font-bold bg-emerald-50 text-[#1fa855] border border-emerald-200 px-2 py-0.5 rounded-lg shrink-0">
                          {item.code}
                        </span>
                        <h4 className="text-xs sm:text-sm font-bold text-slate-800 truncate">
                          {item.title}
                        </h4>
                      </div>
                    </div>

                    <p className="mt-2 max-h-24 overflow-y-auto overscroll-contain whitespace-pre-wrap break-words rounded-xl border border-slate-100 bg-slate-50/60 p-2 pr-2.5 text-xs leading-relaxed text-slate-600">
                      {item.content}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-3 mt-2 border-t border-slate-100">
                    <span className="text-[10px] text-slate-400">
                      Gõ <code className="text-[#1fa855] font-mono font-bold">{item.code}</code> để dùng
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(item)}
                        title="Chỉnh sửa mẫu"
                        className="p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id, item.title)}
                        title="Xóa mẫu"
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
