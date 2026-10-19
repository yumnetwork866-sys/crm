import { describe, expect, it } from 'vitest';
import {
  getMessageText,
  getWebhookSenderIdentifier,
  getWebhookSenderIdentity,
} from './webhookMessageParser';

describe('getWebhookSenderIdentifier', () => {
  it('uses the standard from field first', () => {
    expect(getWebhookSenderIdentifier({ from: '84908123456', user_id: 'ignored' })).toBe('+84908123456');
  });

  it('accepts BSUID-style from_user_id payloads', () => {
    expect(getWebhookSenderIdentifier({ from_user_id: 'MY.941245582048923' })).toBe('MY.941245582048923');
  });

  it('accepts username-style user_id payloads', () => {
    expect(getWebhookSenderIdentifier({ user_id: '@ghahrzl' })).toBe('@ghahrzl');
  });

  it('can resolve user_id from the webhook contacts collection', () => {
    expect(getWebhookSenderIdentifier({}, {
      contacts: [{ user_id: 'MY.941245582048923' }],
    })).toBe('MY.941245582048923');
  });

  it('keeps BSUID and phone as separate identities when Meta provides both', () => {
    expect(getWebhookSenderIdentity(
      { from: '60123456789', from_user_id: 'MY.941245582048923' },
      {
        contacts: [{
          user_id: 'MY.941245582048923',
          wa_id: '60123456789',
          username: '@customer',
        }],
      },
    )).toEqual({
      recipient: 'MY.941245582048923',
      bsuid: 'MY.941245582048923',
      parentBsuid: '',
      phone: '+60123456789',
      username: '@customer',
    });
  });
});

describe('getMessageText WhatsApp orders', () => {
  it('preserves submitted cart items as structured message content', () => {
    const content = getMessageText({
      type: 'order',
      order: {
        catalog_id: 'catalog-1',
        product_items: [
          { product_retailer_id: 'sku-1', quantity: 2, item_price: '49.50', currency: 'myr' },
        ],
      },
    });

    expect(content).toBe('[whatsapp_order:{"catalogId":"catalog-1","items":[{"retailerId":"sku-1","quantity":2,"itemPrice":49.5,"currency":"MYR"}]}]');
  });
});

describe('getMessageText WhatsApp reaction', () => {
  it('formats reaction emoji fallback text', () => {
    expect(getMessageText({
      type: 'reaction',
      reaction: { message_id: 'wamid.123', emoji: '❤️' },
    })).toBe('[Cảm xúc: ❤️]');
  });

  it('formats removed reaction fallback text', () => {
    expect(getMessageText({
      type: 'reaction',
      reaction: { message_id: 'wamid.123', emoji: '' },
    })).toBe('[Gỡ cảm xúc]');
  });
});
