import { describe, expect, it } from 'vitest';
import type { CentralMessage } from '../../../types';
import { getWhatsAppSessionExpiresAt } from './whatsappSession';

const message = (sender: 'customer' | 'agent', timestamp: string) => ({ sender, timestamp } as CentralMessage);
const DAY = 24 * 60 * 60 * 1000;

describe('WhatsApp session expiry', () => {
  it('uses the last inbound message even when an agent replies more recently', () => {
    const inbound = '2026-11-11T08:00:00Z';
    const outbound = message('agent', '2026-11-13T08:00:00Z');
    expect(getWhatsAppSessionExpiresAt({ lastCustomerMessageAt: inbound, lastMessage: outbound, messages: [outbound] }))
      .toBe(Date.parse(inbound) + DAY);
  });

  it('preserves the latest server watermark when only older history is loaded', () => {
    expect(getWhatsAppSessionExpiresAt({
      lastCustomerMessageAt: '2026-11-13T08:00:00Z',
      lastMessage: message('agent', '2026-11-13T09:00:00Z'),
      messages: [message('customer', '2026-11-10T08:00:00Z')],
    })).toBe(Date.parse('2026-11-14T08:00:00Z'));
  });

  it('opens a fresh window when a newer customer message arrives, regardless of array order', () => {
    const latest = message('customer', '2026-11-13T10:00:00Z');
    expect(getWhatsAppSessionExpiresAt({
      lastCustomerMessageAt: '2026-11-11T08:00:00Z', lastMessage: latest,
      messages: [latest, message('customer', '2026-11-10T08:00:00Z')],
    })).toBe(Date.parse(latest.timestamp) + DAY);
  });

  it('does not infer a customer session from outgoing messages or invalid dates', () => {
    expect(getWhatsAppSessionExpiresAt(null)).toBeNull();
    expect(getWhatsAppSessionExpiresAt({
      lastCustomerMessageAt: 'invalid', lastMessage: message('agent', '2026-11-13T08:00:00Z'),
      messages: [message('customer', 'invalid')],
    })).toBeNull();
  });
});
