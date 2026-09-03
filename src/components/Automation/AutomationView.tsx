import React, { useState, useMemo } from 'react';
import {
  Heart,
  Sparkles,
  Clock,
  Check,
  ArrowRight,
  Sliders,
  Plus,
  Pencil,
} from 'lucide-react';
import type { Customer, AutomationStepItem, WhatsAppApprovedTemplate } from '../../types';
import { AutomationStepModal, STEP_ICON_MAP } from './AutomationStepModal';

interface AutomationViewProps {
  customers: Customer[];
  onSelectCustomer: (customer: Customer) => void;
  approvedTemplates?: WhatsAppApprovedTemplate[];
}

export const DEFAULT_AUTOMATION_STEPS: AutomationStepItem[] = [
  {
    id: 'step_1',
    step: 1,
    dayOffset: 3,
    title: 'Ngày +3: Lời Cảm Ơn & HDSD',
    objective: 'Bày tỏ lòng tri ân, gửi video/văn bản hướng dẫn sử dụng sản phẩm chuẩn xác.',
    iconName: 'Heart',
    color: 'from-pink-500/20 to-rose-500/20 border-pink-500/40 text-pink-400',
    defaultMsg: 'Chào {{Customer Name}}, VietCRM xin gửi lời cảm ơn chân thành bạn đã tin dùng sản phẩm. Nhấp vào liên kết sau để xem video hướng dẫn sử dụng chuẩn spa nhé!',
    active: true,
  },
  {
    id: 'step_2',
    step: 2,
    dayOffset: 5,
    title: 'Ngày +5: Hỏi Trải Nghiệm',
    objective: 'Thăm vấn sự hài lòng sau 5 ngày trải nghiệm, xử lý sớm phản hồi.',
    iconName: 'MessageCircle',
    color: 'from-amber-500/20 to-orange-500/20 border-amber-500/40 text-amber-400',
    defaultMsg: 'Chào {{Customer Name}}, bạn đã dùng sản phẩm được 5 ngày rồi. Làn da/mái tóc của bạn có cảm thấy mượt mà và dịu nhẹ hơn chưa? Hãy chia sẻ với bọn mình nhé!',
    active: true,
  },
  {
    id: 'step_3',
    step: 3,
    dayOffset: 7,
    title: 'Ngày +7: Giải Đáp & Gợi Ý SP',
    objective: 'Giải đáp thắc mắc thói quen skincare/chăm sóc và tư vấn dòng sản phẩm bổ trợ.',
    iconName: 'HelpCircle',
    color: 'from-blue-500/20 to-cyan-500/20 border-blue-500/40 text-blue-400',
    defaultMsg: 'Chào {{Customer Name}}, nếu có bất kỳ thắc mắc nào khi kết hợp sản phẩm, đừng ngần ngại hỏi nhé! Ngoài ra, kết hợp cùng Serum Vitamin C sẽ nhân đôi hiệu quả đấy ạ.',
    active: true,
  },
  {
    id: 'step_4',
    step: 4,
    dayOffset: 15,
    title: 'Ngày +15: Gửi Voucher & Mua Lại',
    objective: 'Tặng mã giảm giá riêng tri ân khách hàng cũ, khuyến khích đặt hàng lần tiếp theo.',
    iconName: 'Gift',
    color: 'from-emerald-500/20 to-teal-500/20 border-emerald-500/40 text-emerald-400',
    defaultMsg: 'Chào {{Customer Name}}, tặng bạn Voucher VIP20OFF giảm 20% cho đơn hàng tiếp theo. Mã có hiệu lực trong 7 ngày tới, đặt ngay nhé!',
    active: true,
  },
];

const STORAGE_KEY_AUTOMATION_STEPS = 'vietcrm_automation_steps';

export const AutomationView: React.FC<AutomationViewProps> = ({
  customers,
  onSelectCustomer,
  approvedTemplates = [],
}) => {
  const [steps, setSteps] = useState<AutomationStepItem[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_AUTOMATION_STEPS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (err) {
      console.error('Failed to load automation steps from localStorage', err);
    }
    return DEFAULT_AUTOMATION_STEPS;
  });

  const [selectedStepId, setSelectedStepId] = useState<string>(() => steps[0]?.id || 'step_1');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalEditStepId, setModalEditStepId] = useState<string | null>(null);

  const activeSteps = useMemo(() => steps.filter((s) => s.active), [steps]);

  const currentSelectedStep = useMemo(() => {
    return activeSteps.find((s) => s.id === selectedStepId) || activeSteps[0] || null;
  }, [activeSteps, selectedStepId]);

  const handleSaveSteps = (updatedSteps: AutomationStepItem[]) => {
    setSteps(updatedSteps);
    try {
      localStorage.setItem(STORAGE_KEY_AUTOMATION_STEPS, JSON.stringify(updatedSteps));
    } catch (err) {
      console.error('Failed to save automation steps to localStorage', err);
    }
    if (!updatedSteps.some((s) => s.id === selectedStepId && s.active)) {
      setSelectedStepId(updatedSteps.find((s) => s.active)?.id || updatedSteps[0]?.id || '');
    }
  };

  const handleResetDefaults = () => {
    setSteps(DEFAULT_AUTOMATION_STEPS);
    try {
      localStorage.removeItem(STORAGE_KEY_AUTOMATION_STEPS);
    } catch (err) {
      console.error('Failed to reset automation steps in localStorage', err);
    }
    setSelectedStepId(DEFAULT_AUTOMATION_STEPS[0].id);
  };

  // Filter customers that have orders and active automation sequences
  const automationCustomers = customers.filter(
    (c) => c.totalOrders >= 1 && c.automationSequence?.active
  );

  return (
    <div className="space-y-6">
      
      {/* Banner */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Quy Trình Automation WhatsApp Sau Mua
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Hệ thống tự động chăm sóc khách hàng theo các mốc thời gian thiết lập sẵn để gia tăng tỷ lệ quay lại.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => {
              setModalEditStepId(null);
              setIsModalOpen(true);
            }}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white rounded-xl text-xs font-bold flex items-center space-x-2 transition shadow-xs"
          >
            <Sliders className="w-4 h-4 text-emerald-400" />
            <span>Tùy Chỉnh Quy Trình</span>
          </button>
        </div>
      </div>

      {/* Interactive Workflow Sequence Builder Diagram */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <span>Khung Quy Trình Chăm Sóc Tuần Tự</span>
            </h3>
            <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 text-xs font-bold">
              {activeSteps.length} bước kích hoạt
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => {
                setModalEditStepId(null);
                setIsModalOpen(true);
              }}
              className="text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center space-x-1 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm bước mới</span>
            </button>
          </div>
        </div>

        {/* Step Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {activeSteps.map((stepItem, index) => {
            const Icon = STEP_ICON_MAP[stepItem.iconName] || Heart;
            const isSelected = currentSelectedStep?.id === stepItem.id;

            return (
              <div
                key={stepItem.id}
                onClick={() => setSelectedStepId(stepItem.id)}
                className={`p-5 rounded-2xl border cursor-pointer transition-all duration-200 relative group ${
                  isSelected
                    ? 'bg-slate-800/90 border-emerald-500 shadow-xl ring-2 ring-emerald-500/50'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className={`p-2.5 rounded-xl bg-gradient-to-br ${stepItem.color} border`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="text-[11px] font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-md">
                      Bước {index + 1}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setModalEditStepId(stepItem.id);
                        setIsModalOpen(true);
                      }}
                      title="Chỉnh sửa bước này"
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <h4 className="font-bold text-white text-sm truncate">{stepItem.title}</h4>
                <div className="text-[10px] font-bold text-emerald-400 mt-0.5">
                  +{stepItem.dayOffset} ngày sau mua
                </div>
                <p className="text-[11px] text-slate-400 mt-1 min-h-[36px] line-clamp-2">
                  {stepItem.objective}
                </p>

                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-emerald-400 font-semibold">
                  <span>Tự động kích hoạt</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Active Step Details & Template Preview */}
      {currentSelectedStep && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>Mẫu Tin Nhắn WhatsApp Chi Tiết — {currentSelectedStep.title}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setModalEditStepId(currentSelectedStep.id);
                setIsModalOpen(true);
              }}
              className="text-xs font-semibold text-slate-400 hover:text-emerald-400 flex items-center space-x-1.5 transition"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Chỉnh sửa nội dung bước này</span>
            </button>
          </div>

          <div className="bg-slate-800/80 border border-slate-700/70 p-4 rounded-xl text-xs space-y-2">
            <p className="text-slate-300 leading-relaxed font-mono whitespace-pre-wrap">
              "{currentSelectedStep.defaultMsg}"
            </p>
            <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-700/60 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <span>Thẻ động biến số:</span>
                <code className="text-indigo-300 font-bold bg-slate-900 px-1.5 py-0.5 rounded">
                  &#123;&#123;Customer Name&#125;&#125;
                </code>
                <code className="text-amber-300 font-bold bg-slate-900 px-1.5 py-0.5 rounded">
                  &#123;&#123;Order ID&#125;&#125;
                </code>
              </div>
              <div className="flex items-center space-x-2 text-emerald-400">
                {currentSelectedStep.templateName && (
                  <span className="text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                    Template: <b className="text-indigo-300">{currentSelectedStep.templateName}</b>
                  </span>
                )}
                <span>Gửi qua WhatsApp Business API</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Customers Currently in Automation Pipeline Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="font-bold text-white text-base">
              Danh Sách Khách Hàng Đang Trong Quy Trình Automation ({automationCustomers.length})
            </h3>
            <p className="text-xs text-slate-400">
              Trạng thái hoàn thành theo từng bước trong kịch bản tùy chỉnh của mỗi khách hàng.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-800/80 text-slate-400 border-b border-slate-800 uppercase text-[10px]">
                <th className="py-2.5 px-4">Khách Hàng</th>
                <th className="py-2.5 px-3">SĐT & Quốc Gia</th>
                {activeSteps.map((step) => (
                  <th key={step.id} className="py-2.5 px-3 text-center whitespace-nowrap">
                    <span>{step.dayOffset > 0 ? `Ngày +${step.dayOffset}` : 'Ngay sau mua'}</span>
                    <div className="text-[9px] font-normal normal-case text-slate-400 truncate max-w-[110px] mx-auto">
                      {step.title.replace(/^Ngày\s*\+\d+:\s*/i, '')}
                    </div>
                  </th>
                ))}
                <th className="py-2.5 px-4 text-center">Chi Tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {automationCustomers.length === 0 ? (
                <tr>
                  <td colSpan={3 + activeSteps.length} className="text-center py-8 text-slate-500">
                    Chưa có khách hàng nào trong quy trình. Hãy tạo đơn hàng cho khách để kích hoạt!
                  </td>
                </tr>
              ) : (
                automationCustomers.map((c) => {
                  const seqStep = c.automationSequence?.currentStep || 0;

                  return (
                    <tr key={c.id} className="transition hover:bg-slate-800/30">
                      <td className="py-3 px-4 font-bold text-white">{c.name}</td>
                      <td className="py-3 px-3 text-slate-400">
                        {c.phone} ({c.country})
                      </td>

                      {activeSteps.map((step, idx) => {
                        const stepIndex = idx + 1;
                        const isLast = stepIndex === activeSteps.length;

                        return (
                          <td key={step.id} className="py-3 px-3 text-center">
                            {seqStep > stepIndex || (seqStep === stepIndex && isLast) ? (
                              <span className="text-emerald-400 font-bold bg-emerald-500/20 px-2 py-0.5 rounded-full text-[10px] inline-flex items-center space-x-1">
                                <Check className="w-3 h-3" />
                                <span>{isLast ? 'Hoàn thành' : 'Đã Gửi'}</span>
                              </span>
                            ) : seqStep === stepIndex ? (
                              <span className="text-emerald-400 font-bold bg-emerald-500/20 px-2 py-0.5 rounded-full text-[10px] inline-flex items-center space-x-1">
                                <Check className="w-3 h-3" />
                                <span>Đã Gửi</span>
                              </span>
                            ) : seqStep === stepIndex - 1 ? (
                              <span className="text-amber-300 font-bold bg-amber-500/20 px-2 py-0.5 rounded-full text-[10px] inline-flex items-center space-x-1">
                                <Clock className="w-3 h-3" />
                                <span>Kế tiếp</span>
                              </span>
                            ) : (
                              <span className="text-slate-500 text-[10px]">Chờ</span>
                            )}
                          </td>
                        );
                      })}

                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => onSelectCustomer(c)}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium"
                        >
                          Xem
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customization Modal */}
      <AutomationStepModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setModalEditStepId(null);
        }}
        steps={steps}
        onSaveSteps={handleSaveSteps}
        onResetDefaults={handleResetDefaults}
        approvedTemplates={approvedTemplates}
        initialEditStepId={modalEditStepId}
      />

    </div>
  );
};
