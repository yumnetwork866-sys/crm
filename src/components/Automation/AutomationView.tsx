import React, { useState, useMemo } from 'react';
import {
  Heart,
  Clock,
  Check,
  Sliders,
  Pencil,
  ChevronRight,
} from 'lucide-react';
import type {
  Customer,
  AutomationStepItem,
  WhatsAppApprovedTemplate,
} from '../../types';
import {
  AutomationStepModal,
  STEP_ICON_MAP,
  formatStepTitle,
  getStepIconTheme,
  stripStepDayPrefix,
} from './AutomationStepModal';
import { AutomationMessagePreview } from './AutomationMessagePreview';
import {
  AUTOMATION_PARAMETER_SOURCE_OPTIONS,
  extractApprovedTemplateVariables,
  getAutomationParameterMappingKey,
} from './Template/utils/templateFormatters';
import { useAutomationSteps } from '../../hooks/useAutomationSteps';

interface AutomationViewProps {
  customers: Customer[];
  onSelectCustomer: (customer: Customer) => void;
  approvedTemplates?: WhatsAppApprovedTemplate[];
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
      ? approvedTemplates.find((template) => (
          template.name === currentSelectedStep.templateName && (
            !currentSelectedStep.templateLanguage ||
            template.language === currentSelectedStep.templateLanguage
          )
        ))
      : undefined
  ), [approvedTemplates, currentSelectedStep?.templateLanguage, currentSelectedStep?.templateName]);
  const currentSelectedVariables = useMemo(
    () => extractApprovedTemplateVariables(currentSelectedTemplate),
    [currentSelectedTemplate],
  );

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

      {/* Workflow Sequence (Steps) & Live Preview in Left-Right Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Step Cards */}
        <div className="lg:col-span-5 space-y-2.5">
          {activeSteps.map((stepItem, index) => {
              const Icon = STEP_ICON_MAP[stepItem.iconName] || Heart;
              const isSelected = currentSelectedStep?.id === stepItem.id;
              const iconTheme = getStepIconTheme(stepItem.color, stepItem.iconName);

              return (
                <div
                  key={stepItem.id}
                  onClick={() => setSelectedStepId(stepItem.id)}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all duration-200 relative group shadow-xs ${
                    isSelected
                      ? 'bg-emerald-50/50 border-emerald-500 shadow-md ring-2 ring-emerald-500/30'
                      : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className="shrink-0 rounded-xl border p-2" style={iconTheme.containerStyle}>
                        <Icon className="h-4 w-4" style={iconTheme.iconStyle} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-slate-400">
                            Bước {index + 1}
                          </span>
                          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full">
                            {stepItem.dayOffset === 0 ? 'Gửi ngay' : `Sau ${stepItem.dayOffset} ngày`}
                          </span>
                        </div>
                        <h4
                          className="truncate text-sm font-bold text-slate-900 mt-0.5"
                          title={formatStepTitle(stepItem.title, stepItem.dayOffset)}
                        >
                          {stripStepDayPrefix(stepItem.title)}
                        </h4>
                        {stepItem.templateName ? (
                          <div className="text-[11px] text-indigo-600 font-medium truncate mt-0.5">
                            Mẫu: {stepItem.templateName}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <ChevronRight className={`w-4 h-4 shrink-0 transition-colors ${isSelected ? 'text-emerald-600' : 'text-slate-300 group-hover:text-slate-400'}`} />
                  </div>
                </div>
              );
            })}
        </div>

        {/* Right Column: Active Step Details & Template Preview */}
        <div className="lg:col-span-7">
          {currentSelectedStep ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setModalEditStepId(currentSelectedStep.id);
                    setIsModalOpen(true);
                  }}
                  className="text-xs font-semibold text-slate-600 hover:text-emerald-600 px-3 py-1.5 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/60 flex items-center space-x-1.5 transition cursor-pointer shrink-0"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Chỉnh sửa</span>
                </button>
              </div>

              <AutomationMessagePreview
                template={currentSelectedTemplate}
                fallbackBody={currentSelectedStep.defaultMsg}
                parameterMappings={currentSelectedStep.templateParameterMappings}
              />

              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 pt-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  {currentSelectedVariables.length > 0 ? (
                    <>
                      <span className="font-medium text-slate-600">Biến đã gán:</span>
                      {currentSelectedVariables.map((variable) => {
                        const key = getAutomationParameterMappingKey(variable);
                        const mapping = currentSelectedStep.templateParameterMappings?.find(
                          (item) => getAutomationParameterMappingKey(item) === key,
                        );
                        const sourceLabel = mapping?.source === 'constant'
                          ? mapping.value || 'Giá trị cố định'
                          : AUTOMATION_PARAMETER_SOURCE_OPTIONS.find(
                              (option) => option.value === mapping?.source,
                            )?.label || 'Chưa gán';
                        return (
                          <code
                            key={key}
                            className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-bold text-indigo-700 text-[10px]"
                          >
                            {variable.token} → {sourceLabel}
                          </code>
                        );
                      })}
                    </>
                  ) : (
                    <span className="text-slate-400">Template không có biến động.</span>
                  )}
                </div>
                {currentSelectedStep.templateName ? (
                  <div className="flex items-center gap-1.5">
                    <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">
                      Template: <b className="text-indigo-600 font-semibold">{currentSelectedStep.templateName}</b>
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-xs text-slate-400 shadow-sm">
              Chọn một bước ở cột bên trái để xem trước tin nhắn
            </div>
          )}
        </div>

      </div>

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
                      {stripStepDayPrefix(step.title)}
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
