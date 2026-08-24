import type { Response } from 'express';
import { Router } from 'express';
import type { AuthenticatedRequest } from '../middleware/authMiddleware';
import { authenticateToken } from '../middleware/authMiddleware';
import { prisma } from '../lib/prisma';
import { z } from 'zod';

const router = Router();

function compareVietnameseNames(nameA: string = '', nameB: string = ''): number {
  const partsA = nameA.trim().split(/\s+/).filter(Boolean);
  const partsB = nameB.trim().split(/\s+/).filter(Boolean);

  const firstNameA = partsA.length > 0 ? partsA[partsA.length - 1] : '';
  const firstNameB = partsB.length > 0 ? partsB[partsB.length - 1] : '';

  const firstNameComparison = firstNameA.localeCompare(firstNameB, 'vi', { sensitivity: 'base' });
  if (firstNameComparison !== 0) {
    return firstNameComparison;
  }

  const middleAndLastNameA = partsA.slice(0, -1).join(' ');
  const middleAndLastNameB = partsB.slice(0, -1).join(' ');

  const restComparison = middleAndLastNameA.localeCompare(middleAndLastNameB, 'vi', { sensitivity: 'base' });
  if (restComparison !== 0) {
    return restComparison;
  }

  return nameA.localeCompare(nameB, 'vi', { sensitivity: 'base' });
}

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
  group: z.enum(['group_1', 'group_2', 'group_3', 'group_4']).default('group_1'),
  interestedProducts: z.array(z.string()).default([]),
  whatsappOptIn: z.boolean().default(false)
});

// All routes require authentication
router.use(authenticateToken);

// GET /api/customers - List customers with search, filter & pagination
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      search,
      status,
      source,
      owner,
      whatsappOptIn,
      page: pageQuery,
      limit: limitQuery,
      sortBy = 'name',
      sortOrder = 'asc',
      paginate
    } = req.query;

    const isPaginationRequested = pageQuery !== undefined || limitQuery !== undefined || paginate === 'true';
    const page = Math.max(1, parseInt(String(pageQuery || '1'), 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(String(limitQuery || '20'), 10) || 20));
    const skip = (page - 1) * limit;

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
    if (whatsappOptIn !== undefined && whatsappOptIn !== 'all') {
      whereClause.whatsappOptIn = String(whatsappOptIn) === 'true';
    }

    if (search && typeof search === 'string') {
      const cleanSearch = search.trim();
      whereClause.OR = [
        { name: { contains: cleanSearch, mode: 'insensitive' } },
        { phone: { contains: cleanSearch } },
        { email: { contains: cleanSearch, mode: 'insensitive' } },
        { campaign: { contains: cleanSearch, mode: 'insensitive' } }
      ];
    }

    const allowedSortFields = ['updatedAt', 'createdAt', 'name', 'totalSpent', 'totalOrders'];
    const validSortBy = allowedSortFields.includes(String(sortBy)) ? String(sortBy) : 'name';
    const validSortOrder = sortOrder === 'desc' ? 'desc' : 'asc';
    const orderBy = { [validSortBy]: validSortOrder };

    const queryInclude = {
      notes: { orderBy: { createdAt: 'desc' as const } },
      orders: { include: { products: true }, orderBy: { date: 'desc' as const } },
      automationLogs: { orderBy: { sentAt: 'desc' as const } }
    };

    let total = 0;
    let customers: any[] = [];

    if (isPaginationRequested) {
      const [totalCount, customerRecords] = await Promise.all([
        prisma.customer.count({ where: whereClause }),
        prisma.customer.findMany({
          where: whereClause,
          include: queryInclude,
          orderBy,
          skip,
          take: limit
        })
      ]);
      total = totalCount;
      customers = customerRecords;
    } else {
      customers = await prisma.customer.findMany({
        where: whereClause,
        include: queryInclude,
        orderBy
      });
      total = customers.length;
    }

    if (validSortBy === 'name') {
      customers.sort((a, b) => {
        const cmp = compareVietnameseNames(a.name, b.name);
        return validSortOrder === 'desc' ? -cmp : cmp;
      });
    }

    if (isPaginationRequested) {
      const totalPages = Math.ceil(total / limit);
      return res.json({
        data: customers,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      });
    }

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
        group: data.group,
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
