import { prisma } from '../lib/prisma';
import {
  getIntegrationSetting,
  getMetaAccessToken,
  getMetaAccessTokenForPhone,
} from './metaApiClient';

const GRAPH_VERSION = process.env.META_GRAPH_VERSION?.trim() || 'v26.0';
const GRAPH_BASE_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;

export interface MetaCatalogInfo {
  id: string;
  name: string;
  vertical?: string;
  product_count?: number;
  feed_count?: number;
  business?: {
    id: string;
    name: string;
  };
}

export interface SyncResult {
  success: boolean;
  totalProducts: number;
  syncedCount: number;
  failedCount: number;
  errors?: string[];
}

export interface MetaCatalogProduct {
  id: string;
  retailerId: string;
  name: string;
  description?: string;
  price?: string | number;
  currency?: string;
  availability?: string;
  imageUrl?: string;
  category?: string;
  status?: string;
  reviewStatus?: string;
  reviewRejectionReasons?: string[];
  retailerProductGroupId?: string;
  brand?: string;
  condition?: string;
  inventory?: number;
  quantityToSell?: number;
  dataSource?: string;
}

export interface MetaCatalogProductsPage {
  catalog: MetaCatalogInfo;
  products: MetaCatalogProduct[];
  paging: {
    after: string | null;
    before: string | null;
    hasNextPage: boolean;
  };
}

function normalizeCatalogId(catalogId: string): string {
  const normalizedId = catalogId.trim();
  if (!/^\d+$/.test(normalizedId)) {
    throw new Error('Meta Catalog ID không hợp lệ.');
  }
  return normalizedId;
}

async function getAcceptedCatalogIdsForPhone(phoneNumberId: string): Promise<string[]> {
  const messages = await prisma.whatsAppMessage.findMany({
    where: {
      businessPhoneNumberId: phoneNumberId,
      isRealSent: true,
      content: { contains: '[product:' },
    },
    select: { content: true },
    orderBy: { timestamp: 'desc' },
    take: 500,
  });
  const catalogIds = new Set<string>();
  messages.forEach(({ content }) => {
    const match = content.match(/\[product:(\{.*?\})\]/s);
    if (!match) return;
    try {
      const catalogId = String(JSON.parse(match[1])?.catalog_id || '').trim();
      if (/^\d+$/.test(catalogId)) catalogIds.add(catalogId);
    } catch {
      // Ignore malformed historical product tags.
    }
  });
  return Array.from(catalogIds);
}

/**
 * Fetch a cursor-paginated page of products from a specific catalog.
 * Merely viewing another catalog must not change the configured default catalog.
 */
export async function fetchMetaCatalogProducts(
  catalogId: string,
  options: { limit?: number; after?: string } = {},
  phoneNumberId?: string,
): Promise<MetaCatalogProductsPage> {
  const setting = await getIntegrationSetting();
  const token = await getMetaAccessToken(setting)
    || (phoneNumberId ? await getMetaAccessTokenForPhone(phoneNumberId, setting) : '');
  if (!token) {
    throw new Error('Chưa cấu hình META_ACCESS_TOKEN hoặc kết nối Meta.');
  }

  const normalizedCatalogId = normalizeCatalogId(catalogId);
  if (phoneNumberId) {
    const { catalogs } = await fetchMetaCatalogs(phoneNumberId);
    if (!catalogs.some((catalog) => catalog.id === normalizedCatalogId)) {
      throw new Error('Catalog này không thuộc số WhatsApp Business đang chọn.');
    }
  }
  const limit = Math.min(Math.max(Math.trunc(options.limit || 50), 1), 100);
  const fields = [
    'id',
    'retailer_id',
    'name',
    'description',
    'price',
    'currency',
    'availability',
    'image_url',
    'category',
    'status',
    'review_status',
    'review_rejection_reasons',
    'retailer_product_group_id',
    'brand',
    'condition',
    'inventory',
    'quantity_to_sell_on_facebook',
    'product_feed',
  ].join(',');
  const query = new URLSearchParams({ fields, limit: String(limit) });
  if (options.after) query.set('after', options.after);

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  const [catalogResponse, productsResponse] = await Promise.all([
    fetch(
      `${GRAPH_BASE_URL}/${normalizedCatalogId}?fields=id,name,vertical,product_count,feed_count`,
      { headers },
    ),
    fetch(`${GRAPH_BASE_URL}/${normalizedCatalogId}/products?${query.toString()}`, { headers }),
  ]);

  const catalogData: any = await catalogResponse.json().catch(() => ({}));
  const productsData: any = await productsResponse.json().catch(() => ({}));
  if (!catalogResponse.ok || !catalogData?.id) {
    throw new Error(catalogData?.error?.message || 'Catalog không tồn tại hoặc tài khoản không có quyền truy cập.');
  }
  if (!productsResponse.ok) {
    throw new Error(productsData?.error?.message || 'Không thể lấy sản phẩm từ Meta Catalog.');
  }

  const products = (Array.isArray(productsData?.data) ? productsData.data : []).map((item: any) => ({
    id: String(item.id || ''),
    retailerId: String(item.retailer_id || item.id || ''),
    name: String(item.name || 'Sản phẩm Meta'),
    description: item.description ? String(item.description) : undefined,
    price: typeof item.price === 'string' || typeof item.price === 'number' ? item.price : undefined,
    currency: item.currency ? String(item.currency) : undefined,
    availability: item.availability ? String(item.availability) : undefined,
    imageUrl: item.image_url ? String(item.image_url) : undefined,
    category: item.category ? String(item.category) : undefined,
    status: item.status ? String(item.status) : undefined,
    reviewStatus: item.review_status ? String(item.review_status) : undefined,
    reviewRejectionReasons: Array.isArray(item.review_rejection_reasons)
      ? item.review_rejection_reasons.map((reason: unknown) => String(reason))
      : undefined,
    retailerProductGroupId: item.retailer_product_group_id
      ? String(item.retailer_product_group_id)
      : undefined,
    brand: item.brand ? String(item.brand) : undefined,
    condition: item.condition ? String(item.condition) : undefined,
    inventory: typeof item.inventory === 'number' ? item.inventory : undefined,
    quantityToSell: typeof item.quantity_to_sell_on_facebook === 'number'
      ? item.quantity_to_sell_on_facebook
      : undefined,
    dataSource: item.product_feed?.name
      ? String(item.product_feed.name)
      : item.product_feed?.id
        ? String(item.product_feed.id)
        : undefined,
  }));
  const cursors = productsData?.paging?.cursors || {};

  return {
    catalog: catalogData,
    products,
    paging: {
      after: typeof cursors.after === 'string' ? cursors.after : null,
      before: typeof cursors.before === 'string' ? cursors.before : null,
      hasNextPage: Boolean(productsData?.paging?.next),
    },
  };
}

/**
 * Fetch all Catalogs accessible by the business account or system user
 */
export async function fetchMetaCatalogs(phoneNumberId?: string): Promise<{
  catalogs: MetaCatalogInfo[];
  currentCatalogId: string | null;
}> {
  const setting = await getIntegrationSetting();
  const normalizedPhoneId = phoneNumberId?.trim();
  const token = normalizedPhoneId
    ? await getMetaAccessTokenForPhone(normalizedPhoneId, setting)
    : await getMetaAccessToken(setting);
  if (!token) {
    throw new Error('Chưa cấu hình META_ACCESS_TOKEN hoặc kết nối Meta.');
  }

  const catalogs: MetaCatalogInfo[] = [];
  if (normalizedPhoneId) {
    const connection = await prisma.whatsAppConnection.findUnique({
      where: { phoneNumberId: normalizedPhoneId },
      select: { wabaId: true },
    });
    if (!connection) {
      throw new Error('Không tìm thấy kết nối cho số WhatsApp Business đang chọn.');
    }

    const response = await fetch(
      `${GRAPH_BASE_URL}/${connection.wabaId}/product_catalogs?fields=id,name,vertical,product_count,feed_count&limit=50`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      },
    );
    const data: any = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.error?.message || 'Không thể lấy catalog của số WhatsApp Business đang chọn.');
    }
    if (Array.isArray(data?.data)) {
      data.data.forEach((catalog: MetaCatalogInfo) => {
        if (catalog?.id && !catalogs.some((item) => item.id === catalog.id)) catalogs.push(catalog);
      });
    }

    // Some WhatsApp tokens can send an interactive product message but cannot
    // read Commerce catalog objects. Preserve per-number isolation by learning
    // catalog IDs only from product messages Meta previously accepted for this phone.
    const acceptedCatalogIds = await getAcceptedCatalogIdsForPhone(normalizedPhoneId);
    const catalogReadToken = await getMetaAccessToken(setting) || token;
    for (const catalogId of acceptedCatalogIds) {
      if (catalogs.some((catalog) => catalog.id === catalogId)) continue;
      const catalogResponse = await fetch(
        `${GRAPH_BASE_URL}/${catalogId}?fields=id,name,vertical,product_count,feed_count`,
        {
          headers: {
            Authorization: `Bearer ${catalogReadToken}`,
            'Content-Type': 'application/json',
          },
        },
      );
      const catalog = await catalogResponse.json().catch(() => ({}));
      if (catalogResponse.ok && catalog?.id) catalogs.push(catalog as MetaCatalogInfo);
    }

    const configuredCatalogId = setting.metaCatalogId || process.env.META_CATALOG_ID?.trim() || null;
    return {
      catalogs,
      currentCatalogId: catalogs.some((catalog) => catalog.id === configuredCatalogId)
        ? configuredCatalogId
        : catalogs[0]?.id || null,
    };
  }

  const businessId = setting.metaBusinessId || process.env.META_BUSINESS_ID?.trim();

  // 1. Primary for System User: Query /me/assigned_product_catalogs
  try {
    const assignedRes = await fetch(
      `${GRAPH_BASE_URL}/me/assigned_product_catalogs?fields=id,name,vertical,product_count,feed_count&limit=50`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );
    const assignedData: any = await assignedRes.json();
    if (assignedRes.ok && Array.isArray(assignedData?.data)) {
      for (const item of assignedData.data) {
        if (!catalogs.some((c) => c.id === item.id)) {
          catalogs.push(item);
        }
      }
    }
  } catch (err) {
    console.warn('[META CATALOG] Không thể lấy catalog theo /me/assigned_product_catalogs:', err);
  }

  // 2. Try fetching catalogs owned by the Business Account if businessId exists
  if (businessId && catalogs.length === 0) {
    try {
      const res = await fetch(
        `${GRAPH_BASE_URL}/${businessId}/owned_product_catalogs?fields=id,name,vertical,product_count,feed_count&limit=50`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      const data: any = await res.json();
      if (res.ok && Array.isArray(data?.data)) {
        for (const item of data.data) {
          if (!catalogs.some((c) => c.id === item.id)) {
            catalogs.push(item);
          }
        }
      }
    } catch (err) {
      console.warn('[META CATALOG] Không thể lấy catalog theo businessId:', err);
    }
  }

  // 3. Fallback: Check businesses of system user and query their catalogs
  if (catalogs.length === 0) {
    try {
      const businessesRes = await fetch(
        `${GRAPH_BASE_URL}/me/businesses?fields=id,name&limit=10`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      const bizData: any = await businessesRes.json();
      if (businessesRes.ok && Array.isArray(bizData?.data)) {
        for (const biz of bizData.data) {
          const catRes = await fetch(
            `${GRAPH_BASE_URL}/${biz.id}/owned_product_catalogs?fields=id,name,vertical,product_count,feed_count&limit=50`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            }
          );
          const catData: any = await catRes.json();
          if (catRes.ok && Array.isArray(catData?.data)) {
            for (const item of catData.data) {
              if (!catalogs.some((c) => c.id === item.id)) {
                catalogs.push({ ...item, business: { id: biz.id, name: biz.name } });
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn('[META CATALOG] Không thể lấy catalog theo businesses:', err);
    }
  }

  // 4. If current configured catalog is not in the list, fetch its info directly
  const configuredCatalogId = setting.metaCatalogId || process.env.META_CATALOG_ID?.trim() || null;
  if (configuredCatalogId && !catalogs.some((c) => c.id === configuredCatalogId)) {
    try {
      const res = await fetch(
        `${GRAPH_BASE_URL}/${configuredCatalogId}?fields=id,name,vertical,product_count,feed_count`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      const data: any = await res.json();
      if (res.ok && data?.id) {
        catalogs.unshift(data);
      }
    } catch {
      // Ignore
    }
  }

  return {
    catalogs,
    currentCatalogId: configuredCatalogId,
  };
}

/**
 * Save selected Meta Catalog ID into CRM IntegrationSetting
 */
export async function saveMetaCatalogId(catalogId: string): Promise<void> {
  const normalizedId = catalogId.trim();
  await prisma.integrationSetting.upsert({
    where: { id: 'default' },
    update: { metaCatalogId: normalizedId || null },
    create: {
      id: 'default',
      metaCatalogId: normalizedId || null,
    },
  });
}

/**
 * Sync CRM Products to Meta Commerce Catalog via Batch API:
 * POST /{catalog_id}/batch
 */
export async function syncProductsToMetaCatalog(productIds?: string[]): Promise<SyncResult> {
  const setting = await getIntegrationSetting();
  const token = await getMetaAccessToken(setting);
  const catalogId = setting.metaCatalogId || process.env.META_CATALOG_ID?.trim();

  if (!token) {
    throw new Error('Chưa cấu hình META_ACCESS_TOKEN.');
  }
  if (!catalogId) {
    throw new Error('Chưa chọn hoặc cấu hình Meta Catalog ID.');
  }

  // Query products from CRM
  const whereClause = productIds?.length ? { id: { in: productIds } } : {};
  const products = await prisma.product.findMany({
    where: whereClause,
    orderBy: { createdAt: 'desc' },
  });

  if (products.length === 0) {
    return {
      success: true,
      totalProducts: 0,
      syncedCount: 0,
      failedCount: 0,
    };
  }

  const appUrl = (process.env.APP_URL || 'https://crm.yumnetwork.vn').replace(/\/$/, '');
  const errors: string[] = [];
  let syncedCount = 0;
  let failedCount = 0;

  // Meta Batch API supports up to 4999 requests per batch, we chunk into batches of 100 for safety
  const BATCH_SIZE = 100;
  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const chunk = products.slice(i, i + BATCH_SIZE);

    const requests = chunk.map((product) => {
      const retailerId = product.code || product.id;
      // Resolve valid image URL or fallback
      let imageUrl = product.image?.trim() || '';
      if (imageUrl && imageUrl.startsWith('/')) {
        imageUrl = `${appUrl}${imageUrl}`;
      } else if (!imageUrl || !imageUrl.startsWith('http')) {
        imageUrl = `${appUrl}/images/default-product.png`;
      }

      // Format price in Vietnamese Dong (VND)
      const priceInVnd = Math.round(product.price);
      const availability = product.stock > 0 ? 'in stock' : 'out of stock';

      return {
        method: 'UPDATE',
        retailer_id: retailerId,
        data: {
          title: product.name,
          description: product.description || product.name,
          availability,
          condition: 'new',
          price: priceInVnd * 100, // Meta prices in integer cents/currency subunit
          currency: 'VND',
          url: `${appUrl}/products/${encodeURIComponent(product.id)}`,
          image_url: imageUrl,
          brand: 'YumNetwork',
          category: product.category || 'Khác',
        },
      };
    });

    try {
      const res = await fetch(`${GRAPH_BASE_URL}/${catalogId}/batch`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requests }),
      });

      const data: any = await res.json();
      if (!res.ok) {
        const errorMsg = data?.error?.message || `Lỗi khi gọi Meta Batch API (Mã ${res.status})`;
        errors.push(errorMsg);
        failedCount += chunk.length;

        // Mark failed in DB
        await prisma.product.updateMany({
          where: { id: { in: chunk.map((p) => p.id) } },
          data: { metaSyncStatus: 'error' },
        });
        continue;
      }

      // Check per-item handles/errors
      const handles = data?.handles || [];
      const errorMap = new Map<string, string>();
      if (Array.isArray(data?.errors)) {
        for (const err of data.errors) {
          if (err?.retailer_id) {
            errorMap.set(err.retailer_id, err.message || 'Lỗi không xác định');
          }
        }
      }

      const now = new Date();
      for (const p of chunk) {
        const retailerId = p.code || p.id;
        const itemError = errorMap.get(retailerId);
        if (itemError) {
          failedCount++;
          errors.push(`[${p.name}]: ${itemError}`);
          await prisma.product.update({
            where: { id: p.id },
            data: { metaSyncStatus: 'error' },
          });
        } else {
          syncedCount++;
          await prisma.product.update({
            where: { id: p.id },
            data: {
              metaRetailerId: retailerId,
              metaSyncStatus: 'synced',
              lastSyncedAt: now,
            },
          });
        }
      }
    } catch (err: any) {
      const msg = err?.message || 'Lỗi mạng khi kết nối Meta Batch API';
      errors.push(msg);
      failedCount += chunk.length;
      await prisma.product.updateMany({
        where: { id: { in: chunk.map((p) => p.id) } },
        data: { metaSyncStatus: 'error' },
      });
    }
  }

  return {
    success: failedCount === 0,
    totalProducts: products.length,
    syncedCount,
    failedCount,
    errors: errors.length ? errors : undefined,
  };
}

/**
 * Fetch products directly from Meta Catalog (Import from Meta into CRM)
 */
export async function importProductsFromMetaCatalog(catalogIdOverride?: string): Promise<{
  importedCount: number;
  updatedCount: number;
  totalCatalogProducts: number;
}> {
  const setting = await getIntegrationSetting();
  const token = await getMetaAccessToken(setting);
  const configuredCatalogId = setting.metaCatalogId || process.env.META_CATALOG_ID?.trim();
  const catalogId = catalogIdOverride ? normalizeCatalogId(catalogIdOverride) : configuredCatalogId;

  if (!token || !catalogId) {
    throw new Error('Chưa cấu hình Token hoặc Catalog ID.');
  }

  const res = await fetch(
    `${GRAPH_BASE_URL}/${catalogId}/products?fields=id,retailer_id,name,description,price,currency,availability,image_url,category&limit=100`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  const data: any = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || 'Không thể lấy danh sách sản phẩm từ Meta Catalog.');
  }

  const metaProducts = data?.data || [];
  let importedCount = 0;
  let updatedCount = 0;
  const now = new Date();

  for (const item of metaProducts) {
    const retailerId = item.retailer_id || item.id;
    const name = item.name || 'Sản phẩm Meta';
    // Price from Meta comes formatted (e.g., "500000 VND" or float)
    let price = 0;
    if (typeof item.price === 'string') {
      const match = item.price.match(/\d+/g);
      if (match) price = Number(match.join('')) / 100;
    } else if (typeof item.price === 'number') {
      price = item.price;
    }

    const existing = await prisma.product.findFirst({
      where: {
        OR: [{ code: retailerId }, { metaRetailerId: retailerId }],
      },
    });

    if (existing) {
      await prisma.product.update({
        where: { id: existing.id },
        data: {
          name,
          description: item.description || existing.description,
          price: price > 0 ? price : existing.price,
          image: item.image_url || existing.image,
          metaRetailerId: retailerId,
          metaSyncStatus: 'synced',
          lastSyncedAt: now,
        },
      });
      updatedCount++;
    } else {
      await prisma.product.create({
        data: {
          code: retailerId,
          name,
          category: item.category || 'Khác',
          price: price > 0 ? price : 100000,
          costPrice: price > 0 ? price * 0.4 : 40000,
          stock: item.availability === 'in stock' ? 50 : 0,
          status: item.availability === 'in stock' ? 'In Stock' : 'Out of Stock',
          description: item.description || '',
          image: item.image_url || '',
          metaRetailerId: retailerId,
          metaSyncStatus: 'synced',
          lastSyncedAt: now,
        },
      });
      importedCount++;
    }
  }

  return {
    importedCount,
    updatedCount,
    totalCatalogProducts: metaProducts.length,
  };
}
