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
  email?: string;
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
  objective: string;
  defaultTemplate: string;
  iconName: string;
}

export interface BroadcastCampaign {
  id: string;
  name: string;
  targetGroup: string;
  targetProduct?: string;
  targetCountry?: string;
  category: 'Khuyến mại' | 'Flash Sale' | 'Voucher' | 'Sản phẩm mới' | 'Thông báo';
  messageTemplate: string;
  createdAt: string;
  status: 'Draft' | 'Sending' | 'Completed';
  stats: {
    totalTargeted: number;
    optedInCount: number;
    sentCount: number;
    deliveredCount: number;
    readCount: number;
    respondedCount: number;
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

