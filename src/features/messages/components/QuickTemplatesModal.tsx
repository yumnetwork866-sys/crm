import React, { useMemo, useState } from 'react';
import {
  X,
  Plus,
  Edit2,
  Trash2,
  Search,
  Zap,
  HelpCircle,
} from 'lucide-react';
import type { QuickTemplate } from '../types';
import { useQuickTemplates } from '../hooks/useQuickTemplates';

interface QuickTemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate?: (content: string) => void;
}

export const QuickTemplatesModal: React.FC<QuickTemplatesModalProps> = ({
  isOpen,
  onClose,
  onSelectTemplate,
}) => {
  const { templates, addTemplate, updateTemplate, deleteTemplate } = useQuickTemplates();

  const [searchQuery, setSearchQuery] = useState('');
  const [editingTemplate, setEditingTemplate] = useState<QuickTemplate | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  // Form State
  const [formCode, setFormCode] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formError, setFormError] = useState('');

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

  if (!isOpen) return null;

  const handleStartCreate = () => {
    setEditingTemplate(null);
    setFormCode('');
    setFormTitle('');
    setFormContent('');
    setFormError('');
    setIsCreatingNew(true);
  };

  const handleStartEdit = (tmpl: QuickTemplate) => {
    setIsCreatingNew(false);
    setEditingTemplate(tmpl);
    setFormCode(tmpl.code.replace(/^\/+/, ''));
    setFormTitle(tmpl.title);
    setFormContent(tmpl.content);
    setFormError('');
  };

  const handleCancelForm = () => {
    setIsCreatingNew(false);
    setEditingTemplate(null);
    setFormError('');
  };

  const handleInsertVariable = (varName: string) => {
    setFormContent((prev) => `${prev}${varName}`);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = formCode.trim();
    const cleanTitle = formTitle.trim();
    const cleanContent = formContent.trim();

    if (!cleanCode) {
      setFormError('Vui lòng nhập phím tắt (ví dụ: chao, gia)');
      return;
    }
    if (!cleanTitle) {
      setFormError('Vui lòng nhập tiêu đề mẫu');
      return;
    }
    if (!cleanContent) {
      setFormError('Vui lòng nhập nội dung tin nhắn');
      return;
    }

    // Check duplicate code (excluding current editing item)
    const formattedCode = `/${cleanCode.replace(/^\/+/, '')}`;
    const duplicate = templates.find(
      (t) => t.code.toLowerCase() === formattedCode.toLowerCase() && t.id !== editingTemplate?.id
    );
    if (duplicate) {
      setFormError(`Phím tắt "${formattedCode}" đã được sử dụng cho mẫu "${duplicate.title}"`);
      return;
    }

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
              <div className="flex items-center gap-3 pb-3 border-b border-emerald-100 mb-4">
                <label htmlFor="quick-template-title" className="shrink-0 text-xs font-semibold text-slate-700">
                  Tiêu đề <span className="text-rose-500">*</span>
                </label>
                <input
                  id="quick-template-title"
                  form="quick-template-form"
                  type="text"
                  placeholder="Chào hỏi & Tư vấn"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="min-w-0 flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#1fa855]"
                />
                <button
                  type="button"
                  onClick={handleCancelForm}
                  className="shrink-0 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {formError && (
                <div className="mb-3 px-3 py-2 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-600">
                  {formError}
                </div>
              )}

              <form id="quick-template-form" onSubmit={handleSaveForm} className="space-y-3.5">
                <div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Phím tắt kích hoạt <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs sm:text-sm font-mono text-[#1fa855] font-bold pointer-events-none">
                        /
                      </span>
                      <input
                        type="text"
                        placeholder="chao"
                        value={formCode}
                        onChange={(e) => setFormCode(e.target.value.replace(/^\/+/, ''))}
                        className="w-full pl-6 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-mono text-[#1fa855] font-bold focus:outline-none focus:ring-2 focus:ring-[#1fa855]"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700">
                      Nội dung tin nhắn <span className="text-rose-500">*</span>
                    </label>
                    {/* Placeholder helper chips */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] text-slate-500 flex items-center gap-1">
                        <HelpCircle className="w-3 h-3 text-slate-400" />
                        Chèn biến:
                      </span>
                      <button
                        type="button"
                        onClick={() => handleInsertVariable('{ten_khach}')}
                        className="px-2 py-0.5 bg-white border border-emerald-300 text-emerald-700 rounded-md text-[11px] font-mono hover:bg-emerald-50 transition"
                        title="Tự động thay bằng tên khách hàng đang trò chuyện"
                      >
                        + {'{ten_khach}'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleInsertVariable('{sdt}')}
                        className="px-2 py-0.5 bg-white border border-emerald-300 text-emerald-700 rounded-md text-[11px] font-mono hover:bg-emerald-50 transition"
                        title="Tự động thay bằng số điện thoại khách hàng"
                      >
                        + {'{sdt}'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleInsertVariable('{ten_nv}')}
                        className="px-2 py-0.5 bg-white border border-emerald-300 text-emerald-700 rounded-md text-[11px] font-mono hover:bg-emerald-50 transition"
                        title="Tự động thay bằng tên bạn (tư vấn viên)"
                      >
                        + {'{ten_nv}'}
                      </button>
                    </div>
                  </div>
                  <textarea
                    rows={4}
                    value={formContent}
                    onChange={(e) => setFormContent(e.target.value)}
                    placeholder="Nhập nội dung mẫu câu trả lời tại đây..."
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#1fa855] leading-relaxed resize-y"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleCancelForm}
                    className="px-3.5 py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-semibold rounded-xl transition"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-[#1fa855] hover:bg-[#1a924a] text-white text-xs font-semibold rounded-xl shadow-xs transition"
                  >
                    {isCreatingNew ? 'Thêm mẫu' : 'Cập nhật mẫu'}
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

                    <p className="text-xs text-slate-600 whitespace-pre-line line-clamp-3 leading-relaxed bg-slate-50/60 p-2 rounded-xl border border-slate-100 mt-2">
                      {item.content}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-3 mt-2 border-t border-slate-100">
                    <span className="text-[10px] text-slate-400">
                      Gõ <code className="text-[#1fa855] font-mono font-bold">{item.code}</code> để dùng
                    </span>

                    <div className="flex items-center gap-1">
                      {onSelectTemplate && (
                        <button
                          type="button"
                          onClick={() => {
                            onSelectTemplate(item.content);
                            onClose();
                          }}
                          className="px-2.5 py-1 text-xs text-emerald-700 bg-emerald-50 hover:bg-emerald-100 font-semibold rounded-lg transition"
                        >
                          Chèn vào chat
                        </button>
                      )}
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
