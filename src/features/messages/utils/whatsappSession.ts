import type { MessageThread } from '../types';

const SESSION_WINDOW_MS = 24 * 60 * 60 * 1000;

type CustomerTimeline = Pick<MessageThread, 'lastCustomerMessageAt' | 'lastMessage'> & Partial<Pick<MessageThread, 'messages'>>;

export function getLastCustomerMessageTime(
  thread: CustomerTimeline | null,
): number | null {
  if (!thread) return null;
  const timestamps = [
    thread.lastCustomerMessageAt,
    thread.lastMessage.sender === 'customer' ? thread.lastMessage.timestamp : null,
    ...(thread.messages || []).filter((message) => message.sender === 'customer').map((message) => message.timestamp),
  ].flatMap((timestamp) => {
    const value = timestamp ? Date.parse(timestamp) : NaN;
    return Number.isFinite(value) ? [value] : [];
  });
  return timestamps.length ? Math.max(...timestamps) : null;
}

export function getWhatsAppSessionExpiresAt(thread: CustomerTimeline | null): number | null {
  const timestamp = getLastCustomerMessageTime(thread);
  return timestamp === null ? null : timestamp + SESSION_WINDOW_MS;
}

export function compareLastCustomerMessage(a: CustomerTimeline, b: CustomerTimeline): number {
  const first = getLastCustomerMessageTime(a);
  const second = getLastCustomerMessageTime(b);
  if (first === second) return 0;
  if (first === null) return 1;
  if (second === null) return -1;
  return second - first;
}
