import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/prisma', () => ({
  prisma: {
    whatsAppMessage: {
      findFirst: vi.fn(),
    },
  },
}));

import {
  isWhatsAppSessionOpen,
  WHATSAPP_SESSION_SAFETY_MARGIN_MS,
  WHATSAPP_SESSION_WINDOW_MS,
} from './whatsappSessionWindow';

describe('isWhatsAppSessionOpen', () => {
  const now = new Date('2026-09-09T12:00:00.000Z');
  const effectiveWindowMs = WHATSAPP_SESSION_WINDOW_MS - WHATSAPP_SESSION_SAFETY_MARGIN_MS;

  it('returns true while the inbound message is inside the effective 24-hour window', () => {
    const lastInboundAt = new Date(now.getTime() - effectiveWindowMs + 1);

    expect(isWhatsAppSessionOpen(lastInboundAt, now)).toBe(true);
  });

  it('returns false at the safety-margin boundary', () => {
    const lastInboundAt = new Date(now.getTime() - effectiveWindowMs);

    expect(isWhatsAppSessionOpen(lastInboundAt, now)).toBe(false);
  });

  it('returns false without a previous inbound message', () => {
    expect(isWhatsAppSessionOpen(null, now)).toBe(false);
  });

  it('returns false for a future inbound timestamp', () => {
    const futureInboundAt = new Date(now.getTime() + 1);

    expect(isWhatsAppSessionOpen(futureInboundAt, now)).toBe(false);
  });
});
