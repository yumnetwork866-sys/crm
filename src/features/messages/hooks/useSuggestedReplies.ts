import { useEffect, useRef, useState, useCallback } from 'react';
import type { MessageThread } from '../types';

interface UseSuggestedRepliesOptions {
  activeThread: MessageThread | null;
  brandName?: string;
  enabled?: boolean;
}

export interface UseSuggestedRepliesReturn {
  suggestions: string[];
  isLoading: boolean;
  isVisible: boolean;
  dismissSuggestions: () => void;
  refreshSuggestions: () => void;
}

export function useSuggestedReplies({
  activeThread,
  brandName,
  enabled = true,
}: UseSuggestedRepliesOptions): UseSuggestedRepliesReturn {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dismissedMessageIds, setDismissedMessageIds] = useState<Record<string, boolean>>({});

  // In-memory cache by lastMessageId to avoid duplicate network calls
  const cacheRef = useRef<Record<string, string[]>>({});
  const activeAbortRef = useRef<AbortController | null>(null);

  const activeThreadId = activeThread?.threadId || '';
  const lastMessage = activeThread?.lastMessage;
  const lastMessageId = lastMessage?.id || '';
  const isCustomerLast = lastMessage?.sender === 'customer';
  const isDismissed = Boolean(lastMessageId && dismissedMessageIds[lastMessageId]);

  const fetchSuggestions = useCallback(
    async (force = false) => {
      if (!enabled || !activeThread || !lastMessageId || !isCustomerLast) {
        setSuggestions([]);
        setIsLoading(false);
        return;
      }

      // Check cache first
      if (!force && cacheRef.current[lastMessageId]) {
        setSuggestions(cacheRef.current[lastMessageId]);
        setIsLoading(false);
        return;
      }

      // Abort previous in-flight request
      if (activeAbortRef.current) {
        activeAbortRef.current.abort();
      }

      const controller = new AbortController();
      activeAbortRef.current = controller;
      setIsLoading(true);

      try {
        const token = localStorage.getItem('token') || '';
        const res = await fetch('/api/meta/messages/suggest-replies', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            phone: activeThread.customerPhone,
            customerName: activeThread.customerName,
            brandName,
            messages: (activeThread.messages || []).slice(-10).map((m) => ({
              sender: m.sender,
              content: m.content,
              timestamp: m.timestamp,
            })),
          }),
          signal: controller.signal,
        });

        if (res.ok) {
          const data = await res.json();
          const items: string[] = Array.isArray(data.suggestions) ? data.suggestions : [];
          cacheRef.current[lastMessageId] = items;
          setSuggestions(items);
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.warn('[AI Suggest Replies] Lỗi khi tạo gợi ý tin nhắn:', err);
        }
      } finally {
        if (activeAbortRef.current === controller) {
          setIsLoading(false);
          activeAbortRef.current = null;
        }
      }
    },
    [
      enabled,
      activeThread,
      lastMessageId,
      isCustomerLast,
      brandName,
    ]
  );

  // Auto trigger when last customer message arrives or changes
  useEffect(() => {
    if (!enabled || !isCustomerLast || isDismissed) {
      if (!isCustomerLast) {
        setSuggestions([]);
      }
      return;
    }

    fetchSuggestions(false);

    return () => {
      if (activeAbortRef.current) {
        activeAbortRef.current.abort();
        activeAbortRef.current = null;
      }
    };
  }, [enabled, activeThreadId, lastMessageId, isCustomerLast, isDismissed, fetchSuggestions]);

  const dismissSuggestions = useCallback(() => {
    if (lastMessageId) {
      setDismissedMessageIds((prev) => ({ ...prev, [lastMessageId]: true }));
    }
  }, [lastMessageId]);

  const refreshSuggestions = useCallback(() => {
    if (lastMessageId) {
      setDismissedMessageIds((prev) => {
        const next = { ...prev };
        delete next[lastMessageId];
        return next;
      });
      delete cacheRef.current[lastMessageId];
    }
    fetchSuggestions(true);
  }, [lastMessageId, fetchSuggestions]);

  const isVisible =
    enabled &&
    isCustomerLast &&
    !isDismissed &&
    (isLoading || suggestions.length > 0);

  return {
    suggestions,
    isLoading,
    isVisible,
    dismissSuggestions,
    refreshSuggestions,
  };
}
