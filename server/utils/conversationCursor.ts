interface ConversationCursor {
  timestamp: string;
  id: string;
}

export function encodeConversationCursor(timestamp: Date | string, id: string): string {
  return Buffer.from(JSON.stringify({ timestamp: new Date(timestamp).toISOString(), id })).toString('base64url');
}

export function decodeConversationCursor(value: unknown): ConversationCursor | null {
  if (value === undefined || value === '') return null;
  if (typeof value !== 'string' || value.length > 2048 || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error('Invalid conversation cursor');
  }
  const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
  if (!parsed || typeof parsed.id !== 'string' || !parsed.id || parsed.id.length > 255
    || typeof parsed.timestamp !== 'string' || !Number.isFinite(Date.parse(parsed.timestamp))) {
    throw new Error('Invalid conversation cursor');
  }
  return { timestamp: new Date(parsed.timestamp).toISOString(), id: parsed.id };
}
