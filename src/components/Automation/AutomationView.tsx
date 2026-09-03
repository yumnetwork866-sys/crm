import React, { useState, useMemo } from 'react';
import {
  Heart,
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
import {
  AutomationStepModal,
  STEP_ICON_MAP,
  getStepIconTheme,
} from './AutomationStepModal';
import { TemplateButtonIcon } from './Template/components/common/TemplateButtonIcon';
import { useAutomationSteps } from '../../hooks/useAutomationSteps';

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


export const AutomationView: React.FC<AutomationViewProps> = ({
  customers,
  onSelectCustomer,
  approvedTemplates = [],
}) => {
  const { steps, isLoading, error, saveSteps, isSaving } = useAutomationSteps();
  const [selectedStepId, setSelectedStepId] = useState<string>('');
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

  const handleSaveSteps = async (updatedSteps: AutomationStepItem[]) => {
    const sorted = [...updatedSteps]
      .sort((left, right) => left.dayOffset - right.dayOffset)
      .map((step, index) => ({ ...step, step: index + 1 }));
    const savedSteps = await saveSteps(sorted);
    setModalEditStepId(null);
    if (!savedSteps.some((step) => step.id === selectedStepId && step.active)) {
      setSelectedStepId(savedSteps.find((step) => step.active)?.id || savedSteps[0]?.id || '');
    }
  };


  // Filter customers that have orders and active automation sequences
  const automationCustomers = customers.filter(
    (c) => c.totalOrders >= 1 && c.automationSequence?.active
  );

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
        Đang tải quy trình automation...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm font-medium text-rose-700">
        {error instanceof Error ? error.message : 'Không thể tải quy trình automation từ database.'}
      </div>
    );
  }

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
            disabled={isSaving}
            onClick={() => {
              setModalEditStepId(null);
              setIsModalOpen(true);
            }}
            className="px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 rounded-xl text-xs font-bold flex items-center space-x-2 transition shadow-xs cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
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
          {activeSteps.map((stepItem) => {
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
                      <div className="shrink-0 rounded-xl border p-2" style={iconTheme.containerStyle}>
                        <Icon className="h-4 w-4" style={iconTheme.iconStyle} />
                      </div>
                    );
                  })()}
                  <h4 className="font-bold text-slate-900 text-sm truncate" title={stepItem.title}>
                    {stepItem.title}
                  </h4>
                </div>


              </div>
            );
          })}
        </div>
      </div>

      {/* Active Step Details & Template Preview */}
      {currentSelectedStep && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-3 shadow-xs">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                setModalEditStepId(currentSelectedStep.id);
                setIsModalOpen(true);
              }}
              className="text-xs font-semibold text-slate-500 hover:text-emerald-600 flex items-center space-x-1.5 transition cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Chỉnh sửa</span>
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
                    <div className="text-[9px] font-normal normal-case text-slate-500 truncate max-w-27.5 mx-auto">
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
        isSaving={isSaving}
      />

    </div>
  );
};
