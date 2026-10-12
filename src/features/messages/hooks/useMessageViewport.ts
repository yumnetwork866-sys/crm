import { useCallback, useEffect, useRef, useState } from 'react';

interface UseMessageViewportOptions {
  threadId?: string;
  messageCount: number;
  isLoadingOlderMessages: boolean;
  hasOlderMessages?: boolean;
  onLoadOlderMessages?: () => Promise<unknown>;
}

export function useMessageViewport({
  threadId,
  messageCount,
  isLoadingOlderMessages,
  hasOlderMessages = false,
  onLoadOlderMessages,
}: UseMessageViewportOptions) {
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const isLoadingOlderRef = useRef(false);
  const isInitialLayoutDoneRef = useRef(false);
  const [showScrollBottomButton, setShowScrollBottomButton] = useState(false);

  const scrollToBottom = useCallback((behavior: 'smooth' | 'auto' = 'smooth') => {
    const container = chatContainerRef.current;
    if (container) {
      if (behavior === 'auto') container.scrollTop = container.scrollHeight;
      else container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
      return;
    }
    chatEndRef.current?.scrollIntoView({ behavior });
  }, []);

  const loadOlderMessages = useCallback(async () => {
    if (!onLoadOlderMessages || isLoadingOlderMessages || isLoadingOlderRef.current) return;
    const container = chatContainerRef.current;
    const previousScrollHeight = container?.scrollHeight ?? 0;
    const previousScrollTop = container?.scrollTop ?? 0;
    isLoadingOlderRef.current = true;
    try {
      await onLoadOlderMessages();
    } finally {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (container) {
          const delta = container.scrollHeight - previousScrollHeight;
          container.scrollTop = previousScrollTop + delta;
        }
        isLoadingOlderRef.current = false;
      }));
    }
  }, [isLoadingOlderMessages, onLoadOlderMessages]);

  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      setShowScrollBottomButton(
        scrollHeight - scrollTop - clientHeight > 180
      );

      // Auto-load older messages when user scrolls near the top (within 150px)
      if (
        hasOlderMessages &&
        !isLoadingOlderMessages &&
        !isLoadingOlderRef.current &&
        isInitialLayoutDoneRef.current &&
        scrollTop <= 150 &&
        scrollHeight > clientHeight
      ) {
        void loadOlderMessages();
      }
    };
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [hasOlderMessages, isLoadingOlderMessages, loadOlderMessages, threadId]);

  useEffect(() => {
    if (!threadId) return;
    isInitialLayoutDoneRef.current = false;
    scrollToBottom('auto');
    const timers = [40, 120, 300].map((delay) =>
      window.setTimeout(() => {
        scrollToBottom('auto');
        if (delay === 300) {
          isInitialLayoutDoneRef.current = true;
        }
      }, delay)
    );
    return () => timers.forEach(window.clearTimeout);
  }, [scrollToBottom, threadId]);

  useEffect(() => {
    if (isLoadingOlderRef.current) return;
    scrollToBottom('smooth');
    const timer = window.setTimeout(() => scrollToBottom('smooth'), 80);
    return () => window.clearTimeout(timer);
  }, [messageCount, scrollToBottom]);

  return {
    chatContainerRef,
    chatEndRef,
    showScrollBottomBtn: showScrollBottomButton,
    scrollToBottom,
    handleLoadOlderMessages: loadOlderMessages,
  };
}
