import React, { useState } from 'react';
import {
  X,
  Plus,
  Trash2,
  Pencil,
  Check,
  Heart,
  MessageCircle,
  HelpCircle,
  Gift,
  Sparkles,
  Zap,
  Bell,
  Star,
  ShoppingBag,
  Smile,
  type LucideIcon,
} from 'lucide-react';
import type { AutomationStepItem, WhatsAppApprovedTemplate } from '../../types';

export const STEP_ICON_MAP: Record<string, LucideIcon> = {
  Heart,
  MessageCircle,
  HelpCircle,
  Gift,
  Sparkles,
  Zap,
  Bell,
  Star,
  ShoppingBag,
  Smile,
};

export const COLOR_OPTIONS = [
  { label: 'Hồng (Tri ân)', value: 'from-pink-500/15 to-rose-500/15 border-pink-300 text-pink-700' },
  { label: 'Cam (Trải nghiệm)', value: 'from-amber-500/15 to-orange-500/15 border-amber-300 text-amber-700' },
  { label: 'Xanh dương (Tư vấn)', value: 'from-blue-500/15 to-cyan-500/15 border-blue-300 text-blue-700' },
  { label: 'Xanh lá (Ưu đãi)', value: 'from-emerald-500/15 to-teal-500/15 border-emerald-300 text-emerald-700' },
  { label: 'Tím (Đặc quyền)', value: 'from-purple-500/15 to-indigo-500/15 border-purple-300 text-purple-700' },
];

interface AutomationStepModalProps {
  isOpen: boolean;
  onClose: () => void;
  steps: AutomationStepItem[];
  onSaveSteps: (updatedSteps: AutomationStepItem[]) => void;
  approvedTemplates?: WhatsAppApprovedTemplate[];
  initialEditStepId?: string | null;
}

export const AutomationStepModal: React.FC<AutomationStepModalProps> = ({
  isOpen,
  onClose,
  steps,
  onSaveSteps,
  approvedTemplates = [],
  initialEditStepId,
}) => {
  const sortStepsByDay = (items: AutomationStepItem[]) =>
    [...items]
      .sort((a, b) => a.dayOffset - b.dayOffset)
      .map((s, idx) => ({ ...s, step: idx + 1 }));

  const [currentSteps, setCurrentSteps] = useState<AutomationStepItem[]>(() => sortStepsByDay(steps));
  const [editingStep, setEditingStep] = useState<AutomationStepItem | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  // Sync when modal opens or steps change
  React.useEffect(() => {
    setCurrentSteps(sortStepsByDay(steps));
    if (initialEditStepId) {
      const target = steps.find((s) => s.id === initialEditStepId);
      if (target) {
        setEditingStep(target);
        setIsAddingNew(false);
        setFormData({
          title: target.title,
          dayOffset: target.dayOffset,
          objective: target.objective,
          defaultMsg: target.defaultMsg,
          iconName: target.iconName,
          color: target.color,
          active: target.active,
          templateName: target.templateName || '',
        });
      }
    } else {
      setEditingStep(null);
      setIsAddingNew(false);
    }
  }, [steps, initialEditStepId, isOpen]);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    dayOffset: 3,
    objective: '',
    defaultMsg: '',
    iconName: 'Heart',
    color: COLOR_OPTIONS[0].value,
    active: true,
    templateName: '',
  });

  const handleStartEdit = (step: AutomationStepItem) => {
    setEditingStep(step);
    setIsAddingNew(false);
    setFormData({
      title: step.title,
      dayOffset: step.dayOffset,
      objective: step.objective,
      defaultMsg: step.defaultMsg,
      iconName: step.iconName,
      color: step.color,
      active: step.active,
      templateName: step.templateName || '',
    });
  };

  const handleStartAdd = () => {
    const nextStepNum = currentSteps.length + 1;
    const lastDay = currentSteps.length > 0 ? currentSteps[currentSteps.length - 1].dayOffset + 5 : 3;
    setEditingStep(null);
    setIsAddingNew(true);
    setFormData({
      title: `Ngày +${lastDay}: Chăm sóc khách hàng`,
      dayOffset: lastDay,
      objective: 'Gửi tin nhắn chăm sóc và gia tăng lòng trung thành của khách hàng.',
      defaultMsg: 'Chào {{Customer Name}}, VietCRM xin gửi lời cảm ơn chân thành bạn đã tin dùng sản phẩm!',
      iconName: 'Sparkles',
      color: COLOR_OPTIONS[(nextStepNum - 1) % COLOR_OPTIONS.length].value,
      active: true,
      templateName: '',
    });
  };

  const handleCancelForm = () => {
    setEditingStep(null);
    setIsAddingNew(false);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      alert('Vui lòng nhập tiêu đề bước!');
      return;
    }

    if (isAddingNew) {
      const newStep: AutomationStepItem = {
        id: `step_${Date.now()}`,
        step: currentSteps.length + 1,
        dayOffset: Number(formData.dayOffset) || 0,
        title: formData.title.trim(),
        objective: formData.objective.trim(),
        defaultMsg: formData.defaultMsg.trim(),
        iconName: formData.iconName,
        color: formData.color,
        active: formData.active,
        templateName: formData.templateName || undefined,
      };
      const updated = sortStepsByDay([...currentSteps, newStep]);
      setCurrentSteps(updated);
      onSaveSteps(updated);
    } else if (editingStep) {
      const updated = sortStepsByDay(
        currentSteps.map((s) => {
          if (s.id === editingStep.id) {
            return {
              ...s,
              title: formData.title.trim(),
              dayOffset: Number(formData.dayOffset) || 0,
              objective: formData.objective.trim(),
              defaultMsg: formData.defaultMsg.trim(),
              iconName: formData.iconName,
              color: formData.color,
              active: formData.active,
              templateName: formData.templateName || undefined,
            };
          }
          return s;
        })
      );
      setCurrentSteps(updated);
      onSaveSteps(updated);
    }

    handleCancelForm();
  };

  const handleDeleteStep = (stepId: string) => {
    if (currentSteps.length <= 1) {
      alert('Quy trình phải có ít nhất 1 bước!');
      return;
    }
    if (!confirm('Bạn có chắc chắn muốn xóa bước này khỏi quy trình?')) return;

    const updated = sortStepsByDay(currentSteps.filter((s) => s.id !== stepId));
    setCurrentSteps(updated);
    onSaveSteps(updated);

    if (editingStep?.id === stepId) {
      handleCancelForm();
    }
  };

  const handleToggleActive = (stepId: string) => {
    const updated = sortStepsByDay(currentSteps.map((s) => (s.id === stepId ? { ...s, active: !s.active } : s)));
    setCurrentSteps(updated);
    onSaveSteps(updated);
  };

  const handleSelectApprovedTemplate = (templateName: string) => {
    setFormData((prev) => ({ ...prev, templateName }));
    if (!templateName) return;

    const found = approvedTemplates.find((t) => t.name === templateName);
    if (found) {
      const bodyComp = found.components.find((c) => c.type === 'BODY');
      if (bodyComp?.text) {
        setFormData((prev) => ({
          ...prev,
          templateName,
          defaultMsg: bodyComp.text || prev.defaultMsg,
        }));
      }
    }
  };

  const handleInsertToken = (token: string) => {
    setFormData((prev) => ({
      ...prev,
      defaultMsg: `${prev.defaultMsg} ${token}`,
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white border border-slate-200 w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-slate-800 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0 bg-white">
          <div>
            <div className="flex items-center space-x-2">
              <Zap className="w-5 h-5 text-emerald-600" />
              <h3 className="font-bold text-slate-900 text-base">
                Tùy Chỉnh Quy Trình Chăm Sóc Khách Hàng Tự Động
              </h3>
            </div>

          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 bg-slate-50/50">
          {isAddingNew || editingStep ? (
            /* Form Add/Edit */
            <form onSubmit={handleSaveForm} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <h4 className="font-bold text-slate-900 text-sm flex items-center space-x-2">
                  <Pencil className="w-4 h-4 text-emerald-600" />
                  <span>{isAddingNew ? 'Thêm Bước Mới' : `Chỉnh Sửa: ${editingStep?.title}`}</span>
                </h4>
                <div className="flex items-center space-x-3">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={formData.active}
                    onClick={() => setFormData((prev) => ({ ...prev, active: !prev.active }))}
                    title={formData.active ? 'Đang kích hoạt - Nhấp để tắt' : 'Đang tạm tắt - Nhấp để bật'}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none focus:outline-none focus:ring-0 ${
                      formData.active ? 'bg-emerald-600' : 'bg-rose-500'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                        formData.active ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelForm}
                    className="text-xs text-slate-500 hover:text-slate-800 font-medium transition cursor-pointer"
                  >
                    Hủy quay lại
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Tiêu Đề Bước <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="VD: Ngày +3: Lời Cảm Ơn & HDSD"
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Số Ngày Sau Mua (+Ngày) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={365}
                    required
                    value={formData.dayOffset}
                    onChange={(e) => setFormData({ ...formData, dayOffset: Number(e.target.value) })}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Mục Tiêu Bước Chăm Sóc
                </label>
                <input
                  type="text"
                  value={formData.objective}
                  onChange={(e) => setFormData({ ...formData, objective: e.target.value })}
                  placeholder="VD: Bày tỏ lòng tri ân, gửi video/văn bản hướng dẫn sử dụng sản phẩm chuẩn xác."
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
                />
              </div>

              {approvedTemplates.length > 0 && (
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Liên Kết Mẫu WhatsApp Template Đã Duyệt (Tùy chọn)
                  </label>
                  <select
                    value={formData.templateName}
                    onChange={(e) => handleSelectApprovedTemplate(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
                  >
                    <option value="">-- Tự Soạn Tin Nhắn (Không dùng Template Meta) --</option>
                    {approvedTemplates.map((tpl) => (
                      <option key={tpl.name} value={tpl.name}>
                        {tpl.name} ({tpl.category} - {tpl.language})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-700">
                    Nội Dung Tin Nhắn Gửi Khách <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex items-center space-x-1.5 text-[11px] text-slate-500">
                    <span>Chèn biến nhanh:</span>
                    <button
                      type="button"
                      onClick={() => handleInsertToken('{{Customer Name}}')}
                      className="px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded font-mono text-[10px] transition cursor-pointer"
                    >
                      &#123;&#123;Customer Name&#125;&#125;
                    </button>
                    <button
                      type="button"
                      onClick={() => handleInsertToken('{{Order ID}}')}
                      className="px-2 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded font-mono text-[10px] transition cursor-pointer"
                    >
                      &#123;&#123;Order ID&#125;&#125;
                    </button>
                  </div>
                </div>
                <textarea
                  rows={4}
                  required
                  value={formData.defaultMsg}
                  onChange={(e) => setFormData({ ...formData, defaultMsg: e.target.value })}
                  placeholder="Nhập nội dung tin nhắn gửi khách..."
                  className="w-full bg-white border border-slate-300 rounded-lg p-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 leading-relaxed font-mono transition"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Biểu Tượng (Icon)
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {Object.keys(STEP_ICON_MAP).map((iconKey) => {
                      const IconComp = STEP_ICON_MAP[iconKey];
                      const isSelected = formData.iconName === iconKey;
                      return (
                        <button
                          key={iconKey}
                          type="button"
                          onClick={() => setFormData({ ...formData, iconName: iconKey })}
                          className={`p-2 rounded-lg border flex flex-col items-center justify-center transition cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-50 border-emerald-500 text-emerald-700 font-bold shadow-xs ring-1 ring-emerald-400'
                              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <IconComp className="w-4 h-4" />
                          <span className="text-[9px] mt-1 truncate max-w-full font-medium">{iconKey}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Tông Màu Thẻ
                  </label>
                  <div className="space-y-1.5">
                    {COLOR_OPTIONS.map((opt) => (
                      <label
                        key={opt.label}
                        className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border cursor-pointer text-xs transition ${
                          formData.color === opt.value
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-900 font-semibold shadow-xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="step_color"
                          checked={formData.color === opt.value}
                          onChange={() => setFormData({ ...formData, color: opt.value })}
                          className="text-emerald-600 focus:ring-0"
                        />
                        <span>{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={handleCancelForm}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition cursor-pointer"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow-sm flex items-center space-x-1.5 transition cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{isAddingNew ? 'Thêm Bước Này' : 'Lưu Thay Đổi'}</span>
                </button>
              </div>
            </form>
          ) : null}

          {/* List of current steps */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-900 text-sm">
                Danh Sách Các Bước Trong Kịch Bản ({currentSteps.length} bước)
              </h4>
              {!isAddingNew && !editingStep && (
                <button
                  type="button"
                  onClick={handleStartAdd}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 transition shadow-sm cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm Bước Mới</span>
                </button>
              )}
            </div>

            <div className="space-y-2">
              {currentSteps.map((s, idx) => {
                const IconComp = STEP_ICON_MAP[s.iconName] || Heart;
                const isFirst = idx === 0;
                const isLast = idx === currentSteps.length - 1;

                return (
                  <div
                    key={s.id}
                    className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition shadow-xs ${
                      s.active
                        ? 'bg-white border-slate-200'
                        : 'bg-slate-100/60 border-slate-200 opacity-60'
                    }`}
                  >
                    <div className="flex items-start sm:items-center space-x-3 min-w-0">
                      <div className={`p-2.5 rounded-xl bg-gradient-to-br ${s.color} border shrink-0`}>
                        <IconComp className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-bold text-slate-900 truncate">{s.title}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                            +{s.dayOffset} ngày
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5 max-w-lg">
                          {s.objective || s.defaultMsg}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0 self-end sm:self-auto">
                      {/* Active toggle switch */}
                      <button
                        type="button"
                        role="switch"
                        aria-checked={s.active}
                        onClick={() => handleToggleActive(s.id)}
                        title={s.active ? 'Đang kích hoạt - Nhấp để tắt' : 'Đang tạm tắt - Nhấp để bật'}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none focus:outline-none focus:ring-0 ${
                          s.active ? 'bg-emerald-600' : 'bg-rose-500'
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                            s.active ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>

                      {/* Edit Button */}
                      <button
                        type="button"
                        onClick={() => handleStartEdit(s)}
                        title="Chỉnh sửa bước này"
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete Button */}
                      <button
                        type="button"
                        onClick={() => handleDeleteStep(s.id)}
                        title="Xóa bước này"
                        className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 flex items-center justify-end shrink-0 bg-white">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition cursor-pointer"
          >
            Đóng Lại
          </button>
        </div>

      </div>
    </div>
  );
};
