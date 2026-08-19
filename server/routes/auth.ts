import type { Request, Response } from 'express';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { AuthenticatedRequest } from '../middleware/authMiddleware';
import { authenticateToken } from '../middleware/authMiddleware';
import { prisma } from '../lib/prisma';
import { z } from 'zod';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'vietcrm_super_secret_jwt_key_2026_change_in_production';

// Input Schemas
const loginSchema = z.object({
  email: z.string().min(1, 'Email / Tên đăng nhập không được để trống'),
  password: z.string().min(1, 'Mật khẩu không được để trống')
});

const registerSchema = z.object({
  name: z.string().min(2, 'Tên phải từ 2 ký tự trở lên'),
  email: z.string().email('Email không đúng định dạng'),
  password: z.string().min(6, 'Mật khẩu phải từ 6 ký tự trở lên'),
  role: z.enum(['Admin', 'Sales Manager', 'Sales Rep', 'Marketing Lead', 'Customer Support']).default('Sales Rep'),
  department: z.string().default('Sales'),
  phone: z.string().optional()
});

import dotenv from 'dotenv';

/**
 * Đọc cấu hình ADMIN và ADMIN_PASSWORD mới nhất từ .env
 */
function getAdminCredentials() {
  dotenv.config({ override: true });
  return {
    admin: (process.env.ADMIN || '').trim(),
    adminPassword: (process.env.ADMIN_PASSWORD || '').trim()
  };
}

/**
 * Tự động đảm bảo tài khoản Admin từ biến môi trường ADMIN và ADMIN_PASSWORD tồn tại và được đồng bộ trong DB.
 */
export async function ensureAdminUser(): Promise<void> {
  const { admin: adminEmail, adminPassword } = getAdminCredentials();

  if (!adminEmail || !adminPassword) {
    return;
  }

  try {
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: adminEmail, mode: 'insensitive' } },
          ...(adminEmail === 'admin' ? [{ role: 'Admin' }] : [])
        ]
      }
    });

    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    if (!existing) {
      await prisma.user.create({
        data: {
          name: 'Quản Trị Viên (Admin)',
          email: adminEmail,
          password: hashedPassword,
          role: 'Admin',
          department: 'Ban Giám Đốc',
          status: 'active'
        }
      });
      console.log(`👑 [Auth] Đã tự động tạo tài khoản Admin từ .env (${adminEmail})`);
    } else {
      const isMatch = await bcrypt.compare(adminPassword, existing.password);
      if (!isMatch || existing.role !== 'Admin' || existing.status !== 'active' || existing.email !== adminEmail) {
        await prisma.user.update({
          where: { id: existing.id },
          data: {
            email: adminEmail,
            password: hashedPassword,
            role: 'Admin',
            status: 'active'
          }
        });
        console.log(`👑 [Auth] Đã đồng bộ tài khoản Admin từ .env (${adminEmail})`);
      }
    }
  } catch (err) {
    console.warn('⚠️ [Auth] Không thể đồng bộ tài khoản Admin từ .env:', err);
  }
}

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.issues[0].message });
    }

    const { email, password } = parseResult.data;
    const { admin: envAdmin, adminPassword: envAdminPassword } = getAdminCredentials();
    const cleanEmail = email.trim().toLowerCase();
    const envAdminLower = envAdmin.toLowerCase();

    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: cleanEmail, mode: 'insensitive' } },
          { name: { equals: email.trim(), mode: 'insensitive' } },
          ...(cleanEmail === 'admin' ? [{ role: 'Admin' }] : [])
        ]
      }
    });

    const isEnvAdminLogin = Boolean(
      envAdmin &&
      (cleanEmail === envAdminLower || cleanEmail === 'admin' || user?.role === 'Admin') &&
      envAdminPassword &&
      password === envAdminPassword
    );

    if (!user) {
      if (isEnvAdminLogin) {
        const hashedPassword = await bcrypt.hash(password, 10);
        user = await prisma.user.create({
          data: {
            name: 'Quản Trị Viên (Admin)',
            email: envAdmin || 'admin',
            password: hashedPassword,
            role: 'Admin',
            department: 'Ban Giám Đốc',
            status: 'active'
          }
        });
      } else {
        return res.status(400).json({ error: 'Email hoặc mật khẩu không chính xác.' });
      }
    } else {
      if (user.status === 'inactive') {
        return res.status(403).json({ error: 'Tài khoản đã bị vô hiệu hóa.' });
      }

      let isMatch = await bcrypt.compare(password, user.password);

      // Nếu mật khẩu khớp ADMIN_PASSWORD trong .env, tự động đồng bộ lại hash trong DB
      if (!isMatch && (isEnvAdminLogin || (user.role === 'Admin' && envAdminPassword && password === envAdminPassword))) {
        const hashedPassword = await bcrypt.hash(password, 10);
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            password: hashedPassword,
            role: 'Admin',
            status: 'active'
          }
        });
        isMatch = true;
      }

      if (!isMatch) {
        return res.status(400).json({ error: 'Email hoặc mật khẩu không chính xác.' });
      }
    }

    // Update lastActive
    await prisma.user.update({
      where: { id: user.id },
      data: { lastActive: new Date() }
    });

    const payload = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

    const { password: _, ...userWithoutPassword } = user;

    return res.json({
      message: 'Đăng nhập thành công',
      token,
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Lỗi khi đăng nhập:', error);
    return res.status(500).json({ error: 'Lỗi hệ thống khi đăng nhập.' });
  }
});

// POST /api/auth/register (Public or Admin)
router.post('/register', async (req: Request, res: Response) => {
  try {
    const parseResult = registerSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.issues[0].message });
    }

    const data = parseResult.data;

    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      return res.status(400).json({ error: 'Email đã được đăng ký trong hệ thống.' });
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const newUser = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashedPassword,
        role: data.role,
        department: data.department,
        phone: data.phone || ''
      }
    });

    const { password: _, ...userWithoutPassword } = newUser;
    return res.status(201).json({
      message: 'Đăng ký tài khoản thành công',
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Lỗi khi đăng ký:', error);
    return res.status(500).json({ error: 'Lỗi hệ thống khi đăng ký.' });
  }
});

// GET /api/auth/me
router.get('/me', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Chưa xác thực' });

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(444).json({ error: 'Không tìm thấy thông tin người dùng' });

    const { password: _, ...userWithoutPassword } = user;
    return res.json(userWithoutPassword);
  } catch (error) {
    return res.status(500).json({ error: 'Lỗi hệ thống' });
  }
});

export default router;
