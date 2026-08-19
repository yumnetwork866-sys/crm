import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { InfiniteData } from '@tanstack/react-query';
import type { AppUser, CentralMessage, Customer, MessageChannel } from '../types';
import { api } from '../utils/apiClient';
import { playNotificationSound } from '../utils/audioUtils';
import { isSamePhoneNumber } from '../utils/crmUtils';
import { queryKeys } from '../lib/queryClient';

interface MessagePage {
  messages: CentralMessage[];
  nextCursor: string | null;
  hasMore: boolean;
  limit: number;
  direction: string;
}

const flattenMessagePages = (data?: InfiniteData<MessagePage, string | null>) => {
  const byId = new Map<string, CentralMessage>();
  data?.pages.forEach((page) => page.messages.forEach((message) => byId.set(message.id, message)));
  return Array.from(byId.values()).sort((first, second) =>
    new Date(first.timestamp).getTime() - new Date(second.timestamp).getTime()
  );
};

interface UseCentralMessagesOptions {
  customers: Customer[];
  setCustomers: Dispatch<SetStateAction<Customer[]>>;
  currentUser: AppUser | null;
}

export function useCentralMessages({
  customers,
  setCustomers,
  currentUser,
}: UseCentralMessagesOptions) {
  const queryClient = useQueryClient();
  const messagesQuery = useInfiniteQuery<
    MessagePage,
    Error,
    InfiniteData<MessagePage, string | null>,
    typeof queryKeys.centralMessages,
    string | null
  >({
    queryKey: queryKeys.centralMessages,
    queryFn: ({ pageParam }) => api.get<MessagePage>(
      `/meta/messages?paginate=true&limit=30${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''}`
    ),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.nextCursor : undefined,
    enabled: Boolean(currentUser),
  });
  const messages = useMemo(() => flattenMessagePages(messagesQuery.data), [messagesQuery.data]);

  useEffect(() => {
    // Remove the legacy full-message cache once. PostgreSQL + TanStack Query are now the source of truth.
    localStorage.removeItem('yumcrm_central_messages_v2');
  }, []);

  const setMessages: Dispatch<SetStateAction<CentralMessage[]>> = useCallback((update) => {
    queryClient.setQueryData<InfiniteData<MessagePage, string | null>>(queryKeys.centralMessages, (data) => {
      if (!data) return data;
      const current = flattenMessagePages(data);
      const next = typeof update === 'function' ? update(current) : update;
      const nextById = new Map(next.map((message) => [message.id, message]));
      const existingIds = new Set<string>();
      const pages = data.pages.map((page) => ({
        ...page,
        messages: page.messages
          .filter((message) => nextById.has(message.id))
          .map((message) => {
            existingIds.add(message.id);
            return nextById.get(message.id) ?? message;
          }),
      }));
      const added = next.filter((message) => !existingIds.has(message.id));
      if (pages[0] && added.length > 0) {
        pages[0] = {
          ...pages[0],
          messages: [...pages[0].messages, ...added].sort((first, second) =>
            new Date(first.timestamp).getTime() - new Date(second.timestamp).getTime()
          ),
        };
      }
      return { ...data, pages };
    });
  }, [queryClient]);
  const [toastNotification, setToastNotification] = useState<{
    message: CentralMessage;
    show: boolean;
  } | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  const selectedCustomerIdRef = useRef(selectedCustomerId);
  const customersRef = useRef(customers);
  const currentUserRef = useRef(currentUser);

  useEffect(() => {
    selectedCustomerIdRef.current = selectedCustomerId;
  }, [selectedCustomerId]);

  useEffect(() => {
    customersRef.current = customers;
  }, [customers]);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  const unreadCount = useMemo(
    () => messages.filter((message) => !message.isRead && message.sender === 'customer').length,
    [messages]
  );

  const readMutation = useMutation({
    mutationFn: (variables: { customerId: string; customerPhone: string; messageIds?: string[]; readBy: string }) =>
      api.post('/meta/messages/read', variables),
  });

  const selectCustomerThread = useCallback((
    targetId: string,
    explicitPhone?: string,
    messageIds?: string[]
  ) => {
    setSelectedCustomerId(targetId);
    const reader = currentUserRef.current?.name || 'Nguyễn Văn Ánh';
    const customer = customersRef.current.find(
      (item) => item.id === targetId || isSamePhoneNumber(item.phone, explicitPhone || targetId)
    );
    const phone = explicitPhone
      || customer?.phone
      || (targetId.startsWith('cust_')
        ? targetId.replace('cust_', '')
        : String(targetId).replace(/\D/g, '').length >= 7
          ? targetId
          : '');
    const readAt = new Date().toISOString();

    setMessages((previous) =>
      previous.map((message) => {
        const matches = (messageIds?.includes(message.id) ?? false)
          || message.customerId === targetId
          || (customer && message.customerId === customer.id)
          || Boolean(phone && isSamePhoneNumber(message.customerPhone, phone));
        return matches
          ? { ...message, isRead: true, readBy: message.readBy || reader, readAt: message.readAt || readAt }
          : message;
      })
    );

    readMutation.mutate({
      customerId: customer?.id || targetId,
      customerPhone: phone,
      messageIds,
      readBy: reader,
    });
  }, [readMutation, setMessages]);

  useEffect(() => {
    const knownMessageIds = new Set<string>();
    flattenMessagePages(
      queryClient.getQueryData<InfiniteData<MessagePage, string | null>>(queryKeys.centralMessages)
    )
      .forEach((message) => knownMessageIds.add(message.id));


    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/meta/messages/stream');
      eventSource.addEventListener('connected', (event: MessageEvent) => {
        console.log('⚡ [REALTIME SSE] Connected to server event stream:', event.data);
      });
      eventSource.addEventListener('message:new', (event: MessageEvent) => {
        try {
          const newMessage: CentralMessage = JSON.parse(event.data);
          if (!newMessage?.id) return;
          const wasKnown = knownMessageIds.has(newMessage.id);
          knownMessageIds.add(newMessage.id);

          setMessages((previous) => {
            const selected = selectedCustomerIdRef.current;
            const isSelected = Boolean(
              selected
              && (newMessage.customerId === selected
                || isSamePhoneNumber(newMessage.customerPhone, selected))
            );
            const enrichedMessage: CentralMessage = {
              ...newMessage,
              isRead: isSelected || Boolean(newMessage.isRead),
              readBy: newMessage.readBy
                || (isSelected ? currentUserRef.current?.name || 'Nhân viên' : undefined),
              readAt: newMessage.readAt || (isSelected ? new Date().toISOString() : undefined),
            };
            const withoutDuplicate = previous.filter(
              (message) => message.id !== enrichedMessage.id
                && !(message.id.startsWith('msg_') && message.content === enrichedMessage.content)
            );
            return [...withoutDuplicate, enrichedMessage].sort(
              (first, second) => new Date(first.timestamp).getTime() - new Date(second.timestamp).getTime()
            );
          });

          if (newMessage.sender === 'customer' && !wasKnown) {
            playNotificationSound();
            setToastNotification({ message: newMessage, show: true });
          }
        } catch (error) {
          console.error('[REALTIME SSE] Error processing message:new event:', error);
        }
      });
      eventSource.addEventListener('message:read', (event: MessageEvent) => {
        try {
          const { messageIds, customerId, customerPhone, readBy, readAt } = JSON.parse(event.data);
          setMessages((previous) =>
            previous.map((message) => {
              const matches = (Array.isArray(messageIds) && messageIds.includes(message.id))
                || (customerId && message.customerId === customerId)
                || (customerPhone && isSamePhoneNumber(message.customerPhone, customerPhone));
              return matches
                ? {
                    ...message,
                    isRead: true,
                    readBy: message.readBy || readBy || 'Nhân viên',
                    readAt: message.readAt || readAt || new Date().toISOString(),
                  }
                : message;
            })
          );
        } catch (error) {
          console.error('[REALTIME SSE] Error processing message:read event:', error);
        }
      });
      eventSource.addEventListener('message:thread_deleted', (event: MessageEvent) => {
        try {
          const { customerId, customerPhone } = JSON.parse(event.data);
          setMessages((previous) =>
            previous.filter(
              (message) => message.customerId !== customerId
                && !(customerPhone && isSamePhoneNumber(message.customerPhone, customerPhone))
            )
          );
        } catch {
          // Ignore malformed realtime events.
        }
      });
      eventSource.addEventListener('message:deleted', (event: MessageEvent) => {
        try {
          const { messageId } = JSON.parse(event.data);
          setMessages((previous) => previous.filter((message) => message.id !== messageId));
        } catch {
          // Ignore malformed realtime events.
        }
      });
      eventSource.addEventListener('message:cleared', () => setMessages([]));
      eventSource.addEventListener('customer:optin', (event: MessageEvent) => {
        try {
          const { customerId, whatsappOptIn } = JSON.parse(event.data);
          if (!customerId) return;
          setCustomers((previous) =>
            previous.map((customer) =>
              customer.id === customerId
                ? { ...customer, whatsappOptIn: Boolean(whatsappOptIn) }
                : customer
            )
          );
        } catch {
          // Ignore malformed realtime events.
        }
      });
      eventSource.onerror = (error) => {
        console.warn('[REALTIME SSE] EventSource disconnected, browser will auto-reconnect...', error);
      };
    } catch (error) {
      console.warn('[REALTIME SSE] Failed to initialize EventSource:', error);
    }

    return () => eventSource?.close();
  }, [queryClient, setCustomers, setMessages]);

  const sendMutation = useMutation({
    mutationFn: (variables: {
      customerId: string;
      customerName: string;
      customerPhone: string;
      content: string;
      agentName: string;
      phoneNumberId?: string;
      contextMessageId?: string;
      replyTo?: { id: string; senderName: string; content: string };
    }) => api.post<any>('/meta/messages/send', variables),
  });
  const threadDeleteMutation = useMutation({
    mutationFn: ({ customerId, phone }: { customerId: string; phone: string }) => {
      const cleanPhone = phone.replace(/\D/g, '');
      const query = cleanPhone ? `?customerPhone=${encodeURIComponent(cleanPhone)}` : '';
      return api.delete(`/meta/messages/thread/${encodeURIComponent(customerId)}${query}`);
    },
  });
  const messageDeleteMutation = useMutation({
    mutationFn: (messageId: string) => api.delete(`/meta/messages/item/${encodeURIComponent(messageId)}`),
  });

  const sendMessage = useCallback(async (
    customerId: string,
    content: string,
    channel: MessageChannel = 'WhatsApp',
    explicitPhone?: string,
    explicitName?: string,
    senderPhoneNumberId?: string,
    replyTo?: { id: string; senderName: string; content: string }
  ) => {
    const customer = customersRef.current.find(
      (item) => item.id === customerId || isSamePhoneNumber(item.phone, explicitPhone || customerId)
    );
    const agentName = currentUserRef.current?.name || 'Nguyễn Văn Ánh';
    const phone = explicitPhone
      || customer?.phone
      || (customerId.startsWith('cust_')
        ? customerId.replace('cust_', '')
        : customerId.replace(/\D/g, '').length >= 7
          ? customerId
          : '');
    const customerName = explicitName || customer?.name || (phone ? `Khách Hàng (${phone})` : 'Khách Hàng');
    const temporaryMessage: CentralMessage = {
      id: `msg_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      customerId: customer?.id || customerId,
      customerName,
      customerPhone: phone,
      sender: 'agent',
      agentName,
      channel,
      content,
      timestamp: new Date().toISOString(),
      isRead: true,
      replyTo,
    };

    setMessages((previous) => [...previous, temporaryMessage]);
    try {
      const response = await sendMutation.mutateAsync({
        customerId: customer?.id || customerId,
        customerName,
        customerPhone: phone,
        content,
        agentName,
        phoneNumberId: senderPhoneNumberId,
        contextMessageId: replyTo?.id,
        replyTo,
      });
      if (response?.message) {
        setMessages((previous) =>
          previous.map((message) =>
            message.id === temporaryMessage.id
              ? {
                  ...message,
                  id: response.message.id,
                  isRealSent: response.isRealSent,
                  replyTo: response.message.replyTo || message.replyTo,
                }
              : message
          )
        );
      }
    } catch {
      console.log('Real WhatsApp API offline fallback');
    }

    if (customer || phone) {
      setCustomers((previous) =>
        previous.map((item) => {
          const matches = item.id === customerId
            || (customer && item.id === customer.id)
            || isSamePhoneNumber(item.phone, phone);
          if (!matches) return item;
          return {
            ...item,
            lastContact: new Date().toISOString().split('T')[0],
            notes: [
              {
                id: `n_wa_${Date.now()}`,
                author: agentName,
                content: `[WhatsApp Gửi đi] ${content}`,
                createdAt: new Date().toLocaleString('vi-VN'),
                type: 'whatsapp' as const,
              },
              ...(item.notes || []),
            ],
          };
        })
      );
    }
  }, [sendMutation, setCustomers, setMessages]);

  const deleteThread = useCallback(async (customerId: string) => {
    if (currentUserRef.current?.role !== 'Admin') {
      alert('Chỉ tài khoản Admin mới có quyền xóa hội thoại!');
      return;
    }
    const threadMessages = messages.filter(
      (message) => message.customerId === customerId
        || isSamePhoneNumber(message.customerPhone, customerId)
    );
    const phone = threadMessages[0]?.customerPhone
      || customersRef.current.find((customer) => customer.id === customerId)?.phone
      || customerId;
    const previousMessages = queryClient.getQueryData<InfiniteData<MessagePage, string | null>>(
      queryKeys.centralMessages
    );
    setMessages((previous) =>
      previous.filter(
        (message) => message.customerId !== customerId
          && !isSamePhoneNumber(message.customerPhone, phone)
      )
    );
    try {
      await threadDeleteMutation.mutateAsync({ customerId, phone });
    } catch (error) {
      if (previousMessages) queryClient.setQueryData(queryKeys.centralMessages, previousMessages);
      console.error('Error deleting thread via API:', error);
    }
  }, [messages, queryClient, setMessages, threadDeleteMutation]);

  const deleteMessage = useCallback(async (messageId: string) => {
    if (currentUserRef.current?.role !== 'Admin') {
      alert('Chỉ tài khoản Admin mới có quyền xóa tin nhắn!');
      return;
    }
    const previousMessages = queryClient.getQueryData<InfiniteData<MessagePage, string | null>>(
      queryKeys.centralMessages
    );
    setMessages((previous) => previous.filter((message) => message.id !== messageId));
    try {
      await messageDeleteMutation.mutateAsync(messageId);
    } catch (error) {
      if (previousMessages) queryClient.setQueryData(queryKeys.centralMessages, previousMessages);
      console.error('Error deleting message via API:', error);
    }
  }, [messageDeleteMutation, queryClient, setMessages]);

  return {
    messages,
    setMessages,
    unreadCount,
    toastNotification,
    setToastNotification,
    selectedCustomerId,
    selectCustomerThread,
    sendMessage,
    deleteThread,
    deleteMessage,
    hasOlderMessages: Boolean(messagesQuery.hasNextPage),
    isLoadingOlderMessages: messagesQuery.isFetchingNextPage,
    loadOlderMessages: messagesQuery.fetchNextPage,
    isLoading: messagesQuery.isLoading,
    isFetching: messagesQuery.isFetching,
    isError: messagesQuery.isError || readMutation.isError || sendMutation.isError
      || threadDeleteMutation.isError || messageDeleteMutation.isError,
    error: messagesQuery.error || readMutation.error || sendMutation.error
      || threadDeleteMutation.error || messageDeleteMutation.error,
    isMutating: readMutation.isPending || sendMutation.isPending
      || threadDeleteMutation.isPending || messageDeleteMutation.isPending,
  };
}
