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
  const [result, setResult] = useState<{ key: string; suggestions: string[]; isLoading: boolean }>({
    key: '', suggestions: [], isLoading: false,
  });
  const [dismissedKeys, setDismissedKeys] = useState<Record<string, boolean>>({});
  const [refreshVersion, setRefreshVersion] = useState(0);
  const cacheRef = useRef(new Map<string, string[]>());
  const threadRef = useRef(activeThread);

  // Keep the payload fresh without making object replacement restart the request.
  useEffect(() => {
    threadRef.current = activeThread;
  }, [activeThread]);

  const lastMessage = activeThread?.lastMessage;
  const isCustomerLast = lastMessage?.sender === 'customer';
  const requestKey = activeThread?.threadId && lastMessage?.id
    ? JSON.stringify([activeThread.threadId, lastMessage.id, brandName || ''])
    : '';
  const isDismissed = Boolean(dismissedKeys[requestKey]);

  useEffect(() => {
    const thread = threadRef.current;
    if (!enabled || !requestKey || !isCustomerLast || isDismissed || !thread) {
      setResult({ key: requestKey, suggestions: [], isLoading: false });
      return;
    }

    const cached = cacheRef.current.get(requestKey);
    if (cached) {
      setResult({ key: requestKey, suggestions: cached, isLoading: false });
      return;
    }

    const controller = new AbortController();
    setResult({ key: requestKey, suggestions: [], isLoading: true });

    const fetchSuggestions = async () => {
      try {
        const token = localStorage.getItem('token') || '';
        const res = await fetch('/api/meta/messages/suggest-replies', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            phone: thread.customerPhone,
            customerName: thread.customerName,
            brandName,
            messages: (thread.messages || []).slice(-10).map((message) => ({
              sender: message.sender,
              content: message.content,
              timestamp: message.timestamp,
            })),
          }),
          signal: controller.signal,
        });

        if (res.ok) {
          const data = await res.json();
          // An old response must never replace the current conversation's replies,
          // even if the transport completed after cancellation.
          if (controller.signal.aborted) return;
          const items: string[] = Array.isArray(data.suggestions) ? data.suggestions : [];
          cacheRef.current.set(requestKey, items);
          setResult({ key: requestKey, suggestions: items, isLoading: false });
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          console.warn('[AI Suggest Replies] Lỗi khi tạo gợi ý tin nhắn:', err);
        }
      } finally {
        if (!controller.signal.aborted) {
          setResult((previous) => ({ ...previous, isLoading: false }));
        }
      }
    };
    void fetchSuggestions();

    return () => controller.abort();
  }, [enabled, requestKey, isCustomerLast, isDismissed, brandName, refreshVersion]);

  const dismissSuggestions = useCallback(() => {
    if (requestKey) {
      setDismissedKeys((previous) => ({ ...previous, [requestKey]: true }));
    }
  }, [requestKey]);

  const refreshSuggestions = useCallback(() => {
    if (!requestKey || !enabled || !isCustomerLast) return;
    cacheRef.current.delete(requestKey);
    setDismissedKeys((previous) => {
      const next = { ...previous };
      delete next[requestKey];
      return next;
    });
    // Let the effect own every request, including refresh after dismissal.
    setRefreshVersion((previous) => previous + 1);
  }, [requestKey, enabled, isCustomerLast]);

  const suggestions = result.key === requestKey ? result.suggestions : [];
  const isLoading = enabled && isCustomerLast && !isDismissed &&
    result.key === requestKey && result.isLoading;
  const isVisible = enabled && isCustomerLast && !isDismissed &&
    (isLoading || suggestions.length > 0);

  return { suggestions, isLoading, isVisible, dismissSuggestions, refreshSuggestions };
}
