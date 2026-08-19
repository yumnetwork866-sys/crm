import type { CentralMessage, Customer } from '../../types';

export type ActiveMessageFilter = 'all' | 'unread' | 'vip' | 'repeat' | 'new';

export interface BusinessPhoneNumber {
  id: string;
  verifiedName: string;
  displayPhoneNumber: string;
  qualityRating?: string;
}

export type ConversationStatus = 'consulting' | 'ordered' | 'callback' | 'completed';

export interface InternalNote {
  id: string;
  author: string;
  content: string;
  timestamp: string;
}

export interface MessageThread {
  threadId: string;
  customer: Customer | null;
  customerName: string;
  customerPhone: string;
  lastMessage: CentralMessage;
  unreadCount: number;
  messages: CentralMessage[];
  isPinned: boolean;
}

export interface MessageDateGroup {
  dateLabel: string;
  msgs: CentralMessage[];
}
