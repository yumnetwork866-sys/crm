import type { CentralMessage, Customer } from '../../types';

export type ActiveMessageFilter = 'all' | 'unread' | 'vip' | 'repeat' | 'new';

export interface BusinessPhoneNumber {
  id: string;
  wabaId?: string;
  verifiedName: string;
  displayPhoneNumber: string;
  profilePictureUrl?: string;
  qualityRating?: string;
  unreadCount?: number;
}

export type ConversationStatus = 'consulting' | 'ordered' | 'callback' | 'completed';

export interface InternalNote {
  id: string;
  author: string;
  content: string;
  timestamp: string;
}

export interface ConversationSummary {
  customerId: string;
  customerName: string;
  customerPhone: string;
  recipientId?: string;
  unreadCount: number;
  lastCustomerMessageAt?: string | null;
  lastMessage: CentralMessage;
}

export interface ConversationListResponse {
  data: ConversationSummary[];
  page?: number;
  limit?: number;
  count?: number;
}

export interface MessageThread {
  threadId: string;
  customer: Customer | null;
  customerName: string;
  customerPhone: string;
  lastMessage: CentralMessage;
  lastCustomerMessageAt?: string | null;
  unreadCount: number;
  messages: CentralMessage[];
  isPinned: boolean;
}

export interface MessageDateGroup {
  dateLabel: string;
  msgs: CentralMessage[];
}

export interface QuickTemplate {
  id: string;
  code: string;
  title: string;
  content: string;
}
