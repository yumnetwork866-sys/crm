import type { Response } from 'express';
import { Router } from 'express';
import type { AuthenticatedRequest } from '../middleware/authMiddleware';
import { authenticateToken, requirePermission } from '../middleware/authMiddleware';
import { Permission } from '../auth/permissions';
import { prisma } from '../lib/prisma';
import { getRouteParam } from '../utils/requestParams';
import { z } from 'zod';
import { realtimeHub } from '../services/realtimeHub';
import { getPhoneLookupVariants, normalizePhoneE164 } from '../utils/phone';
import { parseWhatsAppOrder } from '../utils/whatsappOrder';

const router = Router();

router.use(authenticateToken);

// GET /api/orders - List orders with pagination, status & customer filtering
router.get('/', requirePermission(Permission.ORDERS_VIEW), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page: pageQuery, limit: limitQuery, status, customerId, search, paginate } = req.query;

    const isPaginationRequested = pageQuery !== undefined || limitQuery !== undefined || paginate === 'true';
    const page = Math.max(1, parseInt(String(pageQuery || '1'), 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(String(limitQuery || '20'), 10) || 20));
    const skip = (page - 1) * limit;

    const whereClause: any = {};

    if (status && typeof status === 'string' && status !== 'all') {
      whereClause.status = status;
    }

    if (customerId && typeof customerId === 'string') {
      whereClause.customerId = customerId;
    }

    if (search && typeof search === 'string') {
      const normalizedSearchPhone = /\d{3,}/.test(search) ? normalizePhoneE164(search) : '';
      whereClause.OR = [
        { orderCode: { contains: search, mode: 'insensitive' } },
        { customerName: { contains: search, mode: 'insensitive' } },
        { customerPhone: { contains: search } },
        ...(normalizedSearchPhone ? [{ customerPhone: { contains: normalizedSearchPhone } }] : [])
      ];
    }

    const orderInclude = {
      products: true,
      customer: { select: { id: true, name: true, phone: true, status: true } }
    };

    if (isPaginationRequested) {
      const [total, orders] = await Promise.all([
        prisma.order.count({ where: whereClause }),
        prisma.order.findMany({
          where: whereClause,
          include: orderInclude,
          orderBy: { date: 'desc' },
          skip,
          take: limit
        })
      ]);

      const totalPages = Math.ceil(total / limit);

      return res.json({
        data: orders,
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

    // Default query when pagination is not requested (với giới hạn an toàn chống tràn RAM)
    const orders = await prisma.order.findMany({
      where: whereClause,
      include: orderInclude,
      orderBy: { date: 'desc' },
      take: 250
    });

    return res.json(orders);
  } catch (error) {
    console.error('Lỗi khi lấy danh sách đơn hàng:', error);
    return res.status(500).json({ error: 'Lỗi khi lấy danh sách đơn hàng' });
  }
});

// GET /api/orders/whatsapp/:messageId - Resolve an order already created from a WhatsApp cart
router.get('/whatsapp/:messageId', requirePermission(Permission.ORDERS_VIEW), async (req: AuthenticatedRequest, res: Response) => {
  const messageId = getRouteParam(req.params.messageId);
  const [order, message] = await Promise.all([
    prisma.order.findUnique({
      where: { whatsappMessageId: messageId },
      include: { products: true },
    }).catch(() => null),
    prisma.whatsAppMessage.findUnique({
      where: { id: messageId },
      select: { content: true },
    }).catch(() => null),
  ]);
  const submittedOrder = parseWhatsAppOrder(message?.content);
  const retailerIds = submittedOrder
    ? [...new Set(submittedOrder.items.map((item) => item.retailerId))]
    : [];
  const products = retailerIds.length > 0
    ? await prisma.product.findMany({
        where: { metaRetailerId: { in: retailerIds } },
        select: { name: true, image: true, metaRetailerId: true },
      })
    : [];
  return res.json({
    order,
    productMatches: products.map((product) => ({
      retailerId: product.metaRetailerId,
      name: product.name,
      imageUrl: product.image,
    })),
  });
});

// POST /api/orders/whatsapp/:messageId - Confirm a submitted WhatsApp cart as a CRM order
router.post('/whatsapp/:messageId', requirePermission(Permission.ORDERS_MANAGE), async (req: AuthenticatedRequest, res: Response) => {
  const messageId = getRouteParam(req.params.messageId);
  try {
    const existing = await prisma.order.findUnique({
      where: { whatsappMessageId: messageId },
      include: { products: true },
    });
    if (existing) return res.json(existing);

    const message = await prisma.whatsAppMessage.findUnique({
      where: { id: messageId },
      select: {
        id: true,
        customerId: true,
        customerName: true,
        customerPhone: true,
        content: true,
        sender: true,
      },
    });
    if (!message || message.sender !== 'customer') {
      return res.status(404).json({ error: 'Không tìm thấy giỏ hàng WhatsApp của khách.' });
    }

    const submittedOrder = parseWhatsAppOrder(message.content);
    if (!submittedOrder) {
      return res.status(400).json({ error: 'Tin nhắn không chứa đơn hàng WhatsApp hợp lệ.' });
    }

    const retailerIds = [...new Set(submittedOrder.items.map((item) => item.retailerId))];
    const matchedProducts = await prisma.product.findMany({
      where: { metaRetailerId: { in: retailerIds } },
      select: { id: true, name: true, metaRetailerId: true },
    });
    const productByRetailerId = new Map(
      matchedProducts.map((product) => [product.metaRetailerId, product]),
    );
    const currencies = [...new Set(submittedOrder.items.map((item) => item.currency).filter(Boolean))];
    const unmatchedRetailerIds = retailerIds.filter((id) => !productByRetailerId.has(id));
    const totalAmount = submittedOrder.items.reduce(
      (sum, item) => sum + item.quantity * item.itemPrice,
      0,
    );

    const created = await prisma.order.create({
      data: {
        orderCode: `WA-${Date.now().toString(36).toUpperCase()}`,
        whatsappMessageId: message.id,
        customerId: message.customerId,
        customerName: message.customerName,
        customerPhone: message.customerPhone,
        totalAmount,
        status: 'Processing',
        notes: JSON.stringify({
          source: 'WhatsApp Cart',
          catalogId: submittedOrder.catalogId,
          currencies,
          unmatchedRetailerIds,
        }),
        products: {
          create: submittedOrder.items.map((item) => {
            const product = productByRetailerId.get(item.retailerId);
            return {
              productId: product?.id || null,
              productName: product?.name || `Meta SKU: ${item.retailerId}`,
              quantity: item.quantity,
              price: item.itemPrice,
            };
          }),
        },
      },
      include: { products: true },
    });

    realtimeHub.broadcast('orders:sync', {
      source: 'whatsapp-order-confirmed',
      orderId: created.id,
      whatsappMessageId: message.id,
    });
    return res.status(201).json(created);
  } catch (error: any) {
    if (error?.code === 'P2002') {
      const existing = await prisma.order.findUnique({
        where: { whatsappMessageId: messageId },
        include: { products: true },
      });
      if (existing) return res.json(existing);
    }
    console.error('[WHATSAPP ORDER CREATE ERROR]', error);
    return res.status(500).json({ error: 'Không thể tạo đơn từ giỏ hàng WhatsApp.' });
  }
});

// POST /api/orders - Create Order
router.post('/', requirePermission(Permission.ORDERS_MANAGE), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { customerId, customerName, customerPhone, products, totalAmount, notes } = req.body;

    if (!products || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ error: 'Đơn hàng phải có ít nhất 1 sản phẩm' });
    }

    const normalizedCustomerPhone = customerPhone ? normalizePhoneE164(customerPhone) : '';

    let targetCustomerId = customerId && !customerId.startsWith('cust_') ? customerId : null;
    if (!targetCustomerId && normalizedCustomerPhone) {
      const variants = getPhoneLookupVariants(normalizedCustomerPhone);
      if (variants.length > 0) {
        const found = await prisma.customer.findFirst({
          where: { phone: { in: variants } },
          select: { id: true, name: true }
        });
        if (found) targetCustomerId = found.id;
      }
    }

    const orderCode = `DH-${Date.now().toString().slice(-6)}`;

    // Create Order with nested items
    const newOrder = await prisma.order.create({
      data: {
        orderCode,
        customerId: targetCustomerId || null,
        customerName: customerName || 'Khách vãng lai',
        customerPhone: normalizedCustomerPhone,
        totalAmount: Number(totalAmount) || 0,
        status: 'Completed',
        notes: notes || '',
        products: {
          create: products.map((p: any) => ({
            productId: p.productId || null,
            productName: p.productName || 'Sản phẩm',
            quantity: Number(p.quantity) || 1,
            price: Number(p.price) || 0
          }))
        }
      },
      include: {
        products: true,
        customer: true
      }
    });

    // Update customer's total spent & total orders
    if (targetCustomerId) {
      const customerOrders = await prisma.order.findMany({
        where: { customerId: targetCustomerId, status: 'Completed' }
      });

      const totalSpent = customerOrders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
      const totalOrdersCount = customerOrders.length;

      await prisma.customer.update({
        where: { id: targetCustomerId },
        data: {
          totalOrders: totalOrdersCount,
          totalSpent: totalSpent,
          lastPurchaseDate: new Date(),
          status: 'Won'
        }
      });

      realtimeHub.broadcast('customers:sync', { source: 'order-created', customerId: targetCustomerId });
    }

    realtimeHub.broadcast('orders:sync', { source: 'order-created', orderId: newOrder.id });

    return res.status(201).json(newOrder);
  } catch (error) {
    console.error('Lỗi tạo đơn hàng:', error);
    return res.status(500).json({ error: 'Lỗi khi tạo đơn hàng' });
  }
});

// DELETE /api/orders/:id
router.delete('/:id', requirePermission(Permission.ORDERS_MANAGE), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = getRouteParam(req.params.id);
    const existing = await prisma.order.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
    }

    await prisma.order.delete({ where: { id } });

    if (existing.customerId) {
      const customerOrders = await prisma.order.findMany({
        where: { customerId: existing.customerId, status: 'Completed' }
      });
      const totalSpent = customerOrders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
      const totalOrdersAll = await prisma.order.count({ where: { customerId: existing.customerId } });

      await prisma.customer.update({
        where: { id: existing.customerId },
        data: {
          totalOrders: totalOrdersAll,
          totalSpent: totalSpent
        }
      });
      realtimeHub.broadcast('customers:sync', { source: 'order-deleted', customerId: existing.customerId });
    }

    realtimeHub.broadcast('orders:sync', { source: 'order-deleted', orderId: id });

    return res.json({ success: true });
  } catch (error) {
    console.error('Lỗi xóa đơn hàng:', error);
    return res.status(500).json({ error: 'Lỗi khi xóa đơn hàng' });
  }
});

// POST /api/orders/bulk - Nhập hàng loạt đơn hàng từ CSV
const bulkOrderSchema = z.array(z.object({
  customerPhone: z.string().trim(),
  customerName: z.string().trim().optional(),
  order: z.object({
    orderCode: z.string().trim().optional(),
    date: z.string().optional(),
    products: z.array(z.object({
      productName: z.string().trim().min(1),
      quantity: z.coerce.number().min(1).default(1),
      price: z.coerce.number().min(0).default(0),
    }).passthrough()).min(1, 'Đơn hàng phải có ít nhất 1 sản phẩm'),
    totalAmount: z.coerce.number().min(0).default(0),
    status: z.enum(['Completed', 'Processing', 'Cancelled']).default('Completed'),
    notes: z.string().optional(),
  }).passthrough(),
}).passthrough()).min(1).max(2000);

router.post('/bulk', requirePermission(Permission.ORDERS_MANAGE), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rawList = Array.isArray(req.body) ? req.body : req.body.orders;
    const parsed = bulkOrderSchema.safeParse(rawList);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Dữ liệu nhập CSV đơn hàng không hợp lệ.' });
    }

    const rows = parsed.data;
    const phoneVariantsForLookup = Array.from(new Set(
      rows.flatMap((row) => getPhoneLookupVariants(normalizePhoneE164(row.customerPhone) || row.customerPhone))
    ));
    const foundCustomers = phoneVariantsForLookup.length > 0
      ? await prisma.customer.findMany({
          where: { phone: { in: phoneVariantsForLookup } },
          select: { id: true, phone: true },
        })
      : [];
    const customerIdByPhone = new Map(foundCustomers.map((customer) => [customer.phone, customer.id]));

    const createdOrders: Array<Awaited<ReturnType<typeof prisma.order.create>>> = [];
    const linkedCustomerIds = new Set<string>();
    const baseCode = Date.now().toString(36).toUpperCase();

    await prisma.$transaction(async (tx) => {
      for (const [index, row] of rows.entries()) {
        const normalizedPhone = normalizePhoneE164(row.customerPhone) || '';
        let customerId = normalizedPhone ? customerIdByPhone.get(normalizedPhone) ?? null : null;

        // Tự động tạo khách hàng nếu chưa tồn tại
        if (!customerId && normalizedPhone) {
          const newCust = await tx.customer.create({
            data: {
              name: row.customerName || `Khách Hàng (${normalizedPhone})`,
              phone: normalizedPhone,
              source: 'Direct',
              campaign: 'Import CSV Đơn Hàng',
              ownerId: req.user?.id || null,
              status: row.order.status === 'Completed' ? 'Won' : 'Contacted',
            },
          });
          customerId = newCust.id;
          customerIdByPhone.set(normalizedPhone, customerId);
        }

        if (customerId) linkedCustomerIds.add(customerId);

        const orderCode = row.order.orderCode?.trim()
          || `DH-${baseCode}-${index + 1}`;
        const orderDate = row.order.date ? new Date(row.order.date) : new Date();
        if (Number.isNaN(orderDate.getTime())) {
          throw new Error(`Ngày lập đơn không hợp lệ: ${row.order.date}`);
        }

        const created = await tx.order.create({
          data: {
            orderCode,
            whatsappMessageId: null,
            customerId: customerId || null,
            customerName: row.customerName || 'Khách vãng lai',
            customerPhone: normalizedPhone,
            totalAmount: row.order.totalAmount,
            status: row.order.status,
            notes: row.order.notes || '',
            date: orderDate,
            products: {
              create: row.order.products.map((product: { productName: string; quantity: number; price: number }) => ({
                productName: product.productName,
                quantity: product.quantity,
                price: product.price,
              })),
            },
          },
          include: { products: true },
        });
        createdOrders.push(created);
      }
    });

    // Cập nhật lại thống kê của khách liên quan
    for (const customerId of linkedCustomerIds) {
      const [customerOrders, completedOrders] = await Promise.all([
        prisma.order.count({ where: { customerId } }),
        prisma.order.findMany({ where: { customerId, status: 'Completed' }, select: { totalAmount: true } }),
      ]);
      const totalSpent = completedOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
      await prisma.customer.update({
        where: { id: customerId },
        data: {
          totalOrders: customerOrders,
          totalSpent,
          ...(completedOrders.length > 0 ? { lastPurchaseDate: new Date(), status: 'Won' } as any : {}),
        },
      });
    }

    if (linkedCustomerIds.size > 0) {
      realtimeHub.broadcast('customers:sync', {
        source: 'orders-bulk-imported',
        customerIds: Array.from(linkedCustomerIds),
      });
    }
    realtimeHub.broadcast('orders:sync', {
      source: 'orders-bulk-imported',
      orderIds: createdOrders.map((order) => order.id),
    });

    return res.status(201).json({
      createdCount: createdOrders.length,
      created: createdOrders,
    });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return res.status(409).json({ error: 'Mã đơn hàng bị trùng. Vui lòng kiểm tra lại cột "Mã Đơn" trong file CSV.' });
    }
    console.error('Lỗi nhập hàng loạt đơn hàng:', error);
    return res.status(500).json({ error: error?.message || 'Lỗi khi nhập hàng loạt đơn hàng' });
  }
});

// PATCH /api/orders/:id/status
router.patch('/:id/status', requirePermission(Permission.ORDERS_MANAGE), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = getRouteParam(req.params.id);
    const { status } = req.body;

    const updated = await prisma.order.update({
      where: { id },
      data: { status },
      include: { products: true }
    });

    // Recalculate customer metrics if customerId exists
    if (updated.customerId) {
      const customerOrders = await prisma.order.findMany({
        where: { customerId: updated.customerId, status: 'Completed' }
      });
      const totalSpent = customerOrders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
      const totalOrdersCount = customerOrders.length;

      await prisma.customer.update({
        where: { id: updated.customerId },
        data: {
          totalOrders: totalOrdersCount,
          totalSpent: totalSpent
        }
      });
      realtimeHub.broadcast('customers:sync', { source: 'order-status-updated', customerId: updated.customerId });
    }

    realtimeHub.broadcast('orders:sync', { source: 'order-status-updated', orderId: updated.id });

    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ error: 'Lỗi cập nhật trạng thái đơn hàng' });
  }
});

export default router;
