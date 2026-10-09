// In-memory fallback message store for real-time messaging
export interface InMemoryMessage {
  id: string;
  customerId?: string | null;
  customerName?: string;
  customerPhone?: string;
  businessPhoneNumberId?: string;
  sender: 'customer' | 'agent';
  agentName?: string | null;
  isAi?: boolean;
  channel: string;
  content: string;
  timestamp: string;
  isRead: boolean;
  readBy?: string | null;
  readAt?: string | null;
  isRealSent?: boolean;
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  errorCode?: string | null;
  errorMessage?: string | null;
  deliveredAt?: string | null;
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

  updateMessage(id: string, patch: Partial<InMemoryMessage>): InMemoryMessage | undefined {
    let updated: InMemoryMessage | undefined;
    inMemoryMessages = inMemoryMessages.map((m) => {
      if (m.id === id) {
        updated = { ...m, ...patch };
        return updated;
      }
      return m;
    });
    return updated;
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
