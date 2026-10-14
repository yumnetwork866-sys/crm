import {
  Bold,
  Code2,
  Info,
  Italic,
  Loader2,
  Plus,
  ShieldCheck,
  Smile,
  Strikethrough,
  Upload,
} from 'lucide-react';
import {
  useCallback,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import type {
  WhatsAppOtpType,
  WhatsAppTemplateHeaderFormat,
  WhatsAppTemplateParameterFormat,
} from '../../../../../types';
import { WHATSAPP_TEMPLATE_LANGUAGES, getTemplateLanguageLabel } from '../../constants/languages';
import { inputClass, labelClass, sectionClass } from '../../constants/templateConstants';
import { useClickOutside } from '../../hooks/useClickOutside';
import type { EditableButton, TemplateFormData } from '../../types';
import { VariableSamples } from '../VariableSamples';
import { ButtonEditorList } from '../buttons/ButtonEditorList';
import { EmojiPicker } from '../common/EmojiPicker';
import { MediaSampleDropdown } from '../common/MediaSampleDropdown';
import {
  CATEGORY_ICONS,
  RECENT_EMOJIS_STORAGE_KEY,
  loadRecentEmojis,
} from './templateWizardUtils';

interface TemplateContentStepProps {
  form: TemplateFormData;
  setForm: Dispatch<SetStateAction<TemplateFormData>>;
  updateField: <K extends keyof TemplateFormData>(key: K, value: TemplateFormData[K]) => void;
  bodyVariables: string[];
  headerVariables: string[];
  bodyValidationErrors: string[];
  hasDuplicateButtonText: boolean;
  isDuplicateButtonText: (text: string) => boolean;
  setButtons: Dispatch<SetStateAction<EditableButton[]>>;
  isUploadingMedia: boolean;
  mediaAccept: string;
  mediaError: string | null;
  uploadMedia: (file?: File) => Promise<void>;
  onHeaderFormatChange: (format: WhatsAppTemplateHeaderFormat) => void;
  onHeaderExampleChange: (index: number, value: string) => void;
  onBodyExampleChange: (index: number, value: string) => void;
}

export function TemplateContentStep({
  form,
  setForm,
  updateField,
  bodyVariables,
  headerVariables,
  bodyValidationErrors,
  hasDuplicateButtonText,
  isDuplicateButtonText,
  setButtons,
  isUploadingMedia,
  mediaAccept,
  mediaError,
  uploadMedia,
  onHeaderFormatChange,
  onHeaderExampleChange,
  onBodyExampleChange,
}: TemplateContentStepProps) {
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [headerTooltipPosition, setHeaderTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  const [recentEmojis, setRecentEmojis] = useState<string[]>(loadRecentEmojis);

  const headerInputRef = useRef<HTMLInputElement>(null);
  const bodyInputRef = useRef<HTMLTextAreaElement>(null);
  const emojiPickerRef = useRef<HTMLSpanElement>(null);

  const closeEmojiPicker = useCallback(() => setIsEmojiPickerOpen(false), []);
  useClickOutside(emojiPickerRef, closeEmojiPicker, {
    enabled: isEmojiPickerOpen,
    onEscape: closeEmojiPicker,
  });

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

  const mediaHeaderSelected = ['IMAGE', 'VIDEO', 'DOCUMENT', 'LOCATION'].includes(form.headerFormat);

  return (
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
            <label className={labelClass}>Tên template</label>
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
            <label className={labelClass}>Chọn ngôn ngữ</label>
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
              onChange={onHeaderFormatChange}
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
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
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
                <span className="group relative inline-flex">
                  <button
                    type="button"
                    aria-label="Hướng dẫn thêm biến vào nội dung"
                    aria-describedby="body-variable-tooltip"
                    className="rounded-full text-slate-400 hover:text-indigo-600"
                  >
                    <Info aria-hidden="true" className="h-3.5 w-3.5" />
                  </button>
                  <span
                    id="body-variable-tooltip"
                    role="tooltip"
                    className="pointer-events-none absolute right-0 bottom-full z-30 mb-2 w-80 max-w-[calc(100vw-3rem)] rounded-xl border border-slate-200 bg-white p-3 text-xs leading-5 text-slate-900 opacity-0 shadow-xl transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                  >
                    Thêm biến để dữ liệu tương ứng được thay thế khi gửi tin nhắn.
                  </span>
                </span>
              </div>
            </div>

            {form.headerExamples.length > 0 || form.bodyExamples.length > 0 ? (
              <VariableSamples
                headerExamples={form.headerExamples}
                bodyExamples={form.bodyExamples}
                onHeaderChange={onHeaderExampleChange}
                onBodyChange={onBodyExampleChange}
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
  );
}
