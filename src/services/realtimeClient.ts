export type RealtimeEventHandler = (event: MessageEvent) => void;

class RealtimeClient {
  private source: EventSource | null = null;
  private readonly handlers = new Map<string, Set<RealtimeEventHandler>>();
  private readonly dispatchers = new Map<string, EventListener>();

  subscribe(eventHandlers: Record<string, RealtimeEventHandler>): () => void {
    Object.entries(eventHandlers).forEach(([eventName, handler]) => {
      let handlersForEvent = this.handlers.get(eventName);
      if (!handlersForEvent) {
        handlersForEvent = new Set();
        this.handlers.set(eventName, handlersForEvent);
      }
      handlersForEvent.add(handler);
      this.attachDispatcher(eventName);
    });
    this.connect();

    let subscribed = true;
    return () => {
      if (!subscribed) return;
      subscribed = false;
      Object.entries(eventHandlers).forEach(([eventName, handler]) => {
        const handlersForEvent = this.handlers.get(eventName);
        handlersForEvent?.delete(handler);
        if (handlersForEvent?.size === 0) {
          this.handlers.delete(eventName);
          const dispatcher = this.dispatchers.get(eventName);
          if (dispatcher && this.source) this.source.removeEventListener(eventName, dispatcher);
          this.dispatchers.delete(eventName);
        }
      });
      if (this.handlers.size === 0) this.disconnect();
    };
  }

  disconnect(): void {
    this.source?.close();
    this.source = null;
  }

  private connect(): void {
    if (this.source || this.handlers.size === 0) return;
    this.source = new EventSource('/api/meta/messages/stream');
    this.source.onerror = (error) => {
      console.warn(
        '[REALTIME SSE] Kết nối bị gián đoạn, trình duyệt đang tự kết nối lại...',
        error,
      );
    };
    this.dispatchers.forEach((dispatcher, eventName) => {
      this.source?.addEventListener(eventName, dispatcher);
    });
  }

  private attachDispatcher(eventName: string): void {
    if (this.dispatchers.has(eventName)) return;
    const dispatcher: EventListener = (event) => {
      const messageEvent = event as MessageEvent;
      this.handlers.get(eventName)?.forEach((handler) => handler(messageEvent));
    };
    this.dispatchers.set(eventName, dispatcher);
    this.source?.addEventListener(eventName, dispatcher);
  }
}

export const realtimeClient = new RealtimeClient();

if (import.meta.hot) {
  import.meta.hot.dispose(() => realtimeClient.disconnect());
}
