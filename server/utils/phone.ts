/**
 * E.164 Phone Normalization & Lookup Utilities
 */

/**
 * Normalizes a phone number string into canonical E.164 format (e.g. "+84908123456", "+60123456789").
 * Returns an empty string if the input contains no valid digits.
 */
export function normalizePhoneE164(
  phone: string | null | undefined,
  defaultCountryCode?: string,
): string {
  if (!phone) return '';
  const trimmed = String(phone).trim();
  if (!trimmed) return '';

  const hasPlus = trimmed.startsWith('+');
  const hasDoubleZero = trimmed.startsWith('00');

  let digits = trimmed.replace(/\D/g, '');
  if (!digits) return '';

  if (hasDoubleZero) {
    digits = digits.slice(2);
  }

  if (hasPlus || hasDoubleZero) {
    // Strip trunk '0' accidentally included after country code (+8409... -> +849..., +6001... -> +601...)
    if (digits.startsWith('840') && digits.length >= 11) {
      digits = '84' + digits.slice(3);
    } else if (digits.startsWith('600') && digits.length >= 11) {
      digits = '60' + digits.slice(3);
    }
    return digits ? `+${digits}` : '';
  }

  if (digits.startsWith('0')) {
    const national = digits.slice(1);
    if (!national) return '';

    let cc = defaultCountryCode ? defaultCountryCode.replace(/\D/g, '') : '';
    if (!cc) {
      // Detect Vietnamese mobile (03, 05, 07, 08, 09 - 10 digits) or landline (02 - 10/11 digits)
      if (/^0[35789]\d{8}$/.test(digits) || /^02\d{8,9}$/.test(digits)) {
        cc = '84';
      } else if (/^01\d{8,9}$/.test(digits)) {
        // Malaysian mobile (01x-xxxxxxx)
        cc = '60';
      } else {
        cc = (process.env.DEFAULT_PHONE_COUNTRY_CODE || '84').replace(/\D/g, '') || '84';
      }
    }
    return `+${cc}${national}`;
  }

  // Already includes country code digits (e.g. Meta Webhook "84908123456" or "60123456789")
  if (digits.startsWith('840') && digits.length >= 11) {
    digits = '84' + digits.slice(3);
  } else if (digits.startsWith('600') && digits.length >= 11) {
    digits = '60' + digits.slice(3);
  }

  return `+${digits}`;
}

/**
 * Returns E.164 digits without the leading '+' for Meta Graph API calls (e.g. "84908123456").
 */
export function toWhatsAppDigits(
  phone: string | null | undefined,
  defaultCountryCode?: string,
): string {
  const e164 = normalizePhoneE164(phone, defaultCountryCode);
  return e164.replace(/^\+/, '');
}

/**
 * Validates whether a normalized phone string is a valid E.164 number (8 to 15 digits).
 */
export function isValidE164(phone: string | null | undefined): boolean {
  const e164 = normalizePhoneE164(phone);
  return /^\+[1-9]\d{6,14}$/.test(e164);
}

/**
 * Generates exact lookup variants (canonical E.164, bare international digits, and local '0' format)
 * so database queries can use indexed `IN (...)` lookups instead of slow/ambiguous `CONTAINS`.
 */
export function getPhoneLookupVariants(phone: string | null | undefined): string[] {
  if (!phone) return [];
  const raw = String(phone).trim();
  const e164 = normalizePhoneE164(raw);
  if (!e164) return raw ? [raw] : [];

  const digits = e164.slice(1);
  const variants = new Set<string>([e164, digits]);

  if (raw) {
    variants.add(raw);
  }

  if (digits.startsWith('84') && digits.length > 9) {
    variants.add(`0${digits.slice(2)}`);
  } else if (digits.startsWith('60') && digits.length > 9) {
    variants.add(`0${digits.slice(2)}`);
  }

  // Also add variant with default country code if raw started with 0 and could be either 84 or 60
  const rawDigits = raw.replace(/\D/g, '');
  if (rawDigits.startsWith('0') && rawDigits.length >= 9) {
    const nat = rawDigits.slice(1);
    variants.add(`+84${nat}`);
    variants.add(`84${nat}`);
    variants.add(`+60${nat}`);
    variants.add(`60${nat}`);
  }

  return Array.from(variants);
}
