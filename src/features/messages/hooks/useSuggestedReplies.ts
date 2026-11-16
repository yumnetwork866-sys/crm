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
  error: string;
  dismissSuggestions: () => void;
  refreshSuggestions: () => void;
}

export function useSuggestedReplies({
  activeThread,
  brandName,
  enabled = true,
}: UseSuggestedRepliesOptions): UseSuggestedRepliesReturn {
  const [result, setResult] = useState<{
    key: string;
    suggestions: string[];
    isLoading: boolean;
    error?: string;
  }>({
    key: '',
    suggestions: [],
    isLoading: false,
  });
  const [dismissedKeys, setDismissedKeys] = useState<Record<string, boolean>>({});
  const [refreshVersion, setRefreshVersion] = useState(0);
  const cacheRef = useRef(new Map<string, string[]>());
  const forceRefreshRef = useRef('');
  const threadRef = useRef(activeThread);
  const [serverEnabled, setServerEnabled] = useState(true);
  const available = enabled && serverEnabled;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleConfiguration = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.scope === 'global' && typeof detail.suggestionsEnabled === 'boolean') {
        cacheRef.current.clear();
        setServerEnabled(detail.suggestionsEnabled);
      }
    };
    window.addEventListener('ai:status_change', handleConfiguration);
    return () => window.removeEventListener('ai:status_change', handleConfiguration);
  }, []);

  // Keep the payload fresh without making object replacement restart the request.
  useEffect(() => {
    threadRef.current = activeThread;
  }, [activeThread]);

  const lastMessage = activeThread?.lastMessage;
  const isCustomerLast = lastMessage?.sender === 'customer';
  const requestKey =
    activeThread?.threadId && lastMessage?.id
      ? JSON.stringify([activeThread.threadId, lastMessage.id, brandName || ''])
      : '';
  const isDismissed = Boolean(dismissedKeys[requestKey]);

  useEffect(() => {
    const thread = threadRef.current;
    if (!available || !requestKey || !isCustomerLast || isDismissed || !thread) {
      setResult({ key: requestKey, suggestions: [], isLoading: false });
      return;
    }

    const cached = cacheRef.current.get(requestKey);
    if (cached) {
      setResult({ key: requestKey, suggestions: cached, isLoading: false });
      return;
    }

    const controller = new AbortController();
    const force = forceRefreshRef.current === requestKey;
    forceRefreshRef.current = '';
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
            force,
            phone: thread.customerPhone,
            customerId: thread.lastMessage.customerId,
            businessPhoneNumberId: thread.lastMessage.businessPhoneNumberId,
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

        const data = await res.json();
        if (controller.signal.aborted) return;
        if (!res.ok) {
          if (data.code === 'AI_DISABLED') return;
          throw new Error(
            `${data.error || 'Không tạo được gợi ý AI.'}${data.runId ? ` · Mã: ${data.runId}` : ''}`,
          );
        }
        const items: string[] = Array.isArray(data.suggestions)
          ? data.suggestions.filter((item: unknown) => typeof item === 'string' && item.trim())
          : [];
        if (!items.length) throw new Error('AI trả kết quả không hợp lệ. Vui lòng thử lại.');
        cacheRef.current.set(requestKey, items);
        setResult({ key: requestKey, suggestions: items, isLoading: false });
      } catch (err) {
        if (!controller.signal.aborted) {
          setResult({
            key: requestKey,
            suggestions: [],
            isLoading: false,
            error: err instanceof Error ? err.message : 'Không kết nối được AI.',
          });
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
  }, [available, requestKey, isCustomerLast, isDismissed, brandName, refreshVersion]);

  const dismissSuggestions = useCallback(() => {
    if (requestKey) {
      setDismissedKeys((previous) => ({ ...previous, [requestKey]: true }));
    }
  }, [requestKey]);

  const refreshSuggestions = useCallback(() => {
    if (!requestKey || !available || !isCustomerLast) return;
    cacheRef.current.delete(requestKey);
    forceRefreshRef.current = requestKey;
    setDismissedKeys((previous) => {
      const next = { ...previous };
      delete next[requestKey];
      return next;
    });
    // Let the effect own every request, including refresh after dismissal.
    setRefreshVersion((previous) => previous + 1);
  }, [requestKey, available, isCustomerLast]);

  const suggestions = result.key === requestKey ? result.suggestions : [];
  const isLoading =
    available && isCustomerLast && !isDismissed && result.key === requestKey && result.isLoading;
  const error = result.key === requestKey ? result.error || '' : '';
  const isVisible =
    available &&
    isCustomerLast &&
    !isDismissed &&
    (isLoading || suggestions.length > 0 || Boolean(error));

  return { suggestions, isLoading, isVisible, error, dismissSuggestions, refreshSuggestions };
}
