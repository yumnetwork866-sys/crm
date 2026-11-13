interface ConversationCursor {
  timestamp: string | null;
  id: string;
}

export function encodeConversationCursor(timestamp: Date | string | null, id: string): string {
  return Buffer.from(JSON.stringify({
    version: 2,
    timestamp: timestamp === null ? null : new Date(timestamp).toISOString(),
    id,
  })).toString('base64url');
}

export function decodeConversationCursor(value: unknown): ConversationCursor | null {
  if (value === undefined || value === '') return null;
  if (typeof value !== 'string' || value.length > 4096 || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error('Invalid conversation cursor');
  }
  const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
  if (!parsed || parsed.version !== 2 || typeof parsed.id !== 'string' || !parsed.id || parsed.id.length > 1024
    || (parsed.timestamp !== null && (typeof parsed.timestamp !== 'string' || !Number.isFinite(Date.parse(parsed.timestamp))))) {
    throw new Error('Invalid conversation cursor');
  }
  return { timestamp: parsed.timestamp === null ? null : new Date(parsed.timestamp).toISOString(), id: parsed.id };
}
