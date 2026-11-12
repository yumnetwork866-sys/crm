export const ALL_BUSINESS_PHONES = 'all';

export function scopeThreadId(phoneId: string, threadId: string): string {
  return `waba:${phoneId}:${threadId}`;
}

export function parseThreadId(threadId: string): { phoneId: string; threadId: string } {
  const match = /^waba:(\d+):(.*)$/.exec(threadId);
  return match ? { phoneId: match[1], threadId: match[2] } : { phoneId: '', threadId };
}
