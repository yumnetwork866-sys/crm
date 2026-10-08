import { Router, type Response } from 'express';
import { authenticateToken, requirePermission, type AuthenticatedRequest } from '../middleware/authMiddleware';
import { Permission } from '../auth/permissions';
import {
  fetchMetaCatalogs,
  fetchMetaCatalogProducts,
  saveMetaCatalogId,
  syncProductsToMetaCatalog,
  importProductsFromMetaCatalog,
} from '../services/metaCatalogService';
import { prisma } from '../lib/prisma';

const router = Router();

router.use(authenticateToken);

/**
 * GET /api/catalog/list
 * Auto-discover all Meta Catalogs accessible with the current META_ACCESS_TOKEN
 */
router.get(
  '/list',
  requirePermission(Permission.PRODUCTS_VIEW),
  async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const result = await fetchMetaCatalogs();
      return res.json({
        success: true,
        ...result,
      });
    } catch (error: any) {
      console.error('[API CATALOG] Lỗi khi dò tìm danh sách catalog:', error?.message || error);
      return res.status(500).json({
        success: false,
        error: error?.message || 'Không thể lấy danh sách Meta Catalog từ Graph API.',
      });
    }
  }
);

/**
 * GET /api/catalog/:catalogId/products
 * Browse one Meta catalog without changing the default sync catalog.
 */
router.get(
  '/:catalogId/products',
  requirePermission(Permission.PRODUCTS_VIEW),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const catalogId = String(req.params.catalogId || '');
      const after = typeof req.query.after === 'string' ? req.query.after : undefined;
      const requestedLimit = Number(req.query.limit);
      const limit = Number.isFinite(requestedLimit) ? requestedLimit : 50;
      const result = await fetchMetaCatalogProducts(catalogId, { limit, after });
      return res.json({ success: true, ...result });
    } catch (error: any) {
      console.error('[API CATALOG] Lỗi khi lấy sản phẩm catalog:', error?.message || error);
      return res.status(502).json({
        success: false,
        error: error?.message || 'Không thể lấy sản phẩm từ Meta Catalog.',
      });
    }
  },
);

/**
 * POST /api/catalog/select
 * Save selected catalog ID
 */
router.post(
  '/select',
  requirePermission(Permission.ADMINISTRATOR),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { catalogId } = req.body;
      if (!catalogId || typeof catalogId !== 'string') {
        return res.status(400).json({ error: 'Mã Catalog ID là bắt buộc.' });
      }

      await saveMetaCatalogId(catalogId);
      return res.json({
        success: true,
        message: 'Đã lưu cấu hình Meta Catalog thành công.',
        catalogId: catalogId.trim(),
      });
    } catch (error: any) {
      console.error('[API CATALOG] Lỗi khi lưu catalogId:', error?.message || error);
      return res.status(500).json({ error: 'Lỗi khi lưu cấu hình Catalog.' });
    }
  }
);

/**
 * GET /api/catalog/status
 * Get catalog sync status summary
 */
router.get(
  '/status',
  requirePermission(Permission.PRODUCTS_VIEW),
  async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const setting = await prisma.integrationSetting.findUnique({
        where: { id: 'default' },
        select: { metaCatalogId: true },
      });

      const totalProducts = await prisma.product.count();
      const syncedProducts = await prisma.product.count({
        where: { metaSyncStatus: 'synced' },
      });
      const errorProducts = await prisma.product.count({
        where: { metaSyncStatus: 'error' },
      });

      return res.json({
        catalogId: setting?.metaCatalogId || process.env.META_CATALOG_ID?.trim() || null,
        isConfigured: Boolean(setting?.metaCatalogId || process.env.META_CATALOG_ID?.trim()),
        totalProducts,
        syncedProducts,
        errorProducts,
        notSyncedProducts: totalProducts - syncedProducts - errorProducts,
      });
    } catch (error: any) {
      return res.status(500).json({ error: 'Không thể lấy trạng thái Catalog.' });
    }
  }
);

/**
 * POST /api/catalog/sync
 * Sync all or selected products from CRM to Meta Catalog
 */
router.post(
  '/sync',
  requirePermission(Permission.PRODUCTS_UPDATE),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { productIds } = req.body;
      const result = await syncProductsToMetaCatalog(
        Array.isArray(productIds) ? productIds : undefined
      );

      return res.json(result);
    } catch (error: any) {
      console.error('[API CATALOG] Lỗi đồng bộ sản phẩm:', error?.message || error);
      return res.status(500).json({
        success: false,
        error: error?.message || 'Lỗi khi đồng bộ sản phẩm sang Meta Catalog.',
      });
    }
  }
);

/**
 * POST /api/catalog/import
 * Import / pull products from Meta Catalog into CRM
 */
router.post(
  '/import',
  requirePermission(Permission.PRODUCTS_CREATE),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const catalogId = typeof req.body?.catalogId === 'string' ? req.body.catalogId : undefined;
      const result = await importProductsFromMetaCatalog(catalogId);
      return res.json({
        success: true,
        message: `Đã nhập ${result.importedCount} sản phẩm mới và cập nhật ${result.updatedCount} sản phẩm từ Meta Catalog.`,
        ...result,
      });
    } catch (error: any) {
      console.error('[API CATALOG] Lỗi kéo sản phẩm từ Meta:', error?.message || error);
      return res.status(500).json({
        success: false,
        error: error?.message || 'Không thể kéo sản phẩm từ Meta Catalog.',
      });
    }
  }
);

export default router;
