import { prisma } from '../lib/prisma';
import { Permission } from '../../src/lib/permissions';

export { Permission };
export type PermissionKey = keyof typeof Permission;
export const ALL_PERMISSIONS = (1n << 23n) - 1n;

export const PERMISSION_DEFINITIONS: Array<{
  key: PermissionKey;
  label: string;
  group: string;
}> = [
  { key: 'ADMINISTRATOR', label: 'Toàn quyền hệ thống', group: 'Hệ thống' },
  { key: 'CUSTOMERS_VIEW', label: 'Xem khách hàng', group: 'Khách hàng' },
  { key: 'CUSTOMERS_MANAGE', label: 'Quản lý khách hàng', group: 'Khách hàng' },
  { key: 'CUSTOMERS_EXPORT', label: 'Xuất dữ liệu khách hàng', group: 'Khách hàng' },
  { key: 'ORDERS_VIEW', label: 'Xem đơn hàng', group: 'Đơn hàng' },
  { key: 'ORDERS_MANAGE', label: 'Quản lý đơn hàng', group: 'Đơn hàng' },
  { key: 'PRODUCTS_VIEW', label: 'Xem sản phẩm', group: 'Sản phẩm' },
  { key: 'PRODUCTS_CREATE', label: 'Tạo sản phẩm', group: 'Sản phẩm' },
  { key: 'PRODUCTS_UPDATE', label: 'Sửa sản phẩm', group: 'Sản phẩm' },
  { key: 'PRODUCTS_DELETE', label: 'Xóa sản phẩm', group: 'Sản phẩm' },
  { key: 'AUTOMATION_VIEW', label: 'Xem automation', group: 'Automation' },
  { key: 'AUTOMATION_MANAGE', label: 'Quản lý automation', group: 'Automation' },
  { key: 'CAMPAIGNS_MANAGE', label: 'Quản lý chiến dịch', group: 'Automation' },
  { key: 'TEMPLATES_MANAGE', label: 'Quản lý template', group: 'Automation' },
  { key: 'REPORTS_VIEW', label: 'Xem báo cáo', group: 'Báo cáo' },
  { key: 'REPORTS_EXPORT', label: 'Xuất báo cáo', group: 'Báo cáo' },
  { key: 'MESSAGES_VIEW', label: 'Xem WhatsApp', group: 'WhatsApp' },
  { key: 'MESSAGES_MANAGE', label: 'Quản lý WhatsApp', group: 'WhatsApp' },
  { key: 'USERS_READ', label: 'Xem tài khoản', group: 'Quản trị' },
  { key: 'USERS_MANAGE', label: 'Quản lý tài khoản và quyền', group: 'Quản trị' },
  { key: 'AUDIT_VIEW', label: 'Xem nhật ký bảo mật', group: 'Quản trị' },
  { key: 'AI_VIEW', label: 'Xem trang AI', group: 'Trí tuệ nhân tạo (AI)' },
  { key: 'AI_MANAGE', label: 'Quản lý AI (Bật/tắt rep tin nhắn, cấu hình)', group: 'Trí tuệ nhân tạo (AI)' },
];

export const ROLE_DEFAULT_PERMISSIONS: Record<string, bigint> = {
  Admin: ALL_PERMISSIONS,
  'Sales Manager': 261630n,
  'Sales Rep': 213110n,
  'Marketing Lead': 130250n,
  'Customer Support': 196726n,
};

export function hasPermission(mask: bigint, required: bigint): boolean {
  if ((mask & Permission.ADMINISTRATOR) === Permission.ADMINISTRATOR) return true;
  return (mask & required) === required;
}

export function parsePermissionMask(value: unknown): bigint {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw new Error('Permission mask phải là chuỗi số nguyên không âm.');
  }
  const mask = BigInt(value);
  if ((mask & ~ALL_PERMISSIONS) !== 0n) {
    throw new Error('Permission mask chứa quyền không được hỗ trợ.');
  }
  return mask;
}

export async function getRolePermissionMask(role: string): Promise<bigint> {
  try {
    const policy = await prisma.rolePermission.findUnique({ where: { role } });
    return policy?.permissions ?? ROLE_DEFAULT_PERMISSIONS[role] ?? 0n;
  } catch (error) {
    console.warn('[Permissions] Không thể đọc role policy, dùng cấu hình mặc định:', error);
    return ROLE_DEFAULT_PERMISSIONS[role] ?? 0n;
  }
}

export function calculateEffectivePermissions(
  roleMask: bigint,
  allowMask: bigint = 0n,
  denyMask: bigint = 0n,
): bigint {
  if (hasPermission(roleMask, Permission.ADMINISTRATOR)) return ALL_PERMISSIONS;
  return ((roleMask | allowMask) & ~denyMask) & ALL_PERMISSIONS;
}

export async function getEffectivePermissions(
  role: string,
  allowMask: bigint = 0n,
  denyMask: bigint = 0n,
): Promise<bigint> {
  return calculateEffectivePermissions(await getRolePermissionMask(role), allowMask, denyMask);
}
