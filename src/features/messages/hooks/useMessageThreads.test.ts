import { describe, expect, it } from 'vitest';
import type { CentralMessage, Customer } from '../../../types';
import type { ConversationSummary } from '../types';
import { buildMessageThreads } from './useMessageThreads';

const createCustomer = (overrides: Partial<Customer> & { id: string; phone: string; name: string }): Customer => ({
  gender: 'Khác',
  address: '',
  source: 'WhatsApp',
  campaign: 'N/A',
  firstContact: '2026-10-01',
  lastContact: '2026-10-14',
  owner: 'Agent',
  status: 'Contacted',
  totalOrders: 0,
  totalSpent: 0,
  interestedProducts: [],
  notes: [],
  orders: [],
  ...overrides,
});

const createMessage = (overrides: Partial<CentralMessage> & { id: string; customerId: string; customerPhone: string; content: string; timestamp: string }): CentralMessage => ({
  customerName: 'Khách Hàng',
  sender: 'customer',
  channel: 'WhatsApp',
  isRead: false,
  ...overrides,
});

describe('buildMessageThreads (Separated Conversations & Per-Thread Messages)', () => {
  it('preserves all customer threads from conversations even when 1 customer sends 30 consecutive messages', () => {
    const customers: Customer[] = [
      createCustomer({ id: 'cust-1', name: 'Khách A (Nhắn 30 tin)', phone: '+60123456789' }),
      createCustomer({ id: 'cust-2', name: 'Khách B', phone: '+60198765432' }),
      createCustomer({ id: 'cust-3', name: 'Khách C', phone: '+60112233445' }),
    ];

    // 30 consecutive messages from Customer A only (loaded from /meta/messages?paginate=true&limit=30&customerId=cust-1)
    const activeThreadMessages: CentralMessage[] = Array.from({ length: 30 }, (_, index) => {
      const minute = String(index).padStart(2, '0');
      return createMessage({
        id: `msg-a-${index + 1}`,
        customerId: 'cust-1',
        customerName: 'Khách A (Nhắn 30 tin)',
        customerPhone: '+60123456789',
        content: `Tin nhắn liên tiếp số ${index + 1}`,
        timestamp: `2026-10-14T10:${minute}:00.000Z`,
        isRead: true,
      });
    });

    // Conversations summary from /api/meta/messages/conversations
    const conversations: ConversationSummary[] = [
      {
        customerId: 'cust-1',
        customerName: 'Khách A (Nhắn 30 tin)',
        customerPhone: '+60123456789',
        unreadCount: 0,
        lastMessage: activeThreadMessages[29],
      },
      {
        customerId: 'cust-2',
        customerName: 'Khách B',
        customerPhone: '+60198765432',
        unreadCount: 4,
        lastMessage: createMessage({
          id: 'msg-b-last',
          customerId: 'cust-2',
          customerName: 'Khách B',
          customerPhone: '+60198765432',
          content: 'Cho mình hỏi giá sản phẩm',
          timestamp: '2026-10-14T09:15:00.000Z',
          isRead: false,
        }),
      },
      {
        customerId: 'cust-3',
        customerName: 'Khách C',
        customerPhone: '+60112233445',
        unreadCount: 2,
        lastMessage: createMessage({
          id: 'msg-c-last',
          customerId: 'cust-3',
          customerName: 'Khách C',
          customerPhone: '+60112233445',
          content: 'Shop giao hàng chưa ạ?',
          timestamp: '2026-10-14T08:00:00.000Z',
          isRead: false,
        }),
      },
    ];

    const threads = buildMessageThreads({
      conversations,
      messages: activeThreadMessages,
      customers,
      pinnedThreadIds: [],
    });

    // All 3 threads must remain visible in the sidebar
    expect(threads).toHaveLength(3);
    expect(threads.map((t) => t.threadId)).toEqual(['cust-1', 'cust-2', 'cust-3']);

    // Thread A has all 30 loaded messages
    expect(threads[0].messages).toHaveLength(30);
    expect(threads[0].lastMessage.id).toBe('msg-a-30');
    expect(threads[0].unreadCount).toBe(0);

    // Threads B and C preserve their unreadCount and lastMessage from /meta/messages/conversations
    expect(threads[1].customerName).toBe('Khách B');
    expect(threads[1].unreadCount).toBe(4);
    expect(threads[1].lastMessage.content).toBe('Cho mình hỏi giá sản phẩm');

    expect(threads[2].customerName).toBe('Khách C');
    expect(threads[2].unreadCount).toBe(2);
    expect(threads[2].lastMessage.content).toBe('Shop giao hàng chưa ạ?');
  });

  it('links unified CustomerNote records on thread.customer for CustomerChatDrawer', () => {
    const customers: Customer[] = [
      createCustomer({
        id: 'cust-1',
        name: 'Khách A',
        phone: '+60123456789',
        notes: [
          {
            id: 'note-crm-1',
            author: 'Sales Rep',
            content: 'Khách hẹn tối chuyển khoản',
            createdAt: '14/10/2026 16:00',
            type: 'note',
          },
        ],
      }),
    ];

    const conversations: ConversationSummary[] = [
      {
        customerId: 'cust-1',
        customerName: 'Khách A',
        customerPhone: '+60123456789',
        unreadCount: 0,
        lastMessage: createMessage({
          id: 'msg-1',
          customerId: 'cust-1',
          customerPhone: '+60123456789',
          content: 'Xin chào shop',
          timestamp: '2026-10-14T10:00:00.000Z',
        }),
      },
    ];

    const threads = buildMessageThreads({
      conversations,
      messages: [],
      customers,
      pinnedThreadIds: [],
    });

    expect(threads).toHaveLength(1);
    expect(threads[0].customer?.notes).toEqual([
      {
        id: 'note-crm-1',
        author: 'Sales Rep',
        content: 'Khách hẹn tối chuyển khoản',
        createdAt: '14/10/2026 16:00',
        type: 'note',
      },
    ]);
  });

  it('keeps BSUID and username threads distinct without stripping their identifiers', () => {
    const identifiers = ['MY.941245582048923', '@ghahrzl'];
    const conversations: ConversationSummary[] = identifiers.map((identifier, index) => ({
      customerId: `meta_${identifier}`,
      customerName: identifier,
      customerPhone: identifier,
      unreadCount: 1,
      lastMessage: createMessage({
        id: `msg-meta-${index}`,
        customerId: `meta_${identifier}`,
        customerName: identifier,
        customerPhone: identifier,
        content: 'Xin chào',
        timestamp: `2026-10-14T11:0${index}:00.000Z`,
      }),
    }));

    const threads = buildMessageThreads({
      conversations,
      messages: [],
      customers: [],
      pinnedThreadIds: [],
    });

    expect(threads.map((thread) => thread.customerPhone).sort()).toEqual(identifiers.sort());
    expect(threads.map((thread) => thread.threadId).sort()).toEqual([
      'meta:@ghahrzl',
      'meta:my.941245582048923',
    ]);
  });
});
