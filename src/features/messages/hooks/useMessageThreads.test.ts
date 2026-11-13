import { describe, expect, it } from 'vitest';
import type { CentralMessage, Customer } from '../../../types';
import type { ConversationSummary } from '../types';
import { scopeThreadId } from '../../../../shared/whatsappScope';
import { resolveMessageThreadIdentity } from '../utils/messageThreadIdentity';
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

  it.each(['+60123456789', 'MY.941245582048923', '@customer'])(
    'separates the same recipient %s across business phones and resolves the selected sender',
    (customerPhone) => {
      const customerId = `meta_${customerPhone}`;
      const conversations: ConversationSummary[] = ['111', '222'].map((businessPhoneNumberId, index) => ({
        customerId, customerName: 'Cùng một khách', customerPhone,
        unreadCount: index === 0 ? 3 : 0,
        lastMessage: createMessage({
          id: `last-${index}`, customerId, customerPhone, businessPhoneNumberId,
          sender: index === 0 ? 'customer' : 'agent', content: `Số ${businessPhoneNumberId}`,
          timestamp: new Date().toISOString(),
        }),
      }));
      const history = createMessage({
        id: 'older-111', customerId, customerPhone, businessPhoneNumberId: '111',
        content: 'Chỉ thuộc số 111', timestamp: '2026-10-01T00:00:00Z',
      });
      const threads = buildMessageThreads({
        conversations, messages: [history], customers: [], pinnedThreadIds: [], scopeByBusinessPhone: true,
      });
      expect(threads).toHaveLength(2);
      const first = threads.find((thread) => thread.lastMessage.businessPhoneNumberId === '111')!;
      const second = threads.find((thread) => thread.lastMessage.businessPhoneNumberId === '222')!;
      expect(first.messages.map((message) => message.id)).toContain('older-111');
      expect(second.messages.map((message) => message.id)).not.toContain('older-111');
      expect(first.unreadCount).toBe(3);
      expect(second.unreadCount).toBe(0);
      for (const thread of threads) {
        // Selection and deletion can both resolve a scoped row without relying on the active chat.
        const identity = resolveMessageThreadIdentity(thread.threadId, undefined, undefined, {
          customers: [], conversations, allPhones: true, phoneNumberId: 'all',
        });
        expect(identity.threadKey).toBe(thread.threadId);
        expect(identity.businessPhoneId).toBe(thread.lastMessage.businessPhoneNumberId);
        expect(identity.customerId).toBe(customerId);
        expect(identity.customerPhone).toBe(customerPhone.replace(/^\+/, ''));
      }
    },
  );

  it('keeps pins and customer history separate for a linked CRM customer across two numbers', () => {
    const customer = createCustomer({ id: 'crm-1', name: 'Khách CRM', phone: '+60123456789' });
    const messages = ['111', '222'].map((businessPhoneNumberId) => createMessage({
      id: `message-${businessPhoneNumberId}`, customerId: customer.id, customerPhone: customer.phone,
      businessPhoneNumberId, content: 'Xin chào', timestamp: new Date().toISOString(),
    }));
    const threads = buildMessageThreads({
      messages, customers: [customer], pinnedThreadIds: [scopeThreadId('222', customer.id)], scopeByBusinessPhone: true,
    });
    expect(threads.map((thread) => thread.threadId)).toEqual(['waba:222:crm-1', 'waba:111:crm-1']);
    expect(threads[0].isPinned).toBe(true);
    expect(threads[1].isPinned).toBe(false);
    const options = { customers: [customer], conversations: [], allPhones: true, phoneNumberId: 'all' };
    const first = resolveMessageThreadIdentity(customer.id, customer.phone, '111', options);
    const second = resolveMessageThreadIdentity(customer.id, customer.phone, '222', options);
    expect(first.threadKey).not.toBe(second.threadKey);
    expect(first.businessPhoneId).toBe('111');
    expect(second.businessPhoneId).toBe('222');
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

  it('sorts by the latest inbound message, preserving pins and placing outbound-only threads last', () => {
    const customers = ['pinned', 'recent', 'older', 'outbound'].map((id, index) =>
      createCustomer({ id: `crm-${id}`, name: id, phone: `+6012345678${index}` }));
    const inboundTimes = ['2026-11-01T08:00:00Z', '2026-11-13T08:00:00Z', '2026-11-12T08:00:00Z', null];
    const conversations = customers.map((customer, index) => ({
      customerId: customer.id, customerName: customer.name, customerPhone: customer.phone,
      unreadCount: 0, lastCustomerMessageAt: inboundTimes[index],
      lastMessage: createMessage({
        id: `msg-${index}`, customerId: customer.id, customerPhone: customer.phone,
        sender: 'agent', timestamp: index === 2 ? '2026-11-13T11:00:00Z' : '2026-11-13T10:00:00Z', content: 'Agent reply',
      }),
    }));
    const build = () => buildMessageThreads({ conversations, messages: [], customers, pinnedThreadIds: ['crm-pinned'] });
    expect(build().map((thread) => thread.threadId)).toEqual(['crm-pinned', 'crm-recent', 'crm-older', 'crm-outbound']);
    // Sending a newer reply leaves the conversation in its inbound-based position.
    conversations[2].lastMessage.timestamp = '2026-11-14T11:00:00Z';
    expect(build().map((thread) => thread.threadId)).toEqual(['crm-pinned', 'crm-recent', 'crm-older', 'crm-outbound']);
    // A new inbound message advances it immediately.
    conversations[2].lastCustomerMessageAt = '2026-11-14T12:00:00Z';
    expect(build().map((thread) => thread.threadId)).toEqual(['crm-pinned', 'crm-older', 'crm-recent', 'crm-outbound']);
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
