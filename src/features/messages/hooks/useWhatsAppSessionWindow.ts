import { useEffect, useMemo, useState } from 'react';
import type { MessageThread } from '../types';

export function useWhatsAppSessionWindow(activeThread: MessageThread | null) {
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const session24hInfo = useMemo(() => {
    if (!activeThread?.messages.length) return null;
    const customerMessages = activeThread.messages.filter((message) => message.sender === 'customer');
    const referenceTimestamp = customerMessages.at(-1)?.timestamp || activeThread.lastMessage.timestamp;
    const expiresAtMs = new Date(referenceTimestamp).getTime() + 24 * 60 * 60 * 1000;
    const remainingMs = Math.max(0, expiresAtMs - currentTime);
    const isExpired = remainingMs <= 0;
    const hours = Math.floor(remainingMs / (1000 * 60 * 60));
    const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((remainingMs % (1000 * 60)) / 1000);

    return {
      isExpired,
      hours,
      minutes,
      seconds,
      remainingMs,
      expiresAt: new Date(expiresAtMs).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      formattedTime: isExpired
        ? 'Hết hạn'
        : `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`,
    };
  }, [activeThread, currentTime]);

  return { currentTime, session24hInfo };
}
