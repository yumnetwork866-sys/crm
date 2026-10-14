import { describe, expect, it } from 'vitest';
import { isMetaUserIdentifier, normalizeMetaRecipient, resolveMetaRecipient } from './metaRecipient';

describe('Meta recipient identifiers', () => {
  it('preserves BSUID and username recipients', () => {
    expect(isMetaUserIdentifier('MY.941245582048923')).toBe(true);
    expect(normalizeMetaRecipient('MY.941245582048923')).toBe('MY.941245582048923');
    expect(normalizeMetaRecipient('@ghahrzl')).toBe('@ghahrzl');
  });

  it('continues normalizing phone recipients for Cloud API', () => {
    expect(normalizeMetaRecipient('0908 123 456')).toBe('84908123456');
  });

  it('rejects labels and malformed phone values', () => {
    expect(normalizeMetaRecipient('Khách Hàng')).toBe('');
    expect(normalizeMetaRecipient('phone 1234567')).toBe('');
    expect(normalizeMetaRecipient('123')).toBe('');
  });

  it('falls back to the customer phone for a legacy placeholder', () => {
    expect(resolveMetaRecipient('Khách Hàng', '+84835010228')).toEqual({
      raw: '+84835010228',
      recipient: '84835010228',
    });
  });

  it('keeps a valid explicit recipient instead of replacing it', () => {
    expect(resolveMetaRecipient('MY.2191861788027791', '+84835010228')).toEqual({
      raw: 'MY.2191861788027791',
      recipient: 'MY.2191861788027791',
    });
  });
});

