import { describe, expect, it } from 'vitest';
import type { ConversationSummary } from '../types';
import { conversationKey, flattenConversations, updateConversationPages, type ConversationPages } from './conversationPages';

const conversation = (customerId: string, phoneId: string, timestamp = '2026-11-12T08:00:00Z'): ConversationSummary => ({
  customerId, customerName: 'Customer', customerPhone: '+60123456789', unreadCount: 1,
  lastMessage: {
    id: `${phoneId}-${customerId}-${timestamp}`, customerId, customerPhone: '+60123456789', customerName: 'Customer',
    businessPhoneNumberId: phoneId, sender: 'customer', channel: 'WhatsApp', content: 'Hello', timestamp, isRead: false,
  },
});
const pages = (first: ConversationSummary[], second: ConversationSummary[]): ConversationPages => ({
  pageParams: [null, 'boundary-1'],
  pages: [
    { data: first, hasMore: true, nextCursor: 'boundary-1' },
    { data: second, hasMore: true, nextCursor: 'boundary-2' },
  ],
});

describe('infinite conversation cache', () => {
  it('deduplicates threads moving between pages while preserving separate WABA conversations', () => {
    const old = conversation('crm-1', '111');
    const latest = conversation('crm-1', '111', '2026-11-12T09:00:00Z');
    const anotherWaba = conversation('crm-1', '222');
    const result = flattenConversations(pages([old], [latest, anotherWaba]));
    expect(result).toHaveLength(2);
    expect(result[0].lastMessage.id).toBe(latest.lastMessage.id);
    expect(result.map((row) => row.lastMessage.businessPhoneNumberId).sort()).toEqual(['111', '222']);
  });

  it('orders cached pages by customer activity even when the latest message is an agent reply', () => {
    const older = conversation('crm-older', '111', '2026-11-13T11:00:00Z');
    older.lastMessage.sender = 'agent';
    older.lastCustomerMessageAt = '2026-11-12T08:00:00Z';
    const recent = conversation('crm-recent', '111', '2026-11-13T08:00:00Z');
    const outbound = conversation('crm-outbound', '111', '2026-11-14T11:00:00Z');
    outbound.lastMessage.sender = 'agent';
    expect(flattenConversations(pages([outbound, older], [recent])).map((row) => row.customerId))
      .toEqual(['crm-recent', 'crm-older', 'crm-outbound']);
  });

  it('handles aliases for the same phone without duplicate rows', () => {
    const first = conversation('cust_60123456789', '111');
    const alias = { ...first, customerId: 'phone_123456789', customerPhone: '0123456789' };
    expect(conversationKey(first)).toBe(conversationKey(alias));
    expect(flattenConversations(pages([first], [alias]))).toHaveLength(1);
  });

  it('keeps cursor boundaries while updating an older page and inserting a new realtime thread', () => {
    const first = conversation('crm-1', '111');
    const second = conversation('crm-2', '111');
    const newer = conversation('crm-2', '111', '2026-11-12T09:00:00Z');
    const incoming = conversation('crm-3', '111', '2026-11-12T10:00:00Z');
    const original = pages([first], [second]);
    const result = updateConversationPages(original, (rows) => [incoming, newer, ...rows.filter((row) => row.customerId !== 'crm-2')]);
    expect(result.pageParams).toEqual(original.pageParams);
    expect(result.pages.map((page) => page.nextCursor)).toEqual(['boundary-1', 'boundary-2']);
    expect(flattenConversations(result).map((row) => row.customerId)).toEqual(['crm-3', 'crm-2', 'crm-1']);
    expect(result.pages[1].data[0].lastMessage.id).toBe(newer.lastMessage.id);
    expect(original.pages[1].data[0].lastMessage.id).toBe(second.lastMessage.id);
  });

  it('deletes only the selected business conversation and preserves continuation after an empty page', () => {
    const first = conversation('crm-1', '111');
    const other = conversation('crm-1', '222');
    const original = pages([first], [other]);
    const result = updateConversationPages(original, (rows) => rows.filter((row) => conversationKey(row) !== conversationKey(first)));
    expect(result.pages[0].data).toEqual([]);
    expect(result.pages[0].nextCursor).toBe('boundary-1');
    expect(flattenConversations(result)).toEqual([other]);
  });
});
