import { describe, expect, it } from 'vitest';
import type { CentralMessage } from '../../../types';
import { canTranslateMessage, getTranslatableMessageText, isLikelyVietnamese } from './messageTranslation';

const message = (content: string): CentralMessage => ({
  id: 'msg_1',
  customerId: 'customer_1',
  customerName: 'Customer',
  customerPhone: '+60123456789',
  sender: 'customer',
  channel: 'WhatsApp',
  content,
  timestamp: '2026-10-21T00:00:00.000Z',
  isRead: false,
});

describe('message translation helpers', () => {
  it('extracts regular text and skips Vietnamese messages', () => {
    expect(getTranslatableMessageText(message('Berapa harga barang ini?'))).toBe('Berapa harga barang ini?');
    expect(canTranslateMessage(message('Berapa harga barang ini?'))).toBe(true);
    expect(isLikelyVietnamese('Dạ bên em giao hàng được ạ')).toBe(true);
    expect(canTranslateMessage(message('Dạ bên em giao hàng được ạ'))).toBe(false);
  });

  it('skips media placeholders without captions', () => {
    expect(getTranslatableMessageText(message('[image]'))).toBe('');
    expect(getTranslatableMessageText(message('[Tin nhắn thoại]'))).toBe('');
  });
});
