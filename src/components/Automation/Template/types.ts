import type {
  CreateWhatsAppTemplateInput,
  WhatsAppApprovedTemplate,
  WhatsAppOtpType,
  WhatsAppTemplateButtonType,
  WhatsAppTemplateCategory,
  WhatsAppTemplateExample,
  WhatsAppTemplateHeaderFormat,
  WhatsAppTemplateParameterFormat,
} from '../../../types';

export interface TemplateManagementViewProps {
  templates: WhatsAppApprovedTemplate[];
  isLoading: boolean;
  error: Error | null;
  onRefetch: () => void;
  onCreateTemplate: (input: CreateWhatsAppTemplateInput) => Promise<unknown>;
  isCreatePending: boolean;
  createError: Error | null;
  onResetCreateError: () => void;
}

export type QuickReplyMode = 'CUSTOM' | 'PRE_CONFIGURED_RESPONSE';

export interface EditableButton {
  id: string;
  type: WhatsAppTemplateButtonType;
  quickReplyMode?: QuickReplyMode;
  text: string;
  urlType: 'STATIC' | 'DYNAMIC';
  url: string;
  urlExample: string;
  phoneCountryIso: string;
  phoneNumber: string;
  activeForDays: number;
}

export type WizardStep = 1 | 2 | 3;

export type TemplateType = 'DEFAULT' | 'CATALOGUE' | 'FLOWS' | 'CALLING_PERMISSION';

export interface TemplateFormData {
  templateType: TemplateType;
  name: string;
  language: string;
  category: WhatsAppTemplateCategory;
  parameterFormat: WhatsAppTemplateParameterFormat;
  allowCategoryChange: boolean;
  headerFormat: WhatsAppTemplateHeaderFormat;
  headerText: string;
  headerExamples: WhatsAppTemplateExample[];
  mediaHandle: string;
  mediaFileName: string;
  mediaPreviewUrl: string;
  body: string;
  bodyExamples: WhatsAppTemplateExample[];
  footer: string;
  buttons: EditableButton[];
  otpType: WhatsAppOtpType;
  otpButtonText: string;
  otpAutofillText: string;
  otpPackage: string;
  otpSignature: string;
  otpExpiration: number;
  addSecurityRecommendation: boolean;
  zeroTapTermsAccepted: boolean;
}
