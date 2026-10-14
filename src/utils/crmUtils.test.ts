import { describe, expect, it } from 'vitest';
import { isSendableMessageRecipient, resolveSendableMessageRecipient } from './crmUtils';

describe('message recipient resolution', () => {
  it('rejects legacy customer labels', () => {
    expect(isSendableMessageRecipient('Khách Hàng')).toBe(false);
    expect(resolveSendableMessageRecipient('Khách Hàng', '+84835010228')).toBe('+84835010228');
  });

  it('preserves valid phone numbers and Meta identifiers', () => {
    expect(resolveSendableMessageRecipient('+60 12-345 6789', '+84835010228')).toBe('+60 12-345 6789');
    expect(resolveSendableMessageRecipient('MY.2191861788027791', '+84835010228')).toBe('MY.2191861788027791');
  });

  it('can recover a recipient embedded in a synthetic customer id', () => {
    expect(resolveSendableMessageRecipient('', '', 'cust_84908123456')).toBe('84908123456');
  });
});
