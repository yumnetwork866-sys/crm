import React, { useState, useMemo } from 'react';
import {
  Heart,
  Sparkles,
  Clock,
  Check,
  Sliders,
  Pencil,
} from 'lucide-react';
import type {
  Customer,
  AutomationStepItem,
  WhatsAppApprovedTemplate,
  WhatsAppTemplateButtonType,
} from '../../types';
import { AutomationStepModal, STEP_ICON_MAP, getStepIconTheme } from './AutomationStepModal';
import { TemplateButtonIcon } from './Template/components/common/TemplateButtonIcon';

interface AutomationViewProps {
  customers: Customer[];
  onSelectCustomer: (customer: Customer) => void;
  approvedTemplates?: WhatsAppApprovedTemplate[];
}

type PreviewButton = {
  type?: string;
  text?: string;
  otp_type?: string;
};

function getPreviewButtonType(button: PreviewButton): WhatsAppTemplateButtonType {
  if (button.type === 'COPY_CODE' || button.otp_type === 'COPY_CODE') return 'COPY_CODE';
  const supportedTypes: WhatsAppTemplateButtonType[] = [
    'QUICK_REPLY',
    'URL',
    'PHONE_NUMBER',
    'VOICE_CALL',
    'FLOW',
    'CONTACT',
  ];
  return supportedTypes.includes(button.type as WhatsAppTemplateButtonType)
    ? button.type as WhatsAppTemplateButtonType
    : 'QUICK_REPLY';
}

function AutomationMessagePreview({
  template,
  fallbackBody,
}: {
  template?: WhatsAppApprovedTemplate;
  fallbackBody: string;
}) {
  const header = template?.components.find((component) => component.type?.toUpperCase() === 'HEADER');
  const body = template?.components.find((component) => component.type?.toUpperCase() === 'BODY');
  const footer = template?.components.find((component) => component.type?.toUpperCase() === 'FOOTER');
  const buttonComponent = template?.components.find((component) => component.type?.toUpperCase() === 'BUTTONS');
  const buttons = Array.isArray(buttonComponent?.buttons)
    ? buttonComponent.buttons as PreviewButton[]
    : [];
  const headerFormat = header?.format?.toUpperCase();
  const visibleButtons = buttons.length >= 3 ? buttons.slice(0, 2) : buttons;
  const previewTime = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

  return (
    <div
      className="rounded-xl border border-slate-200 bg-[#efeae2] p-4"
      style={{
        backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(255,255,255,.55) 0 1px, transparent 1px)',
        backgroundSize: '16px 16px',
      }}
    >
      <div className="ml-auto max-w-xl overflow-hidden rounded-lg rounded-tr-none bg-white shadow-sm">
        {header ? (
          headerFormat === 'TEXT' ? (
            <p className="px-3 pt-3 text-sm font-bold text-slate-900">{header.text}</p>
          ) : (
            <div className="flex h-28 items-center justify-center bg-slate-100 text-xs font-semibold text-slate-500">
              {headerFormat ? `${headerFormat} template` : 'Media template'}
            </div>
          )
        ) : null}
        <div className="space-y-2 px-3 pb-2 pt-3">
          <p className="whitespace-pre-wrap text-sm leading-5 text-slate-700">
            {body?.text || fallbackBody}
          </p>
          {footer?.text ? <p className="text-[11px] text-slate-500">{footer.text}</p> : null}
          <div className="text-right text-[10px] text-slate-400">{previewTime}</div>
        </div>
        {buttons.length > 0 ? (
          <div className="divide-y divide-slate-100 border-t border-slate-100 px-2">
            {visibleButtons.map((button, index) => {
              const buttonType = getPreviewButtonType(button);
              return (
                <div key={`${button.type || 'button'}-${index}`} className="flex items-center justify-center gap-2 py-2 text-center text-xs font-semibold text-emerald-600">
                  <TemplateButtonIcon type={buttonType} />
                  <span>{button.text || button.otp_type || 'Thao tác'}</span>
                </div>
              );
            })}
            {buttons.length >= 3 ? (
              <div className="py-2 text-center text-xs font-semibold text-emerald-600">See all options</div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export const DEFAULT_AUTOMATION_STEPS: AutomationStepItem[] = [
  {
    id: 'step_1',
    step: 1,
    dayOffset: 3,
    title: 'Ngày +3: Lời Cảm Ơn & HDSD',
    objective: 'Bày tỏ lòng tri ân, gửi video/văn bản hướng dẫn sử dụng sản phẩm chuẩn xác.',
    iconName: 'Heart',
    color: 'pink',
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
    color: 'amber',
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
    color: 'blue',
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
    color: 'emerald',
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
        if (Array.isArray(parsed) && parsed.length > 0) {
          // If stored steps have old color classes, normalize them
          return parsed.map((item) => ({
            ...item,
            color: item.color && !item.color.includes('dark:') ? item.color : (
              item.step === 1 ? DEFAULT_AUTOMATION_STEPS[0].color :
              item.step === 2 ? DEFAULT_AUTOMATION_STEPS[1].color :
              item.step === 3 ? DEFAULT_AUTOMATION_STEPS[2].color :
              DEFAULT_AUTOMATION_STEPS[3].color
            ),
          }))
            .sort((a, b) => a.dayOffset - b.dayOffset)
            .map((s, idx) => ({ ...s, step: idx + 1 }));
        }
      }
    } catch (err) {
      console.error('Failed to load automation steps from localStorage', err);
    }
    return DEFAULT_AUTOMATION_STEPS;
  });

  const [selectedStepId, setSelectedStepId] = useState<string>(() => steps[0]?.id || 'step_1');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalEditStepId, setModalEditStepId] = useState<string | null>(null);

  const activeSteps = useMemo(
    () => [...steps].filter((s) => s.active).sort((a, b) => a.dayOffset - b.dayOffset),
    [steps]
  );

  const currentSelectedStep = useMemo(() => {
    return activeSteps.find((s) => s.id === selectedStepId) || activeSteps[0] || null;
  }, [activeSteps, selectedStepId]);
  const currentSelectedTemplate = useMemo(() => (
    currentSelectedStep?.templateName
      ? approvedTemplates.find((template) => template.name === currentSelectedStep.templateName)
      : undefined
  ), [approvedTemplates, currentSelectedStep?.templateName]);

  const handleSaveSteps = (updatedSteps: AutomationStepItem[]) => {
    const sorted = [...updatedSteps]
      .sort((a, b) => a.dayOffset - b.dayOffset)
      .map((s, idx) => ({ ...s, step: idx + 1 }));
    setSteps(sorted);
    try {
      localStorage.setItem(STORAGE_KEY_AUTOMATION_STEPS, JSON.stringify(sorted));
    } catch (err) {
      console.error('Failed to save automation steps to localStorage', err);
    }
    if (!sorted.some((s) => s.id === selectedStepId && s.active)) {
      setSelectedStepId(sorted.find((s) => s.active)?.id || sorted[0]?.id || '');
    }
  };


  // Filter customers that have orders and active automation sequences
  const automationCustomers = customers.filter(
    (c) => c.totalOrders >= 1 && c.automationSequence?.active
  );

  return (
    <div className="space-y-6">
      
      {/* Banner */}
      <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            Quy Trình Automation WhatsApp Sau Mua
          </h2>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => {
              setModalEditStepId(null);
              setIsModalOpen(true);
            }}
            className="px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 rounded-xl text-xs font-bold flex items-center space-x-2 transition shadow-xs cursor-pointer"
          >
            <Sliders className="w-4 h-4 text-emerald-600" />
            <span>Tùy Chỉnh Quy Trình</span>
          </button>
        </div>
      </div>

      {/* Interactive Workflow Sequence Builder Diagram */}
      <div className="space-y-3">

        {/* Step Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {activeSteps.map((stepItem, index) => {
            const Icon = STEP_ICON_MAP[stepItem.iconName] || Heart;
            const isSelected = currentSelectedStep?.id === stepItem.id;

            return (
              <div
                key={stepItem.id}
                onClick={() => setSelectedStepId(stepItem.id)}
                className={`p-5 rounded-2xl border cursor-pointer transition-all duration-200 relative group shadow-xs ${
                  isSelected
                    ? 'bg-emerald-50/40 border-emerald-500 shadow-md ring-2 ring-emerald-500/30'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center space-x-2.5 min-w-0 mb-2.5">
                  {(() => {
                    const iconTheme = getStepIconTheme(stepItem.color, stepItem.iconName);
                    return (
                      <div className={`p-2 rounded-xl border shrink-0 ${iconTheme.containerClass}`}>
                        <Icon className={`w-4 h-4 ${iconTheme.iconClass}`} />
                      </div>
                    );
                  })()}
                  <h4 className="font-bold text-slate-900 text-sm truncate" title={stepItem.title}>
                    {stepItem.title}
                  </h4>
                </div>

                <p className="text-[11px] text-slate-500 min-h-[36px] line-clamp-2">
                  {stepItem.objective}
                </p>


              </div>
            );
          })}
        </div>
      </div>

      {/* Active Step Details & Template Preview */}
      {currentSelectedStep && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-emerald-700 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Mẫu Tin Nhắn WhatsApp Chi Tiết — {currentSelectedStep.title}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setModalEditStepId(currentSelectedStep.id);
                setIsModalOpen(true);
              }}
              className="text-xs font-semibold text-slate-500 hover:text-emerald-600 flex items-center space-x-1.5 transition cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Chỉnh sửa nội dung bước này</span>
            </button>
          </div>

          <AutomationMessagePreview
            template={currentSelectedTemplate}
            fallbackBody={currentSelectedStep.defaultMsg}
          />
          <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500">
            <div className="flex items-center gap-2">
              <span>Thẻ động biến số:</span>
              <code className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-bold text-indigo-700">
                &#123;&#123;Customer Name&#125;&#125;
              </code>
              <code className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-bold text-amber-700">
                &#123;&#123;Order ID&#125;&#125;
              </code>
            </div>
            {currentSelectedStep.templateName ? (
              <div className="flex items-center gap-2 text-emerald-600">
                <span className="rounded border border-slate-200 bg-white px-2 py-0.5 text-slate-600">
                  Template: <b className="text-indigo-600">{currentSelectedStep.templateName}</b>
                </span>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Customers Currently in Automation Pipeline Table */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <h3 className="font-bold text-slate-900 text-base">
              Danh Sách Khách Hàng Đang Trong Quy Trình Automation ({automationCustomers.length})
            </h3>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase text-[10px]">
                <th className="py-2.5 px-4">Khách Hàng</th>
                <th className="py-2.5 px-3">SĐT & Quốc Gia</th>
                {activeSteps.map((step) => (
                  <th key={step.id} className="py-2.5 px-3 text-center whitespace-nowrap">
                    <span>{step.dayOffset > 0 ? `Ngày +${step.dayOffset}` : 'Ngay sau mua'}</span>
                    <div className="text-[9px] font-normal normal-case text-slate-500 truncate max-w-[110px] mx-auto">
                      {step.title.replace(/^Ngày\s*\+\d+:\s*/i, '')}
                    </div>
                  </th>
                ))}
                <th className="py-2.5 px-4 text-center">Chi Tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {automationCustomers.length === 0 ? (
                <tr>
                  <td colSpan={3 + activeSteps.length} className="text-center py-8 text-slate-400">
                    Chưa có khách hàng nào trong quy trình. Hãy tạo đơn hàng cho khách để kích hoạt!
                  </td>
                </tr>
              ) : (
                automationCustomers.map((c) => {
                  const seqStep = c.automationSequence?.currentStep || 0;

                  return (
                    <tr key={c.id} className="transition hover:bg-slate-50">
                      <td className="py-3 px-4 font-bold text-slate-900">{c.name}</td>
                      <td className="py-3 px-3 text-slate-500">
                        {c.phone} ({c.country})
                      </td>

                      {activeSteps.map((step, idx) => {
                        const stepIndex = idx + 1;
                        const isLast = stepIndex === activeSteps.length;

                        return (
                          <td key={step.id} className="py-3 px-3 text-center">
                            {seqStep > stepIndex || (seqStep === stepIndex && isLast) ? (
                              <span className="text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] inline-flex items-center space-x-1">
                                <Check className="w-3 h-3" />
                                <span>{isLast ? 'Hoàn thành' : 'Đã Gửi'}</span>
                              </span>
                            ) : seqStep === stepIndex ? (
                              <span className="text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] inline-flex items-center space-x-1">
                                <Check className="w-3 h-3" />
                                <span>Đã Gửi</span>
                              </span>
                            ) : seqStep === stepIndex - 1 ? (
                              <span className="text-amber-700 font-bold bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full text-[10px] inline-flex items-center space-x-1">
                                <Clock className="w-3 h-3" />
                                <span>Kế tiếp</span>
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[10px]">Chờ</span>
                            )}
                          </td>
                        );
                      })}

                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => onSelectCustomer(c)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium cursor-pointer transition"
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
        approvedTemplates={approvedTemplates}
        initialEditStepId={modalEditStepId}
      />

    </div>
  );
};
