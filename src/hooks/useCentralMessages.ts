import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { AppUser, CentralMessage, Customer, MessageChannel } from '../types';
import { api } from '../utils/apiClient';
import { playNotificationSound } from '../utils/audioUtils';
import { isSamePhoneNumber } from '../utils/crmUtils';

const STORAGE_KEY_CENTRAL_MESSAGES = 'yumcrm_central_messages_v2';

const loadMessages = (): CentralMessage[] => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_CENTRAL_MESSAGES);
    if (!saved) return [];
    const sampleIds = new Set(['msg_1', 'msg_2', 'msg_3', 'msg_4', 'msg_5']);
    return (JSON.parse(saved) as CentralMessage[]).filter((message) => !sampleIds.has(message.id));
  } catch {
    return [];
  }
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
  const [messages, setMessages] = useState<CentralMessage[]>(loadMessages);
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

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_CENTRAL_MESSAGES, JSON.stringify(messages));
    } catch (error) {
      console.error('Error saving central messages to localStorage', error);
    }
  }, [messages]);

  const unreadCount = useMemo(
    () => messages.filter((message) => !message.isRead && message.sender === 'customer').length,
    [messages]
  );

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

    api.post('/meta/messages/read', {
      customerId: customer?.id || targetId,
      customerPhone: phone,
      messageIds,
      readBy: reader,
    }).catch(() => null);
  }, []);

  useEffect(() => {
    const knownMessageIds = new Set<string>();

    const fetchInitialMessages = async () => {
      try {
        const response = await api.get<any>('/meta/messages');
        const realMessages: CentralMessage[] = Array.isArray(response)
          ? response
          : response?.messages || [];
        if (!Array.isArray(realMessages) || realMessages.length === 0) return;

        realMessages.forEach((message) => knownMessageIds.add(message.id));
        setMessages((previous) => {
          const currentSelected = selectedCustomerIdRef.current;
          const backendIds = new Set(realMessages.map((message) => message.id));
          const optimisticMessages = previous.filter(
            (message) => !backendIds.has(message.id) && message.id.startsWith('msg_')
          );
          const hydratedMessages = realMessages.map((message) => {
            const previousMessage = previous.find((item) => item.id === message.id);
            const isSelected = Boolean(
              currentSelected
              && (message.customerId === currentSelected
                || isSamePhoneNumber(message.customerPhone, currentSelected))
            );
            return {
              ...message,
              isRead: previousMessage?.isRead === true || isSelected || Boolean(message.isRead),
              readBy: message.readBy
                || previousMessage?.readBy
                || (isSelected ? currentUserRef.current?.name || 'Nhân viên' : undefined),
              readAt: message.readAt
                || previousMessage?.readAt
                || (isSelected ? new Date().toISOString() : undefined),
            };
          });
          return [...hydratedMessages, ...optimisticMessages].sort(
            (first, second) => new Date(first.timestamp).getTime() - new Date(second.timestamp).getTime()
          );
        });
      } catch {
        // Keep locally cached messages while the backend is unavailable.
      }
    };

    void fetchInitialMessages();

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
  }, [setCustomers]);

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
      const response: any = await api.post('/meta/messages/send', {
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
  }, [setCustomers]);

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
    setMessages((previous) =>
      previous.filter(
        (message) => message.customerId !== customerId
          && !isSamePhoneNumber(message.customerPhone, phone)
      )
    );
    try {
      const cleanPhone = phone.replace(/\D/g, '');
      const query = cleanPhone ? `?customerPhone=${encodeURIComponent(cleanPhone)}` : '';
      await api.delete(`/meta/messages/thread/${encodeURIComponent(customerId)}${query}`);
    } catch (error) {
      console.error('Error deleting thread via API:', error);
    }
  }, [messages]);

  const deleteMessage = useCallback(async (messageId: string) => {
    if (currentUserRef.current?.role !== 'Admin') {
      alert('Chỉ tài khoản Admin mới có quyền xóa tin nhắn!');
      return;
    }
    setMessages((previous) => previous.filter((message) => message.id !== messageId));
    try {
      await api.delete(`/meta/messages/item/${encodeURIComponent(messageId)}`);
    } catch (error) {
      console.error('Error deleting message via API:', error);
    }
  }, []);

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
  };
}
