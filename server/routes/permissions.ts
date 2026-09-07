import type { Response } from 'express';
import { Router } from 'express';
import type { AuthenticatedRequest } from '../middleware/authMiddleware';
import { authenticateToken, requirePermission } from '../middleware/authMiddleware';
import {
  ALL_PERMISSIONS,
  PERMISSION_DEFINITIONS,
  Permission,
  ROLE_DEFAULT_PERMISSIONS,
  parsePermissionMask,
} from '../auth/permissions';
import { prisma } from '../lib/prisma';

const router = Router();
const SUPPORTED_ROLES = Object.keys(ROLE_DEFAULT_PERMISSIONS);

router.use(authenticateToken);
router.use(requirePermission(Permission.USERS_MANAGE));

router.get('/roles', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const storedPolicies = await prisma.rolePermission.findMany();
    const storedByRole = new Map(storedPolicies.map((policy) => [policy.role, policy.permissions]));
    return res.json({
      allPermissions: ALL_PERMISSIONS.toString(),
      definitions: PERMISSION_DEFINITIONS.map((definition) => ({
        ...definition,
        bit: Permission[definition.key].toString(),
      })),
      roles: SUPPORTED_ROLES.map((role) => ({
        role,
        permissions: (storedByRole.get(role) ?? ROLE_DEFAULT_PERMISSIONS[role]).toString(),
      })),
    });
  } catch (error) {
    console.error('[Permissions] Không thể tải role policies:', error);
    return res.status(500).json({ error: 'Không thể tải chính sách phân quyền.' });
  }
});

router.put('/roles/:role', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const role = decodeURIComponent(req.params.role);
    if (!SUPPORTED_ROLES.includes(role)) {
      return res.status(404).json({ error: 'Vai trò không được hỗ trợ.' });
    }
    const permissions = parsePermissionMask(req.body.permissions);
    if (role === 'Admin' && !((permissions & Permission.USERS_MANAGE) === Permission.USERS_MANAGE)) {
      return res.status(400).json({ error: 'Vai trò Admin phải giữ quyền quản lý tài khoản và phân quyền.' });
    }
    const policy = await prisma.rolePermission.upsert({
      where: { role },
      create: { role, permissions },
      update: { permissions },
    });
    return res.json({ role: policy.role, permissions: policy.permissions.toString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Permission mask không hợp lệ.';
    return res.status(400).json({ error: message });
  }
});

export default router;
