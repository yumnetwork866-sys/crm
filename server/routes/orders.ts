import type { Response } from 'express';
import { Router } from 'express';
import type { AuthenticatedRequest } from '../middleware/authMiddleware';
import { authenticateToken, requirePermission } from '../middleware/authMiddleware';
import { Permission } from '../auth/permissions';
import { prisma } from '../lib/prisma';
import { getRouteParam } from '../utils/requestParams';
import { realtimeHub } from '../services/realtimeHub';
import { getPhoneLookupVariants, normalizePhoneE164 } from '../utils/phone';

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
