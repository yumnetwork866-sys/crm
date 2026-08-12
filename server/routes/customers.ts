import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthenticatedRequest } from '../middleware/authMiddleware';
import { z } from 'zod';

const router = Router();
const prisma = new PrismaClient();

const customerSchema = z.object({
  name: z.string().min(1, 'Tên khách hàng không được để trống'),
  phone: z.string().min(8, 'Số điện thoại không hợp lệ'),
  gender: z.string().default('Khác'),
  address: z.string().default(''),
  email: z.string().email().optional().or(z.literal('')),
  note: z.string().optional(),
  source: z.string().default('Direct'),
  campaign: z.string().default('N/A'),
  adSet: z.string().optional(),
  landingPage: z.string().optional(),
  owner: z.string().default('Chưa phân công'),
  status: z.string().default('New Lead'),
  interestedProducts: z.array(z.string()).default([]),
  whatsappOptIn: z.boolean().default(false)
});

// All routes require authentication
router.use(authenticateToken);

// GET /api/customers - List customers with search & status filters
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { search, status, source, owner } = req.query;

    const whereClause: any = {};

    if (status && typeof status === 'string' && status !== 'all') {
      whereClause.status = status;
    }
    if (source && typeof source === 'string' && source !== 'all') {
      whereClause.source = source;
    }
    if (owner && typeof owner === 'string' && owner !== 'all') {
      whereClause.owner = owner;
    }

    if (search && typeof search === 'string') {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
        { campaign: { contains: search, mode: 'insensitive' } }
      ];
    }

    const customers = await prisma.customer.findMany({
      where: whereClause,
      include: {
        notes: { orderBy: { createdAt: 'desc' } },
        orders: { include: { products: true }, orderBy: { date: 'desc' } },
        automationLogs: { orderBy: { sentAt: 'desc' } }
      },
      orderBy: { updatedAt: 'desc' }
    });

    return res.json(customers);
  } catch (error) {
    console.error('Lỗi khi lấy danh sách khách hàng:', error);
    return res.status(500).json({ error: 'Không thể tải danh sách khách hàng từ cơ sở dữ liệu' });
  }
});

// GET /api/customers/:id - Single Customer Detail
router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        notes: { orderBy: { createdAt: 'desc' } },
        orders: { include: { products: true }, orderBy: { date: 'desc' } },
        automationLogs: { orderBy: { sentAt: 'desc' } }
      }
    });

    if (!customer) {
      return res.status(404).json({ error: 'Không tìm thấy khách hàng' });
    }

    return res.json(customer);
  } catch (error) {
    return res.status(500).json({ error: 'Lỗi hệ thống khi lấy thông tin khách hàng' });
  }
});

// POST /api/customers - Create New Customer
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parseResult = customerSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.issues[0].message });
    }

    const data = parseResult.data;

    const notesToCreate = req.body.notes && Array.isArray(req.body.notes)
      ? {
          create: req.body.notes.map((n: any) => ({
            author: n.author || data.owner || 'Hệ thống',
            content: n.content,
            type: n.type || 'note',
            createdAt: n.createdAt ? new Date(n.createdAt) : new Date()
          }))
        }
      : undefined;

    const newCustomer = await prisma.customer.create({
      data: {
        name: data.name,
        phone: data.phone,
        gender: data.gender,
        address: data.address,
        email: data.email || null,
        note: data.note || null,
        source: data.source,
        campaign: data.campaign,
        adSet: data.adSet || null,
        landingPage: data.landingPage || null,
        owner: data.owner,
        status: data.status,
        interestedProducts: data.interestedProducts,
        whatsappOptIn: data.whatsappOptIn,
        whatsappOptInDate: data.whatsappOptIn ? new Date() : null,
        firstContact: new Date(),
        lastContact: new Date(),
        notes: notesToCreate
      },
      include: {
        notes: { orderBy: { createdAt: 'desc' } },
        orders: { include: { products: true }, orderBy: { date: 'desc' } },
        automationLogs: { orderBy: { sentAt: 'desc' } }
      }
    });

    return res.status(201).json(newCustomer);
  } catch (error) {
    console.error('Lỗi khi tạo khách hàng mới:', error);
    return res.status(500).json({ error: 'Không thể tạo khách hàng mới' });
  }
});

// PUT /api/customers/:id - Update Customer
router.put('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Không tìm thấy khách hàng' });
    }

    const parseResult = customerSchema.partial().safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.issues[0].message });
    }

    const data = parseResult.data;

    const updated = await prisma.customer.update({
      where: { id },
      data: {
        ...data,
        lastContact: new Date()
      },
      include: {
        notes: { orderBy: { createdAt: 'desc' } },
        orders: { include: { products: true } },
        automationLogs: true
      }
    });

    return res.json(updated);
  } catch (error) {
    console.error('Lỗi khi cập nhật khách hàng:', error);
    return res.status(500).json({ error: 'Lỗi khi cập nhật thông tin khách hàng' });
  }
});

// DELETE /api/customers/:id - Delete Customer
router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.customer.delete({ where: { id } });
    return res.json({ message: 'Xóa khách hàng thành công' });
  } catch (error) {
    return res.status(500).json({ error: 'Lỗi khi xóa khách hàng' });
  }
});

// POST /api/customers/:id/notes - Add Customer Note
router.post('/:id/notes', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { content, type, author } = req.body;

    if (!content || typeof content !== 'string') {
      return res.status(400).json({ error: 'Nội dung ghi chú không được để trống' });
    }

    const noteAuthor = author || req.user?.name || 'Hệ thống';

    const newNote = await prisma.customerNote.create({
      data: {
        customerId: id,
        author: noteAuthor,
        content,
        type: type || 'note'
      }
    });

    await prisma.customer.update({
      where: { id },
      data: { lastContact: new Date() }
    });

    return res.status(201).json(newNote);
  } catch (error) {
    return res.status(500).json({ error: 'Không thể thêm ghi chú' });
  }
});

// POST /api/customers/:id/automation-logs - Add Customer Automation Log
router.post('/:id/automation-logs', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { step, stepName, message, status } = req.body;

    if (step === undefined || !stepName || !message) {
      return res.status(400).json({ error: 'Thông tin nhật ký automation không đầy đủ' });
    }

    const newLog = await prisma.automationLog.create({
      data: {
        customerId: id,
        step: Number(step),
        stepName,
        message,
        status: status || 'Sent',
        sentAt: new Date()
      }
    });

    return res.status(201).json(newLog);
  } catch (error) {
    console.error('Lỗi khi thêm nhật ký automation:', error);
    return res.status(500).json({ error: 'Không thể thêm nhật ký automation' });
  }
});

export default router;
