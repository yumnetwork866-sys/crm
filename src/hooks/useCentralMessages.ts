import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { InfiniteData } from '@tanstack/react-query';
import type { AppUser, CentralMessage, Customer, MessageChannel } from '../types';
import { api } from '../utils/apiClient';
import { playNotificationSound } from '../utils/audioUtils';
import { formatDateTime, isSamePhoneNumber } from '../utils/crmUtils';
import { queryKeys } from '../lib/queryClient';
import { realtimeClient } from '../services/realtimeClient';

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
  phoneNumberId: string;
  loadMessages?: boolean;
}

interface ConversationSummaryResponse {
  data: Array<{ unreadCount: number }>;
}

export function useCentralMessages({
  customers,
  setCustomers,
  currentUser,
  phoneNumberId,
  loadMessages = true,
}: UseCentralMessagesOptions) {
  const queryClient = useQueryClient();
  const centralMessagesQueryKey = useMemo(
    () => queryKeys.centralMessages(phoneNumberId),
    [phoneNumberId]
  );
  const unreadSummaryQueryKey = useMemo(
    () => queryKeys.messageUnreadSummary(phoneNumberId),
    [phoneNumberId]
  );
  const messagesQuery = useInfiniteQuery<
    MessagePage,
    Error,
    InfiniteData<MessagePage, string | null>,
    ReturnType<typeof queryKeys.centralMessages>,
    string | null
  >({
    queryKey: centralMessagesQueryKey,
    queryFn: ({ pageParam }) => api.get<MessagePage>(
      `/meta/messages?paginate=true&limit=30&phoneNumberId=${encodeURIComponent(phoneNumberId)}${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''}`
    ),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.nextCursor : undefined,
    enabled: Boolean(currentUser) && Boolean(phoneNumberId) && loadMessages,
  });
  const messages = useMemo(() => flattenMessagePages(messagesQuery.data), [messagesQuery.data]);
  const unreadSummaryQuery = useQuery({
    queryKey: unreadSummaryQueryKey,
    queryFn: () => api.get<ConversationSummaryResponse>(
      `/meta/messages/conversations?limit=100&phoneNumberId=${encodeURIComponent(phoneNumberId)}`
    ),
    enabled: Boolean(currentUser) && Boolean(phoneNumberId) && !loadMessages,
    staleTime: 30_000,
  });

  useEffect(() => {
    // Remove the legacy full-message cache once. PostgreSQL + TanStack Query are now the source of truth.
    localStorage.removeItem('yumcrm_central_messages_v2');
  }, []);

  const setMessages: Dispatch<SetStateAction<CentralMessage[]>> = useCallback((update) => {
    queryClient.setQueryData<InfiniteData<MessagePage, string | null>>(centralMessagesQueryKey, (data) => {
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
  }, [centralMessagesQueryKey, queryClient]);
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

  const unreadCount = useMemo(() => {
    if (loadMessages) {
      return messages.filter((message) => !message.isRead && message.sender === 'customer').length;
    }
    return unreadSummaryQuery.data?.data.reduce((total, thread) => total + thread.unreadCount, 0) ?? 0;
  }, [loadMessages, messages, unreadSummaryQuery.data]);

  const readMutation = useMutation({
    mutationFn: (variables: { customerId: string; customerPhone: string; messageIds?: string[]; readBy: string; phoneNumberId: string }) =>
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
      phoneNumberId,
    });
    void queryClient.invalidateQueries({ queryKey: unreadSummaryQueryKey });
  }, [phoneNumberId, queryClient, readMutation, setMessages, unreadSummaryQueryKey]);

  useEffect(() => {
    if (!phoneNumberId) return;

    const knownMessageIds = new Set<string>();
    flattenMessagePages(
      queryClient.getQueryData<InfiniteData<MessagePage, string | null>>(centralMessagesQueryKey)
    )
      .forEach((message) => knownMessageIds.add(message.id));


    return realtimeClient.subscribe({
      connected: (event) => {
        console.log('[REALTIME SSE] Connected to server event stream:', event.data);
      },
      'message:new': (event) => {
        try {
          const newMessage: CentralMessage = JSON.parse(event.data);
          if (!newMessage?.id) return;
          if (
            newMessage.businessPhoneNumberId &&
            newMessage.businessPhoneNumberId !== phoneNumberId
          )
            return;
          const wasKnown = knownMessageIds.has(newMessage.id);
          knownMessageIds.add(newMessage.id);

          setMessages((previous) => {
            const selected = selectedCustomerIdRef.current;
            const isSelected = Boolean(
              selected &&
              (newMessage.customerId === selected ||
                isSamePhoneNumber(newMessage.customerPhone, selected)),
            );
            const enrichedMessage: CentralMessage = {
              ...newMessage,
              isRead: isSelected || Boolean(newMessage.isRead),
              readBy:
                newMessage.readBy ||
                (isSelected ? currentUserRef.current?.name || 'Nhân viên' : undefined),
              readAt: newMessage.readAt || (isSelected ? new Date().toISOString() : undefined),
            };
            const withoutDuplicate = previous.filter(
              (message) =>
                message.id !== enrichedMessage.id &&
                !(message.id.startsWith('msg_') && message.content === enrichedMessage.content),
            );
            return [...withoutDuplicate, enrichedMessage].sort(
              (first, second) =>
                new Date(first.timestamp).getTime() - new Date(second.timestamp).getTime(),
            );
          });

          if (newMessage.sender === 'customer' && !wasKnown) {
            playNotificationSound();
            setToastNotification({ message: newMessage, show: true });
          }
          void queryClient.invalidateQueries({ queryKey: unreadSummaryQueryKey });
        } catch (error) {
          console.error('[REALTIME SSE] Error processing message:new event:', error);
        }
      },
      'message:read': (event) => {
        try {
          const { messageIds, customerId, customerPhone, readBy, readAt } = JSON.parse(event.data);
          setMessages((previous) =>
            previous.map((message) => {
              const matches =
                (Array.isArray(messageIds) && messageIds.includes(message.id)) ||
                (customerId && message.customerId === customerId) ||
                (customerPhone && isSamePhoneNumber(message.customerPhone, customerPhone));
              return matches
                ? {
                    ...message,
                    isRead: true,
                    readBy: message.readBy || readBy || 'Nhân viên',
                    readAt: message.readAt || readAt || new Date().toISOString(),
                  }
                : message;
            }),
          );
          void queryClient.invalidateQueries({ queryKey: unreadSummaryQueryKey });
        } catch (error) {
          console.error('[REALTIME SSE] Error processing message:read event:', error);
        }
      },
      'message:status': (event) => {
        try {
          const { id, status, errorCode, errorMessage, deliveredAt, readAt } = JSON.parse(
            event.data,
          );
          setMessages((previous) =>
            previous.map((message) => {
              if (message.id !== id) return message;
              return {
                ...message,
                status: status || message.status,
                errorCode: errorCode !== undefined ? errorCode : message.errorCode,
                errorMessage: errorMessage !== undefined ? errorMessage : message.errorMessage,
                deliveredAt: deliveredAt || message.deliveredAt,
                readAt: readAt || message.readAt,
                isRead: status === 'read' ? true : message.isRead,
              };
            }),
          );
        } catch (error) {
          console.error('[REALTIME SSE] Error processing message:status event:', error);
        }
      },
      'message:thread_deleted': (event) => {
        try {
          const { customerId, customerPhone } = JSON.parse(event.data);
          setMessages((previous) =>
            previous.filter(
              (message) =>
                message.customerId !== customerId &&
                !(customerPhone && isSamePhoneNumber(message.customerPhone, customerPhone)),
            ),
          );
          void queryClient.invalidateQueries({ queryKey: unreadSummaryQueryKey });
        } catch {
          // Ignore malformed realtime events.
        }
      },
      'message:deleted': (event) => {
        try {
          const { messageId } = JSON.parse(event.data);
          setMessages((previous) => previous.filter((message) => message.id !== messageId));
          void queryClient.invalidateQueries({ queryKey: unreadSummaryQueryKey });
        } catch {
          // Ignore malformed realtime events.
        }
      },
      'message:cleared': () => {
        setMessages([]);
        void queryClient.invalidateQueries({ queryKey: unreadSummaryQueryKey });
      },
      'messages:sync': () => {
        void queryClient.invalidateQueries({ queryKey: centralMessagesQueryKey });
        void queryClient.invalidateQueries({ queryKey: unreadSummaryQueryKey });
      },
      'customers:sync': () => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.customers });
      },
      'ai:status': (event) => {
        try {
          const detail = JSON.parse(event.data);
          window.dispatchEvent(new CustomEvent('ai:status_change', { detail }));
        } catch {
          // Ignore
        }
      },
    });
  }, [centralMessagesQueryKey, phoneNumberId, queryClient, setCustomers, setMessages, unreadSummaryQueryKey]);

  const sendMutation = useMutation({
    mutationFn: (variables: {
      customerId: string;
      customerName: string;
      customerPhone: string;
      content: string;
      agentName: string;
      senderPhoneId?: string;
      contextMessageId?: string;
      replyTo?: { id: string; senderName: string; content: string };
    }) => api.post<any>('/meta/messages/send', variables),
  });
  const threadDeleteMutation = useMutation({
    mutationFn: ({ customerId, phone }: { customerId: string; phone: string }) => {
      const cleanPhone = phone.replace(/\D/g, '');
      const query = new URLSearchParams();
      if (cleanPhone) query.set('customerPhone', cleanPhone);
      if (phoneNumberId) query.set('phoneNumberId', phoneNumberId);
      const queryString = query.toString();
      return api.delete(`/meta/messages/thread/${encodeURIComponent(customerId)}${queryString ? `?${queryString}` : ''}`);
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
      status: 'sending',
      businessPhoneNumberId: senderPhoneNumberId,
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
        senderPhoneId: senderPhoneNumberId,
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
                  status: response.message.status || (response.isRealSent ? 'sent' : 'failed'),
                  errorCode: response.message.errorCode || response.errorCode,
                  errorMessage: response.message.errorMessage || response.errorMessage,
                  replyTo: response.message.replyTo || message.replyTo,
                }
              : message
          )
        );
      }
    } catch (sendErr: any) {
      console.warn('Lỗi khi gửi tin nhắn:', sendErr);
      setMessages((previous) =>
        previous.map((message) =>
          message.id === temporaryMessage.id
            ? {
                ...message,
                status: 'failed',
                errorMessage: sendErr?.response?.data?.error || sendErr?.message || 'Không thể gửi tin nhắn đến máy chủ CRM',
              }
            : message
        )
      );
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
                createdAt: formatDateTime(new Date()),
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
      centralMessagesQueryKey
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
      if (previousMessages) queryClient.setQueryData(centralMessagesQueryKey, previousMessages);
      console.error('Error deleting thread via API:', error);
    }
  }, [centralMessagesQueryKey, messages, queryClient, setMessages, threadDeleteMutation]);

  const deleteMessage = useCallback(async (messageId: string) => {
    if (currentUserRef.current?.role !== 'Admin') {
      alert('Chỉ tài khoản Admin mới có quyền xóa tin nhắn!');
      return;
    }
    const previousMessages = queryClient.getQueryData<InfiniteData<MessagePage, string | null>>(
      centralMessagesQueryKey
    );
    setMessages((previous) => previous.filter((message) => message.id !== messageId));
    try {
      await messageDeleteMutation.mutateAsync(messageId);
    } catch (error) {
      if (previousMessages) queryClient.setQueryData(centralMessagesQueryKey, previousMessages);
      console.error('Error deleting message via API:', error);
    }
  }, [centralMessagesQueryKey, messageDeleteMutation, queryClient, setMessages]);

  const retryMessage = useCallback(async (messageId: string) => {
    const targetMsg = messages.find((m) => m.id === messageId);
    if (!targetMsg || targetMsg.sender !== 'agent') return;

    setMessages((previous) =>
      previous.map((m) =>
        m.id === messageId
          ? { ...m, status: 'sending', errorMessage: null, errorCode: null }
          : m
      )
    );

    try {
      const response = await sendMutation.mutateAsync({
        customerId: targetMsg.customerId,
        customerName: targetMsg.customerName,
        customerPhone: targetMsg.customerPhone,
        content: targetMsg.content,
        agentName: targetMsg.agentName || currentUserRef.current?.name || 'Nguyễn Văn Ánh',
        senderPhoneId: targetMsg.businessPhoneNumberId,
        contextMessageId: targetMsg.replyTo?.id,
        replyTo: targetMsg.replyTo,
      });

      if (response?.message) {
        setMessages((previous) =>
          previous.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  id: response.message.id,
                  isRealSent: response.isRealSent,
                  status: response.message.status || (response.isRealSent ? 'sent' : 'failed'),
                  errorCode: response.message.errorCode || response.errorCode,
                  errorMessage: response.message.errorMessage || response.errorMessage,
                  replyTo: response.message.replyTo || m.replyTo,
                }
              : m
          )
        );
      }
    } catch (retryErr: any) {
      setMessages((previous) =>
        previous.map((m) =>
          m.id === messageId
            ? {
                ...m,
                status: 'failed',
                errorMessage: retryErr?.response?.data?.error || retryErr?.message || 'Không thể kết nối máy chủ',
              }
            : m
        )
      );
    }
  }, [messages, sendMutation]);

  return {
    messages,
    setMessages,
    unreadCount,
    toastNotification,
    setToastNotification,
    selectedCustomerId,
    selectCustomerThread,
    sendMessage,
    retryMessage,
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
