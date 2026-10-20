import { describe, expect, it } from 'vitest';
import {
  getWhatsAppDeliveryErrorMessage,
  getWhatsAppErrorDetails,
} from './whatsappDeliveryError';

describe('WhatsApp delivery errors', () => {
  it('preserves the complete Meta error_data.details string', () => {
    const details = 'Message undeliverable: recipient has not accepted the latest terms.';
    expect(getWhatsAppErrorDetails({ error_data: { details } })).toBe(details);
  });

  it('uses a non-speculative message for error 131026', () => {
    expect(getWhatsAppDeliveryErrorMessage({ code: 131026 })).toBe(
      'Meta không thể gửi tin nhắn',
    );
  });
});
