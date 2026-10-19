import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { InfiniteData } from '@tanstack/react-query';
import type { AppUser, CentralMessage, Customer, MessageChannel } from '../types';
import type { ConversationListResponse, ConversationSummary } from '../features/messages/types';
import { api } from '../utils/apiClient';
import { playNotificationSound } from '../utils/audioUtils';
import {
  isMetaUserIdentifier,
  isSamePhoneNumber,
  resolveSendableMessageRecipient,
} from '../utils/crmUtils';
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

const replaceInfinitePagesWithMessages = (
  data: InfiniteData<MessagePage, string | null>,
  next: CentralMessage[]
): InfiniteData<MessagePage, string | null> => {
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
};

interface UseCentralMessagesOptions {
  customers: Customer[];
  setCustomers: Dispatch<SetStateAction<Customer[]>>;
  currentUser: AppUser | null;
  phoneNumberId: string;
  loadMessages?: boolean;
}

export function useCentralMessages({
  customers,
  setCustomers,
  currentUser,
  phoneNumberId,
  loadMessages = true,
}: UseCentralMessagesOptions) {
  const queryClient = useQueryClient();
  const [toastNotification, setToastNotification] = useState<{
    message: CentralMessage;
    show: boolean;
  } | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedCustomerPhone, setSelectedCustomerPhone] = useState<string>('');

  const customersRef = useRef(customers);
  const currentUserRef = useRef(currentUser);

  useEffect(() => {
    customersRef.current = customers;
  }, [customers]);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  // Reset active thread selection when switching WABA phone number
  const prevPhoneIdRef = useRef(phoneNumberId);
  useEffect(() => {
    if (prevPhoneIdRef.current && phoneNumberId && prevPhoneIdRef.current !== phoneNumberId) {
      setSelectedCustomerId(null);
      setSelectedCustomerPhone('');
    }
    prevPhoneIdRef.current = phoneNumberId;
  }, [phoneNumberId]);

  const conversationsQueryKey = useMemo(
    () => queryKeys.messageConversations(phoneNumberId),
    [phoneNumberId]
  );
  const unreadSummaryQueryKey = useMemo(
    () => queryKeys.messageUnreadSummary(phoneNumberId),
    [phoneNumberId]
  );

  // 1. Load Conversation Threads list for ThreadSidebar (/api/meta/messages/conversations)
  const conversationsQuery = useQuery({
    queryKey: conversationsQueryKey,
    queryFn: () => api.get<ConversationListResponse>(
      `/meta/messages/conversations?limit=100&phoneNumberId=${encodeURIComponent(phoneNumberId)}`
    ),
    enabled: Boolean(currentUser) && Boolean(phoneNumberId),
    staleTime: 30_000,
  });

  const conversations = useMemo(
    () => conversationsQuery.data?.data ?? [],
    [conversationsQuery.data]
  );

  const resolveThreadIdentity = useCallback(
    (rawId?: string | null, rawPhoneInput?: string | null) => {
      const candidateId = rawId?.trim() || '';
      const candidatePhone = rawPhoneInput?.trim() || '';
      if (!candidateId && !candidatePhone) {
        return { threadKey: '', customerId: '', customerPhone: '' };
      }

      const matchedCustomer = customersRef.current.find(
        (item) =>
          (candidateId && item.id === candidateId) ||
          (candidatePhone && item.whatsappRecipientId === candidatePhone) ||
          (candidatePhone && isSamePhoneNumber(item.phone, candidatePhone)) ||
          (candidateId && item.whatsappRecipientId === candidateId.replace(/^meta_/, '')) ||
          (candidateId && isSamePhoneNumber(item.phone, candidateId))
      );

      const currentConvs =
        queryClient.getQueryData<ConversationListResponse>(conversationsQueryKey)?.data ??
        conversations;
      const matchedConv = currentConvs.find(
        (item) =>
          (candidateId && item.customerId === candidateId) ||
          (matchedCustomer && item.customerId === matchedCustomer.id) ||
          (candidatePhone && isSamePhoneNumber(item.customerPhone, candidatePhone)) ||
          (candidateId && isSamePhoneNumber(item.customerPhone, candidateId))
      );

      const resolvedPhone =
        candidatePhone ||
        matchedCustomer?.whatsappRecipientId ||
        matchedCustomer?.phone ||
        matchedConv?.customerPhone ||
        (candidateId.startsWith('cust_')
          ? candidateId.replace('cust_', '')
          : candidateId.startsWith('phone_')
            ? candidateId.replace('phone_', '')
            : !candidateId.includes('-') && candidateId.replace(/\D/g, '').length >= 7
              ? candidateId
              : '');
      const isUserIdentifier = isMetaUserIdentifier(resolvedPhone);
      const cleanPhone = isUserIdentifier ? '' : resolvedPhone.replace(/\D/g, '');
      const customerIdParam =
        matchedCustomer?.id ||
        matchedConv?.customerId ||
        candidateId ||
        (cleanPhone ? `cust_${cleanPhone}` : '');
      const threadKey =
        matchedCustomer?.id ||
        (isUserIdentifier
          ? `meta:${resolvedPhone.toLowerCase()}`
          : cleanPhone.length >= 7 ? cleanPhone.slice(-9) : customerIdParam);

      return {
        threadKey,
        customerId: customerIdParam,
        customerPhone: isUserIdentifier ? resolvedPhone : (cleanPhone || resolvedPhone),
      };
    },
    [conversations, conversationsQueryKey, queryClient]
  );

  const activeTarget = useMemo(() => {
    const fallbackConv = conversations[0];
    const rawId = selectedCustomerId || fallbackConv?.customerId || '';
    const rawPhone =
      selectedCustomerPhone || (!selectedCustomerId ? fallbackConv?.customerPhone || '' : '');
    return resolveThreadIdentity(rawId, rawPhone);
  }, [conversations, resolveThreadIdentity, selectedCustomerId, selectedCustomerPhone]);

  const activeTargetRef = useRef(activeTarget);
  const resolveThreadIdentityRef = useRef(resolveThreadIdentity);

  useEffect(() => {
    activeTargetRef.current = activeTarget;
  }, [activeTarget]);

  useEffect(() => {
    resolveThreadIdentityRef.current = resolveThreadIdentity;
  }, [resolveThreadIdentity]);

  const centralMessagesQueryKey = useMemo(
    () => queryKeys.centralMessages(phoneNumberId, activeTarget.threadKey),
    [activeTarget.threadKey, phoneNumberId]
  );
  const centralMessagesQueryKeyRef = useRef(centralMessagesQueryKey);
  useEffect(() => {
    centralMessagesQueryKeyRef.current = centralMessagesQueryKey;
  }, [centralMessagesQueryKey]);

  // 2. Load Message History only for the selected customer thread (/api/meta/messages?paginate=true&limit=30&customerId=...)
  const messagesQuery = useInfiniteQuery<
    MessagePage,
    Error,
    InfiniteData<MessagePage, string | null>,
    ReturnType<typeof queryKeys.centralMessages>,
    string | null
  >({
    queryKey: centralMessagesQueryKey,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({
        paginate: 'true',
        limit: '30',
        phoneNumberId,
      });
      if (activeTarget.customerId) {
        params.set('customerId', activeTarget.customerId);
      }
      if (activeTarget.customerPhone) {
        params.set('customerPhone', activeTarget.customerPhone);
      }
      if (pageParam) {
        params.set('cursor', pageParam);
      }
      return api.get<MessagePage>(`/meta/messages?${params.toString()}`);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : undefined),
    enabled:
      Boolean(currentUser) &&
      Boolean(phoneNumberId) &&
      loadMessages &&
      Boolean(activeTarget.customerId || activeTarget.customerPhone),
  });

  const threadMessages = useMemo(
    () => flattenMessagePages(messagesQuery.data),
    [messagesQuery.data]
  );

  // Combine conversation lastMessages with active thread messages so consumers like CustomerList
  // also have unread/businessPhone metadata across all threads while active thread has full history.
  const messages = useMemo(() => {
    const byId = new Map<string, CentralMessage>();
    conversations.forEach((conv) => {
      if (conv.lastMessage?.id) {
        byId.set(conv.lastMessage.id, {
          ...conv.lastMessage,
          isRead: conv.unreadCount === 0 ? true : conv.lastMessage.isRead,
        });
      }
    });
    threadMessages.forEach((msg) => {
      byId.set(msg.id, msg);
    });
    return Array.from(byId.values()).sort(
      (first, second) => new Date(first.timestamp).getTime() - new Date(second.timestamp).getTime()
    );
  }, [conversations, threadMessages]);

  useEffect(() => {
    // Remove the legacy full-message cache once. PostgreSQL + TanStack Query are now the source of truth.
    localStorage.removeItem('yumcrm_central_messages_v2');
  }, []);

  const updateConversationsCache = useCallback(
    (updater: (convs: ConversationSummary[]) => ConversationSummary[]) => {
      queryClient.setQueryData<ConversationListResponse>(conversationsQueryKey, (existing) => {
        const current = existing?.data ?? [];
        const next = updater(current);
        return {
          ...(existing ?? { page: 1, limit: 100 }),
          data: next,
          count: next.length,
        };
      });
    },
    [conversationsQueryKey, queryClient]
  );

  const setMessages: Dispatch<SetStateAction<CentralMessage[]>> = useCallback(
    (update) => {
      const targetKey = centralMessagesQueryKeyRef.current;
      queryClient.setQueryData<InfiniteData<MessagePage, string | null>>(targetKey, (data) => {
        const current = flattenMessagePages(data);
        const next = typeof update === 'function' ? update(current) : update;
        if (!data) {
          return {
            pages: [
              {
                messages: next,
                nextCursor: null,
                hasMore: false,
                limit: 30,
                direction: 'before',
              },
            ],
            pageParams: [null],
          };
        }
        return replaceInfinitePagesWithMessages(data, next);
      });
    },
    [queryClient]
  );

  const unreadCount = useMemo(
    () => conversations.reduce((total, thread) => total + thread.unreadCount, 0),
    [conversations]
  );

  const invalidateUnreadCounts = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: conversationsQueryKey });
    void queryClient.invalidateQueries({ queryKey: unreadSummaryQueryKey });
    void queryClient.invalidateQueries({ queryKey: queryKeys.messageUnreadTotals });
  }, [conversationsQueryKey, queryClient, unreadSummaryQueryKey]);

  const readMutation = useMutation({
    mutationFn: (variables: {
      customerId: string;
      customerPhone: string;
      messageIds?: string[];
      readBy: string;
      phoneNumberId: string;
    }) => api.post('/meta/messages/read', variables),
  });

  const selectCustomerThread = useCallback(
    (targetId: string, explicitPhone?: string, messageIds?: string[]) => {
      const identity = resolveThreadIdentityRef.current(targetId, explicitPhone);
      setSelectedCustomerId(targetId);
      setSelectedCustomerPhone(identity.customerPhone || explicitPhone || '');

      const reader = currentUserRef.current?.name || 'Nguyễn Văn Ánh';
      const customer = customersRef.current.find(
        (item) =>
          item.id === targetId ||
          isSamePhoneNumber(item.phone, explicitPhone || identity.customerPhone || targetId)
      );
      const phone =
        identity.customerPhone ||
        explicitPhone ||
        customer?.phone ||
        (targetId.startsWith('cust_')
          ? targetId.replace('cust_', '')
          : String(targetId).replace(/\D/g, '').length >= 7
            ? targetId
            : '');
      const readAt = new Date().toISOString();

      const currentConvs =
        queryClient.getQueryData<ConversationListResponse>(conversationsQueryKey)?.data ?? [];
      const hasUnreadInConv = currentConvs.some((conv) => {
        const matches =
          conv.customerId === targetId ||
          (customer && conv.customerId === customer.id) ||
          Boolean(phone && isSamePhoneNumber(conv.customerPhone, phone)) ||
          resolveThreadIdentityRef.current(conv.customerId, conv.customerPhone).threadKey ===
            identity.threadKey;
        return matches && conv.unreadCount > 0;
      });

      const threadKeyForCache = queryKeys.centralMessages(phoneNumberId, identity.threadKey);
      const cachedThreadMessages = flattenMessagePages(
        queryClient.getQueryData<InfiniteData<MessagePage, string | null>>(threadKeyForCache)
      );
      const hasUnreadInMessages = cachedThreadMessages.some(
        (m) => !m.isRead && m.sender === 'customer'
      );

      if (!hasUnreadInConv && !hasUnreadInMessages) {
        return;
      }

      updateConversationsCache((convs) =>
        convs.map((conv) => {
          const matches =
            conv.customerId === targetId ||
            (customer && conv.customerId === customer.id) ||
            Boolean(phone && isSamePhoneNumber(conv.customerPhone, phone)) ||
            resolveThreadIdentityRef.current(conv.customerId, conv.customerPhone).threadKey ===
              identity.threadKey;
          if (!matches) return conv;
          return {
            ...conv,
            unreadCount: 0,
            lastMessage: {
              ...conv.lastMessage,
              isRead: true,
              readBy: conv.lastMessage.readBy || reader,
              readAt: conv.lastMessage.readAt || readAt,
            },
          };
        })
      );

      queryClient.setQueryData<InfiniteData<MessagePage, string | null>>(
        threadKeyForCache,
        (data) => {
          if (!data) return data;
          const updated = flattenMessagePages(data).map((message) => {
            const matches =
              (messageIds?.includes(message.id) ?? false) ||
              message.customerId === targetId ||
              (customer && message.customerId === customer.id) ||
              Boolean(phone && isSamePhoneNumber(message.customerPhone, phone));
            return matches
              ? {
                  ...message,
                  isRead: true,
                  readBy: message.readBy || reader,
                  readAt: message.readAt || readAt,
                }
              : message;
          });
          return replaceInfinitePagesWithMessages(data, updated);
        }
      );

      readMutation.mutate(
        {
          customerId: customer?.id || targetId,
          customerPhone: phone,
          messageIds,
          readBy: reader,
          phoneNumberId,
        },
        { onSettled: invalidateUnreadCounts }
      );
    },
    [
      conversationsQueryKey,
      invalidateUnreadCounts,
      phoneNumberId,
      queryClient,
      readMutation,
      updateConversationsCache,
    ]
  );

  useEffect(() => {
    if (!phoneNumberId) return;

    const knownMessageIds = new Set<string>();
    flattenMessagePages(
      queryClient.getQueryData<InfiniteData<MessagePage, string | null>>(
        centralMessagesQueryKeyRef.current
      )
    ).forEach((message) => knownMessageIds.add(message.id));

    return realtimeClient.subscribe({
      connected: (event) => {
        console.log('[REALTIME SSE] Connected to server event stream:', event.data);
      },
      'message:new': (event) => {
        try {
          const newMessage: CentralMessage = JSON.parse(event.data);
          if (!newMessage?.id) return;
          invalidateUnreadCounts();
          if (
            newMessage.businessPhoneNumberId &&
            newMessage.businessPhoneNumberId !== phoneNumberId
          )
            return;
          const wasKnown = knownMessageIds.has(newMessage.id);
          knownMessageIds.add(newMessage.id);

          const activeIdentity = activeTargetRef.current;
          const msgIdentity = resolveThreadIdentityRef.current(
            newMessage.customerId,
            newMessage.customerPhone
          );
          const isSelected = Boolean(
            activeIdentity.threadKey &&
              (msgIdentity.threadKey === activeIdentity.threadKey ||
                newMessage.customerId === activeIdentity.customerId ||
                (activeIdentity.customerPhone &&
                  isSamePhoneNumber(newMessage.customerPhone, activeIdentity.customerPhone)))
          );

          const enrichedMessage: CentralMessage = {
            ...newMessage,
            isRead: isSelected || Boolean(newMessage.isRead),
            readBy:
              newMessage.readBy ||
              (isSelected ? currentUserRef.current?.name || 'Nhân viên' : undefined),
            readAt: newMessage.readAt || (isSelected ? new Date().toISOString() : undefined),
          };

          updateConversationsCache((convs) => {
            const matchIdx = convs.findIndex(
              (conv) =>
                conv.customerId === enrichedMessage.customerId ||
                (enrichedMessage.customerPhone &&
                  isSamePhoneNumber(conv.customerPhone, enrichedMessage.customerPhone)) ||
                resolveThreadIdentityRef.current(conv.customerId, conv.customerPhone).threadKey ===
                  msgIdentity.threadKey
            );

            if (matchIdx >= 0) {
              const target = convs[matchIdx];
              const shouldIncrementUnread =
                enrichedMessage.sender === 'customer' &&
                !isSelected &&
                !wasKnown &&
                !enrichedMessage.isRead;
              const updatedConv: ConversationSummary = {
                ...target,
                customerName: enrichedMessage.customerName || target.customerName,
                customerPhone: enrichedMessage.customerPhone || target.customerPhone,
                unreadCount: isSelected
                  ? 0
                  : target.unreadCount + (shouldIncrementUnread ? 1 : 0),
                lastCustomerMessageAt:
                  enrichedMessage.sender === 'customer'
                    ? enrichedMessage.timestamp
                    : target.lastCustomerMessageAt,
                lastMessage: enrichedMessage,
              };
              const remaining = convs.filter((_, idx) => idx !== matchIdx);
              return [updatedConv, ...remaining];
            }

            const newConv: ConversationSummary = {
              customerId: enrichedMessage.customerId,
              customerName: enrichedMessage.customerName || 'Khách Hàng',
              customerPhone: enrichedMessage.customerPhone || '',
              unreadCount:
                enrichedMessage.sender === 'customer' && !isSelected && !enrichedMessage.isRead
                  ? 1
                  : 0,
              lastCustomerMessageAt:
                enrichedMessage.sender === 'customer' ? enrichedMessage.timestamp : null,
              lastMessage: enrichedMessage,
            };
            return [newConv, ...convs];
          });

          const targetThreadKey = queryKeys.centralMessages(phoneNumberId, msgIdentity.threadKey);
          if (isSelected) {
            setMessages((previous) => {
              const withoutDuplicate = previous.filter(
                (message) =>
                  message.id !== enrichedMessage.id &&
                  !(message.id.startsWith('msg_') && message.content === enrichedMessage.content)
              );
              return [...withoutDuplicate, enrichedMessage].sort(
                (first, second) =>
                  new Date(first.timestamp).getTime() - new Date(second.timestamp).getTime()
              );
            });
          } else if (msgIdentity.threadKey) {
            queryClient.setQueryData<InfiniteData<MessagePage, string | null>>(
              targetThreadKey,
              (data) => {
                if (!data) return data;
                const current = flattenMessagePages(data);
                const withoutDuplicate = current.filter(
                  (message) =>
                    message.id !== enrichedMessage.id &&
                    !(message.id.startsWith('msg_') && message.content === enrichedMessage.content)
                );
                const next = [...withoutDuplicate, enrichedMessage].sort(
                  (first, second) =>
                    new Date(first.timestamp).getTime() - new Date(second.timestamp).getTime()
                );
                return replaceInfinitePagesWithMessages(data, next);
              }
            );
          }

          if (newMessage.sender === 'customer' && !wasKnown) {
            playNotificationSound();
            setToastNotification({ message: newMessage, show: true });
          }
        } catch (error) {
          console.error('[REALTIME SSE] Error processing message:new event:', error);
        }
      },
      'message:read': (event) => {
        try {
          const { messageIds, customerId, customerPhone, readBy, readAt } = JSON.parse(event.data);
          const resolvedReadAt = readAt || new Date().toISOString();
          const resolvedReadBy = readBy || 'Nhân viên';

          updateConversationsCache((convs) =>
            convs.map((conv) => {
              const matches =
                (Array.isArray(messageIds) && messageIds.includes(conv.lastMessage.id)) ||
                (customerId && conv.customerId === customerId) ||
                (customerPhone && isSamePhoneNumber(conv.customerPhone, customerPhone));
              if (!matches) return conv;
              return {
                ...conv,
                unreadCount: 0,
                lastMessage: {
                  ...conv.lastMessage,
                  isRead: true,
                  readBy: conv.lastMessage.readBy || resolvedReadBy,
                  readAt: conv.lastMessage.readAt || resolvedReadAt,
                },
              };
            })
          );

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
                    readBy: message.readBy || resolvedReadBy,
                    readAt: message.readAt || resolvedReadAt,
                  }
                : message;
            })
          );
          invalidateUnreadCounts();
        } catch (error) {
          console.error('[REALTIME SSE] Error processing message:read event:', error);
        }
      },
      'message:status': (event) => {
        try {
          const { id, status, errorCode, errorMessage, errorDetails, deliveredAt, readAt } = JSON.parse(
            event.data
          );
          updateConversationsCache((convs) =>
            convs.map((conv) => {
              if (conv.lastMessage.id !== id) return conv;
              return {
                ...conv,
                lastMessage: {
                  ...conv.lastMessage,
                  status: status || conv.lastMessage.status,
                  errorCode: errorCode !== undefined ? errorCode : conv.lastMessage.errorCode,
                  errorMessage:
                    errorMessage !== undefined ? errorMessage : conv.lastMessage.errorMessage,
                  errorDetails:
                    errorDetails !== undefined ? errorDetails : conv.lastMessage.errorDetails,
                  deliveredAt: deliveredAt || conv.lastMessage.deliveredAt,
                  readAt: readAt || conv.lastMessage.readAt,
                  isRead: status === 'read' ? true : conv.lastMessage.isRead,
                },
              };
            })
          );
          setMessages((previous) =>
            previous.map((message) => {
              if (message.id !== id) return message;
              return {
                ...message,
                status: status || message.status,
                errorCode: errorCode !== undefined ? errorCode : message.errorCode,
                errorMessage: errorMessage !== undefined ? errorMessage : message.errorMessage,
                errorDetails: errorDetails !== undefined ? errorDetails : message.errorDetails,
                deliveredAt: deliveredAt || message.deliveredAt,
                readAt: readAt || message.readAt,
                isRead: status === 'read' ? true : message.isRead,
              };
            })
          );
        } catch (error) {
          console.error('[REALTIME SSE] Error processing message:status event:', error);
        }
      },
      'message:reaction': (event) => {
        try {
          const { messageId, emoji, customerId, customerPhone } = JSON.parse(event.data);
          if (!messageId) return;
          setMessages((previous) =>
            previous.map((message) => {
              if (message.id !== messageId) return message;
              return {
                ...message,
                reaction: emoji || null,
              };
            })
          );
          const msgIdentity = resolveThreadIdentityRef.current(customerId, customerPhone);
          if (msgIdentity.threadKey) {
            const targetThreadKey = queryKeys.centralMessages(phoneNumberId, msgIdentity.threadKey);
            queryClient.setQueryData<InfiniteData<MessagePage, string | null>>(
              targetThreadKey,
              (data) => {
                if (!data) return data;
                return {
                  ...data,
                  pages: data.pages.map((page) => ({
                    ...page,
                    messages: page.messages.map((message) =>
                      message.id === messageId ? { ...message, reaction: emoji || null } : message
                    ),
                  })),
                };
              }
            );
          }
        } catch (error) {
          console.error('[REALTIME SSE] Error processing message:reaction event:', error);
        }
      },
      'message:thread_deleted': (event) => {
        try {
          const { customerId, customerPhone } = JSON.parse(event.data);
          updateConversationsCache((convs) =>
            convs.filter(
              (conv) =>
                conv.customerId !== customerId &&
                !(customerPhone && isSamePhoneNumber(conv.customerPhone, customerPhone))
            )
          );
          setMessages((previous) =>
            previous.filter(
              (message) =>
                message.customerId !== customerId &&
                !(customerPhone && isSamePhoneNumber(message.customerPhone, customerPhone))
            )
          );
          invalidateUnreadCounts();
        } catch {
          // Ignore malformed realtime events.
        }
      },
      'message:deleted': (event) => {
        try {
          const { messageId } = JSON.parse(event.data);
          setMessages((previous) => previous.filter((message) => message.id !== messageId));
          invalidateUnreadCounts();
        } catch {
          // Ignore malformed realtime events.
        }
      },
      'message:cleared': () => {
        updateConversationsCache(() => []);
        setMessages([]);
        invalidateUnreadCounts();
      },
      'messages:sync': () => {
        void queryClient.invalidateQueries({ queryKey: centralMessagesQueryKeyRef.current });
        invalidateUnreadCounts();
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
  }, [
    invalidateUnreadCounts,
    phoneNumberId,
    queryClient,
    setCustomers,
    setMessages,
    updateConversationsCache,
  ]);

  const sendMutation = useMutation({
    mutationFn: (variables: {
      customerId: string;
      customerName: string;
      customerPhone: string;
      recipientId?: string;
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
      return api.delete(
        `/meta/messages/thread/${encodeURIComponent(customerId)}${queryString ? `?${queryString}` : ''}`
      );
    },
  });
  const messageDeleteMutation = useMutation({
    mutationFn: (messageId: string) =>
      api.delete(`/meta/messages/item/${encodeURIComponent(messageId)}`),
  });

  const sendMessage = useCallback(
    async (
      customerId: string,
      content: string,
      channel: MessageChannel = 'WhatsApp',
      explicitPhone?: string,
      explicitName?: string,
      senderPhoneNumberId?: string,
      replyTo?: { id: string; senderName: string; content: string }
    ) => {
      const customer = customersRef.current.find(
        (item) =>
          item.id === customerId ||
          item.whatsappRecipientId === explicitPhone ||
          isSamePhoneNumber(item.phone, explicitPhone || customerId)
      );
      const agentName = currentUserRef.current?.name || 'Nguyễn Văn Ánh';
      const phone = resolveSendableMessageRecipient(
        explicitPhone,
        customer?.whatsappRecipientId || customer?.phone,
        customerId,
      );
      const customerName =
        explicitName || customer?.name || (phone ? `Khách Hàng (${phone})` : 'Khách Hàng');
      if (customer?.whatsappReachability === 'unreachable') {
        throw new Error('Liên hệ đang ở trạng thái WhatsApp unreachable. Hãy chờ khách nhắn tin mới.');
      }
      const temporaryMessage: CentralMessage = {
        id: `msg_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        customerId: customer?.id || customerId,
        customerName,
        customerPhone: phone,
        recipientId: phone,
        sender: 'agent',
        agentId: currentUserRef.current?.id,
        agentName,
        channel,
        content,
        timestamp: new Date().toISOString(),
        isRead: true,
        status: 'sending',
        businessPhoneNumberId: senderPhoneNumberId || phoneNumberId,
        replyTo,
      };

      const targetIdentity = resolveThreadIdentityRef.current(
        temporaryMessage.customerId,
        temporaryMessage.customerPhone
      );

      updateConversationsCache((convs) => {
        const matchIdx = convs.findIndex(
          (conv) =>
            conv.customerId === temporaryMessage.customerId ||
            (temporaryMessage.customerPhone &&
              isSamePhoneNumber(conv.customerPhone, temporaryMessage.customerPhone)) ||
            resolveThreadIdentityRef.current(conv.customerId, conv.customerPhone).threadKey ===
              targetIdentity.threadKey
        );
        if (matchIdx >= 0) {
          const existing = convs[matchIdx];
          const updated: ConversationSummary = {
            ...existing,
            customerName: temporaryMessage.customerName || existing.customerName,
            customerPhone: temporaryMessage.customerPhone || existing.customerPhone,
            unreadCount: 0,
            lastMessage: temporaryMessage,
          };
          const remaining = convs.filter((_, idx) => idx !== matchIdx);
          return [updated, ...remaining];
        }
        return [
          {
            customerId: temporaryMessage.customerId,
            customerName: temporaryMessage.customerName,
            customerPhone: temporaryMessage.customerPhone,
            unreadCount: 0,
            lastCustomerMessageAt: null,
            lastMessage: temporaryMessage,
          },
          ...convs,
        ];
      });

      setMessages((previous) => [...previous, temporaryMessage]);
      try {
        const response = await sendMutation.mutateAsync({
          customerId: customer?.id || customerId,
          customerName,
          customerPhone: phone,
          recipientId: phone,
          content,
          agentName,
          senderPhoneId: senderPhoneNumberId,
          contextMessageId: replyTo?.id,
          replyTo,
        });
        if (response?.message) {
          const resolvedSentMsg: CentralMessage = {
            ...temporaryMessage,
            id: response.message.id,
            isRealSent: response.isRealSent,
            status: response.message.status || (response.isRealSent ? 'sent' : 'failed'),
            errorCode: response.message.errorCode || response.errorCode,
            errorMessage: response.message.errorMessage || response.errorMessage,
            errorDetails: response.message.errorDetails || response.errorDetails,
            replyTo: response.message.replyTo || temporaryMessage.replyTo,
          };
          updateConversationsCache((convs) =>
            convs.map((conv) =>
              conv.lastMessage.id === temporaryMessage.id ||
              conv.lastMessage.id === resolvedSentMsg.id
                ? { ...conv, lastMessage: resolvedSentMsg }
                : conv
            )
          );
          setMessages((previous) =>
            previous.map((message) =>
              message.id === temporaryMessage.id ? resolvedSentMsg : message
            )
          );
        }
      } catch (sendErr: any) {
        console.warn('Lỗi khi gửi tin nhắn:', sendErr);
        const failedErrorMessage =
          sendErr?.response?.data?.error ||
          sendErr?.message ||
          'Không thể gửi tin nhắn đến máy chủ CRM';
        updateConversationsCache((convs) =>
          convs.map((conv) =>
            conv.lastMessage.id === temporaryMessage.id
              ? {
                  ...conv,
                  lastMessage: {
                    ...conv.lastMessage,
                    status: 'failed',
                    errorMessage: failedErrorMessage,
                  },
                }
              : conv
          )
        );
        setMessages((previous) =>
          previous.map((message) =>
            message.id === temporaryMessage.id
              ? {
                  ...message,
                  status: 'failed',
                  errorMessage: failedErrorMessage,
                }
              : message
          )
        );
      }

      if (customer || phone) {
        setCustomers((previous) =>
          previous.map((item) => {
            const matches =
              item.id === customerId ||
              (customer && item.id === customer.id) ||
              isSamePhoneNumber(item.phone, phone);
            if (!matches) return item;
            return {
              ...item,
              lastContact: new Date().toISOString().split('T')[0],
            };
          })
        );
      }
    },
    [phoneNumberId, sendMutation, setCustomers, setMessages, updateConversationsCache]
  );

  const deleteThread = useCallback(
    async (customerId: string) => {
      if (currentUserRef.current?.role !== 'Admin') {
        alert('Chỉ tài khoản Admin mới có quyền xóa hội thoại!');
        return;
      }
      const matchingConv = conversations.find(
        (conv) => conv.customerId === customerId || isSamePhoneNumber(conv.customerPhone, customerId)
      );
      const threadMsgs = threadMessages.filter(
        (message) =>
          message.customerId === customerId ||
          isSamePhoneNumber(message.customerPhone, customerId)
      );
      const phone =
        matchingConv?.customerPhone ||
        threadMsgs[0]?.customerPhone ||
        customersRef.current.find((customer) => customer.id === customerId)?.phone ||
        customerId;

      const previousConversations =
        queryClient.getQueryData<ConversationListResponse>(conversationsQueryKey);
      const previousMessages = queryClient.getQueryData<InfiniteData<MessagePage, string | null>>(
        centralMessagesQueryKey
      );

      updateConversationsCache((convs) =>
        convs.filter(
          (conv) =>
            conv.customerId !== customerId && !isSamePhoneNumber(conv.customerPhone, phone)
        )
      );
      setMessages((previous) =>
        previous.filter(
          (message) =>
            message.customerId !== customerId && !isSamePhoneNumber(message.customerPhone, phone)
        )
      );
      if (
        selectedCustomerId === customerId ||
        (phone && isSamePhoneNumber(selectedCustomerPhone || selectedCustomerId || '', phone))
      ) {
        setSelectedCustomerId(null);
        setSelectedCustomerPhone('');
      }

      try {
        await threadDeleteMutation.mutateAsync({ customerId, phone });
        invalidateUnreadCounts();
      } catch (error) {
        if (previousConversations) {
          queryClient.setQueryData(conversationsQueryKey, previousConversations);
        }
        if (previousMessages) {
          queryClient.setQueryData(centralMessagesQueryKey, previousMessages);
        }
        console.error('Error deleting thread via API:', error);
      }
    },
    [
      centralMessagesQueryKey,
      conversations,
      conversationsQueryKey,
      invalidateUnreadCounts,
      queryClient,
      selectedCustomerId,
      selectedCustomerPhone,
      setMessages,
      threadDeleteMutation,
      threadMessages,
      updateConversationsCache,
    ]
  );

  const deleteMessage = useCallback(
    async (messageId: string) => {
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
        invalidateUnreadCounts();
      } catch (error) {
        if (previousMessages) queryClient.setQueryData(centralMessagesQueryKey, previousMessages);
        console.error('Error deleting message via API:', error);
      }
    },
    [centralMessagesQueryKey, invalidateUnreadCounts, messageDeleteMutation, queryClient, setMessages]
  );

  const retryMessage = useCallback(
    async (messageId: string) => {
      const targetMsg = messages.find((m) => m.id === messageId);
      if (!targetMsg || targetMsg.sender !== 'agent') return;
      if (targetMsg.errorCode === '131026') return;

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
                    errorDetails: response.message.errorDetails || response.errorDetails,
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
                  errorMessage:
                    retryErr?.response?.data?.error ||
                    retryErr?.message ||
                    'Không thể kết nối máy chủ',
                }
              : m
          )
        );
      }
    },
    [messages, sendMutation, setMessages]
  );

  return {
    conversations,
    threadMessages,
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
    isLoadingThreads: conversationsQuery.isLoading,
    isLoading: messagesQuery.isLoading || conversationsQuery.isLoading,
    isFetching: messagesQuery.isFetching || conversationsQuery.isFetching,
    isError:
      conversationsQuery.isError ||
      messagesQuery.isError ||
      readMutation.isError ||
      sendMutation.isError ||
      threadDeleteMutation.isError ||
      messageDeleteMutation.isError,
    error:
      conversationsQuery.error ||
      messagesQuery.error ||
      readMutation.error ||
      sendMutation.error ||
      threadDeleteMutation.error ||
      messageDeleteMutation.error,
    isMutating:
      readMutation.isPending ||
      sendMutation.isPending ||
      threadDeleteMutation.isPending ||
      messageDeleteMutation.isPending,
  };
}
