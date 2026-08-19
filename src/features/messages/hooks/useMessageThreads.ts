import { useMemo } from 'react';
import type { CentralMessage, Customer } from '../../../types';
import { isSamePhoneNumber } from '../../../utils/crmUtils';
import type { ActiveMessageFilter, MessageDateGroup, MessageThread } from '../types';

interface UseMessageThreadsOptions {
  messages: CentralMessage[];
  customers: Customer[];
  pinnedThreadIds: string[];
  activeFilter: ActiveMessageFilter;
  searchQuery: string;
  selectedCustomerId?: string | null;
  chatSearchQuery: string;
}

export function useMessageThreads({
  messages,
  customers,
  pinnedThreadIds,
  activeFilter,
  searchQuery,
  selectedCustomerId,
  chatSearchQuery,
}: UseMessageThreadsOptions) {
  const threads = useMemo<MessageThread[]>(() => {
    const map = new Map<string, MessageThread>();

    messages.forEach((message) => {
      const rawPhone = message.customerPhone
        || (message.customerId?.startsWith('cust_') ? message.customerId.replace('cust_', '') : '');
      const cleanPhone = rawPhone.replace(/\D/g, '');
      const phoneKey = cleanPhone.length >= 7 ? cleanPhone.slice(-9) : (message.customerId || 'unknown');
      const customer = customers.find((item) =>
        (message.customerId && item.id === message.customerId)
        || isSamePhoneNumber(item.phone, rawPhone || message.customerId)
      ) || null;
      const threadKey = customer?.id || phoneKey;
      const existing = map.get(threadKey);

      if (!existing) {
        map.set(threadKey, {
          threadId: threadKey,
          customer,
          customerName: message.customerName || customer?.name || 'Khách Hàng',
          customerPhone: message.customerPhone || customer?.phone || (cleanPhone ? `+${cleanPhone}` : ''),
          lastMessage: message,
          unreadCount: !message.isRead && message.sender === 'customer' ? 1 : 0,
          messages: [message],
          isPinned: pinnedThreadIds.includes(threadKey),
        });
        return;
      }

      existing.messages.push(message);
      existing.lastMessage = message;
      if (customer && !existing.customer) existing.customer = customer;
      if (!existing.customerPhone && (message.customerPhone || customer?.phone)) {
        existing.customerPhone = message.customerPhone || customer?.phone || '';
      }
      if (customer && !existing.customerName && customer.name) existing.customerName = customer.name;
      if (!message.isRead && message.sender === 'customer') existing.unreadCount += 1;
    });

    return Array.from(map.values()).sort((first, second) => {
      if (first.isPinned !== second.isPinned) return first.isPinned ? -1 : 1;
      return new Date(second.lastMessage.timestamp).getTime() - new Date(first.lastMessage.timestamp).getTime();
    });
  }, [customers, messages, pinnedThreadIds]);

  const filteredThreads = useMemo(() => threads.filter((thread) => {
    if (activeFilter === 'unread' && thread.unreadCount === 0) return false;
    if (activeFilter === 'vip' && (!thread.customer || thread.customer.totalOrders < 2)) return false;
    if (activeFilter === 'repeat' && (!thread.customer || thread.customer.totalOrders !== 1)) return false;
    if (activeFilter === 'new' && thread.customer && thread.customer.totalOrders > 0) return false;
    if (!searchQuery.trim()) return true;

    const query = searchQuery.toLowerCase();
    return thread.customerName.toLowerCase().includes(query)
      || thread.customerPhone.includes(query)
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
      let dateLabel = messageDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
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
