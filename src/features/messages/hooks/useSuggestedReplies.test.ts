import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MessageThread } from '../types';

// Run the hook's dependency/effect lifecycle in Node without a browser dependency.
const lifecycle = vi.hoisted(() => ({
  slots: [] as any[],
  cursor: 0,
  pending: [] as (() => void)[],
  dirty: false,
}));
vi.mock('react', () => ({
  useRef: (value: unknown) => {
    const index = lifecycle.cursor++;
    return (lifecycle.slots[index] ??= { current: value });
  },
  useState: (initial: unknown) => {
    const index = lifecycle.cursor++;
    lifecycle.slots[index] ??= { value: initial };
    return [
      lifecycle.slots[index].value,
      (next: any) => {
        const slot = lifecycle.slots[index];
        const value = typeof next === 'function' ? next(slot.value) : next;
        if (!Object.is(value, slot.value)) {
          slot.value = value;
          lifecycle.dirty = true;
        }
      },
    ];
  },
  useCallback: (callback: unknown) => callback,
  useEffect: (effect: () => (() => void) | undefined, deps: unknown[]) => {
    const index = lifecycle.cursor++;
    const previous = lifecycle.slots[index];
    if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) {
      lifecycle.slots[index] = { deps, cleanup: previous?.cleanup };
      lifecycle.pending.push(() => {
        lifecycle.slots[index].cleanup?.();
        lifecycle.slots[index].cleanup = effect();
      });
    }
  },
}));
import { useSuggestedReplies } from './useSuggestedReplies';

function thread(threadId = 'a', messageId = 'm1'): MessageThread {
  const message = {
    id: messageId,
    sender: 'customer' as const,
    content: 'Hello',
    timestamp: '2026-11-13T08:00:00Z',
    customerId: threadId,
    customerName: threadId,
    customerPhone: threadId,
    channel: 'WhatsApp' as const,
    isRead: false,
  };
  return {
    threadId,
    customer: null,
    customerName: threadId,
    customerPhone: threadId,
    lastMessage: message,
    messages: [message],
    unreadCount: 1,
    isPinned: false,
  };
}
let options: Parameters<typeof useSuggestedReplies>[0];
function render(update = {}) {
  options = { ...options, ...update };
  let output: ReturnType<typeof useSuggestedReplies>;
  do {
    lifecycle.dirty = false;
    lifecycle.cursor = 0;
    // The test runner explicitly drives successive renders and effect cleanups.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    output = useSuggestedReplies(options);
    lifecycle.pending.splice(0).forEach((effect) => effect());
  } while (lifecycle.dirty);
  return output;
}
const requests: { signal: AbortSignal; body: string; resolve: (response: unknown) => void }[] = [];
async function complete(index: number, suggestions: string[]) {
  requests[index].resolve({ ok: true, json: async () => ({ suggestions }) });
  await new Promise((resolve) => setTimeout(resolve, 0));
  return render();
}
function unmount() {
  lifecycle.slots.forEach((slot) => slot.cleanup?.());
}
beforeEach(() => {
  lifecycle.slots = [];
  lifecycle.pending = [];
  requests.length = 0;
  options = { activeThread: thread(), brandName: 'Actiscar' };
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.stubGlobal('localStorage', { getItem: () => 'token' });
  vi.stubGlobal(
    'fetch',
    vi.fn(
      (_url, init) =>
        new Promise((resolve) => {
          requests.push({ ...init, resolve });
        }),
    ),
  );
});
afterEach(() => {
  unmount();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('suggested replies request lifecycle', () => {
  it('keeps one request through repeated thread object replacements and caches its result', async () => {
    expect(render().isLoading).toBe(true);
    render({ activeThread: thread() });
    render({ activeThread: thread() });
    expect(requests).toHaveLength(1);
    expect(requests[0].signal.aborted).toBe(false);
    expect((await complete(0, ['Reply A'])).suggestions).toEqual(['Reply A']);
    render({ activeThread: thread() });
    expect(requests).toHaveLength(1);
  });

  it('cancels for a new message and ignores a late response from the old message', async () => {
    render();
    expect(render({ activeThread: thread('a', 'm2') }).suggestions).toEqual([]);
    expect(requests[0].signal.aborted).toBe(true);
    expect(requests).toHaveLength(2);
    await complete(1, ['New reply']);
    expect((await complete(0, ['Stale reply'])).suggestions).toEqual(['New reply']);
  });

  it('scopes cached replies by conversation and restores them on return', async () => {
    render();
    await complete(0, ['Reply A']);
    expect(render({ activeThread: thread('b') }).suggestions).toEqual([]);
    await complete(1, ['Reply B']);
    expect(render({ activeThread: thread() }).suggestions).toEqual(['Reply A']);
    expect(requests).toHaveLength(2);
  });

  it('refreshes once after dismissal, using the latest thread payload', async () => {
    render();
    const output = await complete(0, ['Old']);
    output.dismissSuggestions();
    const current = render({ activeThread: { ...thread(), customerName: 'Updated customer' } });
    expect(current.isVisible).toBe(false);
    current.refreshSuggestions();
    expect(render().isLoading).toBe(true);
    expect(requests).toHaveLength(2);
    expect(JSON.parse(requests[1].body).customerName).toBe('Updated customer');
    expect(JSON.parse(requests[1].body).force).toBe(true);
    expect((await complete(1, ['Fresh'])).suggestions).toEqual(['Fresh']);
  });

  it('cancels and clears loading when disabled, with no stale result on re-enable', async () => {
    render();
    expect(render({ enabled: false }).isLoading).toBe(false);
    expect(requests[0].signal.aborted).toBe(true);
    await complete(0, ['Stale']);
    expect(render({ enabled: true }).suggestions).toEqual([]);
    expect(requests).toHaveLength(2);
  });

  it('shows backend errors with the run ID and allows a deliberate retry', async () => {
    render();
    requests[0].resolve({
      ok: false,
      json: async () => ({ error: 'Model timeout', runId: 'run-123' }),
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const failed = render();
    expect(failed.error).toContain('run-123');
    expect(failed.isVisible).toBe(true);
    expect(failed.isLoading).toBe(false);
    failed.refreshSuggestions();
    expect(render().isLoading).toBe(true);
    expect(JSON.parse(requests[1].body).force).toBe(true);
  });

  it('cancels on outgoing messages and unmount', () => {
    render();
    const outgoing = thread();
    outgoing.lastMessage.sender = 'agent';
    expect(render({ activeThread: outgoing }).isVisible).toBe(false);
    expect(requests[0].signal.aborted).toBe(true);
    render({ activeThread: thread('a', 'm2') });
    unmount();
    expect(requests[1].signal.aborted).toBe(true);
  });
});
