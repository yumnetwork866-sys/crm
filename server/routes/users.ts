import type { Response } from 'express';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import type { AuthenticatedRequest } from '../middleware/authMiddleware';
import { authenticateToken, requireRole } from '../middleware/authMiddleware';
import { prisma } from '../lib/prisma';

const router = Router();

router.use(authenticateToken);

// GET /api/users
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        role: true,
        phone: true,
        department: true,
        status: true,
        lastActive: true,
        assignedLeadsCount: true,
        totalRevenue: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.json(users);
  } catch (error) {
    return res.status(500).json({ error: 'Lỗi khi lấy danh sách người dùng' });
  }
});

// POST /api/users - Create User (Admin Only)
router.post('/', requireRole(['Admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, email, password, role, department, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Tên, email và mật khẩu là bắt buộc' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: 'Email đã tồn tại' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: role || 'Sales Rep',
        department: department || 'Sales',
        phone: phone || ''
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        role: true,
        phone: true,
        department: true,
        status: true,
        lastActive: true,
        assignedLeadsCount: true,
        totalRevenue: true,
        createdAt: true
      }
    });

    return res.status(201).json(newUser);
  } catch (error) {
    return res.status(500).json({ error: 'Lỗi khi tạo người dùng mới' });
  }
});

// PUT /api/users/:id - Update User
router.put('/:id', requireRole(['Admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, role, department, phone, status, password } = req.body;

    const dataToUpdate: any = {
      name,
      role,
      department,
      phone,
      status
    };

    if (password && password.trim().length >= 6) {
      dataToUpdate.password = await bcrypt.hash(password, 10);
    }

    const updated = await prisma.user.update({
      where: { id },
      data: dataToUpdate,
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        role: true,
        phone: true,
        department: true,
        status: true,
        lastActive: true,
        assignedLeadsCount: true,
        totalRevenue: true,
        createdAt: true
      }
    });

    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ error: 'Lỗi khi cập nhật người dùng' });
  }
});

export default router;
