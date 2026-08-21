import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  FileText,
  Image,
  Link2,
  Loader2,
  LockKeyhole,
  Phone,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react';
import type {
  CreateWhatsAppTemplateInput,
  WhatsAppApprovedTemplate,
  WhatsAppOtpType,
  WhatsAppTemplateButtonType,
  WhatsAppTemplateCategory,
  WhatsAppTemplateExample,
  WhatsAppTemplateHeaderFormat,
  WhatsAppTemplateParameterFormat,
} from '../../types';
import { api } from '../../utils/apiClient';

interface TemplateManagementViewProps {
  templates: WhatsAppApprovedTemplate[];
  isLoading: boolean;
  error: Error | null;
  onRefetch: () => void;
  onCreateTemplate: (input: CreateWhatsAppTemplateInput) => Promise<unknown>;
  isCreatePending: boolean;
  createError: Error | null;
  onResetCreateError: () => void;
}

type EditableButton = {
  id: string;
  type: WhatsAppTemplateButtonType;
  text: string;
  url: string;
  urlExample: string;
  phoneNumber: string;
};

type WizardStep = 1 | 2 | 3;
type TemplateType = 'DEFAULT' | 'CATALOGUE' | 'FLOWS' | 'CALLING_PERMISSION';

const STATUS_CLASSES: Record<string, string> = {
  APPROVED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  PENDING: 'border-amber-200 bg-amber-50 text-amber-700',
  REJECTED: 'border-rose-200 bg-rose-50 text-rose-700',
  PAUSED: 'border-orange-200 bg-orange-50 text-orange-700',
  DISABLED: 'border-slate-300 bg-slate-100 text-slate-700',
};

const inputClass = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100';
const labelClass = 'mb-1 block text-xs font-semibold text-slate-700';
const sectionClass = 'space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm';

function extractVariables(text: string, format: WhatsAppTemplateParameterFormat): string[] {
  const matches = Array.from(text.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g), (match) => match[1].trim());
  const unique = Array.from(new Set(matches));
  return format === 'POSITIONAL' ? unique.sort((a, b) => Number(a) - Number(b)) : unique;
}

function syncExamples(current: WhatsAppTemplateExample[], variables: string[], format: WhatsAppTemplateParameterFormat) {
  return variables.map((variable, index) => ({
    ...(format === 'NAMED' ? { name: variable } : {}),
    value: current.find((example) => example.name === variable)?.value || current[index]?.value || '',
  }));
}

function substituteExamples(text: string, examples: WhatsAppTemplateExample[], format: WhatsAppTemplateParameterFormat) {
  const variables = extractVariables(text, format);
  return text.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (match, variable: string) => {
    const index = variables.indexOf(variable.trim());
    const example = format === 'NAMED'
      ? examples.find((item) => item.name === variable.trim())
      : examples[index];
    return example?.value.trim() || match;
  });
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(new Error('Không thể đọc file media.'));
    reader.readAsDataURL(file);
  });
}

const buttonLabel: Record<WhatsAppTemplateButtonType, string> = {
  QUICK_REPLY: 'Trả lời nhanh',
  URL: 'Truy cập website',
  PHONE_NUMBER: 'Gọi điện thoại',
};

const categoryDescription: Record<WhatsAppTemplateCategory, string> = {
  MARKETING: 'Gửi ưu đãi, thông báo sản phẩm và nội dung giúp tăng nhận diện hoặc tương tác.',
  UTILITY: 'Theo dõi giao dịch, tài khoản, đơn hàng hoặc một yêu cầu cụ thể của khách hàng.',
  AUTHENTICATION: 'Gửi mã xác thực một lần (OTP) để đăng nhập hoặc xác minh tài khoản.',
};

export const TemplateManagementView: React.FC<TemplateManagementViewProps> = ({
  templates,
  isLoading,
  error,
  onRefetch,
  onCreateTemplate,
  isCreatePending,
  createError,
  onResetCreateError,
}) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [step, setStep] = useState<WizardStep>(1);
  const [templateType, setTemplateType] = useState<TemplateType>('DEFAULT');
  const [name, setName] = useState('');
  const [language, setLanguage] = useState('vi');
  const [category, setCategory] = useState<WhatsAppTemplateCategory>('MARKETING');
  const [parameterFormat, setParameterFormat] = useState<WhatsAppTemplateParameterFormat>('POSITIONAL');
  const [allowCategoryChange, setAllowCategoryChange] = useState(true);
  const [headerFormat, setHeaderFormat] = useState<WhatsAppTemplateHeaderFormat>('NONE');
  const [headerText, setHeaderText] = useState('');
  const [headerExamples, setHeaderExamples] = useState<WhatsAppTemplateExample[]>([]);
  const [mediaHandle, setMediaHandle] = useState('');
  const [mediaFileName, setMediaFileName] = useState('');
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [mediaError, setMediaError] = useState('');
  const [body, setBody] = useState('');
  const [bodyExamples, setBodyExamples] = useState<WhatsAppTemplateExample[]>([]);
  const [footer, setFooter] = useState('');
  const [buttons, setButtons] = useState<EditableButton[]>([]);
  const [otpType, setOtpType] = useState<WhatsAppOtpType>('COPY_CODE');
  const [otpButtonText, setOtpButtonText] = useState('Sao chép mã');
  const [otpAutofillText, setOtpAutofillText] = useState('Tự động điền');
  const [otpPackage, setOtpPackage] = useState('');
  const [otpSignature, setOtpSignature] = useState('');
  const [otpExpiration, setOtpExpiration] = useState(10);
  const [addSecurityRecommendation, setAddSecurityRecommendation] = useState(true);
  const [zeroTapTermsAccepted, setZeroTapTermsAccepted] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const bodyVariables = useMemo(() => extractVariables(body, parameterFormat), [body, parameterFormat]);
  const headerVariables = useMemo(() => extractVariables(headerText, parameterFormat), [headerText, parameterFormat]);

  useEffect(() => {
    setBodyExamples((current) => syncExamples(current, bodyVariables, parameterFormat));
  }, [bodyVariables.join('|'), parameterFormat]);

  useEffect(() => {
    setHeaderExamples((current) => syncExamples(current, headerVariables, parameterFormat));
  }, [headerVariables.join('|'), parameterFormat]);

  const resetForm = () => {
    setStep(1);
    setTemplateType('DEFAULT');
    setName('');
    setLanguage('vi');
    setCategory('MARKETING');
    setParameterFormat('POSITIONAL');
    setAllowCategoryChange(true);
    setHeaderFormat('NONE');
    setHeaderText('');
    setHeaderExamples([]);
    setMediaHandle('');
    setMediaFileName('');
    setMediaError('');
    setBody('');
    setBodyExamples([]);
    setFooter('');
    setButtons([]);
    setOtpType('COPY_CODE');
    setOtpButtonText('Sao chép mã');
    setOtpAutofillText('Tự động điền');
    setOtpPackage('');
    setOtpSignature('');
    setOtpExpiration(10);
    setAddSecurityRecommendation(true);
    setZeroTapTermsAccepted(false);
  };

  const updateExample = (
    setter: React.Dispatch<React.SetStateAction<WhatsAppTemplateExample[]>>,
    index: number,
    value: string,
  ) => setter((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, value } : item));

  const addButton = (type: WhatsAppTemplateButtonType) => {
    setButtons((current) => [
      ...current,
      { id: crypto.randomUUID(), type, text: '', url: '', urlExample: '', phoneNumber: '' },
    ]);
  };

  const updateButton = (id: string, patch: Partial<EditableButton>) => {
    setButtons((current) => current.map((button) => button.id === id ? { ...button, ...patch } : button));
  };

  const uploadMedia = async (file?: File) => {
    if (!file) return;
    setMediaError('');
    if (file.size > 8 * 1024 * 1024) {
      setMediaError('File mẫu không được vượt quá 8 MB.');
      return;
    }
    setIsUploadingMedia(true);
    try {
      const dataBase64 = await fileToBase64(file);
      const result = await api.post<{ handle: string }>('/campaigns/templates/media', {
        fileName: file.name,
        mimeType: file.type,
        dataBase64,
      });
      setMediaHandle(result.handle);
      setMediaFileName(file.name);
    } catch (uploadError) {
      setMediaError(uploadError instanceof Error ? uploadError.message : 'Không thể upload file mẫu.');
    } finally {
      setIsUploadingMedia(false);
    }
  };

  const submitTemplate = async () => {
    onResetCreateError();
    setSuccessMessage('');
    try {
      let input: CreateWhatsAppTemplateInput;
      if (category === 'AUTHENTICATION') {
        input = {
          name: name.trim(),
          language: language.trim(),
          category,
          authentication: {
            addSecurityRecommendation,
            codeExpirationMinutes: otpExpiration,
            otpType,
            button: {
              text: otpButtonText.trim() || undefined,
              ...(otpType !== 'COPY_CODE' ? {
                autofill: otpAutofillText.trim(),
                package: otpPackage.trim(),
                signature: otpSignature.trim(),
              } : {}),
              ...(otpType === 'ZERO_TAP' ? { zeroTapTermsAccepted } : {}),
            },
          },
        };
      } else {
        input = {
          name: name.trim(),
          language: language.trim(),
          category,
          parameterFormat,
          allowCategoryChange,
          header: {
            format: headerFormat,
            ...(headerFormat === 'TEXT' ? {
              text: headerText.trim(),
              examples: headerExamples.map((example) => ({ ...example, value: example.value.trim() })),
            } : {}),
            ...(['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerFormat) ? { mediaHandle } : {}),
          },
          body: body.trim(),
          bodyExamples: bodyExamples.map((example) => ({ ...example, value: example.value.trim() })),
          footer: footer.trim() || undefined,
          buttons: buttons.map(({ id: _id, url, urlExample, phoneNumber, ...button }) => ({
            ...button,
            ...(button.type === 'URL' ? { url: url.trim(), urlExample: urlExample.trim() || undefined } : {}),
            ...(button.type === 'PHONE_NUMBER' ? { phoneNumber: phoneNumber.trim() } : {}),
          })),
        };
      }
      await onCreateTemplate(input);
      setSuccessMessage('Template đã được gửi sang Meta và đang chờ xét duyệt.');
      resetForm();
      setIsFormOpen(false);
    } catch {
      // Mutation error is rendered inline.
    }
  };

  const handleWizardSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (step === 1) {
      if (templateType !== 'DEFAULT' && category !== 'AUTHENTICATION') return;
      setStep(2);
      return;
    }
    if (step === 2) {
      setStep(3);
      return;
    }
    void submitTemplate();
  };

  const openForm = () => {
    if (isFormOpen) {
      setIsFormOpen(false);
      return;
    }
    resetForm();
    onResetCreateError();
    setSuccessMessage('');
    setIsFormOpen(true);
  };

  const mediaAccept = headerFormat === 'IMAGE'
    ? 'image/jpeg,image/png'
    : headerFormat === 'VIDEO'
      ? 'video/mp4'
      : 'application/pdf';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600">
            <FileText className="h-4 w-4" />
            <span>WhatsApp Manager</span>
          </div>
          <h2 className="mt-1 text-xl font-bold text-slate-900">Quản lý Message Template</h2>
          <p className="mt-1 text-xs text-slate-500">Tạo component và gửi trực tiếp sang WABA để Meta xét duyệt.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onRefetch} disabled={isLoading} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Tải lại
          </button>
          <button type="button" onClick={openForm} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-500">
            <Plus className="h-4 w-4" /> Tạo template
          </button>
        </div>
      </div>

      {successMessage ? <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-700">{successMessage}</div> : null}

      {isFormOpen ? (
        <form onSubmit={handleWizardSubmit} className="space-y-5">
          <WizardProgress step={step} />
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:items-start">
            <div className="space-y-5 lg:col-span-8">
              {step === 1 ? (
                <>
                  <section className={sectionClass}>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">Set up template</p>
                      <h3 className="mt-1 text-lg font-bold text-slate-900">Chọn category</h3>
                      <p className="text-sm text-slate-500">Chọn mục đích phù hợp nhất với nội dung tin nhắn.</p>
                    </div>
                    <div className="grid grid-cols-1 gap-2 rounded-xl bg-slate-100 p-1 sm:grid-cols-3" role="tablist" aria-label="Template category">
                      {(['MARKETING', 'UTILITY', 'AUTHENTICATION'] as WhatsAppTemplateCategory[]).map((item) => (
                        <button
                          key={item}
                          type="button"
                          role="tab"
                          aria-selected={category === item}
                          onClick={() => { setCategory(item); setTemplateType('DEFAULT'); }}
                          className={`rounded-lg px-3 py-3 text-left transition ${category === item ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200' : 'text-slate-600 hover:bg-white/60'}`}
                        >
                          <span className="block text-sm font-bold">{item === 'MARKETING' ? 'Marketing' : item === 'UTILITY' ? 'Utility' : 'Authentication'}</span>
                          <span className="mt-0.5 block text-[11px] leading-4">{item === 'MARKETING' ? 'Ưu đãi và tương tác' : item === 'UTILITY' ? 'Cập nhật giao dịch' : 'Mã xác thực OTP'}</span>
                        </button>
                      ))}
                    </div>
                    <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-900">
                      {categoryDescription[category]}
                      {category === 'AUTHENTICATION' ? <p className="mt-2 text-xs text-indigo-700">Meta tự tạo nội dung OTP theo ngôn ngữ và cài đặt bạn chọn ở bước tiếp theo.</p> : null}
                    </div>
                  </section>

                  {category !== 'AUTHENTICATION' ? (
                    <section className={sectionClass}>
                      <div><h3 className="font-bold text-slate-900">Loại template</h3><p className="text-xs text-slate-500">Hiện tại bạn có thể tạo template mặc định.</p></div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {([
                          ['DEFAULT', 'Default', 'Tạo tin nhắn với header, body, footer và buttons.'],
                          ['CATALOGUE', 'Catalogue', 'Hiển thị sản phẩm từ catalogue của doanh nghiệp.'],
                          ['FLOWS', 'Flows', 'Mở một WhatsApp Flow từ tin nhắn.'],
                          ['CALLING_PERMISSION', 'Calling permissions request', 'Yêu cầu khách hàng cấp quyền gọi.'],
                        ] as Array<[TemplateType, string, string]>).map(([value, title, description]) => {
                          const disabled = value !== 'DEFAULT';
                          return (
                            <label key={value} className={`relative flex gap-3 rounded-xl border p-4 ${disabled ? 'cursor-not-allowed border-slate-200 bg-slate-50 opacity-70' : 'cursor-pointer border-indigo-300 bg-indigo-50'}`}>
                              <input type="radio" name="templateType" value={value} checked={templateType === value} disabled={disabled} onChange={() => setTemplateType(value)} className="mt-1" />
                              <span><span className="flex flex-wrap items-center gap-2 text-sm font-bold text-slate-900">{title}{disabled ? <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] text-slate-600">Sắp hỗ trợ</span> : null}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span></span>
                            </label>
                          );
                        })}
                      </div>
                    </section>
                  ) : null}

                  <section className={sectionClass}>
                    <div><h3 className="font-bold text-slate-900">Thông tin template</h3><p className="text-xs text-slate-500">Tên và ngôn ngữ không thể đổi sau khi gửi xét duyệt.</p></div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div><label className={labelClass}>Tên template</label><input required value={name} onChange={(event) => setName(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} placeholder="order_delivery_update" className={inputClass} /></div>
                      <div><label className={labelClass}>Ngôn ngữ</label><input required value={language} onChange={(event) => setLanguage(event.target.value)} placeholder="vi hoặc en_US" className={inputClass} /></div>
                      <div>
                        <label className={labelClass}>Parameter format</label>
                        <select value={parameterFormat} disabled={category === 'AUTHENTICATION'} onChange={(event) => setParameterFormat(event.target.value as WhatsAppTemplateParameterFormat)} className={`${inputClass} disabled:bg-slate-100 disabled:text-slate-500`}>
                          <option value="POSITIONAL">POSITIONAL · {'{{1}}'}</option><option value="NAMED">NAMED · {'{{customer_name}}'}</option>
                        </select>
                        {category === 'AUTHENTICATION' ? <p className="mt-1 text-[11px] text-slate-500">Authentication dùng định dạng OTP cố định của Meta.</p> : null}
                      </div>
                      {category !== 'AUTHENTICATION' ? <label className="flex items-start gap-2 self-end rounded-xl bg-slate-50 p-3 text-xs text-slate-600"><input type="checkbox" checked={allowCategoryChange} onChange={(event) => setAllowCategoryChange(event.target.checked)} className="mt-0.5" />Cho phép Meta tự đổi category nếu nội dung được phân loại khác.</label> : null}
                    </div>
                  </section>
                </>
              ) : null}

              {step === 2 ? (
                category === 'AUTHENTICATION' ? (
                  <section className={sectionClass}>
                    <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-indigo-600" /><div><p className="text-xs font-bold uppercase tracking-wider text-indigo-600">Edit template</p><h3 className="font-bold text-slate-900">Authentication và OTP</h3><p className="text-xs text-slate-500">Meta tự tạo nội dung bảo mật theo ngôn ngữ đã chọn.</p></div></div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <div><label className={labelClass}>Loại nút OTP</label><select value={otpType} onChange={(event) => setOtpType(event.target.value as WhatsAppOtpType)} className={inputClass}><option value="COPY_CODE">COPY_CODE</option><option value="ONE_TAP">ONE_TAP</option><option value="ZERO_TAP">ZERO_TAP</option></select></div>
                      <div><label className={labelClass}>Nội dung nút</label><input value={otpButtonText} maxLength={25} onChange={(event) => setOtpButtonText(event.target.value)} className={inputClass} /></div>
                      <div><label className={labelClass}>Mã hết hạn sau (phút)</label><input type="number" min={1} max={90} value={otpExpiration} onChange={(event) => setOtpExpiration(Number(event.target.value))} className={inputClass} /></div>
                    </div>
                    <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={addSecurityRecommendation} onChange={(event) => setAddSecurityRecommendation(event.target.checked)} /> Thêm khuyến nghị không chia sẻ mã bảo mật.</label>
                    {otpType !== 'COPY_CODE' ? (
                      <div className="grid grid-cols-1 gap-4 rounded-xl border border-indigo-100 bg-indigo-50 p-4 md:grid-cols-3">
                        <div><label className={labelClass}>Nội dung tự động điền</label><input required value={otpAutofillText} maxLength={25} onChange={(event) => setOtpAutofillText(event.target.value)} className={inputClass} /></div>
                        <div><label className={labelClass}>Android package name</label><input required value={otpPackage} onChange={(event) => setOtpPackage(event.target.value)} placeholder="com.example.app" className={inputClass} /></div>
                        <div><label className={labelClass}>App signature hash</label><input required value={otpSignature} onChange={(event) => setOtpSignature(event.target.value)} className={inputClass} /></div>
                        {otpType === 'ZERO_TAP' ? <label className="flex items-center gap-2 text-xs font-medium text-indigo-900 md:col-span-3"><input required type="checkbox" checked={zeroTapTermsAccepted} onChange={(event) => setZeroTapTermsAccepted(event.target.checked)} /> Tôi chấp nhận điều khoản Zero Tap của Meta.</label> : null}
                      </div>
                    ) : null}
                  </section>
                ) : (
                  <>
                    <section className={sectionClass}>
                      <div><p className="text-xs font-bold uppercase tracking-wider text-indigo-600">Edit template</p><div className="mt-1 flex items-center gap-2"><Image className="h-5 w-5 text-indigo-600" /><h3 className="font-bold text-slate-900">Header</h3></div></div>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <div><label className={labelClass}>Loại header</label><select value={headerFormat} onChange={(event) => { setHeaderFormat(event.target.value as WhatsAppTemplateHeaderFormat); setMediaError(''); }} className={inputClass}><option value="NONE">Không có</option><option value="TEXT">Văn bản</option><option value="IMAGE">Hình ảnh</option><option value="VIDEO">Video</option><option value="DOCUMENT">Tài liệu PDF</option></select></div>
                        {headerFormat === 'TEXT' ? <div className="md:col-span-2"><label className={labelClass}>Nội dung header</label><input required maxLength={60} value={headerText} onChange={(event) => setHeaderText(event.target.value)} placeholder={parameterFormat === 'NAMED' ? 'Đơn hàng {{order_id}}' : 'Đơn hàng {{1}}'} className={inputClass} /><p className="mt-1 text-[11px] text-slate-500">Tối đa 60 ký tự và một biến.</p></div> : null}
                        {['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerFormat) ? <div className="md:col-span-2"><label className={labelClass}>File mẫu để Meta xét duyệt</label><label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-indigo-300 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-700 hover:bg-indigo-100">{isUploadingMedia ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}{isUploadingMedia ? 'Đang upload sang Meta...' : mediaFileName || 'Chọn file tối đa 8 MB'}<input required={!mediaHandle} disabled={isUploadingMedia} type="file" accept={mediaAccept} onChange={(event) => void uploadMedia(event.target.files?.[0])} className="hidden" /></label>{mediaHandle ? <p className="mt-1 text-[11px] font-medium text-emerald-600">Đã nhận media handle từ Meta.</p> : null}{mediaError ? <p className="mt-1 text-xs font-medium text-rose-600">{mediaError}</p> : null}</div> : null}
                      </div>
                      {headerFormat === 'TEXT' && headerExamples.length > 0 ? <ExampleFields examples={headerExamples} onChange={(index, value) => updateExample(setHeaderExamples, index, value)} /> : null}
                    </section>
                    <section className={sectionClass}>
                      <div><h3 className="font-bold text-slate-900">Nội dung</h3><p className="text-xs text-slate-500">Body bắt buộc; footer là phần ghi chú ngắn phía dưới.</p></div>
                      <div><label className={labelClass}>BODY</label><textarea required rows={5} maxLength={1024} value={body} onChange={(event) => setBody(event.target.value)} placeholder={parameterFormat === 'NAMED' ? 'Xin chào {{customer_name}}, đơn hàng {{order_id}} đã sẵn sàng.' : 'Xin chào {{1}}, đơn hàng {{2}} đã sẵn sàng.'} className={`${inputClass} p-3`} /><p className="mt-1 text-right text-[11px] text-slate-500">{body.length}/1024</p></div>
                      {bodyExamples.length > 0 ? <ExampleFields examples={bodyExamples} onChange={(index, value) => updateExample(setBodyExamples, index, value)} /> : null}
                      <div><label className={labelClass}>Footer tùy chọn</label><input value={footer} onChange={(event) => setFooter(event.target.value)} maxLength={60} placeholder="Cảm ơn bạn đã sử dụng dịch vụ." className={inputClass} /></div>
                    </section>
                    <section className={sectionClass}>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-bold text-slate-900">Buttons</h3><p className="text-xs text-slate-500">Tối đa 10 nút; tối đa 2 URL và 1 số điện thoại.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => addButton('QUICK_REPLY')} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold"><Plus className="mr-1 inline h-3 w-3" />Trả lời nhanh</button><button type="button" onClick={() => addButton('URL')} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold"><Link2 className="mr-1 inline h-3 w-3" />Website</button><button type="button" onClick={() => addButton('PHONE_NUMBER')} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold"><Phone className="mr-1 inline h-3 w-3" />Điện thoại</button></div></div>
                      {buttons.map((button, index) => <div key={button.id} className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-4"><div><label className={labelClass}>Loại nút #{index + 1}</label><select value={button.type} onChange={(event) => updateButton(button.id, { type: event.target.value as WhatsAppTemplateButtonType })} className={inputClass}><option value="QUICK_REPLY">Trả lời nhanh</option><option value="URL">Website</option><option value="PHONE_NUMBER">Điện thoại</option></select></div><div><label className={labelClass}>Nội dung nút</label><input required maxLength={25} value={button.text} onChange={(event) => updateButton(button.id, { text: event.target.value })} className={inputClass} /></div>{button.type === 'URL' ? <><div><label className={labelClass}>URL HTTPS</label><input required type="url" value={button.url} onChange={(event) => updateButton(button.id, { url: event.target.value })} placeholder="https://example.com/{{1}}" className={inputClass} /></div><div><label className={labelClass}>URL mẫu nếu có biến</label><input value={button.urlExample} onChange={(event) => updateButton(button.id, { urlExample: event.target.value })} placeholder="https://example.com/123" className={inputClass} /></div></> : null}{button.type === 'PHONE_NUMBER' ? <div className="md:col-span-2"><label className={labelClass}>Số E.164</label><input required value={button.phoneNumber} onChange={(event) => updateButton(button.id, { phoneNumber: event.target.value })} placeholder="+842812345678" className={inputClass} /></div> : null}<button type="button" onClick={() => setButtons((current) => current.filter((item) => item.id !== button.id))} className="justify-self-end text-rose-600 md:col-start-4" aria-label="Xóa nút"><Trash2 className="h-4 w-4" /></button></div>)}
                    </section>
                  </>
                )
              ) : null}

              {step === 3 ? (
                <ReviewSections category={category} name={name} language={language} parameterFormat={parameterFormat} allowCategoryChange={allowCategoryChange} headerFormat={headerFormat} headerText={headerText} mediaFileName={mediaFileName} body={body} footer={footer} buttons={buttons} otpType={otpType} otpButtonText={otpButtonText} otpExpiration={otpExpiration} addSecurityRecommendation={addSecurityRecommendation} />
              ) : null}

              {createError ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700">{createError.message}</div> : null}
              <div className="sticky bottom-3 z-10 flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur">
                <button type="button" onClick={() => step === 1 ? setIsFormOpen(false) : setStep((step - 1) as WizardStep)} className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">{step > 1 ? <ArrowLeft className="h-4 w-4" /> : null}{step === 1 ? 'Hủy' : 'Back'}</button>
                <button type="submit" disabled={isCreatePending || isUploadingMedia || (step === 1 && templateType !== 'DEFAULT' && category !== 'AUTHENTICATION')} className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-bold text-white hover:bg-indigo-500 disabled:opacity-50">{step === 1 ? 'Continue' : step === 2 ? 'Continue to review' : isCreatePending ? 'Đang gửi Meta...' : 'Gửi xét duyệt'}</button>
              </div>
            </div>

            <div className="lg:col-span-4 lg:sticky lg:top-5">
              <TemplatePreview category={category} headerFormat={headerFormat} headerText={headerText} headerExamples={headerExamples} mediaFileName={mediaFileName} body={body} bodyExamples={bodyExamples} footer={footer} buttons={buttons} parameterFormat={parameterFormat} otpType={otpType} otpButtonText={otpButtonText} otpExpiration={otpExpiration} addSecurityRecommendation={addSecurityRecommendation} />
            </div>
          </div>
        </form>
      ) : null}

      {error ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700">{error.message}</div> : null}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">{templates.map((template) => <TemplateCard key={`${template.name}::${template.language}`} template={template} />)}</div>
      {!isLoading && !error && templates.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-12 text-center text-sm text-slate-500">WABA chưa có template nào.</div> : null}
    </div>
  );
};

const WizardProgress: React.FC<{ step: WizardStep }> = ({ step }) => {
  const steps = ['Set up template', 'Edit template', 'Submit for Review'];
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-5 shadow-sm">
      <ol className="grid grid-cols-3">
        {steps.map((label, index) => {
          const number = (index + 1) as WizardStep;
          const complete = number < step;
          const active = number === step;
          return <li key={label} className="relative flex flex-col items-center text-center"><div className={`absolute top-4 h-0.5 w-full ${index === 0 ? 'left-1/2' : index === steps.length - 1 ? '-left-1/2' : ''} ${number <= step || index < step ? 'bg-indigo-500' : 'bg-slate-200'} ${index === 0 || index === steps.length - 1 ? 'w-1/2' : ''}`} /><span className={`relative z-[1] flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold ${complete ? 'border-indigo-600 bg-indigo-600 text-white' : active ? 'border-indigo-600 bg-white text-indigo-700' : 'border-slate-300 bg-white text-slate-400'}`}>{complete ? <Check className="h-4 w-4" /> : number}</span><span className={`mt-2 text-[11px] font-bold sm:text-xs ${active || complete ? 'text-slate-900' : 'text-slate-400'}`}>{label}</span></li>;
        })}
      </ol>
    </div>
  );
};

const TemplatePreview: React.FC<{
  category: WhatsAppTemplateCategory;
  headerFormat: WhatsAppTemplateHeaderFormat;
  headerText: string;
  headerExamples: WhatsAppTemplateExample[];
  mediaFileName: string;
  body: string;
  bodyExamples: WhatsAppTemplateExample[];
  footer: string;
  buttons: EditableButton[];
  parameterFormat: WhatsAppTemplateParameterFormat;
  otpType: WhatsAppOtpType;
  otpButtonText: string;
  otpExpiration: number;
  addSecurityRecommendation: boolean;
}> = ({ category, headerFormat, headerText, headerExamples, mediaFileName, body, bodyExamples, footer, buttons, parameterFormat, otpType, otpButtonText, otpExpiration, addSecurityRecommendation }) => {
  const previewHeader = substituteExamples(headerText, headerExamples, parameterFormat);
  const previewBody = substituteExamples(body, bodyExamples, parameterFormat);
  return (
    <aside className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3"><h3 className="text-sm font-bold text-slate-900">Template preview</h3><p className="text-[11px] text-slate-500">Bản xem trước cập nhật theo thời gian thực</p></div>
      <div className="min-h-[430px] bg-[#efeae2] p-4" style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(255,255,255,.55) 0 1px, transparent 1px)', backgroundSize: '16px 16px' }}>
        <div className="ml-auto max-w-[94%] overflow-hidden rounded-lg rounded-tr-none bg-white shadow-sm">
          {category === 'AUTHENTICATION' ? (
            <><div className="space-y-3 p-3"><div className="flex items-center gap-2 text-sm font-semibold text-slate-800"><LockKeyhole className="h-4 w-4 text-emerald-600" /> Mã xác thực của bạn</div><p className="text-sm leading-5 text-slate-700">Mã xác thực của bạn là <strong>123456</strong>.</p>{addSecurityRecommendation ? <p className="text-xs text-slate-600">Để bảo mật, đừng chia sẻ mã này.</p> : null}<p className="text-[11px] text-slate-500">Mã này sẽ hết hạn sau {otpExpiration} phút.</p><div className="text-right text-[10px] text-slate-400">{new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</div></div><div className="border-t border-slate-100 p-2"><div className="flex items-center justify-center gap-2 rounded-md py-1.5 text-xs font-semibold text-sky-600">{otpType === 'COPY_CODE' ? <Copy className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}{otpButtonText || (otpType === 'COPY_CODE' ? 'Sao chép mã' : 'Tự động điền')}</div></div></>
          ) : (
            <>{headerFormat !== 'NONE' ? <div>{headerFormat === 'TEXT' ? <div className="px-3 pt-3 text-sm font-bold text-slate-900">{previewHeader || 'Nội dung header'}</div> : <div className="flex h-36 flex-col items-center justify-center gap-2 bg-slate-100 px-3 text-center text-xs text-slate-500">{headerFormat === 'IMAGE' ? <Image className="h-8 w-8" /> : <FileText className="h-8 w-8" />}<span className="max-w-full truncate">{mediaFileName || `${headerFormat.toLowerCase()} mẫu`}</span></div>}</div> : null}<div className="space-y-2 px-3 pb-2 pt-3"><p className="whitespace-pre-wrap text-sm leading-5 text-slate-700">{previewBody || 'Nhập nội dung template để xem trước tin nhắn.'}</p>{footer ? <p className="text-[11px] text-slate-500">{footer}</p> : null}<div className="text-right text-[10px] text-slate-400">{new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</div></div>{buttons.length > 0 ? <div className="divide-y divide-slate-100 border-t border-slate-100 px-2">{buttons.map((button) => <div key={button.id} className="flex items-center justify-center gap-2 py-2 text-center text-xs font-semibold text-sky-600">{button.type === 'PHONE_NUMBER' ? <Phone className="h-3.5 w-3.5" /> : button.type === 'URL' ? <Link2 className="h-3.5 w-3.5" /> : null}{button.text || buttonLabel[button.type]}</div>)}</div> : null}</>
          )}
        </div>
      </div>
    </aside>
  );
};

const ReviewRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => <div className="grid gap-1 border-b border-slate-100 py-3 last:border-0 sm:grid-cols-[160px_1fr]"><dt className="text-xs font-semibold text-slate-500">{label}</dt><dd className="whitespace-pre-wrap break-words text-sm text-slate-800">{value || '—'}</dd></div>;

const ReviewSections: React.FC<{
  category: WhatsAppTemplateCategory; name: string; language: string; parameterFormat: WhatsAppTemplateParameterFormat; allowCategoryChange: boolean; headerFormat: WhatsAppTemplateHeaderFormat; headerText: string; mediaFileName: string; body: string; footer: string; buttons: EditableButton[]; otpType: WhatsAppOtpType; otpButtonText: string; otpExpiration: number; addSecurityRecommendation: boolean;
}> = ({ category, name, language, parameterFormat, allowCategoryChange, headerFormat, headerText, mediaFileName, body, footer, buttons, otpType, otpButtonText, otpExpiration, addSecurityRecommendation }) => (
  <div className="space-y-5">
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><div className="flex gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" /><div><p className="text-sm font-bold text-amber-900">Sẵn sàng gửi Meta xét duyệt</p><p className="mt-1 text-xs leading-5 text-amber-800">Meta sẽ kiểm tra nội dung, category và định dạng của template. Quá trình xét duyệt có thể mất đến 24 giờ và template chỉ sử dụng được sau khi được phê duyệt.</p></div></div></div>
    <section className={sectionClass}><div><p className="text-xs font-bold uppercase tracking-wider text-indigo-600">Submit for Review</p><h3 className="mt-1 font-bold text-slate-900">Thiết lập template</h3></div><dl><ReviewRow label="Tên" value={<span className="font-mono">{name}</span>} /><ReviewRow label="Category" value={category} /><ReviewRow label="Ngôn ngữ" value={language} />{category !== 'AUTHENTICATION' ? <><ReviewRow label="Parameter format" value={parameterFormat} /><ReviewRow label="Meta đổi category" value={allowCategoryChange ? 'Cho phép' : 'Không cho phép'} /></> : null}</dl></section>
    {category === 'AUTHENTICATION' ? <section className={sectionClass}><h3 className="font-bold text-slate-900">Authentication và OTP</h3><dl><ReviewRow label="Loại OTP" value={otpType} /><ReviewRow label="Nội dung nút" value={otpButtonText} /><ReviewRow label="Thời gian hết hạn" value={`${otpExpiration} phút`} /><ReviewRow label="Khuyến nghị bảo mật" value={addSecurityRecommendation ? 'Có' : 'Không'} /></dl></section> : <><section className={sectionClass}><h3 className="font-bold text-slate-900">Nội dung</h3><dl><ReviewRow label="Header" value={headerFormat === 'NONE' ? 'Không có' : `${headerFormat}${headerFormat === 'TEXT' ? ` · ${headerText}` : ` · ${mediaFileName}`}`} /><ReviewRow label="Body" value={body} /><ReviewRow label="Footer" value={footer} /></dl></section><section className={sectionClass}><h3 className="font-bold text-slate-900">Buttons ({buttons.length})</h3>{buttons.length ? <dl>{buttons.map((button, index) => <ReviewRow key={button.id} label={`Nút ${index + 1} · ${button.type}`} value={`${button.text}${button.type === 'URL' ? ` · ${button.url}` : button.type === 'PHONE_NUMBER' ? ` · ${button.phoneNumber}` : ''}`} />)}</dl> : <p className="text-sm text-slate-500">Không có button.</p>}</section></>}
  </div>
);

const ExampleFields: React.FC<{ examples: WhatsAppTemplateExample[]; onChange: (index: number, value: string) => void; }> = ({ examples, onChange }) => (
  <div className="grid grid-cols-1 gap-3 rounded-xl border border-indigo-200 bg-indigo-50 p-4 sm:grid-cols-2">
    {examples.map((example, index) => <div key={example.name || index}><label className="mb-1 block text-xs font-semibold text-indigo-800">Giá trị mẫu cho {example.name ? `{{${example.name}}}` : `{{${index + 1}}}`}</label><input required value={example.value} onChange={(event) => onChange(index, event.target.value)} placeholder="Giá trị thực tế minh họa cho Meta" className={inputClass} /></div>)}
  </div>
);

const TemplateCard: React.FC<{ template: WhatsAppApprovedTemplate }> = ({ template }) => {
  const statusClass = STATUS_CLASSES[template.status] || 'border-slate-300 bg-slate-100 text-slate-700';
  const StatusIcon = template.status === 'APPROVED' ? CheckCircle2 : template.status === 'REJECTED' ? XCircle : Clock3;
  const header = template.components.find((component) => component.type?.toUpperCase() === 'HEADER');
  const body = template.components.find((component) => component.type?.toUpperCase() === 'BODY');
  const footer = template.components.find((component) => component.type?.toUpperCase() === 'FOOTER');
  const buttonComponent = template.components.find((component) => component.type?.toUpperCase() === 'BUTTONS');
  const buttons = Array.isArray(buttonComponent?.buttons) ? buttonComponent.buttons as Array<{ type?: string; text?: string; url?: string; phone_number?: string; otp_type?: string }> : [];
  const rejectionReason = template.status === 'REJECTED' && template.rejected_reason && template.rejected_reason !== 'NONE' ? template.rejected_reason : null;
  const qualityScore = template.quality_score?.score && template.quality_score.score !== 'UNKNOWN' ? template.quality_score.score : null;
  const isMetaSample = template.name === 'hello_world';

  return (
    <article className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex items-center gap-2"><h3 className="truncate font-mono text-sm font-bold text-slate-900">{template.name}</h3>{isMetaSample ? <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700">Mẫu của Meta</span> : null}</div><p className="mt-1 text-xs text-slate-500">{template.language} · {template.category} · {template.parameter_format || 'POSITIONAL'}</p></div><span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold ${statusClass}`}><StatusIcon className="h-3.5 w-3.5" />{template.status}</span></div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">{header ? <div className="border-b border-slate-200 px-3 py-2 text-xs font-bold text-slate-800">{header.format && header.format !== 'TEXT' ? `[${header.format}]` : header.text}</div> : null}{body?.text ? <p className="whitespace-pre-wrap px-3 py-3 text-xs leading-relaxed text-slate-700">{body.text}</p> : template.category === 'AUTHENTICATION' ? <p className="px-3 py-3 text-xs text-slate-700">Nội dung mã xác thực do Meta tạo tự động.</p> : null}{footer?.text ? <p className="border-t border-slate-200 px-3 py-2 text-[11px] text-slate-500">{footer.text}</p> : null}{buttons.length > 0 ? <div className="grid gap-1 border-t border-slate-200 p-2">{buttons.map((button, index) => <div key={index} className="rounded-lg bg-white px-3 py-2 text-center text-xs font-semibold text-indigo-600">{button.text || button.otp_type || buttonLabel[button.type as WhatsAppTemplateButtonType] || button.type}</div>)}</div> : null}</div>
      {rejectionReason ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700"><strong>Lý do từ chối:</strong> {rejectionReason}</div> : null}
      {qualityScore ? <p className="text-[11px] font-medium text-slate-500">Quality score: {qualityScore}</p> : null}
    </article>
  );
};
