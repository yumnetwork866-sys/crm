import type { Response } from 'express';
import { Router } from 'express';
import type { AuthenticatedRequest } from '../middleware/authMiddleware';
import { authenticateToken, requireRole } from '../middleware/authMiddleware';
import { prisma } from '../lib/prisma';

const router = Router();

router.use(authenticateToken);

// GET /api/products
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const products = await prisma.product.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return res.json(products);
  } catch (error) {
    return res.status(500).json({ error: 'Lỗi khi lấy danh sách sản phẩm' });
  }
});

// POST /api/products - Create Product (Requires Admin or Manager)
router.post('/', requireRole(['Admin', 'Sales Manager', 'Marketing Lead']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, category, price, costPrice, stock, sku, description, image } = req.body;

    if (!name || !price) {
      return res.status(400).json({ error: 'Tên và giá sản phẩm là bắt buộc' });
    }

    const code = `SP-${Date.now().toString().slice(-6)}`;
    const numStock = Number(stock) || 0;
    let status = 'In Stock';
    if (numStock === 0) status = 'Out of Stock';
    else if (numStock < 15) status = 'Low Stock';

    const newProduct = await prisma.product.create({
      data: {
        code,
        name,
        category: category || 'Khác',
        price: Number(price),
        costPrice: Number(costPrice) || Number(price) * 0.4,
        stock: numStock,
        status,
        sku: sku || code,
        description: description || '',
        image: image || ''
      }
    });

    return res.status(201).json(newProduct);
  } catch (error) {
    console.error('Lỗi khi tạo sản phẩm:', error);
    return res.status(500).json({ error: 'Lỗi khi tạo sản phẩm mới' });
  }
});

// PUT /api/products/:id - Update Product
router.put('/:id', requireRole(['Admin', 'Sales Manager']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, category, price, costPrice, stock, sku, description, image } = req.body;

    const numStock = Number(stock);
    let status = 'In Stock';
    if (numStock === 0) status = 'Out of Stock';
    else if (numStock < 15) status = 'Low Stock';

    const updated = await prisma.product.update({
      where: { id },
      data: {
        name,
        category,
        price: Number(price),
        costPrice: Number(costPrice),
        stock: numStock,
        status,
        sku,
        description,
        image
      }
    });

    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ error: 'Lỗi khi cập nhật sản phẩm' });
  }
});

// DELETE /api/products/:id
router.delete('/:id', requireRole(['Admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.product.delete({ where: { id } });
    return res.json({ message: 'Xóa sản phẩm thành công' });
  } catch (error) {
    return res.status(500).json({ error: 'Lỗi khi xóa sản phẩm' });
  }
});

export default router;
