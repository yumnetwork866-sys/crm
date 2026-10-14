import { describe, expect, it } from 'vitest';
import { getPhoneLookupVariants, isValidE164, normalizePhoneE164, toWhatsAppDigits } from './phone';

describe('E.164 phone normalization utilities', () => {
  it('normalizes Vietnamese local numbers starting with 0 to +84', () => {
    expect(normalizePhoneE164('0908 123 456')).toBe('+84908123456');
    expect(normalizePhoneE164('0987654321')).toBe('+84987654321');
    expect(normalizePhoneE164('+84 0908 123 456')).toBe('+84908123456');
  });

  it('normalizes Malaysian and US numbers to canonical E.164', () => {
    expect(normalizePhoneE164('+60 12 345 6789')).toBe('+60123456789');
    expect(normalizePhoneE164('012-345 6789')).toBe('+60123456789');
    expect(normalizePhoneE164('+1 415 555 2671')).toBe('+14155552671');
  });

  it('normalizes bare international digits from Meta webhooks', () => {
    expect(normalizePhoneE164('84908123456')).toBe('+84908123456');
    expect(normalizePhoneE164('60123456789')).toBe('+60123456789');
    expect(toWhatsAppDigits('+84 908 123 456')).toBe('84908123456');
    expect(isValidE164('+84908123456')).toBe(true);
  });

  it('generates exact lookup variants for indexed DB queries', () => {
    const variants = getPhoneLookupVariants('0908123456');
    expect(variants).toContain('+84908123456');
    expect(variants).toContain('84908123456');
    expect(variants).toContain('0908123456');
  });
});
