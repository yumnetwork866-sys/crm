export interface WhatsAppOrderItem {
  retailerId: string;
  quantity: number;
  itemPrice: number;
  currency: string;
}

export interface WhatsAppOrderPayload {
  catalogId: string;
  items: WhatsAppOrderItem[];
}

const ORDER_PREFIX = '[whatsapp_order:';

export function serializeWhatsAppOrder(msgData: any): string {
  if (msgData?.type !== 'order' || !Array.isArray(msgData?.order?.product_items)) return '';
  const items = msgData.order.product_items.map((item: any) => ({
    retailerId: String(item?.product_retailer_id || '').trim(),
    quantity: Math.max(1, Number(item?.quantity) || 1),
    itemPrice: Math.max(0, Number(item?.item_price) || 0),
    currency: String(item?.currency || '').trim().toUpperCase(),
  })).filter((item: WhatsAppOrderItem) => item.retailerId);
  if (items.length === 0) return '';
  return `${ORDER_PREFIX}${JSON.stringify({
    catalogId: String(msgData.order.catalog_id || ''),
    items,
  })}]`;
}

export function parseWhatsAppOrder(content: string | null | undefined): WhatsAppOrderPayload | null {
  const clean = String(content || '').replace(/^\[reply:\{.*?\}\]\n/, '').trim();
  if (!clean.startsWith(ORDER_PREFIX) || !clean.endsWith(']')) return null;
  try {
    const parsed = JSON.parse(clean.slice(ORDER_PREFIX.length, -1));
    if (!Array.isArray(parsed?.items) || parsed.items.length === 0) return null;
    const items = parsed.items.map((item: any) => ({
      retailerId: String(item?.retailerId || '').trim(),
      quantity: Math.max(1, Number(item?.quantity) || 1),
      itemPrice: Math.max(0, Number(item?.itemPrice) || 0),
      currency: String(item?.currency || '').trim().toUpperCase(),
    })).filter((item: WhatsAppOrderItem) => item.retailerId);
    return items.length > 0 ? { catalogId: String(parsed.catalogId || ''), items } : null;
  } catch {
    return null;
  }
}
