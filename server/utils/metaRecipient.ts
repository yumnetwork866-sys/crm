import { isValidE164, toWhatsAppDigits } from './phone';

/** Meta may address a WhatsApp user by an opaque BSUID/username instead of a phone number. */
export function isMetaUserIdentifier(value: string | null | undefined): boolean {
  const identifier = String(value || '').trim();
  return /^MY\./i.test(identifier) || identifier.startsWith('@');
}

/** Preserve opaque Meta user IDs; normalize actual phone numbers for Cloud API dispatch. */
export function normalizeMetaRecipient(value: string | null | undefined): string {
  const recipient = String(value || '').trim();
  if (!recipient) return '';
  if (isMetaUserIdentifier(recipient)) return recipient;
  if (!/^[+\d\s().-]+$/.test(recipient)) return '';
  return isValidE164(recipient) ? toWhatsAppDigits(recipient) : '';
}

/** Prefer the requested recipient, but recover from legacy placeholder values with a customer phone. */
export function resolveMetaRecipient(
  primary: string | null | undefined,
  fallback?: string | null,
): { raw: string; recipient: string } {
  const rawPrimary = String(primary || '').trim();
  const primaryRecipient = normalizeMetaRecipient(rawPrimary);
  if (primaryRecipient) return { raw: rawPrimary, recipient: primaryRecipient };

  const rawFallback = String(fallback || '').trim();
  return {
    raw: rawFallback,
    recipient: normalizeMetaRecipient(rawFallback),
  };
}

