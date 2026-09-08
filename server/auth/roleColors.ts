import { prisma } from '../lib/prisma';

export const DEFAULT_ROLE_COLORS: Record<string, string> = {
  Admin: '#9333ea',
  'Sales Manager': '#4f46e5',
  'Sales Rep': '#059669',
  'Marketing Lead': '#d97706',
  'Customer Support': '#0891b2',
};

export const FALLBACK_ROLE_COLOR = '#475569';

export const resolveRoleColor = (role: string, color?: string | null) =>
  color ?? DEFAULT_ROLE_COLORS[role] ?? FALLBACK_ROLE_COLOR;

export async function getRoleColor(role: string): Promise<string> {
  try {
    const policy = await prisma.rolePermission.findUnique({
      where: { role },
      select: { color: true },
    });
    return resolveRoleColor(role, policy?.color);
  } catch (error) {
    console.warn('[RoleColor] Không thể đọc màu vai trò, dùng màu mặc định:', error);
    return resolveRoleColor(role);
  }
}
