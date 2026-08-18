import { Router, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/authMiddleware';
import { prisma } from '../lib/prisma';
import { z } from 'zod';

const router = Router();

router.use(authenticateToken);

// GET /api/orders - List orders with pagination, status & customer filtering
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
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
      whereClause.OR = [
        { orderCode: { contains: search, mode: 'insensitive' } },
        { customerName: { contains: search, mode: 'insensitive' } },
        { customerPhone: { contains: search } }
      ];
    }

    if (isPaginationRequested) {
      const [total, orders] = await Promise.all([
        prisma.order.count({ where: whereClause }),
        prisma.order.findMany({
          where: whereClause,
          include: {
            products: true,
            customer: true
          },
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

    // Default full query when pagination is not requested
    const orders = await prisma.order.findMany({
      where: whereClause,
      include: {
        products: true,
        customer: true
      },
      orderBy: { date: 'desc' }
    });

    return res.json(orders);
  } catch (error) {
    console.error('Lỗi khi lấy danh sách đơn hàng:', error);
    return res.status(500).json({ error: 'Lỗi khi lấy danh sách đơn hàng' });
  }
});

// POST /api/orders - Create Order
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { customerId, customerName, customerPhone, products, totalAmount, notes } = req.body;

    if (!products || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ error: 'Đơn hàng phải có ít nhất 1 sản phẩm' });
    }

    const orderCode = `DH-${Date.now().toString().slice(-6)}`;

    // Create Order with nested items
    const newOrder = await prisma.order.create({
      data: {
        orderCode,
        customerId: customerId || null,
        customerName: customerName || 'Khách vãng lai',
        customerPhone: customerPhone || '',
        totalAmount: totalAmount || 0,
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
    if (customerId) {
      const customerOrders = await prisma.order.findMany({
        where: { customerId, status: 'Completed' }
      });

      const totalSpent = customerOrders.reduce((sum, o) => sum + o.totalAmount, 0);
      const totalOrdersCount = customerOrders.length;

      await prisma.customer.update({
        where: { id: customerId },
        data: {
          totalOrders: totalOrdersCount,
          totalSpent: totalSpent,
          lastPurchaseDate: new Date(),
          status: 'Won'
        }
      });
    }

    return res.status(201).json(newOrder);
  } catch (error) {
    console.error('Lỗi tạo đơn hàng:', error);
    return res.status(500).json({ error: 'Lỗi khi tạo đơn hàng' });
  }
});

// PATCH /api/orders/:id/status
router.patch('/:id/status', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const updated = await prisma.order.update({
      where: { id },
      data: { status },
      include: { products: true }
    });

    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ error: 'Lỗi cập nhật trạng thái đơn hàng' });
  }
});

export default router;
