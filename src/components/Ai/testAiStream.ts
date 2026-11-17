import { ApiError, clearLegacyStoredTokens } from '../../utils/apiClient';
import type { AiTestEvent, AiTraceStep } from '../../../shared/aiTrace';

/** Lines may cross network chunks, including in the middle of a UTF-8 character. */
export async function readAiTestStream(
  body: ReadableStream<Uint8Array>,
  onStep: (step: AiTraceStep) => void,
): Promise<Record<string, unknown>> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result: Record<string, unknown> | undefined;
  const consume = (line: string) => {
    if (!line.trim()) return;
    const event = JSON.parse(line) as AiTestEvent;
    if (event.type === 'step') onStep(event.step);
    if (event.type === 'result') result = event.result;
    if (event.type === 'error') throw new ApiError(event.error, 502, event);
  };
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      let newline: number;
      while ((newline = buffer.indexOf('\n')) >= 0) {
        consume(buffer.slice(0, newline));
        buffer = buffer.slice(newline + 1);
      }
      if (done) break;
    }
    consume(buffer);
    if (!result) throw new Error('Kết nối kết thúc trước khi nhận được kết quả AI.');
    return result;
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export async function streamTestAi(
  messages: { sender: string; content: string }[],
  signal: AbortSignal,
  onStep: (step: AiTraceStep) => void,
) {
  const token =
    localStorage.getItem('yumnetwork_crm_jwt_token') || localStorage.getItem('vietcrm_jwt_token');
  const response = await fetch('/api/ai/test', {
    method: 'POST',
    credentials: 'same-origin',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/x-ndjson',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ messages }),
  });
  if (response.status === 401) clearLegacyStoredTokens();
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new ApiError(
      data.error || `HTTP ${response.status}`,
      response.status,
      data,
      response.headers.get('X-Request-Id') || undefined,
    );
  }
  if (!response.body || !response.headers.get('Content-Type')?.includes('application/x-ndjson'))
    throw new Error('Backend chưa hỗ trợ theo dõi từng bước. Cần cập nhật backend.');
  return readAiTestStream(response.body, onStep);
}
