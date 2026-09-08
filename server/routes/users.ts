import type { User } from '@prisma/client';
import type { Response } from 'express';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../middleware/authMiddleware';
import { authenticateToken, requirePermission } from '../middleware/authMiddleware';
import { Permission, getEffectivePermissions, parsePermissionMask } from '../auth/permissions';
import { getRoleColor } from '../auth/roleColors';
import { prisma } from '../lib/prisma';
import { getRouteParam } from '../utils/requestParams';

const router = Router();
const userRoleSchema = z.string().trim().min(2).max(50);
const permissionMaskSchema = z.string()
  .regex(/^\d+$/, 'Permission mask phải là chuỗi số nguyên không âm.')
  .refine((value) => {
    try {
      parsePermissionMask(value);
      return true;
    } catch {
      return false;
    }
  }, 'Permission mask chứa quyền không được hỗ trợ.');

const createUserSchema = z.object({
  name: z.string().trim().min(2, 'Tên phải có ít nhất 2 ký tự.'),
  email: z.string().trim().email('Email không đúng định dạng.'),
  password: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự.'),
  role: userRoleSchema.default('Sales Rep'),
  phone: z.string().trim().optional().default(''),
  status: z.enum(['active', 'inactive']).default('active'),
  permissionAllow: permissionMaskSchema.optional(),
  permissionDeny: permissionMaskSchema.optional(),
}).strict();

const updateUserSchema = z.object({
  name: z.string().trim().min(2).optional(),
  role: userRoleSchema.optional(),
  phone: z.string().trim().optional(),
  status: z.enum(['active', 'inactive']).optional(),
  password: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự.').optional(),
  permissionAllow: permissionMaskSchema.optional(),
  permissionDeny: permissionMaskSchema.optional(),
}).strict();

async function serializeUser(user: User) {
  const { password: _password, permissionAllow, permissionDeny, ...safeUser } = user;
  return {
    ...safeUser,
    permissionAllow: permissionAllow.toString(),
    permissionDeny: permissionDeny.toString(),
    effectivePermissions: (await getEffectivePermissions(user.role, permissionAllow, permissionDeny)).toString(),
    roleColor: await getRoleColor(user.role),
  };
}

async function ensureAnotherActiveAdmin(targetId: string): Promise<boolean> {
  const count = await prisma.user.count({
    where: {
      id: { not: targetId },
      role: 'Admin',
      status: 'active',
    },
  });
  return count > 0;
}

async function roleExists(role: string): Promise<boolean> {
  return Boolean(await prisma.rolePermission.findUnique({ where: { role } }));
}

router.use(authenticateToken);

// GET /api/users
router.get('/', requirePermission(Permission.USERS_READ), async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
    return res.json(await Promise.all(users.map(serializeUser)));
  } catch (error) {
    console.error('Lỗi khi lấy danh sách người dùng:', error);
    return res.status(500).json({ error: 'Lỗi khi lấy danh sách người dùng' });
  }
});

// POST /api/users
router.post('/', requirePermission(Permission.USERS_MANAGE), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Dữ liệu tài khoản không hợp lệ.' });
    }

    const data = parsed.data;
    if (!(await roleExists(data.role))) {
      return res.status(400).json({ error: 'Vai trò được chọn không tồn tại.' });
    }
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) return res.status(409).json({ error: 'Email đã tồn tại' });

    const newUser = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: await bcrypt.hash(data.password, 10),
        role: data.role,
        phone: data.phone,
        status: data.status,
        permissionAllow: data.permissionAllow ? parsePermissionMask(data.permissionAllow) : 0n,
        permissionDeny: data.permissionDeny ? parsePermissionMask(data.permissionDeny) : 0n,
      },
    });

    return res.status(201).json(await serializeUser(newUser));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi khi tạo người dùng mới';
    return res.status(500).json({ error: message });
  }
});

// PUT /api/users/:id
router.put('/:id', requirePermission(Permission.USERS_MANAGE), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Dữ liệu tài khoản không hợp lệ.' });
    }

    const userId = getRouteParam(req.params.id);
    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) return res.status(404).json({ error: 'Không tìm thấy tài khoản.' });

    const data = parsed.data;
    if (data.role !== undefined && !(await roleExists(data.role))) {
      return res.status(400).json({ error: 'Vai trò được chọn không tồn tại.' });
    }
    if (req.user?.id === target.id && data.status === 'inactive') {
      return res.status(400).json({ error: 'Bạn không thể tự vô hiệu hóa tài khoản đang đăng nhập.' });
    }
    const removesActiveAdmin = target.role === 'Admin' && target.status === 'active'
      && (data.role && data.role !== 'Admin' || data.status === 'inactive');
    if (removesActiveAdmin && !(await ensureAnotherActiveAdmin(target.id))) {
      return res.status(400).json({ error: 'Hệ thống phải còn ít nhất một tài khoản Admin đang hoạt động.' });
    }

    const updated = await prisma.user.update({
      where: { id: target.id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.role !== undefined && { role: data.role }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.password !== undefined && { password: await bcrypt.hash(data.password, 10) }),
        ...(data.permissionAllow !== undefined && { permissionAllow: parsePermissionMask(data.permissionAllow) }),
        ...(data.permissionDeny !== undefined && { permissionDeny: parsePermissionMask(data.permissionDeny) }),
      },
    });

    return res.json(await serializeUser(updated));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi khi cập nhật người dùng';
    return res.status(500).json({ error: message });
  }
});

// DELETE /api/users/:id
router.delete('/:id', requirePermission(Permission.USERS_MANAGE), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = getRouteParam(req.params.id);
    if (req.user?.id === userId) {
      return res.status(400).json({ error: 'Bạn không thể xóa tài khoản đang đăng nhập.' });
    }
    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) return res.status(404).json({ error: 'Không tìm thấy tài khoản.' });
    if (target.role === 'Admin' && target.status === 'active' && !(await ensureAnotherActiveAdmin(target.id))) {
      return res.status(400).json({ error: 'Hệ thống phải còn ít nhất một tài khoản Admin đang hoạt động.' });
    }
    await prisma.user.delete({ where: { id: target.id } });
    return res.json({ message: 'Xóa tài khoản thành công.' });
  } catch (error) {
    console.error('Lỗi khi xóa người dùng:', error);
    return res.status(500).json({ error: 'Lỗi khi xóa người dùng' });
  }
});

export default router;
