export type CustomerStatus = 'New Lead' | 'Contacted' | 'Quoted' | 'Won' | 'Lost';

export type LeadSource = 'Facebook' | 'TikTok' | 'Google' | 'Website' | 'Zalo' | 'WhatsApp' | 'Referral' | 'Direct';

export type MessageChannel = 'WhatsApp';

export interface CentralMessage {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  sender: 'customer' | 'agent' | 'system';
  agentName?: string;
  channel: MessageChannel;
  content: string;
  timestamp: string;
  isRead: boolean;
  readBy?: string;
  readAt?: string;
  replyTo?: {
    id: string;
    senderName: string;
    content: string;
  };
}

export interface CustomerNote {
  id: string;
  author: string;
  content: string;
  createdAt: string;
  type?: 'note' | 'call' | 'whatsapp' | 'email' | 'system';
}

export type CustomerOrder = {
  id: string;
  orderCode: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  date: string;
  totalAmount: number; // in VND
  status: 'Completed' | 'Processing' | 'Cancelled';
  products: {
    productId?: string;
    productName: string;
    quantity: number;
    price: number;
  }[];
  notes?: string;
};

export interface Product {
  id: string;
  code: string;
  name: string;
  category: 'Mỹ Phẩm' | 'Thực Phẩm Chức Năng' | 'Thời Trang' | 'Gia Dụng' | 'Khác';
  price: number; // VND
  costPrice: number; // VND
  stock: number;
  status: 'In Stock' | 'Low Stock' | 'Out of Stock';
  sku?: string;
  description?: string;
  image?: string;
}

export type Gender = 'Nam' | 'Nữ' | 'Khác';

export interface Customer {
  id: string;
  // 1. Basic Info
  phone: string;
  name: string;
  gender: Gender;
  address: string;
  country?: string;
  email?: string;
  avatar?: string;
  note?: string; // Ghi chú / node thông tin khách hàng

  // Lead Source
  source: LeadSource;
  campaign: string;
  adSet?: string;
  landingPage?: string;
  firstContact: string; // ISO or YYYY-MM-DD
  lastContact: string;

  // Status & Assignment
  owner: string; // Sales rep name
  status: CustomerStatus;
  group?: CustomerGroupId; // Independent CRM segmentation group
  notes: CustomerNote[];

  // Orders Summary
  totalOrders: number;
  totalSpent: number; // VND
  lastPurchaseDate?: string;
  interestedProducts: string[];
  orders: CustomerOrder[];

  // WhatsApp Policy Compliance
  whatsappOptIn: boolean;
  whatsappOptInDate?: string;

  // Automation Tracking
  automationSequence?: {
    active: boolean;
    currentStep: number; // 0: None, 1: Day+3, 2: Day+5, 3: Day+7, 4: Day+15, 5: Completed
    startDate?: string;
    logs: {
      step: number;
      stepName: string;
      sentAt: string;
      message: string;
      status: 'Sent' | 'Delivered' | 'Read' | 'Failed';
    }[];
  };
}

export type CustomerGroupId = 'group_1' | 'group_2' | 'group_3' | 'group_4';

export interface CustomerGroupInfo {
  id: CustomerGroupId;
  name: string;
  description: string;
  badgeColor: string;
}

export interface AutomationStepConfig {
  stepNumber: number;
  dayOffset: number; // +3, +5, +7, +15
  title: string;
  defaultTemplate: string;
  iconName: string;
}

export interface AutomationStepItem {
  id: string;
  step: number;
  dayOffset: number;
  title: string;
  defaultMsg: string;
  iconName: string;
  color: string;
  active: boolean;
  templateName?: string;
}

export type WhatsAppTemplateCategory = 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';

export type BroadcastCampaignCategory =
  | WhatsAppTemplateCategory
  | 'Khuyến mại'
  | 'Flash Sale'
  | 'Voucher'
  | 'Sản phẩm mới'
  | 'Thông báo';

export type BroadcastCampaignStatus =
  | 'Draft'
  | 'Pending'
  | 'Sending'
  | 'Completed'
  | 'PartiallyFailed'
  | 'Failed'
  | 'Cancelled';

export interface WhatsAppTemplateAnalyticsPoint {
  start: number;
  end: number;
  sent: number;
  delivered: number;
  read: number;
  clicked: number;
}

export interface WhatsAppTemplateAnalytics {
  templateId: string;
  sent: number;
  delivered: number;
  read: number;
  clicked: number;
  dataPoints: WhatsAppTemplateAnalyticsPoint[];
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
  is_archived_locally?: boolean;
  components: Array<{
    type: string;
    text?: string;
    format?: string;
    buttons?: unknown[];
    example?: unknown;
  }>;
}

export type WhatsAppTemplateParameterFormat = 'POSITIONAL' | 'NAMED';
export type WhatsAppTemplateHeaderFormat = 'NONE' | 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'LOCATION';
export type WhatsAppTemplateButtonType =
  | 'QUICK_REPLY'
  | 'URL'
  | 'PHONE_NUMBER'
  | 'VOICE_CALL'
  | 'FLOW'
  | 'COPY_CODE'
  | 'CONTACT';
export type WhatsAppOtpType = 'COPY_CODE' | 'ONE_TAP' | 'ZERO_TAP';

export interface WhatsAppTemplateExample {
  name?: string;
  value: string;
}

export interface CreateWhatsAppTemplateInput {
  name: string;
  language: string;
  category: WhatsAppTemplateCategory;
  parameterFormat?: WhatsAppTemplateParameterFormat;
  allowCategoryChange?: boolean;
  header?: {
    format: WhatsAppTemplateHeaderFormat;
    text?: string;
    examples?: WhatsAppTemplateExample[];
    mediaHandle?: string;
  };
  body?: string;
  bodyExamples?: WhatsAppTemplateExample[];
  footer?: string;
  buttons?: Array<{
    type: WhatsAppTemplateButtonType;
    text: string;
    url?: string;
    urlExample?: string;
    flowId?: string;
    navigateScreen?: string;
    phoneNumber?: string;
    activeForDays?: number;
  }>;
  authentication?: {
    addSecurityRecommendation?: boolean;
    codeExpirationMinutes?: number;
    otpType: WhatsAppOtpType;
    button: {
      text?: string;
      autofill?: string;
      package?: string;
      signature?: string;
      zeroTapTermsAccepted?: boolean;
    };
  };
}

export interface LaunchCampaignInput {
  name: string;
  targetGroup: string;
  targetProduct?: string;
  targetGender?: 'Nam' | 'Nữ' | 'Khác';
  category: WhatsAppTemplateCategory;
  templateName: string;
  templateLanguage: string;
  templateParameterSources?: Array<'customer_name' | 'phone' | 'product' | 'voucher_code'>;
  messageTemplate: string;
  voucherCode?: string;
}

export interface BroadcastCampaign {
  id: string;
  name: string;
  targetGroup: string;
  targetProduct?: string;
  targetGender?: string;
  targetCountry?: string;
  category: BroadcastCampaignCategory;
  templateName?: string;
  templateLanguage?: string;
  messageTemplate: string;
  createdAt: string;
  status: BroadcastCampaignStatus;
  lastError?: string;
  stats: {
    totalTargeted: number;
    optedInCount: number;
    sentCount: number;
    deliveredCount: number;
    readCount: number;
    respondedCount: number;
    failedCount?: number;
  };
}

export interface MarketingCampaignReport {
  campaignName: string;
  source: LeadSource;
  leadsCount: number;
  adSpend: number; // VND
  revenue: number; // VND
  cpl: number; // Cost Per Lead
  roas: number; // Return on Ad Spend (revenue / adSpend)
}

export interface SalesRepPerformance {
  ownerName: string;
  assignedLeads: number;
  wonCustomers: number;
  conversionRate: number; // %
  totalRevenue: number;
}

export type UserRole = 'Admin' | 'Sales Manager' | 'Sales Rep' | 'Marketing Lead' | 'Customer Support';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  password?: string;
  avatar?: string;
  role: UserRole;
  phone?: string;
  department: string;
  status: 'active' | 'inactive';
  lastActive: string;
  assignedLeadsCount?: number;
  totalRevenue?: number;
}
