import { toWhatsAppDigits } from './phone';

/** Meta may address a WhatsApp user by an opaque BSUID/username instead of a phone number. */
export function isMetaUserIdentifier(value: string | null | undefined): boolean {
  const identifier = String(value || '').trim();
  return /^MY\./i.test(identifier) || identifier.startsWith('@');
}

/** Preserve opaque Meta user IDs; normalize actual phone numbers for Cloud API dispatch. */
export function normalizeMetaRecipient(value: string | null | undefined): string {
  const recipient = String(value || '').trim();
  if (!recipient) return '';
  return isMetaUserIdentifier(recipient) ? recipient : toWhatsAppDigits(recipient);
}

