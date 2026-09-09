import { prisma } from '../lib/prisma';

export const WHATSAPP_SESSION_WINDOW_MS = 24 * 60 * 60 * 1000;
export const WHATSAPP_SESSION_SAFETY_MARGIN_MS = 2 * 60 * 1000;

export function isWhatsAppSessionOpen(lastInboundAt: Date | null | undefined, now = new Date()): boolean {
  if (!lastInboundAt) return false;
  const ageMs = now.getTime() - lastInboundAt.getTime();
  return ageMs >= 0 && ageMs < WHATSAPP_SESSION_WINDOW_MS - WHATSAPP_SESSION_SAFETY_MARGIN_MS;
}

export async function getLatestCustomerInboundAt(customerId: string): Promise<Date | null> {
  const latestInbound = await prisma.whatsAppMessage.findFirst({
    where: {
      customerId,
      sender: 'customer',
      channel: 'WhatsApp',
    },
    orderBy: { timestamp: 'desc' },
    select: { timestamp: true },
  });
  return latestInbound?.timestamp ?? null;
}
