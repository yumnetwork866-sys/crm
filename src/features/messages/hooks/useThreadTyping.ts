import { useCallback, useEffect, useRef, useState } from 'react';
import { realtimeClient } from '../../../services/realtimeClient';
import { api } from '../../../utils/apiClient';
import { isSamePhoneNumber } from '../../../utils/crmUtils';

interface TypingEvent {
  threadId: string;
  customerPhone: string;
  businessPhoneNumberId: string;
  userId: string;
  userName: string;
  userEmail: string;
  userAvatar?: string;
  sourceId: string;
  isTyping: boolean;
  expiresAt: string;
}

export interface TypingUser {
  id: string;
  name: string;
  avatar?: string;
  expiresAt: number;
}

interface UseThreadTypingOptions {
  threadId?: string;
  customerPhone?: string;
  businessPhoneNumberId: string;
  currentUserId?: string;
  currentUserEmail?: string;
}

const TYPING_HEARTBEAT_MS = 2_000;
const TYPING_IDLE_MS = 5_000;

export function useThreadTyping({
  threadId,
  customerPhone,
  businessPhoneNumberId,
  currentUserId,
  currentUserEmail,
}: UseThreadTypingOptions) {
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const lastHeartbeatAtRef = useRef(0);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPublishingRef = useRef(false);
  const sourceIdRef = useRef(
    globalThis.crypto?.randomUUID?.() || `typing_${Date.now()}_${Math.random().toString(36).slice(2)}`,
  );

  const publish = useCallback((isTyping: boolean) => {
    if (!threadId || !businessPhoneNumberId) return;
    if (!isTyping && !isPublishingRef.current) return;
    isPublishingRef.current = isTyping;
    if (!isTyping) lastHeartbeatAtRef.current = 0;
    void api.post('/meta/messages/typing', {
      threadId,
      customerPhone,
      businessPhoneNumberId,
      isTyping,
      sourceId: sourceIdRef.current,
    }).catch(() => undefined);
  }, [businessPhoneNumberId, customerPhone, threadId]);

  const stopTyping = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = null;
    publish(false);
  }, [publish]);

  const notifyTyping = useCallback((value: string) => {
    if (!value.trim()) {
      stopTyping();
      return;
    }

    const now = Date.now();
    if (!isPublishingRef.current || now - lastHeartbeatAtRef.current >= TYPING_HEARTBEAT_MS) {
      lastHeartbeatAtRef.current = now;
      publish(true);
    }
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(stopTyping, TYPING_IDLE_MS);
  }, [publish, stopTyping]);

  useEffect(() => {
    setTypingUsers([]);
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
      publish(false);
    };
  }, [publish]);

  useEffect(() => realtimeClient.subscribe({
    'message:typing': (event) => {
      try {
        const payload = JSON.parse(event.data) as TypingEvent;
        const matchesThread = payload.threadId === threadId
          || Boolean(customerPhone && payload.customerPhone && isSamePhoneNumber(payload.customerPhone, customerPhone));
        if (
          !payload.userId
          || payload.sourceId === sourceIdRef.current
          || !matchesThread
          || (businessPhoneNumberId && payload.businessPhoneNumberId && payload.businessPhoneNumberId !== businessPhoneNumberId)
        ) return;

        setTypingUsers((current) => {
          const withoutUser = current.filter((user) => user.id !== payload.userId);
          if (!payload.isTyping) return withoutUser;
          return [...withoutUser, {
            id: payload.userId,
            name: payload.userName || 'Nhân viên',
            avatar: payload.userAvatar,
            expiresAt: new Date(payload.expiresAt).getTime(),
          }];
        });
      } catch {
        // Ignore malformed realtime typing events.
      }
    },
  }), [businessPhoneNumberId, currentUserEmail, currentUserId, customerPhone, threadId]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();
      setTypingUsers((current) => current.filter((user) => user.expiresAt > now));
    }, 1_000);
    return () => window.clearInterval(timer);
  }, []);

  return { typingUsers, notifyTyping, stopTyping };
}
