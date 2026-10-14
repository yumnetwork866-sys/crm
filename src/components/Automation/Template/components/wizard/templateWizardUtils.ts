import { Bell, KeyRound, Megaphone } from 'lucide-react';
import type { CreateWhatsAppTemplateInput } from '../../../../../types';
import { readTemplateDraft } from '../../hooks/useTemplateForm';
import type { TemplateFormData, TemplateType, WizardStep } from '../../types';
import { toE164Phone } from '../../utils/templateFormatters';

export const RECENT_EMOJIS_STORAGE_KEY = 'yumcrm_recent_emojis';

export function loadDraftWizardStep(): WizardStep {
  const saved = readTemplateDraft();
  const step = saved?.wizardStep;
  return step === 1 || step === 2 || step === 3 ? step : 1;
}

export function loadRecentEmojis(): string[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(RECENT_EMOJIS_STORAGE_KEY) || '[]');
    return Array.isArray(saved)
      ? saved.filter((item): item is string => typeof item === 'string').slice(0, 8)
      : [];
  } catch {
    return [];
  }
}

export const CATEGORY_ICONS = {
  MARKETING: Megaphone,
  UTILITY: Bell,
  AUTHENTICATION: KeyRound,
} as const;

export const MARKETING_TEMPLATE_TYPES: Array<[TemplateType, string, string]> = [
  ['DEFAULT', 'Default', 'Tạo tin nhắn với header, body, footer và buttons.'],
  ['CATALOGUE', 'Catalogue', 'Hiển thị sản phẩm từ catalogue của doanh nghiệp.'],
  ['FLOWS', 'Flows', 'Mở một WhatsApp Flow từ tin nhắn.'],
  ['CALLING_PERMISSION', 'Calling permissions request', 'Yêu cầu khách hàng cấp quyền gọi.'],
];

export const UTILITY_TEMPLATE_TYPES: Array<[TemplateType, string, string]> = [
  ['DEFAULT', 'Default', 'Gửi tin nhắn về một đơn hàng hoặc tài khoản hiện có.'],
  ['FLOWS', 'Flows', 'Gửi biểu mẫu để thu thập phản hồi, gửi lời nhắc hoặc quản lý đơn hàng.'],
  ['CALLING_PERMISSION', 'Calling permissions request', 'Hỏi khách hàng xem bạn có thể gọi cho họ trên WhatsApp hay không.'],
];

export function buildCreateTemplateInput(form: TemplateFormData): CreateWhatsAppTemplateInput {
  if (form.category === 'AUTHENTICATION') {
    return {
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
  }

  return {
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
      flowId,
      navigateScreen,
      buttonIcon: _buttonIcon,
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
      ...(button.type === 'FLOW'
        ? { flowId: (flowId || '').trim(), ...((navigateScreen || '').trim() ? { navigateScreen: navigateScreen.trim() } : {}) }
        : {}),
    })),
  };
}
