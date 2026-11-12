import type { InfiniteData } from '@tanstack/react-query';
import type { ConversationListResponse, ConversationSummary } from '../types';
import { isMetaUserIdentifier } from '../../../utils/crmUtils';

export type ConversationPages = InfiniteData<ConversationListResponse, string | null>;

// Match the backend grouping: business phone + CRM customer, phone suffix, or Meta identifier.
export function conversationKey(conversation: ConversationSummary): string {
  const { customerId, customerPhone, lastMessage } = conversation;
  const digits = customerPhone.replace(/\D/g, '');
  const recipient = lastMessage.recipientId || conversation.recipientId || '';
  const threadId = customerId && !/^(cust_|phone_|meta_)/.test(customerId)
    ? customerId
    : !isMetaUserIdentifier(customerPhone) && digits.length >= 7
      ? digits.slice(-9)
      : isMetaUserIdentifier(recipient)
        ? recipient.toLowerCase()
        : isMetaUserIdentifier(customerPhone) ? customerPhone.toLowerCase() : customerId || lastMessage.id;
  return JSON.stringify([lastMessage.businessPhoneNumberId || '', threadId]);
}

export function flattenConversations(data?: ConversationPages): ConversationSummary[] {
  const byKey = new Map<string, ConversationSummary>();
  data?.pages.forEach((page) => page.data.forEach((conversation) => {
    const key = conversationKey(conversation);
    const previous = byKey.get(key);
    if (!previous || new Date(conversation.lastMessage.timestamp).getTime() > new Date(previous.lastMessage.timestamp).getTime()) {
      byKey.set(key, conversation);
    }
  }));
  return Array.from(byKey.values()).sort((a, b) =>
    new Date(b.lastMessage.timestamp).getTime() - new Date(a.lastMessage.timestamp).getTime()
      || b.lastMessage.id.localeCompare(a.lastMessage.id),
  );
}

export function updateConversationPages(
  data: ConversationPages,
  update: (conversations: ConversationSummary[]) => ConversationSummary[],
): ConversationPages {
  const remaining = new Map(update(flattenConversations(data)).map((conversation) => [conversationKey(conversation), conversation]));
  const pages = data.pages.map((page) => ({
    ...page,
    data: page.data.flatMap((conversation) => {
      const key = conversationKey(conversation);
      const next = remaining.get(key);
      if (!next) return [];
      remaining.delete(key);
      return [next];
    }),
  }));
  // Keep each server cursor intact while inserting new realtime/optimistic threads at the front.
  if (pages[0]) pages[0] = { ...pages[0], data: [...remaining.values(), ...pages[0].data] };
  return { ...data, pages };
}
