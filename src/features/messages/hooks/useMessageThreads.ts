import { useMemo } from 'react';
import type { CentralMessage, Customer } from '../../../types';
import { formatDate, isMetaUserIdentifier, isSamePhoneNumber, normalizePhone } from '../../../utils/crmUtils';
import type {
  ActiveMessageFilter,
  ConversationSummary,
  MessageDateGroup,
  MessageThread,
} from '../types';

interface UseMessageThreadsOptions {
  messages: CentralMessage[];
  conversations?: ConversationSummary[];
  customers: Customer[];
  pinnedThreadIds: string[];
  activeFilter: ActiveMessageFilter;
  searchQuery: string;
  selectedCustomerId?: string | null;
  chatSearchQuery: string;
}

const getPhoneLookupKeys = (phone?: string | null) => {
  const normalized = normalizePhone(phone);
  if (!normalized) return [];
  if (isMetaUserIdentifier(phone)) return [normalized];
  return [normalized, normalized.slice(-8), normalized.slice(-7)]
    .filter((key, index, keys) => key.length >= 7 && keys.indexOf(key) === index);
};

const buildCustomerLookup = (customers: Customer[]) => {
  const byId = new Map<string, Customer>();
  const byPhone = new Map<string, Customer>();

  customers.forEach((customer) => {
    byId.set(customer.id, customer);
    getPhoneLookupKeys(customer.phone).forEach((phoneKey) => {
      if (!byPhone.has(phoneKey)) byPhone.set(phoneKey, customer);
    });
  });

  return { byId, byPhone };
};

export function buildMessageThreads({
  messages,
  conversations = [],
  customers,
  pinnedThreadIds,
  customerLookup = buildCustomerLookup(customers),
}: {
  messages: CentralMessage[];
  conversations?: ConversationSummary[];
  customers: Customer[];
  pinnedThreadIds: string[];
  customerLookup?: ReturnType<typeof buildCustomerLookup>;
}): MessageThread[] {
  const map = new Map<string, MessageThread>();
  const threadsFromConversations = new Set<string>();

  const resolveCustomerAndKey = (rawCustomerId?: string | null, rawCustomerPhone?: string | null) => {
    const rawPhone =
      rawCustomerPhone ||
      (rawCustomerId?.startsWith('cust_') ? rawCustomerId.replace('cust_', '') : '') ||
      (rawCustomerId?.startsWith('phone_') ? rawCustomerId.replace('phone_', '') : '');
    const isUserIdentifier = isMetaUserIdentifier(rawPhone);
    const cleanPhone = isUserIdentifier ? '' : rawPhone.replace(/\D/g, '');
    const phoneKey = isUserIdentifier
      ? `meta:${rawPhone.toLowerCase()}`
      : cleanPhone.length >= 7 ? cleanPhone.slice(-9) : (rawCustomerId || 'unknown');
    const customerByPhone = getPhoneLookupKeys(rawPhone || rawCustomerId)
      .map((key) => customerLookup.byPhone.get(key))
      .find(Boolean);
    const customer =
      (rawCustomerId ? customerLookup.byId.get(rawCustomerId) : undefined) ||
      customerByPhone ||
      null;
    const threadKey = customer?.id || phoneKey;
    return { customer, cleanPhone, threadKey };
  };

  // 1. Seed all conversation threads from GET /api/meta/messages/conversations
  conversations.forEach((conv) => {
    if (!conv.lastMessage) return;
    const { customer, cleanPhone, threadKey } = resolveCustomerAndKey(
      conv.customerId || conv.lastMessage.customerId,
      conv.customerPhone || conv.lastMessage.customerPhone
    );
    threadsFromConversations.add(threadKey);
    const existing = map.get(threadKey);

    if (!existing) {
      map.set(threadKey, {
        threadId: threadKey,
        customer,
        customerName:
          customer?.name || conv.customerName || conv.lastMessage.customerName || 'Khách Hàng',
        customerPhone:
          conv.customerPhone ||
          customer?.phone ||
          conv.lastMessage.customerPhone ||
          (cleanPhone ? `+${cleanPhone}` : ''),
        lastMessage: conv.lastMessage,
        lastCustomerMessageAt:
          conv.lastCustomerMessageAt ||
          (conv.lastMessage.sender === 'customer' ? conv.lastMessage.timestamp : null),
        unreadCount: conv.unreadCount,
        messages: [conv.lastMessage],
        isPinned: pinnedThreadIds.includes(threadKey),
      });
      return;
    }

    if (
      new Date(conv.lastMessage.timestamp).getTime() >
      new Date(existing.lastMessage.timestamp).getTime()
    ) {
      existing.lastMessage = conv.lastMessage;
    }
    if (!existing.messages.some((m) => m.id === conv.lastMessage.id)) {
      existing.messages.push(conv.lastMessage);
    }
    existing.unreadCount += conv.unreadCount;
    if (customer && !existing.customer) existing.customer = customer;
    if (!existing.customerPhone && (conv.customerPhone || customer?.phone)) {
      existing.customerPhone = conv.customerPhone || customer?.phone || '';
    }
    if (
      conv.lastCustomerMessageAt &&
      (!existing.lastCustomerMessageAt ||
        new Date(conv.lastCustomerMessageAt).getTime() >
          new Date(existing.lastCustomerMessageAt).getTime())
    ) {
      existing.lastCustomerMessageAt = conv.lastCustomerMessageAt;
    }
  });

  // 2. Attach loaded per-thread messages from GET /api/meta/messages?paginate=true&limit=30&customerId=...
  messages.forEach((message) => {
    const { customer, cleanPhone, threadKey } = resolveCustomerAndKey(
      message.customerId,
      message.customerPhone
    );
    const existing = map.get(threadKey);

    if (!existing) {
      map.set(threadKey, {
        threadId: threadKey,
        customer,
        customerName: customer?.name || message.customerName || 'Khách Hàng',
        customerPhone:
          message.customerPhone || customer?.phone || (cleanPhone ? `+${cleanPhone}` : ''),
        lastMessage: message,
        lastCustomerMessageAt: message.sender === 'customer' ? message.timestamp : null,
        unreadCount: !message.isRead && message.sender === 'customer' ? 1 : 0,
        messages: [message],
        isPinned: pinnedThreadIds.includes(threadKey),
      });
      return;
    }

    const existingMsgIdx = existing.messages.findIndex((m) => m.id === message.id);
    if (existingMsgIdx >= 0) {
      existing.messages[existingMsgIdx] = message;
    } else {
      existing.messages.push(message);
    }

    if (
      new Date(message.timestamp).getTime() >=
      new Date(existing.lastMessage.timestamp).getTime()
    ) {
      existing.lastMessage = message;
    }
    if (
      message.sender === 'customer' &&
      (!existing.lastCustomerMessageAt ||
        new Date(message.timestamp).getTime() >
          new Date(existing.lastCustomerMessageAt).getTime())
    ) {
      existing.lastCustomerMessageAt = message.timestamp;
    }
    if (customer) existing.customer = customer;
    if (!existing.customerPhone && (message.customerPhone || customer?.phone)) {
      existing.customerPhone = message.customerPhone || customer?.phone || '';
    }
    if (
      customer &&
      (!existing.customerName || existing.customerName === 'Khách Hàng') &&
      customer.name
    ) {
      existing.customerName = customer.name;
    }
    if (
      !threadsFromConversations.has(threadKey) &&
      !message.isRead &&
      message.sender === 'customer'
    ) {
      existing.unreadCount += 1;
    }
  });

  map.forEach((thread) => {
    if (thread.messages.length > 1) {
      thread.messages.sort(
        (first, second) =>
          new Date(first.timestamp).getTime() - new Date(second.timestamp).getTime()
      );
      thread.lastMessage = thread.messages[thread.messages.length - 1] || thread.lastMessage;
    }
  });

  return Array.from(map.values()).sort((first, second) => {
    if (first.isPinned !== second.isPinned) return first.isPinned ? -1 : 1;
    return (
      new Date(second.lastMessage.timestamp).getTime() -
      new Date(first.lastMessage.timestamp).getTime()
    );
  });
}

export function useMessageThreads({
  messages,
  conversations = [],
  customers,
  pinnedThreadIds,
  activeFilter,
  searchQuery,
  selectedCustomerId,
  chatSearchQuery,
}: UseMessageThreadsOptions) {
  const customerLookup = useMemo(() => buildCustomerLookup(customers), [customers]);

  const threads = useMemo<MessageThread[]>(
    () =>
      buildMessageThreads({
        messages,
        conversations,
        customers,
        pinnedThreadIds,
        customerLookup,
      }),
    [conversations, customerLookup, customers, messages, pinnedThreadIds]
  );

  const filteredThreads = useMemo(() => threads.filter((thread) => {
    if (activeFilter === 'unread' && thread.unreadCount === 0) return false;
    if (activeFilter === 'vip' && (!thread.customer || thread.customer.totalOrders < 2)) return false;
    if (activeFilter === 'repeat' && (!thread.customer || thread.customer.totalOrders !== 1)) return false;
    if (activeFilter === 'new' && thread.customer && thread.customer.totalOrders > 0) return false;
    if (!searchQuery.trim()) return true;

    const query = searchQuery.toLowerCase();
    return thread.customerName.toLowerCase().includes(query)
      || thread.customerPhone.includes(query)
      || thread.lastMessage.content.toLowerCase().includes(query)
      || thread.messages.some((message) => message.content.toLowerCase().includes(query));
  }), [activeFilter, searchQuery, threads]);

  const activeThread = useMemo(() => {
    if (!threads.length) return null;
    if (!selectedCustomerId) return filteredThreads[0] || threads[0];
    return threads.find((thread) =>
      thread.threadId === selectedCustomerId
      || thread.customer?.id === selectedCustomerId
      || thread.lastMessage.customerId === selectedCustomerId
      || isSamePhoneNumber(thread.customerPhone, selectedCustomerId)
    ) || filteredThreads[0] || threads[0] || null;
  }, [filteredThreads, selectedCustomerId, threads]);

  const displayedActiveMessages = useMemo(() => {
    if (!activeThread) return [];
    if (!chatSearchQuery.trim()) return activeThread.messages;
    const query = chatSearchQuery.toLowerCase();
    return activeThread.messages.filter((message) => message.content.toLowerCase().includes(query));
  }, [activeThread, chatSearchQuery]);

  const groupedMessagesByDate = useMemo<MessageDateGroup[]>(() => {
    const groups: MessageDateGroup[] = [];
    displayedActiveMessages.forEach((message) => {
      const messageDate = new Date(message.timestamp);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      let dateLabel = formatDate(messageDate);
      if (messageDate.toDateString() === today.toDateString()) dateLabel = 'Hôm nay';
      else if (messageDate.toDateString() === yesterday.toDateString()) dateLabel = 'Hôm qua';

      const lastGroup = groups[groups.length - 1];
      if (lastGroup?.dateLabel === dateLabel) lastGroup.msgs.push(message);
      else groups.push({ dateLabel, msgs: [message] });
    });
    return groups;
  }, [displayedActiveMessages]);

  return { threads, filteredThreads, activeThread, groupedMessagesByDate };
}
