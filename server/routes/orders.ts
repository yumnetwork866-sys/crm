import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthenticatedRequest } from '../middleware/authMiddleware';
import { z } from 'zod';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

// GET /api/orders
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orders = await prisma.order.findMany({
      include: {
        products: true,
        customer: true
      },
      orderBy: { date: 'desc' }
    });
    return res.json(orders);
  } catch (error) {
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
