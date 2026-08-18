// In-memory fallback message store for real-time messaging
export interface InMemoryMessage {
  id: string;
  customerId?: string | null;
  customerName?: string;
  customerPhone?: string;
  sender: 'customer' | 'agent';
  agentName?: string | null;
  channel: string;
  content: string;
  timestamp: string;
  isRead: boolean;
  readBy?: string | null;
  readAt?: string | null;
  isRealSent?: boolean;
  replyTo?: any;
}

let inMemoryMessages: InMemoryMessage[] = [];

export const messageStore = {
  getAll(): InMemoryMessage[] {
    return inMemoryMessages;
  },

  add(msg: InMemoryMessage): void {
    if (!inMemoryMessages.some((m) => m.id === msg.id)) {
      inMemoryMessages.push(msg);
    }
  },

  update(updater: (messages: InMemoryMessage[]) => InMemoryMessage[]): void {
    inMemoryMessages = updater(inMemoryMessages);
  },

  filter(predicate: (m: InMemoryMessage) => boolean): void {
    inMemoryMessages = inMemoryMessages.filter(predicate);
  },

  clear(): void {
    inMemoryMessages = [];
  },

  find(predicate: (m: InMemoryMessage) => boolean): InMemoryMessage | undefined {
    return inMemoryMessages.find(predicate);
  }
};
