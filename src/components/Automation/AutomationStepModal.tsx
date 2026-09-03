import React, { useState } from 'react';
import {
  X,
  Plus,
  Trash2,
  Pencil,
  ArrowUp,
  ArrowDown,
  RotateCcw,
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
  { label: 'Hồng (Tri ân)', value: 'from-pink-500/20 to-rose-500/20 border-pink-500/40 text-pink-400' },
  { label: 'Cam (Trải nghiệm)', value: 'from-amber-500/20 to-orange-500/20 border-amber-500/40 text-amber-400' },
  { label: 'Xanh dương (Tư vấn)', value: 'from-blue-500/20 to-cyan-500/20 border-blue-500/40 text-blue-400' },
  { label: 'Xanh lá (Ưu đãi)', value: 'from-emerald-500/20 to-teal-500/20 border-emerald-500/40 text-emerald-400' },
  { label: 'Tím (Đặc quyền)', value: 'from-purple-500/20 to-indigo-500/20 border-purple-500/40 text-purple-400' },
];

interface AutomationStepModalProps {
  isOpen: boolean;
  onClose: () => void;
  steps: AutomationStepItem[];
  onSaveSteps: (updatedSteps: AutomationStepItem[]) => void;
  onResetDefaults: () => void;
  approvedTemplates?: WhatsAppApprovedTemplate[];
  initialEditStepId?: string | null;
}

export const AutomationStepModal: React.FC<AutomationStepModalProps> = ({
  isOpen,
  onClose,
  steps,
  onSaveSteps,
  onResetDefaults,
  approvedTemplates = [],
  initialEditStepId,
}) => {
  const [currentSteps, setCurrentSteps] = useState<AutomationStepItem[]>(steps);
  const [editingStep, setEditingStep] = useState<AutomationStepItem | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  // Sync when modal opens or steps change
  React.useEffect(() => {
    setCurrentSteps(steps);
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
      const updated = [...currentSteps, newStep].map((s, idx) => ({ ...s, step: idx + 1 }));
      setCurrentSteps(updated);
      onSaveSteps(updated);
    } else if (editingStep) {
      const updated = currentSteps.map((s) => {
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
      });
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

    const updated = currentSteps
      .filter((s) => s.id !== stepId)
      .map((s, idx) => ({ ...s, step: idx + 1 }));
    setCurrentSteps(updated);
    onSaveSteps(updated);

    if (editingStep?.id === stepId) {
      handleCancelForm();
    }
  };

  const handleToggleActive = (stepId: string) => {
    const updated = currentSteps.map((s) => (s.id === stepId ? { ...s, active: !s.active } : s));
    setCurrentSteps(updated);
    onSaveSteps(updated);
  };

  const handleMoveStep = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= currentSteps.length) return;

    const updated = [...currentSteps];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    const reindexed = updated.map((s, idx) => ({ ...s, step: idx + 1 }));
    setCurrentSteps(reindexed);
    onSaveSteps(reindexed);
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
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-slate-200 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900/90">
          <div>
            <div className="flex items-center space-x-2">
              <Zap className="w-5 h-5 text-emerald-400" />
              <h3 className="font-bold text-white text-base">
                Tùy Chỉnh Quy Trình Chăm Sóc Khách Hàng Tự Động
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Thêm, sửa, xóa hoặc thay đổi ngày gửi và nội dung tin nhắn của từng bước trong kịch bản.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {isAddingNew || editingStep ? (
            /* Form Add/Edit */
            <form onSubmit={handleSaveForm} className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
                <h4 className="font-bold text-white text-sm flex items-center space-x-2">
                  <Pencil className="w-4 h-4 text-emerald-400" />
                  <span>{isAddingNew ? 'Thêm Bước Mới' : `Chỉnh Sửa: ${editingStep?.title}`}</span>
                </h4>
                <button
                  type="button"
                  onClick={handleCancelForm}
                  className="text-xs text-slate-400 hover:text-slate-200"
                >
                  Hủy quay lại
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 space-y-1">
                  <label className="block text-xs font-semibold text-slate-300">
                    Tiêu Đề Bước <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="VD: Ngày +3: Lời Cảm Ơn & HDSD"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-hidden focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-300">
                    Số Ngày Sau Mua (+Ngày) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={365}
                    required
                    value={formData.dayOffset}
                    onChange={(e) => setFormData({ ...formData, dayOffset: Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-300">
                  Mục Tiêu Bước Chăm Sóc
                </label>
                <input
                  type="text"
                  value={formData.objective}
                  onChange={(e) => setFormData({ ...formData, objective: e.target.value })}
                  placeholder="VD: Bày tỏ lòng tri ân, gửi video/văn bản hướng dẫn sử dụng sản phẩm chuẩn xác."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              {approvedTemplates.length > 0 && (
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-300">
                    Liên Kết Mẫu WhatsApp Template Đã Duyệt (Tùy chọn)
                  </label>
                  <select
                    value={formData.templateName}
                    onChange={(e) => handleSelectApprovedTemplate(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-hidden focus:border-emerald-500"
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
                  <label className="block text-xs font-semibold text-slate-300">
                    Nội Dung Tin Nhắn Gửi Khách <span className="text-rose-400">*</span>
                  </label>
                  <div className="flex items-center space-x-1.5 text-[11px] text-slate-400">
                    <span>Chèn biến nhanh:</span>
                    <button
                      type="button"
                      onClick={() => handleInsertToken('{{Customer Name}}')}
                      className="px-2 py-0.5 bg-slate-700 hover:bg-slate-600 rounded text-emerald-400 font-mono text-[10px]"
                    >
                      &#123;&#123;Customer Name&#125;&#125;
                    </button>
                    <button
                      type="button"
                      onClick={() => handleInsertToken('{{Order ID}}')}
                      className="px-2 py-0.5 bg-slate-700 hover:bg-slate-600 rounded text-amber-300 font-mono text-[10px]"
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
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs text-white focus:outline-hidden focus:border-emerald-500 leading-relaxed font-mono"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-300">
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
                          className={`p-2 rounded-lg border flex flex-col items-center justify-center transition ${
                            isSelected
                              ? 'bg-emerald-600/30 border-emerald-500 text-emerald-400'
                              : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'
                          }`}
                        >
                          <IconComp className="w-4 h-4" />
                          <span className="text-[9px] mt-1 truncate max-w-full">{iconKey}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-300">
                    Tông Màu Thẻ
                  </label>
                  <div className="space-y-1.5">
                    {COLOR_OPTIONS.map((opt) => (
                      <label
                        key={opt.label}
                        className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border cursor-pointer text-xs transition ${
                          formData.color === opt.value
                            ? 'bg-slate-700 border-emerald-500 text-white'
                            : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <input
                          type="radio"
                          name="step_color"
                          checked={formData.color === opt.value}
                          onChange={() => setFormData({ ...formData, color: opt.value })}
                          className="text-emerald-500 focus:ring-0"
                        />
                        <span>{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-700/60">
                <button
                  type="button"
                  onClick={handleCancelForm}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow-md shadow-emerald-600/30 flex items-center space-x-1.5 transition"
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
              <h4 className="font-bold text-white text-sm">
                Danh Sách Các Bước Trong Kịch Bản ({currentSteps.length} bước)
              </h4>
              {!isAddingNew && !editingStep && (
                <button
                  type="button"
                  onClick={handleStartAdd}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 transition shadow-sm"
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
                    className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition ${
                      s.active
                        ? 'bg-slate-800/80 border-slate-700'
                        : 'bg-slate-900/60 border-slate-800 opacity-60'
                    }`}
                  >
                    <div className="flex items-start sm:items-center space-x-3 min-w-0">
                      <div className={`p-2 rounded-xl bg-gradient-to-br ${s.color} border shrink-0`}>
                        <IconComp className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-bold text-white truncate">{s.title}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-700 text-emerald-400">
                            +{s.dayOffset} ngày
                          </span>
                          {!s.active && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-400">
                              Đã tắt
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 truncate mt-0.5 max-w-lg">
                          {s.objective || s.defaultMsg}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1.5 shrink-0 self-end sm:self-auto">
                      {/* Reorder Buttons */}
                      <button
                        type="button"
                        disabled={isFirst}
                        onClick={() => handleMoveStep(idx, 'up')}
                        title="Di chuyển lên"
                        className="p-1.5 rounded-lg bg-slate-700/60 hover:bg-slate-700 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={isLast}
                        onClick={() => handleMoveStep(idx, 'down')}
                        title="Di chuyển xuống"
                        className="p-1.5 rounded-lg bg-slate-700/60 hover:bg-slate-700 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>

                      {/* Active toggle */}
                      <button
                        type="button"
                        onClick={() => handleToggleActive(s.id)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition ${
                          s.active
                            ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-400'
                            : 'bg-slate-800 border-slate-700 text-slate-400'
                        }`}
                      >
                        {s.active ? 'Đang bật' : 'Tắt'}
                      </button>

                      {/* Edit Button */}
                      <button
                        type="button"
                        onClick={() => handleStartEdit(s)}
                        title="Chỉnh sửa bước này"
                        className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 transition"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete Button */}
                      <button
                        type="button"
                        onClick={() => handleDeleteStep(s.id)}
                        title="Xóa bước này"
                        className="p-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 transition"
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
        <div className="px-6 py-3.5 border-t border-slate-800 flex items-center justify-between shrink-0 bg-slate-900/90">
          <button
            type="button"
            onClick={() => {
              if (confirm('Khôi phục lại 4 bước quy trình mặc định (Ngày +3, +5, +7, +15)?')) {
                onResetDefaults();
                handleCancelForm();
              }
            }}
            className="flex items-center space-x-1.5 text-xs text-slate-400 hover:text-amber-400 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Khôi phục mặc định</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold transition"
          >
            Đóng Lại
          </button>
        </div>

      </div>
    </div>
  );
};
