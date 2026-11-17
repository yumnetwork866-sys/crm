import { describe, expect, it } from 'vitest';
import { readAiTestStream } from './testAiStream';
import type { AiTraceStep } from '../../../shared/aiTrace';

function stream(text: string, splitEvery = 1) {
  const bytes = new TextEncoder().encode(text);
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < bytes.length; i += splitEvery)
        controller.enqueue(bytes.slice(i, i + splitEvery));
      controller.close();
    },
  });
}

describe('AI test trace stream', () => {
  it('handles fragmented UTF-8, multiple events, heartbeats and a final line without newline', async () => {
    const step: AiTraceStep = { id: 'keyword', title: 'Truy xuất tiếng Việt', status: 'completed' };
    const steps: AiTraceStep[] = [];
    const events = [
      { type: 'heartbeat' },
      { type: 'step', step },
      { type: 'result', result: { answer: 'Đã tìm thấy nguồn.' } },
    ];
    expect(
      await readAiTestStream(
        stream(events.map((event) => JSON.stringify(event)).join('\n')),
        (value) => steps.push(value),
      ),
    ).toEqual({ answer: 'Đã tìm thấy nguồn.' });
    expect(steps).toEqual([step]);
  });
  it('preserves an intermediate step when the server reports a rerank failure', async () => {
    const steps: AiTraceStep[] = [];
    const events = [
      { type: 'step', step: { id: 'rerank', title: 'Rerank', status: 'running' } },
      { type: 'error', error: 'Rerank timeout', code: 'RERANK_TIMEOUT', stage: 'rerank' },
    ];
    await expect(
      readAiTestStream(
        stream(events.map((event) => JSON.stringify(event)).join('\n'), 32),
        (value) => steps.push(value),
      ),
    ).rejects.toMatchObject({ message: 'Rerank timeout', details: { stage: 'rerank' } });
    expect(steps).toHaveLength(1);
  });
  it('rejects a disconnected stream without a final result', async () => {
    await expect(readAiTestStream(stream('{"type":"heartbeat"}\n'), () => {})).rejects.toThrow(
      'trước khi nhận được kết quả',
    );
  });
});
