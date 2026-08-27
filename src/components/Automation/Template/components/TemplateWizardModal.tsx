import {
  ArrowLeft,
  Bell,
  Bold,
  Code2,
  Info,
  Italic,
  KeyRound,
  Loader2,
  Megaphone,
  Plus,
  ShieldCheck,
  Smile,
  Strikethrough,
  Upload,
  XCircle,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from 'react';
import type {
  CreateWhatsAppTemplateInput,
  WhatsAppOtpType,
  WhatsAppTemplateCategory,
  WhatsAppTemplateHeaderFormat,
  WhatsAppTemplateParameterFormat,
} from '../../../../types';
import { WHATSAPP_TEMPLATE_LANGUAGES, getTemplateLanguageLabel } from '../constants/languages';
import {
  ALL_SETUP_PREVIEW_IMAGES,
  CATEGORY_DESCRIPTIONS,
  inputClass,
  labelClass,
  sectionClass,
} from '../constants/templateConstants';
import { useClickOutside } from '../hooks/useClickOutside';
import { useMediaUpload, type MediaFormPatch } from '../hooks/useMediaUpload';
import { useTemplateForm } from '../hooks/useTemplateForm';
import type { EditableButton, TemplateType, WizardStep } from '../types';
import { toE164Phone } from '../utils/templateFormatters';
import { ReviewSections } from './ReviewSections';
import { TemplatePreview } from './TemplatePreview';
import { VariableSamples } from './VariableSamples';
import { WizardProgress } from './WizardProgress';
import { ButtonEditorList } from './buttons/ButtonEditorList';
import { EmojiPicker } from './common/EmojiPicker';
import { MediaSampleDropdown } from './common/MediaSampleDropdown';

interface TemplateWizardModalProps {
  onClose: () => void;
  onCreateTemplate: (input: CreateWhatsAppTemplateInput) => Promise<unknown>;
  isCreatePending: boolean;
  createError: Error | null;
  onResetCreateError: () => void;
  onSuccess: (message: string) => void;
}

const RECENT_EMOJIS_STORAGE_KEY = 'yumcrm_recent_emojis';
const CATEGORY_ICONS = {
  MARKETING: Megaphone,
  UTILITY: Bell,
  AUTHENTICATION: KeyRound,
} as const;

const MARKETING_TEMPLATE_TYPES: Array<[TemplateType, string, string]> = [
  ['DEFAULT', 'Default', 'Tạo tin nhắn với header, body, footer và buttons.'],
  ['CATALOGUE', 'Catalogue', 'Hiển thị sản phẩm từ catalogue của doanh nghiệp.'],
  ['FLOWS', 'Flows', 'Mở một WhatsApp Flow từ tin nhắn.'],
  ['CALLING_PERMISSION', 'Calling permissions request', 'Yêu cầu khách hàng cấp quyền gọi.'],
];

const UTILITY_TEMPLATE_TYPES: Array<[TemplateType, string, string]> = [
  ['DEFAULT', 'Default', 'Gửi tin nhắn về một đơn hàng hoặc tài khoản hiện có.'],
  ['FLOWS', 'Flows', 'Gửi biểu mẫu để thu thập phản hồi, gửi lời nhắc hoặc quản lý đơn hàng.'],
  ['CALLING_PERMISSION', 'Calling permissions request', 'Hỏi khách hàng xem bạn có thể gọi cho họ trên WhatsApp hay không.'],
];

export function TemplateWizardModal({
  onClose,
  onCreateTemplate,
  isCreatePending,
  createError,
  onResetCreateError,
  onSuccess,
}: TemplateWizardModalProps) {
  const [wizardStep, setWizardStep] = useState<WizardStep>(1);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [headerTooltipPosition, setHeaderTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  const [recentEmojis, setRecentEmojis] = useState<string[]>(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(RECENT_EMOJIS_STORAGE_KEY) || '[]');
      return Array.isArray(saved)
        ? saved.filter((item): item is string => typeof item === 'string').slice(0, 8)
        : [];
    } catch {
      return [];
    }
  });
  const formRef = useRef<HTMLFormElement>(null);
  const headerInputRef = useRef<HTMLInputElement>(null);
  const bodyInputRef = useRef<HTMLTextAreaElement>(null);
  const emojiPickerRef = useRef<HTMLSpanElement>(null);

  const {
    form,
    setForm,
    updateField,
    resetForm,
    bodyVariables,
    headerVariables,
    bodyValidationErrors,
    hasDuplicateButtonText,
    isDuplicateButtonText,
  } = useTemplateForm();

  const handleMediaFormChange = useCallback((patch: MediaFormPatch) => {
    setForm((current) => ({ ...current, ...patch }));
  }, [setForm]);
  const {
    clearMediaError,
    isUploadingMedia,
    mediaAccept,
    mediaError,
    setMediaError,
    uploadMedia,
  } = useMediaUpload({
    headerFormat: form.headerFormat,
    mediaPreviewUrl: form.mediaPreviewUrl,
    onFormChange: handleMediaFormChange,
  });

  const setButtons = useCallback<Dispatch<SetStateAction<EditableButton[]>>>((nextButtons) => {
    setForm((current) => ({
      ...current,
      buttons: typeof nextButtons === 'function' ? nextButtons(current.buttons) : nextButtons,
    }));
  }, [setForm]);

  const closeEmojiPicker = useCallback(() => setIsEmojiPickerOpen(false), []);
  useClickOutside(emojiPickerRef, closeEmojiPicker, {
    enabled: isEmojiPickerOpen,
    onEscape: closeEmojiPicker,
  });

  useEffect(() => {
    // Preload all template setup preview images in memory cache for instant switching
    ALL_SETUP_PREVIEW_IMAGES.forEach((src) => {
      const img = new window.Image();
      img.src = src;
    });
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const addHeaderVariable = useCallback(() => {
    if (headerVariables.length > 0) return;
    const variable = form.parameterFormat === 'NAMED' ? '{{variable_name}}' : '{{1}}';
    const input = headerInputRef.current;
    const selectionStart = input?.selectionStart ?? form.headerText.length;
    const selectionEnd = input?.selectionEnd ?? selectionStart;
    const nextHeaderText = `${form.headerText.slice(0, selectionStart)}${variable}${form.headerText.slice(selectionEnd)}`;
    if (nextHeaderText.length > 60) return;
    setForm((current) => ({ ...current, headerText: nextHeaderText, headerFormat: 'TEXT' }));
    window.requestAnimationFrame(() => {
      const cursorPosition = selectionStart + variable.length;
      input?.focus();
      input?.setSelectionRange(cursorPosition, cursorPosition);
    });
  }, [form.headerText, form.parameterFormat, headerVariables.length, setForm]);

  const insertBodyText = useCallback((text: string) => {
    const input = bodyInputRef.current;
    const selectionStart = input?.selectionStart ?? form.body.length;
    const selectionEnd = input?.selectionEnd ?? selectionStart;
    const nextBody = `${form.body.slice(0, selectionStart)}${text}${form.body.slice(selectionEnd)}`;
    if (nextBody.length > 1024) return;
    updateField('body', nextBody);
    window.requestAnimationFrame(() => {
      const cursorPosition = selectionStart + text.length;
      input?.focus();
      input?.setSelectionRange(cursorPosition, cursorPosition);
    });
  }, [form.body, updateField]);

  const replaceBodySelection = useCallback((prefix: string, suffix = '', fallback = '') => {
    const input = bodyInputRef.current;
    const selectionStart = input?.selectionStart ?? form.body.length;
    const selectionEnd = input?.selectionEnd ?? selectionStart;
    const selectedText = form.body.slice(selectionStart, selectionEnd) || fallback;
    const replacement = `${prefix}${selectedText}${suffix}`;
    const nextBody = `${form.body.slice(0, selectionStart)}${replacement}${form.body.slice(selectionEnd)}`;
    if (nextBody.length > 1024) return;
    updateField('body', nextBody);
    window.requestAnimationFrame(() => {
      const contentStart = selectionStart + prefix.length;
      input?.focus();
      input?.setSelectionRange(contentStart, contentStart + selectedText.length);
    });
  }, [form.body, updateField]);

  const addBodyVariable = useCallback(() => {
    insertBodyText(form.parameterFormat === 'NAMED'
      ? `{{variable_${bodyVariables.length + 1}}}`
      : `{{${bodyVariables.length + 1}}}`);
  }, [bodyVariables.length, form.parameterFormat, insertBodyText]);

  const handleEmojiSelect = useCallback((emoji: string) => {
    insertBodyText(emoji);
    setRecentEmojis((current) => {
      const next = [emoji, ...current.filter((item) => item !== emoji)].slice(0, 8);
      try {
        localStorage.setItem(RECENT_EMOJIS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Emoji insertion remains available when storage is unavailable.
      }
      return next;
    });
  }, [insertBodyText]);

  const handleHeaderExampleChange = useCallback((index: number, value: string) => {
    setForm((current) => ({
      ...current,
      headerExamples: current.headerExamples.map((item, itemIndex) =>
        itemIndex === index ? { ...item, value } : item),
    }));
  }, [setForm]);
  const handleBodyExampleChange = useCallback((index: number, value: string) => {
    setForm((current) => ({
      ...current,
      bodyExamples: current.bodyExamples.map((item, itemIndex) =>
        itemIndex === index ? { ...item, value } : item),
    }));
  }, [setForm]);

  const handleHeaderFormatChange = useCallback((format: WhatsAppTemplateHeaderFormat) => {
    updateField('headerFormat', format === 'NONE' && form.headerText.trim() ? 'TEXT' : format);
    clearMediaError();
  }, [clearMediaError, form.headerText, updateField]);

  const submitTemplate = useCallback(async () => {
    if (form.category !== 'AUTHENTICATION' && hasDuplicateButtonText) return;
    onResetCreateError();
    try {
      let input: CreateWhatsAppTemplateInput;
      if (form.category === 'AUTHENTICATION') {
        input = {
          name: form.name.trim(),
          language: form.language.trim(),
          category: form.category,
          authentication: {
            addSecurityRecommendation: form.addSecurityRecommendation,
            codeExpirationMinutes: form.otpExpiration,
            otpType: form.otpType,
            button: {
              text: form.otpButtonText.trim() || undefined,
              ...(form.otpType !== 'COPY_CODE' ? {
                autofill: form.otpAutofillText.trim(),
                package: form.otpPackage.trim(),
                signature: form.otpSignature.trim(),
              } : {}),
              ...(form.otpType === 'ZERO_TAP'
                ? { zeroTapTermsAccepted: form.zeroTapTermsAccepted }
                : {}),
            },
          },
        };
      } else {
        input = {
          name: form.name.trim(),
          language: form.language.trim(),
          category: form.category,
          parameterFormat: form.parameterFormat,
          allowCategoryChange: form.allowCategoryChange,
          header: {
            format: form.headerFormat,
            ...(form.headerFormat === 'TEXT' ? {
              text: form.headerText.trim(),
              examples: form.headerExamples.map((example) => ({ ...example, value: example.value.trim() })),
            } : {}),
            ...(['IMAGE', 'VIDEO', 'DOCUMENT'].includes(form.headerFormat)
              ? { mediaHandle: form.mediaHandle }
              : {}),
          },
          body: form.body.trim(),
          bodyExamples: form.bodyExamples.map((example) => ({ ...example, value: example.value.trim() })),
          footer: form.footer.trim() || undefined,
          buttons: form.buttons.map(({
            id: _id,
            quickReplyMode: _quickReplyMode,
            urlType: _urlType,
            url,
            urlExample,
            phoneCountryIso,
            phoneNumber,
            activeForDays,
            ...button
          }) => ({
            ...button,
            ...(button.type === 'URL'
              ? { url: url.trim(), urlExample: urlExample.trim() || undefined }
              : {}),
            ...(button.type === 'PHONE_NUMBER'
              ? { phoneNumber: toE164Phone(phoneCountryIso, phoneNumber) }
              : {}),
            ...(button.type === 'VOICE_CALL' ? { activeForDays } : {}),
          })),
        };
      }
      await onCreateTemplate(input);
      const message = 'Template đã được gửi sang Meta và đang chờ xét duyệt.';
      resetForm();
      onSuccess(message);
      onClose();
    } catch {
      // Mutation error is rendered inline.
    }
  }, [form, hasDuplicateButtonText, onClose, onCreateTemplate, onResetCreateError, onSuccess, resetForm]);

  const continueToEditor = useCallback(() => {
    if (form.templateType !== 'DEFAULT' && form.category !== 'AUTHENTICATION') return;
    setWizardStep(2);
  }, [form.category, form.templateType]);
  const continueToReview = useCallback(() => {
    if (form.category !== 'AUTHENTICATION' && (bodyValidationErrors.length > 0 || hasDuplicateButtonText)) return;
    if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(form.headerFormat) && !form.mediaHandle) {
      setMediaError('Vui lòng upload file mẫu trước khi tiếp tục.');
      return;
    }
    if (!formRef.current?.reportValidity()) return;
    setWizardStep(3);
  }, [bodyValidationErrors.length, form.category, form.headerFormat, form.mediaHandle, hasDuplicateButtonText, setMediaError]);
  const handleSubmit = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (wizardStep === 3) void submitTemplate();
  }, [submitTemplate, wizardStep]);

  const mediaHeaderSelected = ['IMAGE', 'VIDEO', 'DOCUMENT', 'LOCATION'].includes(form.headerFormat);
  const templateTypes = form.category === 'UTILITY' ? UTILITY_TEMPLATE_TYPES : MARKETING_TEMPLATE_TYPES;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/60 p-2 backdrop-blur-sm sm:p-4"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Tạo WhatsApp message template"
        className="relative my-auto max-h-[calc(100vh-1rem)] w-full max-w-370 overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-2xl sm:max-h-[calc(100vh-2rem)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng cửa sổ tạo template"
          className="absolute right-4 top-4 z-40 rounded-full bg-white p-1 text-slate-400 shadow-sm ring-1 ring-slate-200 hover:text-slate-700"
        >
          <XCircle className="h-5 w-5" />
        </button>
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="space-y-5 bg-linear-to-br from-slate-50 via-white to-indigo-50/50 p-3 sm:p-5"
        >
          <WizardProgress step={wizardStep} />
          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="min-w-0 space-y-5">
              {wizardStep === 1 ? (
                <>
                  <section className={sectionClass}>
                    <h3 className="text-xl font-bold text-slate-900">Thiết lập template</h3>
                    <div
                      className="grid grid-cols-1 gap-2 rounded-xl bg-slate-100 p-1 sm:grid-cols-3"
                      role="tablist"
                      aria-label="Template category"
                    >
                      {(['MARKETING', 'UTILITY', 'AUTHENTICATION'] as WhatsAppTemplateCategory[]).map((category) => {
                        const CategoryIcon = CATEGORY_ICONS[category];
                        const isSelected = form.category === category;
                        return (
                          <button
                            key={category}
                            type="button"
                            role="tab"
                            aria-selected={isSelected}
                            onClick={() => setForm((current) => ({
                              ...current,
                              category,
                              templateType: 'DEFAULT',
                            }))}
                            className={`template-category-tab group relative flex items-center gap-2.5 rounded-lg px-3 py-3 text-left transition ${
                              isSelected
                                ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200'
                                : 'text-slate-600 hover:bg-white/60'
                            }`}
                          >
                            <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
                              isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700'
                            }`}>
                              <CategoryIcon
                                className="template-category-tab-icon h-4 w-4"
                                aria-hidden="true"
                                style={{
                                  color: isSelected ? '#ffffff' : '#334155',
                                  stroke: isSelected ? '#ffffff' : '#334155',
                                }}
                              />
                            </span>
                            <span className="block text-sm font-bold">
                              {category === 'MARKETING'
                                ? 'Marketing'
                                : category === 'UTILITY'
                                  ? 'Utility'
                                  : 'Authentication'}
                            </span>
                            <span
                              role="tooltip"
                              className="pointer-events-none absolute left-1/2 top-[calc(100%+8px)] z-30 w-64 -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-3 text-left text-xs font-normal leading-5 text-slate-900 opacity-0 shadow-xl transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                            >
                              {CATEGORY_DESCRIPTIONS[category]}
                              {category === 'AUTHENTICATION'
                                ? ' Meta tự tạo nội dung OTP theo ngôn ngữ và cài đặt ở bước tiếp theo.'
                                : ''}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  {form.category !== 'AUTHENTICATION' ? (
                    <section className={sectionClass}>
                      <h3 className="font-bold text-slate-900">Loại template</h3>
                      <div className="grid gap-3">
                        {templateTypes.map(([value, title, description]) => {
                          const unavailable = value !== 'DEFAULT';
                          return (
                            <label
                              key={value}
                              className={`relative flex cursor-pointer gap-3 rounded-xl border p-4 transition ${
                                form.templateType === value
                                  ? 'border-indigo-300 bg-indigo-50'
                                  : 'border-slate-200 bg-white hover:bg-slate-50'
                              }`}
                            >
                              <input
                                type="radio"
                                name="templateType"
                                value={value}
                                checked={form.templateType === value}
                                onChange={() => updateField('templateType', value)}
                                className="mt-1"
                              />
                              <span>
                                <span className="flex flex-wrap items-center gap-2 text-sm font-bold text-slate-900">
                                  {title}
                                  {unavailable ? (
                                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] text-slate-600">
                                      Chưa hỗ trợ
                                    </span>
                                  ) : null}
                                </span>
                                <span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </section>
                  ) : (
                    <section className={sectionClass}>
                      <div>
                        <h3 className="font-bold text-slate-900">Loại template</h3>
                        <p className="text-xs text-slate-500">Chọn cách gửi mã xác thực cho khách hàng.</p>
                      </div>
                      <label className="relative flex cursor-pointer gap-3 rounded-xl border border-indigo-300 bg-indigo-50 p-4">
                        <input type="radio" name="authenticationTemplateType" checked readOnly className="mt-1" />
                        <span>
                          <span className="block text-sm font-bold text-slate-900">One-time passcode</span>
                          <span className="mt-1 block text-xs leading-5 text-slate-500">
                            Gửi mã xác thực dùng một lần để đăng nhập hoặc xác minh tài khoản.
                          </span>
                        </span>
                      </label>
                    </section>
                  )}
                </>
              ) : null}

              {wizardStep === 2 ? (
                <>
                  {form.category !== 'AUTHENTICATION' ? (() => {
                    const CategoryBadgeIcon = CATEGORY_ICONS[form.category];
                    return (
                      <section className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                          form.category === 'MARKETING' ? 'bg-emerald-600' : 'bg-indigo-600'
                        } text-white`}>
                          <CategoryBadgeIcon className="h-5 w-5 text-white" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-slate-900">
                            {form.name || 'your_template_name'} · {getTemplateLanguageLabel(form.language)}
                          </p>
                          <p className="mt-0.5 text-[11px] text-slate-500">
                            {form.category === 'MARKETING' ? 'Marketing' : 'Utility'} · Default
                          </p>
                        </div>
                      </section>
                    );
                  })() : null}

                  <section className={sectionClass}>
                    <h3 className="font-bold text-slate-900">Template name and language</h3>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
                      <div>
                        <label className={labelClass}>Name your template</label>
                        <div className="relative">
                          <input
                            required
                            maxLength={512}
                            value={form.name}
                            onChange={(event) => updateField('name', event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                            placeholder="Enter a template name"
                            className={`${inputClass} pr-16`}
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">
                            {form.name.length}/512
                          </span>
                        </div>
                      </div>
                      <div>
                        <label className={labelClass}>Select language</label>
                        <select
                          required
                          value={form.language}
                          onChange={(event) => updateField('language', event.target.value)}
                          className={inputClass}
                        >
                          {WHATSAPP_TEMPLATE_LANGUAGES.map((language) => (
                            <option key={language.code} value={language.code}>{language.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </section>

                  {form.category === 'AUTHENTICATION' ? (
                    <section className={sectionClass}>
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-5 w-5 text-indigo-600" />
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">Edit template</p>
                          <h3 className="font-bold text-slate-900">Authentication và OTP</h3>
                          <p className="text-xs text-slate-500">Meta tự tạo nội dung bảo mật theo ngôn ngữ đã chọn.</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <div>
                          <label className={labelClass}>Loại button OTP</label>
                          <select
                            value={form.otpType}
                            onChange={(event) => updateField('otpType', event.target.value as WhatsAppOtpType)}
                            className={inputClass}
                          >
                            <option value="COPY_CODE">COPY_CODE</option>
                            <option value="ONE_TAP">ONE_TAP</option>
                            <option value="ZERO_TAP">ZERO_TAP</option>
                          </select>
                        </div>
                        <div>
                          <label className={labelClass}>Nội dung button</label>
                          <div className="relative">
                            <input
                              value={form.otpButtonText}
                              maxLength={40}
                              onChange={(event) => updateField('otpButtonText', event.target.value)}
                              placeholder="Tùy chỉnh text button"
                              className={`${inputClass} pr-12`}
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">
                              {form.otpButtonText.length}/40
                            </span>
                          </div>
                        </div>
                        <div>
                          <label className={labelClass}>Mã hết hạn sau (phút)</label>
                          <input
                            type="number"
                            min={1}
                            max={90}
                            value={form.otpExpiration}
                            onChange={(event) => updateField('otpExpiration', Number(event.target.value))}
                            className={inputClass}
                          />
                        </div>
                      </div>
                      <label className="flex items-center gap-2 text-xs text-slate-600">
                        <input
                          type="checkbox"
                          checked={form.addSecurityRecommendation}
                          onChange={(event) => updateField('addSecurityRecommendation', event.target.checked)}
                        />
                        Thêm khuyến nghị không chia sẻ mã bảo mật.
                      </label>
                      {form.otpType !== 'COPY_CODE' ? (
                        <div className="grid grid-cols-1 gap-4 rounded-xl border border-indigo-100 bg-indigo-50 p-4 md:grid-cols-3">
                          <div>
                            <label className={labelClass}>Nội dung tự động điền</label>
                            <input
                              required
                              value={form.otpAutofillText}
                              maxLength={40}
                              onChange={(event) => updateField('otpAutofillText', event.target.value)}
                              className={inputClass}
                            />
                          </div>
                          <div>
                            <label className={labelClass}>Android package name</label>
                            <input
                              required
                              value={form.otpPackage}
                              onChange={(event) => updateField('otpPackage', event.target.value)}
                              placeholder="com.example.app"
                              className={inputClass}
                            />
                          </div>
                          <div>
                            <label className={labelClass}>App signature hash</label>
                            <input
                              required
                              value={form.otpSignature}
                              onChange={(event) => updateField('otpSignature', event.target.value)}
                              className={inputClass}
                            />
                          </div>
                          {form.otpType === 'ZERO_TAP' ? (
                            <label className="flex items-center gap-2 text-xs font-medium text-indigo-900 md:col-span-3">
                              <input
                                required
                                type="checkbox"
                                checked={form.zeroTapTermsAccepted}
                                onChange={(event) => updateField('zeroTapTermsAccepted', event.target.checked)}
                              />
                              Tôi chấp nhận điều khoản Zero Tap của Meta.
                            </label>
                          ) : null}
                        </div>
                      ) : null}
                    </section>
                  ) : (
                    <>
                      <section className={sectionClass}>
                        <div>
                          <h3 className="font-bold text-slate-900">Content</h3>
                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            Thêm tiêu đề, nội dung và chân trang cho template. Cloud API do Meta lưu trữ sẽ kiểm duyệt các biến và nội dung trong mẫu.{' '}
                            <a
                              href="https://developers.facebook.com/docs/whatsapp/message-templates/guidelines/"
                              target="_blank"
                              rel="noreferrer"
                              className="font-semibold text-indigo-600 underline decoration-indigo-300 underline-offset-2 hover:text-indigo-700"
                            >
                              Tìm hiểu thêm
                            </a>
                          </p>
                        </div>

                        <div className="sm:max-w-56">
                          <div className="mb-1 flex items-center gap-1.5">
                            <label className="block text-xs font-semibold text-slate-700">Loại biến</label>
                            <span className="group relative inline-flex">
                              <button
                                type="button"
                                aria-label="Giải thích về biến trong template"
                                aria-describedby="variable-type-tooltip"
                                className="rounded-full text-slate-400 transition hover:text-indigo-600 focus-visible:outline-2 focus-visible:outline-indigo-500"
                              >
                                <Info aria-hidden="true" className="h-3.5 w-3.5" />
                              </button>
                              <span
                                id="variable-type-tooltip"
                                role="tooltip"
                                className="pointer-events-none absolute bottom-full left-0 z-30 mb-2 w-72 max-w-[calc(100vw-3rem)] rounded-xl border border-slate-200 bg-white p-3 text-xs leading-5 text-slate-900 opacity-0 shadow-xl transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                              >
                                Biến là phần giữ chỗ dùng để chèn động dữ liệu. Ví dụ: <code>{'{{order_id}}'}</code> hoặc <code>{'{{1}}'}</code>.
                              </span>
                            </span>
                          </div>
                          <select
                            value={form.parameterFormat}
                            onChange={(event) => updateField('parameterFormat', event.target.value as WhatsAppTemplateParameterFormat)}
                            className={inputClass}
                          >
                            <option value="POSITIONAL">Số</option>
                            <option value="NAMED">Tên</option>
                          </select>
                        </div>

                        <MediaSampleDropdown
                          value={form.headerFormat}
                          onChange={handleHeaderFormatChange}
                          labelClass={labelClass}
                        />
                        {['IMAGE', 'VIDEO', 'DOCUMENT'].includes(form.headerFormat) ? (
                          <div>
                            <label className={labelClass}>Upload media sample</label>
                            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-indigo-300 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-700 hover:bg-indigo-100">
                              {isUploadingMedia
                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                : <Upload className="h-4 w-4" />}
                              {isUploadingMedia
                                ? 'Đang upload sang Meta...'
                                : form.mediaFileName || (form.headerFormat === 'IMAGE'
                                    ? 'Chọn file ảnh (JPEG, PNG) tối đa 5 MB'
                                    : form.headerFormat === 'VIDEO'
                                      ? 'Chọn video (MP4) tối đa 16 MB'
                                      : 'Chọn tài liệu (PDF) tối đa 16 MB')}
                              <input
                                disabled={isUploadingMedia}
                                type="file"
                                accept={mediaAccept}
                                onChange={(event) => void uploadMedia(event.target.files?.[0])}
                                className="hidden"
                              />
                            </label>
                            {form.mediaHandle ? (
                              <p className="mt-1 text-[11px] font-medium text-emerald-600">Đã nhận media handle từ Meta.</p>
                            ) : null}
                            {mediaError ? (
                              <p role="alert" className="mt-1 text-xs font-medium text-rose-600">{mediaError}</p>
                            ) : null}
                          </div>
                        ) : null}

                        <div
                          className="relative"
                          tabIndex={mediaHeaderSelected ? 0 : undefined}
                          aria-describedby={mediaHeaderSelected ? 'media-header-tooltip' : undefined}
                          onMouseMove={(event) => {
                            if (!mediaHeaderSelected) return;
                            setHeaderTooltipPosition({
                              x: Math.max(8, Math.min(event.clientX + 14, window.innerWidth - 300)),
                              y: Math.max(8, Math.min(event.clientY + 16, window.innerHeight - 72)),
                            });
                          }}
                          onMouseLeave={() => setHeaderTooltipPosition(null)}
                          onFocus={(event) => {
                            if (!mediaHeaderSelected) return;
                            const bounds = event.currentTarget.getBoundingClientRect();
                            setHeaderTooltipPosition({
                              x: Math.max(8, Math.min(bounds.left, window.innerWidth - 300)),
                              y: Math.max(8, Math.min(bounds.bottom + 8, window.innerHeight - 72)),
                            });
                          }}
                          onBlur={() => setHeaderTooltipPosition(null)}
                        >
                          <label className={labelClass}>
                            Tiêu đề <span className="font-normal text-slate-400">· Optional</span>
                          </label>
                          <div className="relative">
                            <input
                              ref={headerInputRef}
                              disabled={mediaHeaderSelected}
                              maxLength={60}
                              value={form.headerText}
                              onChange={(event) => {
                                const headerText = event.target.value;
                                setForm((current) => ({
                                  ...current,
                                  headerText,
                                  headerFormat: headerText.trim() ? 'TEXT' : 'NONE',
                                }));
                              }}
                              placeholder={form.headerFormat === 'LOCATION'
                                ? 'Đã chọn header vị trí (Location)'
                                : 'Add a short line of text to the header of your message'}
                              className={`${inputClass} pr-14 disabled:cursor-not-allowed disabled:bg-slate-100`}
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">
                              {form.headerText.length}/60
                            </span>
                          </div>
                          {!mediaHeaderSelected ? (
                            <div className="mt-2 flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={addHeaderVariable}
                                disabled={headerVariables.length > 0 || form.headerText.length + (form.parameterFormat === 'NAMED' ? 17 : 5) > 60}
                                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-indigo-600 transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <Plus aria-hidden="true" className="h-3.5 w-3.5" /> Thêm biến
                              </button>
                              <span className="group relative inline-flex">
                                <button
                                  type="button"
                                  aria-label="Hướng dẫn thêm biến vào tiêu đề"
                                  aria-describedby="header-variable-tooltip"
                                  className="rounded-full text-slate-400 hover:text-indigo-600"
                                >
                                  <Info aria-hidden="true" className="h-3.5 w-3.5" />
                                </button>
                                <span
                                  id="header-variable-tooltip"
                                  role="tooltip"
                                  className="pointer-events-none absolute bottom-full left-0 z-30 mb-2 w-80 max-w-[calc(100vw-3rem)] rounded-xl border border-slate-200 bg-white p-3 text-xs leading-5 text-slate-900 opacity-0 shadow-xl transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                                >
                                  Thêm biến để dữ liệu tương ứng được thay thế khi gửi tin nhắn.
                                </span>
                              </span>
                            </div>
                          ) : null}
                          {mediaHeaderSelected ? (
                            <span
                              id="media-header-tooltip"
                              role="tooltip"
                              style={{
                                left: headerTooltipPosition?.x ?? -9999,
                                top: headerTooltipPosition?.y ?? -9999,
                                opacity: headerTooltipPosition ? 1 : 0,
                              }}
                              className="pointer-events-none fixed z-50 w-72 rounded-xl border border-slate-200 bg-white p-3 text-xs font-medium leading-relaxed text-slate-900 shadow-xl transition-opacity"
                            >
                              Xóa media để thêm tiêu đề
                            </span>
                          ) : null}
                        </div>

                        <div>
                          <label className={labelClass}>Body</label>
                          <div className="relative">
                            <textarea
                              ref={bodyInputRef}
                              required
                              rows={6}
                              maxLength={1024}
                              value={form.body}
                              onChange={(event) => updateField('body', event.target.value)}
                              placeholder={`Nhập text bằng tiếng ${getTemplateLanguageLabel(form.language)}`}
                              className={`${inputClass} p-3 pb-7 ${
                                bodyValidationErrors.length > 0
                                  ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-100'
                                  : ''
                              }`}
                            />
                            <span className="pointer-events-none absolute right-3 bottom-2 text-[10px] text-slate-400">
                              {form.body.length}/1024
                            </span>
                          </div>
                          {bodyValidationErrors.length > 0 ? (
                            <div className="mt-1.5 space-y-1 text-right">
                              {bodyValidationErrors.map((message) => (
                                <p key={message} className="text-xs leading-5 text-rose-600">{message}</p>
                              ))}
                            </div>
                          ) : null}
                          <div className="mt-2 flex flex-wrap items-center justify-end gap-1">
                            <span ref={emojiPickerRef} className="relative inline-flex">
                              <button
                                type="button"
                                onClick={() => setIsEmojiPickerOpen((current) => !current)}
                                aria-label="Mở bảng biểu tượng cảm xúc"
                                aria-haspopup="dialog"
                                aria-expanded={isEmojiPickerOpen}
                                title="Biểu tượng cảm xúc"
                                className={`rounded-lg p-1.5 transition ${
                                  isEmojiPickerOpen
                                    ? 'bg-indigo-50 text-indigo-600'
                                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                                }`}
                              >
                                <Smile aria-hidden="true" className="h-4 w-4" />
                              </button>
                              {isEmojiPickerOpen ? (
                                <EmojiPicker recentEmojis={recentEmojis} onSelect={handleEmojiSelect} />
                              ) : null}
                            </span>
                            <button type="button" onClick={() => replaceBodySelection('*', '*', 'text')} aria-label="In đậm" title="In đậm" className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100">
                              <Bold aria-hidden="true" className="h-4 w-4" />
                            </button>
                            <button type="button" onClick={() => replaceBodySelection('_', '_', 'text')} aria-label="In nghiêng" title="In nghiêng" className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100">
                              <Italic aria-hidden="true" className="h-4 w-4" />
                            </button>
                            <button type="button" onClick={() => replaceBodySelection('~', '~', 'text')} aria-label="Gạch ngang" title="Gạch ngang" className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100">
                              <Strikethrough aria-hidden="true" className="h-4 w-4" />
                            </button>
                            <button type="button" onClick={() => replaceBodySelection('```', '```', 'text')} aria-label="Định dạng monospace" title="Định dạng monospace" className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100">
                              <Code2 aria-hidden="true" className="h-4 w-4" />
                            </button>
                            <button type="button" onClick={addBodyVariable} className="ml-1 inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100">
                              <Plus aria-hidden="true" className="h-3.5 w-3.5" /> Thêm biến
                            </button>
                          </div>
                        </div>

                        {form.headerExamples.length > 0 || form.bodyExamples.length > 0 ? (
                          <VariableSamples
                            headerExamples={form.headerExamples}
                            bodyExamples={form.bodyExamples}
                            onHeaderChange={handleHeaderExampleChange}
                            onBodyChange={handleBodyExampleChange}
                          />
                        ) : null}
                        <div>
                          <label className={labelClass}>
                            Footer <span className="font-normal text-slate-400">· Optional</span>
                          </label>
                          <div className="relative">
                            <input
                              value={form.footer}
                              onChange={(event) => updateField('footer', event.target.value)}
                              maxLength={60}
                              placeholder="Add a short line of text to the bottom of your message"
                              className={`${inputClass} pr-14`}
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">
                              {form.footer.length}/60
                            </span>
                          </div>
                        </div>
                      </section>

                      <section className={sectionClass}>
                        <div>
                          <h3 className="font-bold text-slate-900">
                            Buttons <span className="text-xs font-normal text-slate-400">· Optional</span>
                          </h3>
                          <p className="mt-1 text-xs text-slate-500">
                            Tạo button để khách hàng phản hồi hoặc thực hiện hành động. Bạn có thể thêm tối đa 10 button.
                          </p>
                        </div>
                        <ButtonEditorList
                          buttons={form.buttons}
                          setButtons={setButtons}
                          isDuplicateButtonText={isDuplicateButtonText}
                          hasDuplicateButtonText={hasDuplicateButtonText}
                        />
                      </section>
                    </>
                  )}
                </>
              ) : null}

              {wizardStep === 3 ? (
                <ReviewSections
                  category={form.category}
                  name={form.name}
                  language={form.language}
                  parameterFormat={form.parameterFormat}
                  headerFormat={form.headerFormat}
                  headerText={form.headerText}
                  mediaFileName={form.mediaFileName}
                  body={form.body}
                  footer={form.footer}
                  buttons={form.buttons}
                  otpType={form.otpType}
                  otpButtonText={form.otpButtonText}
                  otpExpiration={form.otpExpiration}
                  addSecurityRecommendation={form.addSecurityRecommendation}
                />
              ) : null}

              {createError ? (
                <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700">
                  {createError.message}
                </div>
              ) : null}
              <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur">
                <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">
                  Hủy
                </button>
                <div className="ml-auto flex items-center gap-2">
                  {wizardStep > 1 ? (
                    <button
                      type="button"
                      onClick={() => setWizardStep((wizardStep - 1) as WizardStep)}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <ArrowLeft className="h-4 w-4" /> Quay lại
                    </button>
                  ) : null}
                  {wizardStep === 1 ? (
                    <button
                      type="button"
                      onClick={continueToEditor}
                      disabled={form.templateType !== 'DEFAULT' && form.category !== 'AUTHENTICATION'}
                      className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-bold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Tiếp tục
                    </button>
                  ) : null}
                  {wizardStep === 2 ? (
                    <button
                      type="button"
                      onClick={continueToReview}
                      disabled={isUploadingMedia || (form.category !== 'AUTHENTICATION' && (bodyValidationErrors.length > 0 || hasDuplicateButtonText))}
                      className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-bold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Tiếp tục
                    </button>
                  ) : null}
                  {wizardStep === 3 ? (
                    <button
                      type="submit"
                      disabled={isCreatePending || isUploadingMedia}
                      className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-bold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isCreatePending ? 'Đang gửi Meta...' : 'Gửi xét duyệt'}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="w-full lg:sticky lg:top-5 lg:w-90">
              <TemplatePreview
                wizardStep={wizardStep}
                templateType={form.templateType}
                category={form.category}
                headerFormat={form.headerFormat}
                headerText={form.headerText}
                headerExamples={form.headerExamples}
                mediaFileName={form.mediaFileName}
                mediaPreviewUrl={form.mediaPreviewUrl}
                body={form.body}
                bodyExamples={form.bodyExamples}
                footer={form.footer}
                buttons={form.buttons}
                parameterFormat={form.parameterFormat}
                otpType={form.otpType}
                otpButtonText={form.otpButtonText}
                otpExpiration={form.otpExpiration}
                addSecurityRecommendation={form.addSecurityRecommendation}
              />
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default TemplateWizardModal;
