export const CATEGORIES = ['Tất cả danh mục', 'Mỹ Phẩm', 'Thực Phẩm Chức Năng', 'Thời Trang', 'Gia Dụng', 'Khác'];

export interface MetaCatalogOption {
  id: string;
  name: string;
  product_count?: number;
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

export type MetaColumnKey = 'variants' | 'availability' | 'price' | 'brand' | 'condition' | 'quantity' | 'dataSource' | 'lastUpdated';

export const META_COLUMN_LABELS: Record<MetaColumnKey, string> = {
  variants: 'Variants',
  availability: 'Availability',
  price: 'Price',
  brand: 'Brand',
  condition: 'Condition',
  quantity: 'Quantity to sell',
  dataSource: 'Data sources',
  lastUpdated: 'Last updated',
};

export function formatMetaPrice(price?: string | number, currency?: string): string {
  if (price === undefined || price === null || price === '') return 'Chưa có giá';
  if (typeof price === 'string') {
    if (/[a-z]/i.test(price)) return price;
  }
  const numericPrice = Number(price);
  if (!Number.isFinite(numericPrice)) return String(price);
  const amount = numericPrice / 100;
  return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(amount)}${currency ? ` ${currency}` : ''}`;
}
