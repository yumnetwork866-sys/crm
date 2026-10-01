import type { Response } from 'express';
import { Router } from 'express';
import type { AuthenticatedRequest } from '../middleware/authMiddleware';
import { authenticateToken, requirePermission } from '../middleware/authMiddleware';
import { Permission } from '../auth/permissions';
import { prisma } from '../lib/prisma';
import { getRouteParam } from '../utils/requestParams';

const router = Router();

router.use(authenticateToken);

// GET /api/products
router.get('/', requirePermission(Permission.PRODUCTS_VIEW), async (req: AuthenticatedRequest, res: Response) => {
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
router.post('/', requirePermission(Permission.PRODUCTS_CREATE), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, category, price, costPrice, stock, sku, description, image } = req.body;

    if (!name || price === undefined || price === null || isNaN(Number(price))) {
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
router.put('/:id', requirePermission(Permission.PRODUCTS_UPDATE), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = getRouteParam(req.params.id);
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
router.delete('/:id', requirePermission(Permission.PRODUCTS_DELETE), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = getRouteParam(req.params.id);
    await prisma.product.delete({ where: { id } });
    return res.json({ message: 'Xóa sản phẩm thành công' });
  } catch (error) {
    return res.status(500).json({ error: 'Lỗi khi xóa sản phẩm' });
  }
});

// POST /api/products/bulk - Bulk create or update products
router.post('/bulk', requirePermission(Permission.PRODUCTS_CREATE), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rawList = Array.isArray(req.body) ? req.body : req.body.products;
    if (!Array.isArray(rawList) || rawList.length === 0) {
      return res.status(400).json({ error: 'Danh sách sản phẩm không hợp lệ hoặc rỗng' });
    }

    const createdOrUpdated: Array<{
      id: string;
      code: string;
      name: string;
      category: string;
      price: number;
      costPrice: number;
      stock: number;
      status: string;
      sku: string | null;
      description: string | null;
      image: string | null;
      createdAt: Date;
      updatedAt: Date;
    }> = [];
    const timestamp = Date.now();

    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < rawList.length; i++) {
        const item = rawList[i];
        const name = typeof item.name === 'string' ? item.name.trim() : '';
        if (!name) continue;

        const rawCode = typeof item.code === 'string' ? item.code.trim() : '';
        const code = rawCode || `SP-${timestamp.toString().slice(-6)}-${i + 1}`;
        const numPrice = Number(item.price);
        const price = isNaN(numPrice) ? 0 : Math.max(0, numPrice);
        const numCost = Number(item.costPrice);
        const costPrice = isNaN(numCost) ? 0 : Math.max(0, numCost);
        const numStock = Number(item.stock);
        const stock = isNaN(numStock) ? 0 : Math.max(0, Math.floor(numStock));

        let status = typeof item.status === 'string' ? item.status : '';
        if (!status || !['In Stock', 'Low Stock', 'Out of Stock'].includes(status)) {
          if (stock === 0) status = 'Out of Stock';
          else if (stock < 15) status = 'Low Stock';
          else status = 'In Stock';
        }

        const category = typeof item.category === 'string' && item.category.trim() ? item.category.trim() : 'Mỹ Phẩm';
        const rawSku = typeof item.sku === 'string' ? item.sku.trim() : '';
        const sku = rawSku || code;
        const description = typeof item.description === 'string' ? item.description.trim() : '';
        const image = typeof item.image === 'string' ? item.image.trim() : '';

        const p = await tx.product.upsert({
          where: { code },
          update: {
            name,
            category,
            price,
            costPrice,
            stock,
            status,
            sku,
            description,
            ...(image ? { image } : {}),
          },
          create: {
            code,
            name,
            category,
            price,
            costPrice,
            stock,
            status,
            sku,
            description,
            image: image || null,
          },
        });
        createdOrUpdated.push(p);
      }
    });

    return res.status(201).json({
      message: `Đã lưu thành công ${createdOrUpdated.length} sản phẩm`,
      count: createdOrUpdated.length,
      products: createdOrUpdated,
    });
  } catch (error) {
    console.error('Lỗi khi nhập danh sách sản phẩm:', error);
    return res.status(500).json({ error: 'Lỗi máy chủ khi lưu sản phẩm' });
  }
});

export default router;
