import { describe, expect, it } from 'vitest';
import { parseWhatsAppOrder, serializeWhatsAppOrder } from './whatsappOrder';

describe('WhatsApp order payloads', () => {
  it('serializes Meta order webhooks and parses stored content', () => {
    const stored = serializeWhatsAppOrder({
      type: 'order',
      order: {
        catalog_id: 'cat-1',
        product_items: [
          { product_retailer_id: 'sku-1', quantity: 2, item_price: '49.50', currency: 'myr' },
        ],
      },
    });

    expect(parseWhatsAppOrder(stored)).toEqual({
      catalogId: 'cat-1',
      items: [{ retailerId: 'sku-1', quantity: 2, itemPrice: 49.5, currency: 'MYR' }],
    });
  });

  it('rejects messages without usable product items', () => {
    expect(serializeWhatsAppOrder({ type: 'order', order: { product_items: [] } })).toBe('');
    expect(parseWhatsAppOrder('[order message]')).toBeNull();
  });
});
