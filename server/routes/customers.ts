import type { Response } from 'express';
import { Router } from 'express';
import type { AuthenticatedRequest } from '../middleware/authMiddleware';
import { authenticateToken, requireAnyPermission, requirePermission } from '../middleware/authMiddleware';
import { Permission } from '../auth/permissions';
import { prisma } from '../lib/prisma';
import { getRouteParam } from '../utils/requestParams';
import { z } from 'zod';
import { matchCustomerByPhone, syncExistingWhatsAppCustomersToCrm } from '../services/webhookService';
import { realtimeHub } from '../services/realtimeHub';
import { getPhoneLookupVariants, normalizePhoneE164 } from '../utils/phone';
import { isUnassignedOwnerInput, resolveCustomerOwnerId, serializeCustomer } from '../utils/customerOwner';
import { buildCustomerWorkspaceWorkbook } from '../services/customerExcelExport';

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
  ownerId: z.string().nullable().optional(),
  status: z.string().default('New Lead'),
  group: z.enum(['group_1', 'group_2', 'group_3', 'group_4']).default('group_1'),
  interestedProducts: z.array(z.string()).default([])
});

const ownerUserSelect = {
  id: true,
  name: true,
  email: true,
  avatar: true,
  role: true,
} as const;

// All routes require authentication
router.use(authenticateToken);

// GET /api/customers - List customers with search, filter & pagination
router.get('/', requirePermission(Permission.CUSTOMERS_VIEW), async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Ensure any unlinked WhatsApp conversations are synced into Customer records
    await syncExistingWhatsAppCustomersToCrm().catch(() => 0);

    const {
      search,
      status,
      source,
      owner,
      ownerId,
      gender,
      group,
      startDate,
      endDate,
      page: pageQuery,
      limit: limitQuery,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      paginate
    } = req.query;

    const isPaginationRequested = pageQuery !== undefined || limitQuery !== undefined || paginate === 'true';
    const page = Math.max(1, parseInt(String(pageQuery || '1'), 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(String(limitQuery || '20'), 10) || 20));
    const skip = (page - 1) * limit;

    const whereClause: any = {};

    if (status && typeof status === 'string' && status !== 'all' && status !== 'ALL') {
      whereClause.status = status;
    }
    if (source && typeof source === 'string' && source !== 'all' && source !== 'ALL') {
      whereClause.source = source;
    }
    const ownerFilter = typeof ownerId === 'string' && ownerId ? ownerId : (typeof owner === 'string' ? owner : '');
    if (ownerFilter && ownerFilter !== 'all' && ownerFilter !== 'ALL') {
      if (isUnassignedOwnerInput(ownerFilter)) {
        whereClause.ownerId = null;
      } else {
        whereClause.ownerUser = {
          OR: [
            { id: ownerFilter },
            { name: { equals: ownerFilter, mode: 'insensitive' } },
            { email: { equals: ownerFilter, mode: 'insensitive' } },
          ],
        };
      }
    }
    if (gender && typeof gender === 'string' && gender !== 'ALL') {
      const lower = gender.toLowerCase();
      if (lower === 'nam') whereClause.gender = 'Nam';
      else if (lower === 'nữ' || lower === 'nu') whereClause.gender = 'Nữ';
      else if (lower === 'khác' || lower === 'khac') whereClause.gender = 'Khác';
      else whereClause.gender = gender;
    }
    if (group && typeof group === 'string' && group !== 'ALL') {
      whereClause.group = group;
    }

    if (startDate && typeof startDate === 'string') {
      const start = new Date(startDate);
      if (!isNaN(start.getTime())) {
        whereClause.createdAt = { ...(whereClause.createdAt || {}), gte: start };
      }
    }
    if (endDate && typeof endDate === 'string') {
      const end = new Date(endDate);
      if (!isNaN(end.getTime())) {
        end.setHours(23, 59, 59, 999);
        whereClause.createdAt = { ...(whereClause.createdAt || {}), lte: end };
      }
    }

    if (search && typeof search === 'string') {
      const cleanSearch = search.trim();
      const normalizedSearchPhone = /\d{3,}/.test(cleanSearch) ? normalizePhoneE164(cleanSearch) : '';
      const searchDigits = cleanSearch.replace(/\D/g, '');
      whereClause.OR = [
        { name: { contains: cleanSearch, mode: 'insensitive' } },
        { phone: { contains: cleanSearch } },
        { whatsappRecipientId: { contains: cleanSearch, mode: 'insensitive' } },
        ...(normalizedSearchPhone ? [{ phone: { contains: normalizedSearchPhone } }] : []),
        ...(searchDigits.length >= 4 ? [{ phone: { contains: searchDigits.replace(/^0/, '') } }] : []),
        { email: { contains: cleanSearch, mode: 'insensitive' } },
        { campaign: { contains: cleanSearch, mode: 'insensitive' } },
        { address: { contains: cleanSearch, mode: 'insensitive' } },
        { note: { contains: cleanSearch, mode: 'insensitive' } },
      ];
    }

    const allowedSortFields = ['updatedAt', 'createdAt', 'name', 'totalSpent', 'totalOrders'];
    const validSortBy = allowedSortFields.includes(String(sortBy)) ? String(sortBy) : 'createdAt';
    const validSortOrder = sortOrder === 'asc' ? 'asc' : 'desc';
    const orderBy = { [validSortBy]: validSortOrder };

    const isDetailed = req.query.detailed === 'true';

    const queryInclude = isDetailed
      ? {
          ownerUser: { select: ownerUserSelect },
          notes: { orderBy: { createdAt: 'desc' as const } },
          orders: { include: { products: true }, orderBy: { date: 'desc' as const } },
          automationLogs: { orderBy: { sentAt: 'desc' as const } }
        }
      : {
          ownerUser: { select: ownerUserSelect },
          notes: { select: { id: true, content: true, author: true, createdAt: true, type: true }, take: 100, orderBy: { createdAt: 'desc' as const } },
          orders: { select: { id: true, orderCode: true, totalAmount: true, status: true, date: true }, take: 10, orderBy: { date: 'desc' as const } },
          automationLogs: { select: { id: true, step: true, stepName: true, sentAt: true, message: true, status: true }, take: 5, orderBy: { sentAt: 'desc' as const } }
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
      customers = customerRecords.map(serializeCustomer);
    } else {
      const customerRecords = await prisma.customer.findMany({
        where: whereClause,
        include: queryInclude,
        orderBy,
        take: 300 // Giới hạn an toàn chống tràn bộ nhớ (OOM)
      });
      customers = customerRecords.map(serializeCustomer);
      total = customers.length;
    }

    if (validSortBy === 'name' && !isPaginationRequested) {
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

const customerExcelExportSchema = z.object({
  customerIds: z.array(z.string().uuid()).min(1).max(5000),
});

// POST /api/customers/export/excel - Export selected customers, one sheet per WhatsApp workspace
router.post('/export/excel', requirePermission(Permission.CUSTOMERS_EXPORT), async (req: AuthenticatedRequest, res: Response) => {
  const parsed = customerExcelExportSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Danh sách khách hàng cần xuất không hợp lệ.' });
  }

  try {
    const requestedIds = Array.from(new Set(parsed.data.customerIds));
    const [customerRecords, links, workspaces] = await Promise.all([
      prisma.customer.findMany({
        where: { id: { in: requestedIds } },
        include: { ownerUser: { select: { name: true } } },
      }),
      prisma.whatsAppMessage.findMany({
        where: {
          customerId: { in: requestedIds },
          businessPhoneNumberId: { not: null },
        },
        select: { customerId: true, businessPhoneNumberId: true },
        distinct: ['customerId', 'businessPhoneNumberId'],
      }),
      prisma.whatsAppConnection.findMany({
        select: { phoneNumberId: true, verifiedName: true, displayPhoneNumber: true },
      }),
    ]);

    const customerById = new Map(customerRecords.map((customer) => [customer.id, customer]));
    const customers = requestedIds.flatMap((id) => {
      const customer = customerById.get(id);
      return customer ? [customer] : [];
    });
    const workbook = await buildCustomerWorkspaceWorkbook({
      customers,
      links,
      workspaces: workspaces.map((workspace) => ({
        id: workspace.phoneNumberId,
        verifiedName: workspace.verifiedName,
        displayPhoneNumber: workspace.displayPhoneNumber,
      })),
    });
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
    const filename = `YumNetworkCRM_KhachHang_${date}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', workbook.length.toString());
    return res.send(workbook);
  } catch (error) {
    console.error('Lỗi khi xuất Excel khách hàng:', error);
    return res.status(500).json({ error: 'Không thể tạo file Excel khách hàng.' });
  }
});

// GET /api/customers/:id - Single Customer Detail
router.get('/:id', requireAnyPermission([Permission.CUSTOMERS_VIEW, Permission.MESSAGES_VIEW]), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = getRouteParam(req.params.id);
    const detailInclude = {
      ownerUser: { select: ownerUserSelect },
      notes: { orderBy: { createdAt: 'desc' as const } },
      orders: { include: { products: true }, orderBy: { date: 'desc' as const } },
      automationLogs: { orderBy: { sentAt: 'desc' as const } }
    };

    let customer = await prisma.customer.findUnique({
      where: { id },
      include: detailInclude
    });

    if (!customer) {
      customer = await prisma.customer.findFirst({
        where: { whatsappRecipientId: id },
        include: detailInclude,
      });
    }

    if (!customer) {
      const variants = getPhoneLookupVariants(id);
      if (variants.length > 0) {
        customer = await prisma.customer.findFirst({
          where: { phone: { in: variants } },
          include: detailInclude
        });
      }
    }

    if (!customer) {
      return res.status(404).json({ error: 'Không tìm thấy khách hàng' });
    }

    return res.json(serializeCustomer(customer));
  } catch (error) {
    return res.status(500).json({ error: 'Lỗi hệ thống khi lấy thông tin khách hàng' });
  }
});

// POST /api/customers - Create New Customer
router.post('/', requirePermission(Permission.CUSTOMERS_MANAGE), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parseResult = customerSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.issues[0].message });
    }

    const data = parseResult.data;
    const normalizedPhone = normalizePhoneE164(data.phone);
    if (!normalizedPhone) {
      return res.status(400).json({ error: 'Số điện thoại không hợp lệ' });
    }

    const { ownerId: resolvedOwnerId, ownerName } = await resolveCustomerOwnerId({
      ownerId: data.ownerId,
      owner: data.owner,
    });

    const notesToCreate = req.body.notes && Array.isArray(req.body.notes)
      ? {
          create: req.body.notes.map((n: any) => ({
            author: n.author || ownerName || 'Hệ thống',
            content: n.content,
            type: n.type || 'note',
            createdAt: n.createdAt ? new Date(n.createdAt) : new Date()
          }))
        }
      : undefined;

    const newCustomer = await prisma.customer.create({
      data: {
        name: data.name,
        phone: normalizedPhone,
        gender: data.gender,
        address: data.address,
        email: data.email || null,
        note: data.note || null,
        source: data.source,
        campaign: data.campaign,
        adSet: data.adSet || null,
        landingPage: data.landingPage || null,
        ownerId: resolvedOwnerId,
        status: data.status,
        group: data.group,
        interestedProducts: data.interestedProducts,
        firstContact: new Date(),
        lastContact: new Date(),
        notes: notesToCreate
      },
      include: {
        ownerUser: { select: ownerUserSelect },
        notes: { orderBy: { createdAt: 'desc' } },
        orders: { include: { products: true }, orderBy: { date: 'desc' } },
        automationLogs: { orderBy: { sentAt: 'desc' } }
      }
    });

    return res.status(201).json(serializeCustomer(newCustomer));
  } catch (error) {
    console.error('Lỗi khi tạo khách hàng mới:', error);
    return res.status(500).json({ error: 'Không thể tạo khách hàng mới' });
  }
});

// PUT /api/customers/:id - Update Customer
router.put('/:id', requirePermission(Permission.CUSTOMERS_MANAGE), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = getRouteParam(req.params.id);
    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Không tìm thấy khách hàng' });
    }

    const parseResult = customerSchema.partial().safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.issues[0].message });
    }

    const { owner, ownerId, phone, ...restData } = parseResult.data;
    const updatePayload: Record<string, any> = {
      ...restData,
      lastContact: new Date(),
    };

    if (phone !== undefined) {
      const normalizedPhone = normalizePhoneE164(phone);
      if (!normalizedPhone) {
        return res.status(400).json({ error: 'Số điện thoại không hợp lệ' });
      }
      updatePayload.phone = normalizedPhone;
    }

    if (ownerId !== undefined || owner !== undefined) {
      const resolved = await resolveCustomerOwnerId({ ownerId, owner });
      updatePayload.ownerId = resolved.ownerId;
    }

    const updated = await prisma.customer.update({
      where: { id },
      data: updatePayload,
      include: {
        ownerUser: { select: ownerUserSelect },
        notes: { orderBy: { createdAt: 'desc' } },
        orders: { include: { products: true } },
        automationLogs: true
      }
    });

    return res.json(serializeCustomer(updated));
  } catch (error) {
    console.error('Lỗi khi cập nhật khách hàng:', error);
    return res.status(500).json({ error: 'Lỗi khi cập nhật thông tin khách hàng' });
  }
});

// DELETE /api/customers/:id - Delete Customer
router.delete('/:id', requirePermission(Permission.CUSTOMERS_MANAGE), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = getRouteParam(req.params.id);
    await prisma.customer.delete({ where: { id } });
    return res.json({ message: 'Xóa khách hàng thành công' });
  } catch (error) {
    return res.status(500).json({ error: 'Lỗi khi xóa khách hàng' });
  }
});

// POST /api/customers/:id/notes - Add Customer Note (Unified CRM & WhatsApp Chat Note)
router.post(
  '/:id/notes',
  requireAnyPermission([Permission.CUSTOMERS_MANAGE, Permission.MESSAGES_MANAGE]),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = getRouteParam(req.params.id);
      const { content, type, author, phone, customerName, businessPhoneNumberId } = req.body;

      if (!content || typeof content !== 'string' || !content.trim()) {
        return res.status(400).json({ error: 'Nội dung ghi chú không được để trống' });
      }

      let customer = await prisma.customer.findUnique({
        where: { id },
        select: { id: true },
      });

      if (!customer) {
        const lookupPhone = typeof phone === 'string' && phone.trim() ? phone.trim() : id;
        const variants = getPhoneLookupVariants(lookupPhone);
        if (variants.length > 0) {
          customer = await prisma.customer.findFirst({
            where: { phone: { in: variants } },
            select: { id: true },
          });
        }
        if (!customer && lookupPhone.replace(/\D/g, '').length >= 7) {
          const matched = await matchCustomerByPhone(
            lookupPhone,
            typeof customerName === 'string' && customerName.trim() ? customerName.trim() : 'Khách WhatsApp',
            typeof businessPhoneNumberId === 'string' ? businessPhoneNumberId : undefined
          );
          if (matched.isCrmCustomer) {
            customer = { id: matched.customerId };
          }
        }
      }

      if (!customer) {
        return res.status(404).json({ error: 'Không tìm thấy khách hàng để lưu ghi chú' });
      }

      const noteAuthor =
        type === 'system'
          ? author || 'Hệ Thống'
          : req.user?.name || author || 'Tư vấn viên';

      const newNote = await prisma.customerNote.create({
        data: {
          customerId: customer.id,
          author: noteAuthor,
          content: content.trim(),
          type: type || 'note',
        },
      });

      await prisma.customer.update({
        where: { id: customer.id },
        data: { lastContact: new Date() },
      });

      realtimeHub.broadcast('customers:sync', {
        source: 'customer-note-created',
        customerId: customer.id,
      });

      return res.status(201).json(newNote);
    } catch (error) {
      return res.status(500).json({ error: 'Không thể thêm ghi chú' });
    }
  }
);

// DELETE /api/customers/:id/notes/:noteId - Delete Customer Note
router.delete(
  '/:id/notes/:noteId',
  requireAnyPermission([Permission.CUSTOMERS_MANAGE, Permission.MESSAGES_MANAGE]),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const noteId = getRouteParam(req.params.noteId);
      if (!noteId) {
        return res.status(400).json({ error: 'Thiếu mã ghi chú' });
      }

      const existingNote = await prisma.customerNote.findUnique({
        where: { id: noteId },
        select: { id: true, customerId: true },
      });

      if (!existingNote) {
        return res.status(404).json({ error: 'Không tìm thấy ghi chú' });
      }

      await prisma.customerNote.delete({ where: { id: noteId } });
      await prisma.messageInternalNote.deleteMany({ where: { id: noteId } }).catch(() => {});

      realtimeHub.broadcast('customers:sync', {
        source: 'customer-note-deleted',
        customerId: existingNote.customerId,
        noteId,
      });

      return res.json({ id: noteId, customerId: existingNote.customerId });
    } catch (error) {
      return res.status(500).json({ error: 'Không thể xóa ghi chú' });
    }
  }
);

// POST /api/customers/:id/automation-logs - Add Customer Automation Log
router.post('/:id/automation-logs', requirePermission(Permission.AUTOMATION_MANAGE), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = getRouteParam(req.params.id);
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
