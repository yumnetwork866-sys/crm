import { useCallback, useEffect, useRef, useState } from 'react';
import { realtimeClient } from '../../../services/realtimeClient';
import { api } from '../../../utils/apiClient';

interface TypingEvent {
  threadId: string;
  businessPhoneNumberId: string;
  userId: string;
  userName: string;
  isTyping: boolean;
  expiresAt: string;
}

export interface TypingUser {
  id: string;
  name: string;
  expiresAt: number;
}

interface UseThreadTypingOptions {
  threadId?: string;
  businessPhoneNumberId: string;
  currentUserId?: string;
}

const TYPING_HEARTBEAT_MS = 2_000;
const TYPING_IDLE_MS = 3_500;

export function useThreadTyping({
  threadId,
  businessPhoneNumberId,
  currentUserId,
}: UseThreadTypingOptions) {
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const lastHeartbeatAtRef = useRef(0);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPublishingRef = useRef(false);

  const publish = useCallback((isTyping: boolean) => {
    if (!threadId || !businessPhoneNumberId) return;
    if (!isTyping && !isPublishingRef.current) return;
    isPublishingRef.current = isTyping;
    if (!isTyping) lastHeartbeatAtRef.current = 0;
    void api.post('/meta/messages/typing', {
      threadId,
      businessPhoneNumberId,
      isTyping,
    }).catch(() => undefined);
  }, [businessPhoneNumberId, threadId]);

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
        if (
          !payload.userId
          || payload.userId === currentUserId
          || payload.threadId !== threadId
          || payload.businessPhoneNumberId !== businessPhoneNumberId
        ) return;

        setTypingUsers((current) => {
          const withoutUser = current.filter((user) => user.id !== payload.userId);
          if (!payload.isTyping) return withoutUser;
          return [...withoutUser, {
            id: payload.userId,
            name: payload.userName || 'Nhân viên',
            expiresAt: new Date(payload.expiresAt).getTime(),
          }];
        });
      } catch {
        // Ignore malformed realtime typing events.
      }
    },
  }), [businessPhoneNumberId, currentUserId, threadId]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();
      setTypingUsers((current) => current.filter((user) => user.expiresAt > now));
    }, 1_000);
    return () => window.clearInterval(timer);
  }, []);

  return { typingUsers, notifyTyping, stopTyping };
}
