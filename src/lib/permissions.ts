export const Permission = {
  ADMINISTRATOR: 1n << 0n,
  CUSTOMERS_VIEW: 1n << 1n,
  CUSTOMERS_MANAGE: 1n << 2n,
  CUSTOMERS_EXPORT: 1n << 3n,
  ORDERS_VIEW: 1n << 4n,
  ORDERS_MANAGE: 1n << 5n,
  PRODUCTS_VIEW: 1n << 6n,
  PRODUCTS_CREATE: 1n << 7n,
  PRODUCTS_UPDATE: 1n << 8n,
  PRODUCTS_DELETE: 1n << 9n,
  AUTOMATION_VIEW: 1n << 10n,
  AUTOMATION_MANAGE: 1n << 11n,
  CAMPAIGNS_MANAGE: 1n << 12n,
  TEMPLATES_MANAGE: 1n << 13n,
  REPORTS_VIEW: 1n << 14n,
  REPORTS_EXPORT: 1n << 15n,
  MESSAGES_VIEW: 1n << 16n,
  MESSAGES_MANAGE: 1n << 17n,
  USERS_READ: 1n << 18n,
  USERS_MANAGE: 1n << 19n,
  AUDIT_VIEW: 1n << 20n,
} as const;

export function hasPermission(mask: string | undefined, required: bigint): boolean {
  if (!mask || !/^\d+$/.test(mask)) return false;
  try {
    const parsedMask = BigInt(mask);
    if ((parsedMask & Permission.ADMINISTRATOR) === Permission.ADMINISTRATOR) return true;
    return (parsedMask & required) === required;
  } catch {
    return false;
  }
}
