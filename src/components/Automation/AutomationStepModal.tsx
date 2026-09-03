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

export const getStepIconTheme = (color?: string, iconName?: string) => {
  const c = (color || '').toLowerCase();
  const name = iconName || '';

  if (c.includes('pink') || c.includes('rose') || name === 'Heart') {
    return {
      containerClass: 'bg-rose-50 border-rose-200 text-rose-600 step-icon-pink',
      iconClass: 'step-icon-pink text-rose-600',
    };
  }
  if (c.includes('amber') || c.includes('orange') || name === 'MessageCircle') {
    return {
      containerClass: 'bg-amber-50 border-amber-200 text-amber-600 step-icon-amber',
      iconClass: 'step-icon-amber text-amber-600',
    };
  }
  if (c.includes('blue') || c.includes('cyan') || name === 'HelpCircle') {
    return {
      containerClass: 'bg-blue-50 border-blue-200 text-blue-600 step-icon-blue',
      iconClass: 'step-icon-blue text-blue-600',
    };
  }
  if (c.includes('emerald') || c.includes('teal') || c.includes('green') || name === 'Gift') {
    return {
      containerClass: 'bg-emerald-50 border-emerald-200 text-emerald-600 step-icon-emerald',
      iconClass: 'step-icon-emerald text-emerald-600',
    };
  }
  if (c.includes('purple') || c.includes('indigo') || c.includes('violet') || name === 'Sparkles') {
    return {
      containerClass: 'bg-purple-50 border-purple-200 text-purple-600 step-icon-purple',
      iconClass: 'step-icon-purple text-purple-600',
    };
  }

  return {
    containerClass: 'bg-rose-50 border-rose-200 text-rose-600 step-icon-pink',
    iconClass: 'step-icon-pink text-rose-600',
  };
};

export const COLOR_OPTIONS = [
  { label: 'Hồng (Tri ân)', value: 'pink' },
  { label: 'Cam (Trải nghiệm)', value: 'amber' },
  { label: 'Xanh dương (Tư vấn)', value: 'blue' },
  { label: 'Xanh lá (Ưu đãi)', value: 'emerald' },
  { label: 'Tím (Đặc quyền)', value: 'purple' },
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

    const updated = sortStepsByDay(currentSteps.filter((step) => step.id !== stepId));
    setCurrentSteps(updated);
    onSaveSteps(updated);
  };

  const handleToggleActive = (stepId: string) => {
    const updated = sortStepsByDay(currentSteps.map((step) => (
      step.id === stepId ? { ...step, active: !step.active } : step
    )));
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
          {isAddingNew || editingStep ? (
            <h3 className="flex items-center space-x-2 text-base font-bold text-slate-900">
              <Pencil className="h-4 w-4 text-emerald-600" />
              <span>{isAddingNew ? 'Thêm Bước Mới' : `Chỉnh Sửa: ${editingStep?.title}`}</span>
            </h3>
          ) : <span aria-hidden="true" />}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 bg-white">
          {isAddingNew || editingStep ? (
            /* Form Add/Edit */
            <form onSubmit={handleSaveForm} className="space-y-4">
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
                      const iconTheme = getStepIconTheme(formData.color, iconKey);
                      return (
                        <button
                          key={iconKey}
                          type="button"
                          onClick={() => setFormData({ ...formData, iconName: iconKey })}
                          className={`p-2 rounded-lg border flex flex-col items-center justify-center transition cursor-pointer ${
                            isSelected
                              ? `${iconTheme.containerClass} shadow-xs ring-2 ring-emerald-500`
                              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <IconComp className={`w-4 h-4 ${isSelected ? iconTheme.iconClass : ''}`} />
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

          {!isAddingNew && !editingStep ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-900">
                  Danh Sách Các Bước Trong Kịch Bản ({currentSteps.length} bước)
                </h4>
                <button
                  type="button"
                  onClick={handleStartAdd}
                  className="flex items-center space-x-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-500"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Thêm Bước Mới</span>
                </button>
              </div>

              <div className="space-y-2">
                {currentSteps.map((step) => {
                  const IconComponent = STEP_ICON_MAP[step.iconName] || Heart;
                  const iconTheme = getStepIconTheme(step.color, step.iconName);
                  return (
                    <div
                      key={step.id}
                      className={`flex flex-col justify-between gap-3 rounded-xl border p-4 shadow-xs transition sm:flex-row sm:items-center ${
                        step.active
                          ? 'border-slate-200 bg-white'
                          : 'border-slate-200 bg-slate-100/60 opacity-60'
                      }`}
                    >
                      <div className="flex min-w-0 items-start space-x-3 sm:items-center">
                        <div className={`shrink-0 rounded-xl border p-2.5 ${iconTheme.containerClass}`}>
                          <IconComponent className={`h-4 w-4 ${iconTheme.iconClass}`} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center space-x-2">
                            <span className="truncate text-xs font-bold text-slate-900">{step.title}</span>
                            <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                              +{step.dayOffset} ngày
                            </span>
                          </div>
                          <p className="mt-0.5 max-w-lg truncate text-[11px] text-slate-500">
                            {step.objective || step.defaultMsg}
                          </p>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center space-x-2 self-end sm:self-auto">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={step.active}
                          onClick={() => handleToggleActive(step.id)}
                          title={step.active ? 'Đang kích hoạt - Nhấp để tắt' : 'Đang tạm tắt - Nhấp để bật'}
                          className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors ${
                            step.active ? 'bg-emerald-600' : 'bg-rose-500'
                          }`}
                        >
                          <span
                            aria-hidden="true"
                            className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-md transition ${
                              step.active ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStartEdit(step)}
                          title="Chỉnh sửa bước này"
                          className="rounded-lg bg-slate-100 p-1.5 text-slate-700 transition hover:bg-slate-200"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteStep(step.id)}
                          title="Xóa bước này"
                          className="rounded-lg border border-rose-200 bg-rose-50 p-1.5 text-rose-600 transition hover:bg-rose-100"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

        </div>

      </div>
    </div>
  );
};
