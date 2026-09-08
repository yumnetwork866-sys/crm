import type { Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../middleware/authMiddleware';
import { authenticateToken, requirePermission } from '../middleware/authMiddleware';
import {
  ALL_PERMISSIONS,
  PERMISSION_DEFINITIONS,
  Permission,
  parsePermissionMask,
} from '../auth/permissions';
import { prisma } from '../lib/prisma';
import { getRouteParam } from '../utils/requestParams';
import { FALLBACK_ROLE_COLOR, resolveRoleColor } from '../auth/roleColors';

const router = Router();
const roleColorSchema = z.string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Màu vai trò phải là mã hex hợp lệ.')
  .transform((color) => color.toLowerCase());

const roleNameSchema = z.string()
  .trim()
  .min(2, 'Tên vai trò phải có ít nhất 2 ký tự.')
  .max(50, 'Tên vai trò không được vượt quá 50 ký tự.')
  .refine(
    (value) => Array.from(value).every((character) => {
      const code = character.charCodeAt(0);
      return code > 31 && code !== 127;
    }),
    'Tên vai trò chứa ký tự không hợp lệ.',
  );

router.use(authenticateToken);
router.use(requirePermission(Permission.USERS_MANAGE));

router.get('/roles', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const storedPolicies = await prisma.rolePermission.findMany({ orderBy: { role: 'asc' } });
    const userCounts = await prisma.user.groupBy({ by: ['role'], _count: { _all: true } });
    const countsByRole = new Map(userCounts.map((item) => [item.role, item._count._all]));
    return res.json({
      allPermissions: ALL_PERMISSIONS.toString(),
      definitions: PERMISSION_DEFINITIONS.map((definition) => ({
        ...definition,
        bit: Permission[definition.key].toString(),
      })),
      roles: storedPolicies.map((policy) => ({
        role: policy.role,
        permissions: policy.permissions.toString(),
        color: resolveRoleColor(policy.role, policy.color),
        userCount: countsByRole.get(policy.role) ?? 0,
      })),
    });
  } catch (error) {
    console.error('[Permissions] Không thể tải role policies:', error);
    return res.status(500).json({ error: 'Không thể tải chính sách phân quyền.' });
  }
});

router.post('/roles', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsedName = roleNameSchema.safeParse(req.body?.name);
    if (!parsedName.success) {
      return res.status(400).json({ error: parsedName.error.issues[0]?.message || 'Tên vai trò không hợp lệ.' });
    }
    const role = parsedName.data;
    const existing = await prisma.rolePermission.findFirst({
      where: { role: { equals: role, mode: 'insensitive' } },
    });
    if (existing) return res.status(409).json({ error: 'Tên vai trò đã tồn tại.' });

    const permissions = req.body?.permissions === undefined ? 0n : parsePermissionMask(req.body.permissions);
    const parsedColor = req.body?.color === undefined
      ? { success: true as const, data: FALLBACK_ROLE_COLOR }
      : roleColorSchema.safeParse(req.body.color);
    if (!parsedColor.success) {
      return res.status(400).json({ error: parsedColor.error.issues[0]?.message || 'Màu vai trò không hợp lệ.' });
    }
    const policy = await prisma.rolePermission.create({ data: { role, permissions, color: parsedColor.data } });
    return res.status(201).json({
      role: policy.role,
      permissions: policy.permissions.toString(),
      color: resolveRoleColor(policy.role, policy.color),
      userCount: 0,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể tạo vai trò.';
    return res.status(400).json({ error: message });
  }
});

router.put('/roles/:role', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const role = decodeURIComponent(getRouteParam(req.params.role));
    const existing = await prisma.rolePermission.findUnique({ where: { role } });
    if (!existing) return res.status(404).json({ error: 'Không tìm thấy vai trò.' });
    const permissions = parsePermissionMask(req.body?.permissions);
    const parsedColor = roleColorSchema.safeParse(req.body?.color);
    if (!parsedColor.success) {
      return res.status(400).json({ error: parsedColor.error.issues[0]?.message || 'Màu vai trò không hợp lệ.' });
    }
    if (role === 'Admin' && !((permissions & Permission.USERS_MANAGE) === Permission.USERS_MANAGE)) {
      return res.status(400).json({ error: 'Vai trò Admin phải giữ quyền quản lý tài khoản và phân quyền.' });
    }
    const policy = await prisma.rolePermission.update({
      where: { role },
      data: { permissions, color: parsedColor.data },
    });
    const userCount = await prisma.user.count({ where: { role } });
    return res.json({
      role: policy.role,
      permissions: policy.permissions.toString(),
      color: resolveRoleColor(policy.role, policy.color),
      userCount,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Permission mask không hợp lệ.';
    return res.status(400).json({ error: message });
  }
});

router.patch('/roles/:role', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const currentRole = decodeURIComponent(getRouteParam(req.params.role));
    if (currentRole === 'Admin') {
      return res.status(400).json({ error: 'Không thể đổi tên vai trò Admin hệ thống.' });
    }
    const parsedName = roleNameSchema.safeParse(req.body?.name);
    if (!parsedName.success) {
      return res.status(400).json({ error: parsedName.error.issues[0]?.message || 'Tên vai trò không hợp lệ.' });
    }
    const nextRole = parsedName.data;
    const existing = await prisma.rolePermission.findUnique({ where: { role: currentRole } });
    if (!existing) return res.status(404).json({ error: 'Không tìm thấy vai trò.' });
    const duplicate = await prisma.rolePermission.findFirst({
      where: { role: { equals: nextRole, mode: 'insensitive' }, NOT: { role: currentRole } },
    });
    if (duplicate) return res.status(409).json({ error: 'Tên vai trò đã tồn tại.' });

    const [, policy] = await prisma.$transaction([
      prisma.user.updateMany({ where: { role: currentRole }, data: { role: nextRole } }),
      prisma.rolePermission.update({ where: { role: currentRole }, data: { role: nextRole } }),
    ]);
    const userCount = await prisma.user.count({ where: { role: nextRole } });
    return res.json({
      role: policy.role,
      permissions: policy.permissions.toString(),
      color: resolveRoleColor(policy.role, policy.color),
      userCount,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể đổi tên vai trò.';
    return res.status(400).json({ error: message });
  }
});

router.delete('/roles/:role', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const role = decodeURIComponent(getRouteParam(req.params.role));
    if (role === 'Admin') {
      return res.status(400).json({ error: 'Không thể xóa vai trò Admin hệ thống.' });
    }
    const existing = await prisma.rolePermission.findUnique({ where: { role } });
    if (!existing) return res.status(404).json({ error: 'Không tìm thấy vai trò.' });
    const userCount = await prisma.user.count({ where: { role } });
    if (userCount > 0) {
      return res.status(409).json({
        error: `Vai trò đang được gán cho ${userCount} tài khoản. Hãy chuyển các tài khoản sang vai trò khác trước khi xóa.`,
      });
    }
    await prisma.rolePermission.delete({ where: { role } });
    return res.json({ message: 'Đã xóa vai trò.' });
  } catch (error) {
    console.error('[Permissions] Không thể xóa vai trò:', error);
    return res.status(500).json({ error: 'Không thể xóa vai trò.' });
  }
});

export default router;
