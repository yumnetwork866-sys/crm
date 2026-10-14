import { prisma } from '../lib/prisma';
import { DEFAULT_ROLE_COLORS, FALLBACK_ROLE_COLOR } from '../../src/utils/roleColors';

export { DEFAULT_ROLE_COLORS, FALLBACK_ROLE_COLOR };

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
