import { prisma } from '../lib/prisma';
import { DEFAULT_ROLE_COLORS, FALLBACK_ROLE_COLOR } from '../../src/utils/roleColors';
import { createLogger } from '../lib/logger';

const log = createLogger('roleColors');

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
    log.warn({ err: error }, '[RoleColor] Không thể đọc màu vai trò, dùng màu mặc định:');
    return resolveRoleColor(role);
  }
}
