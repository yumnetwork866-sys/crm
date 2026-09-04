import React, { useState, useMemo } from 'react';
import {
  Send, ShieldCheck, ShieldAlert, CheckCircle2, MessageSquare,
  Users, Tag, Globe, Play, Layers, Clock
} from 'lucide-react';
import { AutomationMessagePreview } from '../Automation/AutomationMessagePreview';
import type {
  AutomationParameterSource,
  AutomationTemplateParameterMapping,
  Customer,
  BroadcastCampaign,
  LaunchCampaignInput,
  WhatsAppApprovedTemplate,
  WhatsAppTemplateCategory,
} from '../../types';
import { INITIAL_PRODUCTS } from '../../data/mockData';
import { formatDateTime, getCustomerGroup } from '../../utils/crmUtils';

interface BroadcastViewProps {
  customers: Customer[];
  campaigns: BroadcastCampaign[];
  approvedTemplates: WhatsAppApprovedTemplate[];
  isTemplatesLoading: boolean;
  templatesError: Error | null;
  onRefetchTemplates: () => void;
  onLaunchCampaign: (input: LaunchCampaignInput) => Promise<BroadcastCampaign>;
  isLaunchPending: boolean;
  launchError: Error | null;
  onResetLaunchError: () => void;
  defaultTargetGroup?: string;
}

type TemplateParameterSource = 'customer_name' | 'phone' | 'product' | 'voucher_code';

const PARAMETER_SOURCE_OPTIONS: Array<{
  value: TemplateParameterSource;
  label: string;
  tag: string;
}> = [
  { value: 'customer_name', label: 'Tên khách hàng', tag: '{{Customer Name}}' },
  { value: 'phone', label: 'Số điện thoại', tag: '{{Phone}}' },
  { value: 'product', label: 'Sản phẩm quan tâm', tag: '{{Product}}' },
  { value: 'voucher_code', label: 'Mã voucher', tag: '{{Voucher Code}}' },
];

const mapTemplateBody = (body: string, sources: TemplateParameterSource[]) =>
  body.replace(/\{\{(\d+)\}\}/g, (_match, position: string) => {
    const source = sources[Number(position) - 1] || 'customer_name';
    return PARAMETER_SOURCE_OPTIONS.find((option) => option.value === source)?.tag || '{{Customer Name}}';
  });

const isTemplateSupported = (template: WhatsAppApprovedTemplate) => {
  if (!['MARKETING', 'UTILITY', 'AUTHENTICATION'].includes(template.category?.toUpperCase())) return false;
  if (template.parameter_format?.toUpperCase() === 'NAMED') return false;
  const body = template.components.find((component) => component.type?.toUpperCase() === 'BODY');
  if (!body?.text) return false;
  return !template.components.some((component) => {
    const type = component.type?.toUpperCase();
    if (type === 'HEADER' && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(component.format?.toUpperCase() || '')) {
      return true;
    }
    return type !== 'BODY' && /\{\{\d+\}\}/.test(JSON.stringify(component));
  });
};

export const BroadcastView: React.FC<BroadcastViewProps> = ({
  customers,
  campaigns,
  approvedTemplates,
  isTemplatesLoading,
  templatesError,
  onRefetchTemplates,
  onLaunchCampaign,
  isLaunchPending,
  launchError,
  onResetLaunchError,
  defaultTargetGroup = 'Tất cả khách hàng',
}) => {
  const [campaignName, setCampaignName] = useState('Chiến Dịch Khuyến Mại WhatsApp');
  const [targetGroup, setTargetGroup] = useState<string>(defaultTargetGroup);
  const [targetProduct, setTargetProduct] = useState<string>('ALL');
  const [targetGender, setTargetGender] = useState<string>('ALL');
  const [category, setCategory] = useState<WhatsAppTemplateCategory | ''>('');
  const [templateName, setTemplateName] = useState('');
  const [templateLanguage, setTemplateLanguage] = useState('vi');
  const [templateBody, setTemplateBody] = useState('');
  const [parameterSources, setParameterSources] = useState<TemplateParameterSource[]>([]);
  const [voucherCode, setVoucherCode] = useState('VOUCHER30OFF');

  const [templateText, setTemplateText] = useState('');


  // Calculate targeted audience strictly conforming to WhatsApp Opt-in
  const { targetedTotal, optedInTotal, eligibleCustomers } = useMemo(() => {
    const matched = customers.filter((c) => {
      // Group filter
      if (targetGroup === 'Khách mới') {
        if (getCustomerGroup(c) !== 'group_1') return false;
      } else if (targetGroup === 'Đã hỏi giá') {
        if (getCustomerGroup(c) !== 'group_2') return false;
      } else if (targetGroup === 'Đã mua 1 lần') {
        if (getCustomerGroup(c) !== 'group_3') return false;
      } else if (targetGroup === 'VIP' || targetGroup === 'VIP (Mua ≥ 2 lần)') {
        if (getCustomerGroup(c) !== 'group_4') return false;
      }

      // Product filter
      if (targetProduct !== 'ALL') {
        if (!c.interestedProducts || !c.interestedProducts.includes(targetProduct)) return false;
      }

      // Gender filter
      if (targetGender !== 'ALL') {
        if (!c.gender) return false;
        const cg = c.gender.trim().toLowerCase();
        const tg = targetGender.trim().toLowerCase();
        if (tg === 'nam' && !(cg === 'nam' || cg === 'male' || cg === 'm')) return false;
        if ((tg === 'nữ' || tg === 'nu') && !(cg === 'nữ' || cg === 'nu' || cg === 'female' || cg === 'f')) return false;
        if ((tg === 'khác' || tg === 'khac') && (cg === 'nam' || cg === 'nữ' || cg === 'nu')) return false;
      }

      return true;
    });

    const optedIn = matched.filter((c) => c.whatsappOptIn);

    return {
      targetedTotal: matched.length,
      optedInTotal: optedIn.length,
      eligibleCustomers: optedIn,
    };
  }, [customers, targetGroup, targetProduct, targetGender]);

  const handleTemplateSelect = (templateKey: string) => {
    const template = approvedTemplates.find(
      (item) => `${item.name}::${item.language}` === templateKey
    );
    if (!template || !isTemplateSupported(template)) {
      setTemplateName('');
      setCategory('');
      setTemplateBody('');
      setParameterSources([]);
      return;
    }

    const body = template.components.find((component) => component.type?.toUpperCase() === 'BODY')?.text || '';
    const positions = Array.from(body.matchAll(/\{\{(\d+)\}\}/g)).map((match) => Number(match[1]));
    const parameterCount = positions.length > 0 ? Math.max(...positions) : 0;
    const defaults: TemplateParameterSource[] = Array.from(
      { length: parameterCount },
      (_, index) => (['customer_name', 'product', 'voucher_code', 'phone'][index] || 'customer_name') as TemplateParameterSource
    );

    setTemplateName(template.name);
    setTemplateLanguage(template.language);
    setCategory(template.category.toUpperCase() as WhatsAppTemplateCategory);
    setTemplateBody(body);
    setParameterSources(defaults);
    setTemplateText(mapTemplateBody(body, defaults));
  };

  const handleParameterSourceChange = (index: number, source: TemplateParameterSource) => {
    setParameterSources((current) => {
      const next = current.map((item, itemIndex) => itemIndex === index ? source : item);
      setTemplateText(mapTemplateBody(templateBody, next));
      return next;
    });
  };

  const handleLaunch = async () => {
    if (!campaignName.trim()) {
      alert('Vui lòng nhập tên chiến dịch!');
      return;
    }
    if (!templateName.trim()) {
      alert('Vui lòng nhập tên WhatsApp template đã được Meta phê duyệt!');
      return;
    }
    if (!category) {
      alert('Template không có category Meta hợp lệ!');
      return;
    }
    if (!templateText.trim()) {
      alert('Vui lòng nhập nội dung xem trước của template!');
      return;
    }
    if (optedInTotal === 0) {
      alert('Không có khách hàng hợp lệ (đã Opt-In WhatsApp) trong tập lựa chọn này!');
      return;
    }

    onResetLaunchError();
    try {
      const campaign = await onLaunchCampaign({
        name: campaignName.trim(),
        targetGroup,
        targetProduct: targetProduct !== 'ALL' ? targetProduct : undefined,
        targetGender: targetGender !== 'ALL'
          ? targetGender as 'Nam' | 'Nữ' | 'Khác'
          : undefined,
        category,
        templateName: templateName.trim(),
        templateLanguage: templateLanguage.trim() || 'vi',
        templateParameterSources: parameterSources,
        messageTemplate: templateText.trim(),
        voucherCode: voucherCode.trim() || undefined,
      });
      alert(`Chiến dịch đã được xếp hàng cho ${campaign.stats.optedInCount} khách hàng. Trạng thái gửi sẽ được cập nhật tự động.`);
    } catch {
      // Mutation error is rendered inline below the launch button.
    }
  };

  // Preview formatting
  const previewSampleCustomer = eligibleCustomers[0] || customers[0];
  const sampleMessagePreview = templateText
    .replace(/\{\{Customer Name\}\}/g, previewSampleCustomer?.name || 'Nguyễn Văn Minh')
    .replace(/\{\{Phone\}\}/g, previewSampleCustomer?.phone || '0901234567')
    .replace(/\{\{Product\}\}/g, previewSampleCustomer?.interestedProducts?.[0] || 'Kem Dưỡng Da Premium')
    .replace(/\{\{Voucher Code\}\}/g, voucherCode || 'VOUCHER30OFF');

  const selectedApprovedTemplate = useMemo(() => {
    if (!templateName) return undefined;
    return approvedTemplates.find(
      (item) => item.name === templateName && item.language === templateLanguage,
    );
  }, [approvedTemplates, templateName, templateLanguage]);

  const parameterMappings = useMemo<AutomationTemplateParameterMapping[]>(() => {
    if (!selectedApprovedTemplate) return [];
    const bodyIndex = selectedApprovedTemplate.components.findIndex(
      (component) => component.type?.toUpperCase() === 'BODY',
    );
    if (bodyIndex === -1) return [];

    return parameterSources.map((source, index) => {
      let mappedSource: AutomationParameterSource | '' = '';
      let value: string | undefined;

      if (source === 'customer_name') mappedSource = 'customer_name';
      else if (source === 'phone') mappedSource = 'customer_phone';
      else if (source === 'product') mappedSource = 'product_name';
      else if (source === 'voucher_code') {
        mappedSource = 'constant';
        value = voucherCode || 'VOUCHER30OFF';
      }

      return {
        component: 'BODY' as const,
        componentIndex: bodyIndex,
        variable: String(index + 1),
        source: mappedSource,
        value,
      };
    });
  }, [selectedApprovedTemplate, parameterSources, voucherCode]);

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Gửi Tin Nhắn Hàng Loạt (Broadcast)</h2>
        </div>
      </div>


      {/* Main Campaign Builder Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Audience & Content Setup */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
          
          <h3 className="font-bold text-white text-sm flex items-center space-x-2 border-b border-slate-800 pb-3">
            <Users className="w-4 h-4 text-teal-400" />
            <span>1. Lựa Chọn Nhóm Khách Hàng Mục Tiêu</span>
          </h3>

          <div className="space-y-4 text-xs">
            
            {/* Campaign Name */}
            <div>
              <label className="block text-slate-300 font-medium mb-1">Tên Chiến Dịch Broadcast</label>
              <input
                type="text"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="Ví dụ: Tri Ân Khách Hàng Thân Thiết"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-teal-500"
              />
            </div>

            {/* Target Group Selector */}
            <div>
              <label className="block text-slate-300 font-medium mb-1">Nhóm Khách Hàng CRM</label>
              <select
                value={targetGroup}
                onChange={(e) => setTargetGroup(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 focus:outline-none focus:border-teal-500 font-semibold text-teal-300"
              >
                <option value="Tất cả khách hàng">Tất cả khách hàng trong CRM</option>
                <option value="Khách mới">Nhóm 1: Khách mới (Chưa tư vấn)</option>
                <option value="Đã hỏi giá">Nhóm 2: Đã hỏi giá (Chưa mua)</option>
                <option value="Đã mua 1 lần">Nhóm 3: Đã mua 1 lần</option>
                <option value="VIP">Nhóm 4: VIP (Đã mua ≥2 lần)</option>
              </select>
            </div>

            {/* Sub-Filters: Product & Country */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Theo Sản Phẩm Quan Tâm</label>
                <select
                  value={targetProduct}
                  onChange={(e) => setTargetProduct(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none"
                >
                  <option value="ALL">Tất cả sản phẩm</option>
                  {INITIAL_PRODUCTS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Theo Giới Tính</label>
                <select
                  value={targetGender}
                  onChange={(e) => setTargetGender(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none"
                >
                  <option value="ALL">Tất cả giới tính</option>
                  <option value="Nam">Nam</option>
                  <option value="Nữ">Nữ</option>
                  <option value="Khác">Khác</option>
                </select>
              </div>
            </div>

            {/* Audience Count Summary Display */}
            <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700/80 flex items-center justify-between">
              <div>
                <div className="text-slate-400">Khách thỏa mãn bộ lọc:</div>
                <div className="text-sm font-bold text-white">{targetedTotal} khách</div>
              </div>

              <div className="text-right">
                <div className="text-[#00793d] dark:text-[#20a361] font-semibold flex items-center space-x-1 justify-end">
                  <ShieldCheck className="w-4 h-4 text-[#00793d] dark:text-[#20a361]" />
                  <span>Đủ điều kiện gửi (Opt-In):</span>
                </div>
                <div className="text-xl font-extrabold text-[#00793d] dark:text-[#20a361]">{optedInTotal} khách</div>
              </div>
            </div>

          </div>

          <hr className="border-slate-800" />

          {/* WABA Message Template */}
          <h3 className="font-bold text-white text-sm flex items-center space-x-2">
            <MessageSquare className="w-4 h-4 text-teal-400" />
            <span>2. Approved Template từ WABA</span>
          </h3>

          <div className="space-y-4 text-xs">

            <div>
              <div className="mb-1 flex items-center justify-between gap-3">
                <label className="block text-slate-300 font-medium">
                  Approved Template từ WABA
                </label>
                <button
                  type="button"
                  onClick={onRefetchTemplates}
                  disabled={isTemplatesLoading}
                  className="text-[11px] font-semibold text-teal-600 hover:text-teal-700 disabled:opacity-50"
                >
                  {isTemplatesLoading ? 'Đang tải...' : 'Tải lại template'}
                </button>
              </div>
              <select
                value={templateName ? `${templateName}::${templateLanguage}` : ''}
                onChange={(e) => handleTemplateSelect(e.target.value)}
                disabled={isTemplatesLoading || approvedTemplates.length === 0}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-teal-500 font-mono disabled:opacity-60"
              >
                <option value="">
                  {isTemplatesLoading
                    ? 'Đang tải template từ WABA...'
                    : approvedTemplates.length === 0
                      ? 'Không có approved template'
                      : 'Chọn template và ngôn ngữ'}
                </option>
                {approvedTemplates.map((template) => {
                  const isSupported = isTemplateSupported(template);
                  return (
                    <option
                      key={`${template.name}::${template.language}`}
                      value={`${template.name}::${template.language}`}
                      disabled={!isSupported}
                    >
                      {template.name} · {template.language} · {template.category}{!isSupported ? ' · Chưa hỗ trợ cấu trúc này' : ''}
                    </option>
                  );
                })}
              </select>
              {templatesError ? (
                <div role="alert" className="mt-2 rounded-lg border border-rose-300 bg-rose-50 p-2 text-[11px] font-medium text-rose-700">
                  {templatesError.message}
                </div>
              ) : null}
            </div>

            {parameterSources.length > 0 ? (
              <div className="space-y-2 rounded-xl border border-indigo-200 bg-indigo-50 p-3">
                <span className="block font-semibold text-indigo-900">
                  Ánh xạ biến BODY của template
                </span>
                {parameterSources.map((source, index) => (
                  <div key={index} className="grid grid-cols-[70px_1fr] items-center gap-2">
                    <span className="font-mono font-bold text-indigo-700">{`{{${index + 1}}}`}</span>
                    <select
                      value={source}
                      onChange={(e) => handleParameterSourceChange(index, e.target.value as TemplateParameterSource)}
                      className="rounded-lg border border-indigo-200 bg-white px-2.5 py-1.5 text-slate-900 focus:outline-none focus:border-indigo-500"
                    >
                      {PARAMETER_SOURCE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            ) : null}

            <div>
              <label className="block text-slate-300 font-medium mb-1">Mã voucher mặc định</label>
              <input
                type="text"
                value={voucherCode}
                onChange={(e) => setVoucherCode(e.target.value)}
                placeholder="VOUCHER30OFF"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-teal-500 font-mono"
              />
            </div>

          </div>

          {/* Launch Trigger */}
          <div className="pt-2">
            <button
              onClick={() => void handleLaunch()}
              disabled={isLaunchPending || optedInTotal === 0 || !templateName.trim()}
              className="w-full py-3 bg-[#00793d] hover:bg-[#006232] disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-[#00793d]/25 transition flex items-center justify-center space-x-2 text-sm"
            >
              <Send className="w-4 h-4" />
              <span>
                {isLaunchPending
                  ? 'Đang kiểm tra template và xếp hàng...'
                  : `Gửi Broadcast Cho ${optedInTotal} Khách Hàng`}
              </span>
            </button>

            {launchError ? (
              <div role="alert" className="mt-3 rounded-xl border border-rose-300 bg-rose-50 p-3 text-xs font-medium text-rose-700">
                {launchError.message}
              </div>
            ) : null}
          </div>

        </div>

        {/* Right Column: Live WhatsApp Preview & Campaign History */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* WhatsApp Template Preview */}
          <div className="space-y-2">
            <AutomationMessagePreview
              template={selectedApprovedTemplate}
              fallbackBody={sampleMessagePreview || 'Chọn template để xem nội dung xem trước'}
              parameterMappings={parameterMappings}
            />
            {previewSampleCustomer ? (
              <div className="text-[11px] text-slate-500 text-center italic">
                Xem trước cá nhân hóa cho: <strong className="font-semibold text-slate-700 dark:text-slate-200">{previewSampleCustomer.name}</strong>
              </div>
            ) : null}
          </div>

          {/* Broadcast Campaign History */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Lịch Sử Các Chiến Dịch Broadcast Đã Gửi
            </h4>

            <div className="space-y-3 max-h-75 overflow-y-auto pr-1">
               {campaigns.map((camp) => {
                const sentCount = camp.stats.sentCount;
                const deliveredCount = camp.stats.deliveredCount;
                const readCount = camp.stats.readCount;
                const respondedCount = camp.stats.respondedCount;

                return (
                  <div key={camp.id} className="bg-slate-800/80 border border-slate-700/70 p-3.5 rounded-xl space-y-2 text-xs">
                    <div className="flex justify-between items-start">
                      <span className="font-bold text-white text-sm">{camp.name}</span>
                      <span className="text-[10px] bg-[#00793d]/20 text-[#00793d] dark:text-emerald-300 border border-[#00793d]/40 px-2.5 py-0.5 rounded-full font-bold">
                        {camp.status}
                      </span>
                    </div>

                    <div className="text-slate-400 text-[11px] flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span>Target: <strong className="text-teal-300">{camp.targetGroup}</strong></span>
                      <span>•</span>
                      <span>{formatDateTime(camp.createdAt)}</span>
                      {camp.templateName ? (
                        <>
                          <span>•</span>
                          <span>Template: <strong>{camp.templateName}</strong> ({camp.templateLanguage})</span>
                        </>
                      ) : null}
                    </div>
                    {camp.lastError ? (
                      <p className="rounded-lg bg-rose-50 p-2 text-[10px] font-medium text-rose-700">
                        {camp.lastError}
                      </p>
                    ) : null}

                    <div className="grid grid-cols-4 gap-1 text-[10px] text-center bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                      <div>
                        <span className="text-slate-400">Đã gửi</span>
                        <div className="font-bold text-white">{sentCount}</div>
                      </div>
                      <div>
                        <span className="text-slate-400">Đã nhận</span>
                        <div className="font-bold text-[#00793d] dark:text-teal-300">{deliveredCount}</div>
                      </div>
                      <div>
                        <span className="text-slate-400">Tỷ lệ đọc</span>
                        <div className="font-bold text-[#00793d] dark:text-emerald-400">
                          {sentCount > 0 ? Math.round((readCount / sentCount) * 100) : 0}%
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-400">Phản hồi</span>
                        <div className="font-bold text-amber-300">{respondedCount}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
