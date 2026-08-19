import { useCallback, useEffect, useRef, useState } from 'react';

interface UseMessageViewportOptions {
  threadId?: string;
  messageCount: number;
  isLoadingOlderMessages: boolean;
  onLoadOlderMessages?: () => Promise<unknown>;
}

export function useMessageViewport({
  threadId,
  messageCount,
  isLoadingOlderMessages,
  onLoadOlderMessages,
}: UseMessageViewportOptions) {
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const isLoadingOlderRef = useRef(false);
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
    if (!onLoadOlderMessages || isLoadingOlderMessages) return;
    const container = chatContainerRef.current;
    const previousScrollHeight = container?.scrollHeight ?? 0;
    isLoadingOlderRef.current = true;
    try {
      await onLoadOlderMessages();
    } finally {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (container) container.scrollTop += container.scrollHeight - previousScrollHeight;
        isLoadingOlderRef.current = false;
      }));
    }
  }, [isLoadingOlderMessages, onLoadOlderMessages]);

  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;
    const handleScroll = () => {
      setShowScrollBottomButton(
        container.scrollHeight - container.scrollTop - container.clientHeight > 180
      );
    };
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [threadId]);

  useEffect(() => {
    if (!threadId) return;
    scrollToBottom('auto');
    const timers = [40, 120, 300].map((delay) =>
      window.setTimeout(() => scrollToBottom('auto'), delay)
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
