import { describe, expect, it } from 'vitest';
import { isMetaUserIdentifier, normalizeMetaRecipient } from './metaRecipient';

describe('Meta recipient identifiers', () => {
  it('preserves BSUID and username recipients', () => {
    expect(isMetaUserIdentifier('MY.941245582048923')).toBe(true);
    expect(normalizeMetaRecipient('MY.941245582048923')).toBe('MY.941245582048923');
    expect(normalizeMetaRecipient('@ghahrzl')).toBe('@ghahrzl');
  });

  it('continues normalizing phone recipients for Cloud API', () => {
    expect(normalizeMetaRecipient('0908 123 456')).toBe('84908123456');
  });
});

