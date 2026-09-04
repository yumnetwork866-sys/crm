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
import { AutomationMessagePreview } from './AutomationMessagePreview';

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

const STEP_COLOR_PRESETS = [
  '#e11d48',
  '#d97706',
  '#2563eb',
  '#059669',
  '#9333ea',
  '#db2777',
  '#ea580c',
  '#0891b2',
  '#4f46e5',
  '#475569',
] as const;

export const normalizeStepColor = (color?: string, iconName?: string): string => {
  const value = (color || '').trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(value)) return value;
  if (value.includes('pink') || value.includes('rose')) return STEP_COLOR_PRESETS[0];
  if (value.includes('amber') || value.includes('orange')) return STEP_COLOR_PRESETS[1];
  if (value.includes('blue') || value.includes('cyan')) return STEP_COLOR_PRESETS[2];
  if (value.includes('emerald') || value.includes('teal') || value.includes('green')) return STEP_COLOR_PRESETS[3];
  if (value.includes('purple') || value.includes('indigo') || value.includes('violet')) return STEP_COLOR_PRESETS[4];

  const iconFallbacks: Record<string, string> = {
    Heart: STEP_COLOR_PRESETS[0],
    MessageCircle: STEP_COLOR_PRESETS[1],
    HelpCircle: STEP_COLOR_PRESETS[2],
    Gift: STEP_COLOR_PRESETS[3],
    Sparkles: STEP_COLOR_PRESETS[4],
  };
  return iconFallbacks[iconName || ''] || STEP_COLOR_PRESETS[0];
};

export const getStepIconTheme = (color?: string, iconName?: string) => {
  const hex = normalizeStepColor(color, iconName);
  return {
    containerStyle: {
      backgroundColor: `${hex}14`,
      borderColor: `${hex}45`,
      color: hex,
    },
    iconStyle: { color: hex, stroke: hex },
  };
};

interface AutomationStepModalProps {
  isOpen: boolean;
  onClose: () => void;
  steps: AutomationStepItem[];
  onSaveSteps: (updatedSteps: AutomationStepItem[]) => Promise<void>;
  approvedTemplates?: WhatsAppApprovedTemplate[];
  initialEditStepId?: string | null;
  isSaving?: boolean;
}

export const AutomationStepModal: React.FC<AutomationStepModalProps> = ({
  isOpen,
  onClose,
  steps,
  onSaveSteps,
  approvedTemplates = [],
  initialEditStepId,
  isSaving = false,
}) => {
  const sortStepsByDay = (items: AutomationStepItem[]) =>
    [...items]
      .sort((a, b) => a.dayOffset - b.dayOffset)
      .map((s, idx) => ({ ...s, step: idx + 1 }));

  const [currentSteps, setCurrentSteps] = useState<AutomationStepItem[]>(() => sortStepsByDay(steps));
  const [editingStep, setEditingStep] = useState<AutomationStepItem | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [paletteColors, setPaletteColors] = useState<string[]>(() =>
    Array.from(
      new Set([
        ...STEP_COLOR_PRESETS,
        ...steps.map((step) => normalizeStepColor(step.color, step.iconName)),
      ]),
    ),
  );
  const customColorInputRef = React.useRef<HTMLInputElement>(null);

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
          defaultMsg: target.defaultMsg,
          iconName: target.iconName,
          color: normalizeStepColor(target.color, target.iconName),
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
    defaultMsg: '',
    iconName: 'Heart',
    color: STEP_COLOR_PRESETS[0] as string,
    active: true,
    templateName: '',
  });


  const handleStartEdit = (step: AutomationStepItem) => {
    setEditingStep(step);
    setIsAddingNew(false);
    setFormData({
      title: step.title,
      dayOffset: step.dayOffset,
      defaultMsg: step.defaultMsg,
      iconName: step.iconName,
      color: normalizeStepColor(step.color, step.iconName),
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
      defaultMsg: 'Chào {{Customer Name}}, VietCRM xin gửi lời cảm ơn chân thành bạn đã tin dùng sản phẩm!',
      iconName: 'Sparkles',
      color: STEP_COLOR_PRESETS[(nextStepNum - 1) % STEP_COLOR_PRESETS.length],
      active: true,
      templateName: '',
    });
  };

  const handleCancelForm = () => {
    setEditingStep(null);
    setIsAddingNew(false);
  };

  const persistSteps = async (updatedSteps: AutomationStepItem[]) => {
    try {
      await onSaveSteps(updatedSteps);
      setCurrentSteps(updatedSteps);
      return true;
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Không thể lưu quy trình vào database.');
      return false;
    }
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      alert('Vui lòng nhập tiêu đề bước!');
      return;
    }
    if (!formData.templateName) {
      alert('Vui lòng chọn một template đã được duyệt!');
      return;
    }

    let updated: AutomationStepItem[] | null = null;
    if (isAddingNew) {
      const newStep: AutomationStepItem = {
        id: `step_${Date.now()}`,
        step: currentSteps.length + 1,
        dayOffset: Number(formData.dayOffset) || 0,
        title: formData.title.trim(),
        defaultMsg: formData.defaultMsg.trim(),
        iconName: formData.iconName,
        color: normalizeStepColor(formData.color, formData.iconName),
        active: formData.active,
        templateName: formData.templateName || undefined,
      };
      updated = sortStepsByDay([...currentSteps, newStep]);
    } else if (editingStep) {
      updated = sortStepsByDay(
        currentSteps.map((step) => step.id === editingStep.id
          ? {
              ...step,
              title: formData.title.trim(),
              dayOffset: Number(formData.dayOffset) || 0,
              defaultMsg: formData.defaultMsg.trim(),
              iconName: formData.iconName,
              color: normalizeStepColor(formData.color, formData.iconName),
              active: formData.active,
              templateName: formData.templateName || undefined,
            }
          : step),
      );
    }

    if (updated && await persistSteps(updated)) {
      handleCancelForm();
      onClose();
    }
  };


  const handleDeleteStep = async (stepId: string) => {
    if (currentSteps.length <= 1) {
      alert('Quy trình phải có ít nhất 1 bước!');
      return;
    }
    if (!confirm('Bạn có chắc chắn muốn xóa bước này khỏi quy trình?')) return;

    const updated = sortStepsByDay(currentSteps.filter((step) => step.id !== stepId));
    await persistSteps(updated);
  };

  const handleToggleActive = async (stepId: string) => {
    const updated = sortStepsByDay(currentSteps.map((step) => (
      step.id === stepId ? { ...step, active: !step.active } : step
    )));
    await persistSteps(updated);
  };

  const handleSelectApprovedTemplate = (templateName: string) => {
    const found = approvedTemplates.find((template) => template.name === templateName);
    const body = found?.components.find((component) => component.type === 'BODY')?.text || '';
    setFormData((current) => ({ ...current, templateName, defaultMsg: body }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white border border-slate-200 w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-slate-800 animate-in fade-in zoom-in-95 duration-150">

        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0 bg-white">
          <h3 className="flex min-w-0 items-center space-x-2 text-base font-bold text-slate-900">
            {isAddingNew || editingStep ? (
              <>
                <Pencil className="h-4 w-4 shrink-0 text-emerald-600" />
                <span className="truncate">{isAddingNew ? 'Thêm Bước Mới' : `Chỉnh Sửa: ${editingStep?.title}`}</span>
              </>
            ) : (
              <span className="truncate">Danh Sách Các Bước Trong Kịch Bản ({currentSteps.length} bước)</span>
            )}
          </h3>
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


              <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Chọn Template <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={formData.templateName}
                  onChange={(event) => handleSelectApprovedTemplate(event.target.value)}
                  disabled={approvedTemplates.length === 0}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 transition focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                >
                  <option value="" disabled>
                    {approvedTemplates.length > 0
                      ? 'Chọn một template đã được duyệt'
                      : 'Chưa có template nào được duyệt'}
                  </option>
                  {approvedTemplates.map((template) => (
                    <option key={`${template.name}-${template.language}`} value={template.name}>
                      {template.name} ({template.category} - {template.language})
                    </option>
                  ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Nội Dung Template
                  </label>
                  <AutomationMessagePreview
                    template={approvedTemplates.find(
                      (template) => template.name === formData.templateName,
                    )}
                    fallbackBody={formData.defaultMsg}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Biểu Tượng
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
                              ? 'bg-slate-100 border-slate-400 text-slate-800 shadow-xs ring-1 ring-slate-300'
                              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <IconComp
                            className="h-4 w-4"
                            style={isSelected ? iconTheme.iconStyle : undefined}
                          />
                          <span className="text-[9px] mt-1 truncate max-w-full font-medium">{iconKey}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <fieldset className="space-y-2">
                  <legend className="text-xs font-semibold text-slate-700">Tông Màu Thẻ</legend>
                  <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs">

                    <div className="flex flex-wrap items-center gap-2">
                      {paletteColors.map((color) => {
                        const isSelected = normalizeStepColor(formData.color, formData.iconName) === color;
                        return (
                          <div key={color} className="group relative">
                            <button
                              type="button"
                              onClick={() => setFormData({ ...formData, color })}
                              aria-label={`Chọn màu ${color}`}
                              aria-pressed={isSelected}
                              title={color.toUpperCase()}
                              className={`flex h-8 w-8 items-center justify-center rounded-full border-2 border-white shadow-sm transition hover:scale-110 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 ${
                                isSelected ? 'scale-110 ring-2 ring-slate-700 ring-offset-2' : ''
                              }`}
                              style={{ backgroundColor: color }}
                            >
                              {isSelected ? <Check className="h-4 w-4 text-white drop-shadow-sm" /> : null}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setPaletteColors((current) => {
                                  const remaining = current.filter((item) => item !== color);
                                  if (isSelected) {
                                    setFormData((currentForm) => ({
                                      ...currentForm,
                                      color: remaining[0] || STEP_COLOR_PRESETS[0],
                                    }));
                                  }
                                  return remaining;
                                });
                              }}
                              aria-label={`Xóa màu ${color}`}
                              title="Xóa màu"
                              className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 opacity-0 shadow-sm transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-red-300 group-hover:opacity-100"
                            >
                              <X className="h-2.5 w-2.5" />
                            </button>
                          </div>
                        );
                      })}

                      <button
                        type="button"
                        onClick={() => customColorInputRef.current?.click()}
                        aria-label="Thêm màu mới"
                        title="Thêm màu mới"
                        className="ml-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-dashed border-slate-300 bg-white text-slate-500 transition hover:scale-110 hover:border-slate-500 hover:bg-slate-50 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                      <input
                        ref={customColorInputRef}
                        type="color"
                        value={normalizeStepColor(formData.color, formData.iconName)}
                        onChange={(event) => {
                          const color = event.target.value.toLowerCase();
                          setFormData((current) => ({ ...current, color }));
                          setPaletteColors((current) =>
                            current.includes(color) ? current : [...current, color],
                          );
                        }}
                        aria-label="Thêm màu mới"
                        className="pointer-events-none absolute h-px w-px opacity-0"
                        tabIndex={-1}
                      />
                    </div>
                  </div>
                </fieldset>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-200">

                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow-sm flex items-center space-x-1.5 transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSaving ? 'Đang lưu...' : isAddingNew ? 'Thêm' : 'Lưu'}</span>
                </button>
              </div>
            </form>
          ) : null}

          {!isAddingNew && !editingStep ? (
            <div className="space-y-3">

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
                        <div className="shrink-0 rounded-xl border p-2.5" style={iconTheme.containerStyle}>
                          <IconComponent className="h-4 w-4" style={iconTheme.iconStyle} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center space-x-2">
                            <span className="truncate text-xs font-bold text-slate-900">{step.title}</span>
                            <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                              +{step.dayOffset} ngày
                            </span>
                          </div>

                        </div>
                      </div>

                      <div className="flex shrink-0 items-center space-x-2 self-end sm:self-auto">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={step.active}
                          disabled={isSaving}
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
                          disabled={isSaving}
                          onClick={() => handleStartEdit(step)}
                          title="Chỉnh sửa bước này"
                          className="rounded-lg bg-slate-100 p-1.5 text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => handleDeleteStep(step.id)}
                          title="Xóa bước này"
                          className="rounded-lg border border-rose-200 bg-rose-50 p-1.5 text-rose-600 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-center pt-1">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={handleStartAdd}
                  className="flex items-center space-x-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Thêm</span>
                </button>
              </div>
            </div>
          ) : null}

        </div>

      </div>
    </div>
  );
};
