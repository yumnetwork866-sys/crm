import type { WhatsAppTemplateButtonType, WhatsAppTemplateCategory } from '../../../../types';
import type { TemplateType } from '../types';

export const MARKETING_SETUP_PREVIEW_IMAGES: Record<TemplateType, string> = {
  DEFAULT: '/images/template-types/default.webp',
  CATALOGUE: '/images/template-types/catalogue.gif',
  FLOWS: '/images/template-types/flows.gif',
  CALLING_PERMISSION: '/images/template-types/calling.gif',
};

export const UTILITY_SETUP_PREVIEW_IMAGES: Record<Exclude<TemplateType, 'CATALOGUE'>, string> = {
  DEFAULT: '/images/template-types/default_utility.webp',
  FLOWS: '/images/template-types/flow_utility.gif',
  CALLING_PERMISSION: '/images/template-types/calling_utility.gif',
};

export const ALL_SETUP_PREVIEW_IMAGES = [
  '/images/template-types/default.webp',
  '/images/template-types/catalogue.gif',
  '/images/template-types/flows.gif',
  '/images/template-types/calling.gif',
  '/images/template-types/default_utility.webp',
  '/images/template-types/flow_utility.gif',
  '/images/template-types/calling_utility.gif',
  '/images/template-types/otp.webp',
];

export const STATUS_CLASSES: Record<string, string> = {
  APPROVED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  PENDING: 'border-amber-200 bg-amber-50 text-amber-700',
  REJECTED: 'border-rose-200 bg-rose-50 text-rose-700',
  PAUSED: 'border-orange-200 bg-orange-50 text-orange-700',
  DISABLED: 'border-slate-300 bg-slate-100 text-slate-700',
};

export const inputClass =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100';

export const labelClass = 'mb-1 block text-xs font-semibold text-slate-700';

export const sectionClass = 'space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm';

export const DEFAULT_BUTTON_TEXT: Record<WhatsAppTemplateButtonType, string> = {
  QUICK_REPLY: 'Quick Reply',
  URL: 'Visit website',
  VOICE_CALL: 'Call on WhatsApp',
  PHONE_NUMBER: 'Call Phone Number',
  FLOW: 'View Flow',
  COPY_CODE: 'Copy offer code',
  CONTACT: 'Share contact info',
};

export const BUTTON_LABELS: Record<WhatsAppTemplateButtonType, string> = {
  QUICK_REPLY: 'Custom',
  URL: 'Visit website',
  VOICE_CALL: 'Call on WhatsApp',
  PHONE_NUMBER: 'Call Phone Number',
  FLOW: 'View Flow',
  COPY_CODE: 'Copy offer code',
  CONTACT: 'Share contact info',
};

export const CATEGORY_DESCRIPTIONS: Record<WhatsAppTemplateCategory, string> = {
  MARKETING: 'Gửi ưu đãi, thông báo sản phẩm và nội dung giúp tăng nhận diện hoặc tương tác.',
  UTILITY: 'Theo dõi giao dịch, tài khoản, đơn hàng hoặc một yêu cầu cụ thể của khách hàng.',
  AUTHENTICATION: 'Gửi mã xác thực một lần (OTP) để đăng nhập hoặc xác minh tài khoản.',
};

export const CATEGORY_PREVIEW_GUIDANCE: Record<
  WhatsAppTemplateCategory,
  { suitableFor: string; customizable: string }
> = {
  MARKETING: {
    suitableFor: 'Ưu đãi, ra mắt sản phẩm, nhắc giỏ hàng và các chiến dịch tăng tương tác.',
    customizable: 'Header, nội dung, footer, biến cá nhân hóa, media và các button hành động.',
  },
  UTILITY: {
    suitableFor: 'Cập nhật đơn hàng, giao dịch, tài khoản hoặc yêu cầu mà khách hàng đã thực hiện.',
    customizable: 'Header, nội dung giao dịch, footer, biến dữ liệu và button hỗ trợ hoặc tra cứu.',
  },
  AUTHENTICATION: {
    suitableFor: 'Đăng nhập, xác minh danh tính và các luồng cần mã OTP dùng một lần.',
    customizable:
      'Thời gian hết hạn, khuyến nghị bảo mật và cách người dùng nhập hoặc sao chép OTP.',
  },
};

export const MEDIA_SAMPLE_OPTIONS = [
  { value: 'NONE', label: 'None' },
  { value: 'IMAGE', label: 'Image' },
  { value: 'VIDEO', label: 'Video' },
  { value: 'DOCUMENT', label: 'Document' },
  { value: 'LOCATION', label: 'Location' },
] as const;

export const TEMPLATE_BUTTON_ICON_CLASSES: Record<WhatsAppTemplateButtonType, string> = {
  QUICK_REPLY: 'fa-solid fa-reply',
  URL: 'fa-solid fa-arrow-up-right-from-square',
  VOICE_CALL: 'fa-brands fa-whatsapp',
  PHONE_NUMBER: 'fa-solid fa-phone',
  FLOW: 'fa-regular fa-clipboard',
  COPY_CODE: 'fa-solid fa-copy',
  CONTACT: 'fa-solid fa-user',
};

export const BUTTON_ICON_OPTIONS = [
  { value: 'fa-regular fa-clipboard', label: 'Default', iconClass: 'fa-regular fa-clipboard' },
  { value: 'fa-regular fa-file-lines', label: 'Document', iconClass: 'fa-regular fa-file-lines' },
  { value: 'fa-solid fa-tag', label: 'Promotion', iconClass: 'fa-solid fa-tag' },
  { value: 'fa-regular fa-thumbs-up', label: 'Review', iconClass: 'fa-regular fa-thumbs-up' },
] as const;

const metaBusinessId = import.meta.env.VITE_META_BUSINESS_ID?.trim();
const whatsappWabaId = import.meta.env.VITE_WHATSAPP_WABA_ID?.trim();

export const WHATSAPP_MANAGER_URL =
  metaBusinessId && whatsappWabaId
    ? `https://business.facebook.com/latest/whatsapp_manager/phone_numbers/?business_id=${encodeURIComponent(metaBusinessId)}&tab=phone-numbers&nav_ref=whatsapp_manager&asset_id=${encodeURIComponent(whatsappWabaId)}`
    : 'https://business.facebook.com/latest/whatsapp_manager/phone_numbers/';

export const WHATSAPP_INSIGHTS_URL =
  metaBusinessId && whatsappWabaId
    ? `https://business.facebook.com/latest/whatsapp_manager/insights/?business_id=${encodeURIComponent(metaBusinessId)}&tab=insights&nav_ref=whatsapp_manager&asset_id=${encodeURIComponent(whatsappWabaId)}`
    : 'https://business.facebook.com/latest/whatsapp_manager/insights/?tab=insights&nav_ref=whatsapp_manager';

export const WHATSAPP_CALLING_DOCS_URL =
  'https://developers.facebook.com/docs/whatsapp/cloud-api/calling';

export const WHATSAPP_FLOWS_URL =
  'https://business.facebook.com/latest/whatsapp_manager/flows/';
