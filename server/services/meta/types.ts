export interface IntegrationSettingData {
  id: string;
  whatsappVerifyToken: string;
  whatsappPhoneNumberId?: string | null;
  whatsappWabaId?: string | null;
  metaBusinessId?: string | null;
  whatsappAccessTokenEncrypted?: string | null;
  whatsappRegistrationPinEncrypted?: string | null;
  whatsappTokenExpiresAt?: Date | null;
  whatsappAppId?: string | null;
  metaCatalogId?: string | null;
  difyAiEnabled?: boolean;
  aiAvatarUrl?: string | null;
  aiName?: string | null;
  status: string;
  lastConnectedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface MetaTemplateDispatchResult {
  isRealSent: boolean;
  messageId?: string;
  errorCode?: string;
  errorMessage?: string;
  retryable: boolean;
  metaResult: any;
}

export interface WhatsAppApprovedTemplate {
  id?: string;
  name: string;
  language: string;
  category: string;
  status: string;
  parameter_format?: string;
  rejected_reason?: string;
  quality_score?: { score?: string; date?: number };
  components: Array<{
    type: string;
    text?: string;
    format?: string;
    buttons?: any[];
    example?: any;
  }>;
}

export interface TemplateAnalyticsDataPoint {
  start: number;
  end: number;
  sent: number;
  delivered: number;
  read: number;
  clicked: number;
}

export interface TemplateAnalyticsSummary {
  templateId: string;
  sent: number;
  delivered: number;
  read: number;
  clicked: number;
  dataPoints: TemplateAnalyticsDataPoint[];
}

export interface WhatsAppFlow {
  id: string;
  name: string;
  status: string;
  categories?: string[];
}

export interface SurveyFlowScreenInput {
  title: string;
  heading: string;
  description: string;
  options: string[];
}

export interface CreateSurveyFlowOptions {
  wabaId: string;
  token: string;
  name: string;
  screens: [SurveyFlowScreenInput, SurveyFlowScreenInput, SurveyFlowScreenInput];
}

export interface CreateSurveyFlowResult {
  id: string;
  name: string;
  status: 'DRAFT';
}

export interface MessageTemplateExample {
  name?: string;
  value: string;
}

export interface MessageTemplateButton {
  type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER' | 'VOICE_CALL' | 'FLOW' | 'COPY_CODE' | 'CONTACT';
  text: string;
  url?: string;
  urlExample?: string;
  flowId?: string;
  navigateScreen?: string;
  phoneNumber?: string;
  activeForDays?: number;
}

export interface AuthenticationTemplateConfig {
  addSecurityRecommendation?: boolean;
  codeExpirationMinutes?: number;
  otpType: 'COPY_CODE' | 'ONE_TAP' | 'ZERO_TAP';
  button: {
    text?: string;
    autofill?: string;
    package?: string;
    signature?: string;
    zeroTapTermsAccepted?: boolean;
  };
}

export interface CreateMessageTemplateOptions {
  wabaId: string;
  token: string;
  name: string;
  language: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  parameterFormat?: 'POSITIONAL' | 'NAMED';
  allowCategoryChange?: boolean;
  header?: {
    format: 'NONE' | 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'LOCATION';
    text?: string;
    examples: MessageTemplateExample[];
    mediaHandle?: string;
  };
  body?: string;
  bodyExamples: MessageTemplateExample[];
  footer?: string;
  buttons: MessageTemplateButton[];
  authentication?: AuthenticationTemplateConfig;
}

/**
 * Helper to test if image URL is supported by Meta Cloud API
 */
export function isSupportedMetaImage(url: string): boolean {
  if (!url) return false;
  if (url.includes('.svg') || url.includes('/svg') || url.includes('image/svg')) return false;
  return Boolean(url.match(/\.(png|jpg|jpeg|webp)(\?.*)?$/i));
}

export function getMetaApiError(result: any, fallback: string): string {
  const validationErrors = Array.isArray(result?.validation_errors)
    ? result.validation_errors
      .map((error: any) => error?.error || error?.message)
      .filter(Boolean)
      .join('; ')
    : '';
  return result?.error?.error_user_msg
    || result?.error?.message
    || validationErrors
    || fallback;
}
