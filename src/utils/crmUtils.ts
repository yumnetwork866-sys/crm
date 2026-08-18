import { Customer, CustomerGroupId, CustomerGroupInfo, CustomerStatus } from '../types';

export function getStatusColorClass(status: CustomerStatus | string): string {
  switch (status) {
    case 'Won':
      return 'bg-emerald-100 text-[#00793d] border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40 font-bold';
    case 'Contacted':
      return 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/40 font-bold';
    case 'Quoted':
      return 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40 font-bold';
    case 'New Lead':
      return 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-500/20 dark:text-purple-300 dark:border-purple-500/40 font-bold';
    case 'Lost':
      return 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/40 font-bold';
    default:
      return 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 font-bold';
  }
}

export function getOwnerBadgeClass(ownerName?: string): string {
  if (!ownerName) return 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 font-semibold';
  if (ownerName.includes('Ánh')) {
    return 'bg-violet-100 text-violet-800 border-violet-300 dark:bg-violet-500/20 dark:text-violet-300 dark:border-violet-500/40 font-semibold';
  }
  if (ownerName.includes('Hà')) {
    return 'bg-pink-100 text-pink-800 border-pink-300 dark:bg-pink-500/20 dark:text-pink-300 dark:border-pink-500/40 font-semibold';
  }
  if (ownerName.includes('Nam')) {
    return 'bg-cyan-100 text-cyan-800 border-cyan-300 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-500/40 font-semibold';
  }
  if (ownerName.includes('Đức')) {
    return 'bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-500/20 dark:text-sky-300 dark:border-sky-500/40 font-semibold';
  }
  if (ownerName.includes('Hương')) {
    return 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40 font-semibold';
  }
  return 'bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-500/40 font-semibold';
}

export const CUSTOMER_GROUPS: Record<CustomerGroupId, CustomerGroupInfo> = {
  group_1: {
    id: 'group_1',
    name: 'Khách mới',
    description: 'Chưa được tư vấn & chưa phát sinh đơn hàng',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
  },
  group_2: {
    id: 'group_2',
    name: 'Đã hỏi giá',
    description: 'Đã tư vấn/báo giá nhưng chưa mua',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800',
  },
  group_3: {
    id: 'group_3',
    name: 'Đã mua 1 lần',
    description: 'Khách đã mua 1 đơn duy nhất - Cần chăm sóc quay lại',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
  },
  group_4: {
    id: 'group_4',
    name: 'Đã mua từ 2 lần trở lên (VIP)',
    description: 'Khách hàng thân thiết / VIP mua nhiều lần',
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800',
  },
};

/**
 * Categorize a customer into one of the 4 strict Groups specified in requirement:
 * Nhóm 1: Khách mới (Chưa được tư vấn)
 * Nhóm 2: Đã hỏi giá (Chưa mua)
 * Nhóm 3: Đã mua 1 lần
 * Nhóm 4: Đã mua từ 2 lần trở lên
 */
export function getCustomerGroup(customer: Customer): CustomerGroupId {
  if (customer.totalOrders >= 2) {
    return 'group_4';
  }
  if (customer.totalOrders === 1) {
    return 'group_3';
  }
  if (customer.status === 'Quoted' || customer.status === 'Contacted') {
    return 'group_2';
  }
  return 'group_1';
}

export type CurrencyUnit = 'RM' | 'VND' | 'USD';

export function getGlobalCurrency(): CurrencyUnit {
  try {
    const saved = localStorage.getItem('vietcrm_currency_unit') as CurrencyUnit;
    if (saved && ['RM', 'VND', 'USD'].includes(saved)) {
      return saved;
    }
  } catch {
    // fallback
  }
  return 'RM'; // Default to RM
}

export function setGlobalCurrency(unit: CurrencyUnit) {
  try {
    localStorage.setItem('vietcrm_currency_unit', unit);
  } catch (e) {
    console.error('Error saving currency unit:', e);
  }
}

export function formatVND(amount: number, overrideUnit?: CurrencyUnit): string {
  const unit = overrideUnit || getGlobalCurrency();
  const num = isNaN(amount) ? 0 : amount;

  if (unit === 'RM') {
    return `RM ${num.toLocaleString('en-US', { minimumFractionDigits: num % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 })}`;
  }
  if (unit === 'USD') {
    return `$${num.toLocaleString('en-US', { minimumFractionDigits: num % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 })}`;
  }
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num);
}

export function formatDate(dateStr?: string): string {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

export function calculateCrmMetrics(customers: Customer[]) {
  const totalCustomers = customers.length;
  const newCustomersCount = customers.filter(c => c.totalOrders <= 1).length;
  const returningCustomersCount = customers.filter(c => c.totalOrders >= 2).length;
  
  const totalRevenue = customers.reduce((sum, c) => sum + c.totalSpent, 0);
  const totalOrdersCount = customers.reduce((sum, c) => sum + c.totalOrders, 0);

  // AOV: Average Order Value = Total Revenue / Total Orders Count
  const aov = totalOrdersCount > 0 ? totalRevenue / totalOrdersCount : 0;

  // LTV: Average Customer Lifetime Value = Total Revenue / Total Customers
  const ltv = totalCustomers > 0 ? totalRevenue / totalCustomers : 0;

  // Repeat Purchase Rate = (Returning Customers / Total Customers with >= 1 order) * 100
  const customersWithOrders = customers.filter(c => c.totalOrders >= 1).length;
  const repeatPurchaseRate = customersWithOrders > 0
    ? (returningCustomersCount / customersWithOrders) * 100
    : 0;

  return {
    totalCustomers,
    newCustomersCount,
    returningCustomersCount,
    totalRevenue,
    totalOrdersCount,
    aov,
    ltv,
    repeatPurchaseRate,
  };
}

/**
 * Normalizes phone numbers by extracting clean digits and matching by standard last 9 digits
 */
export function normalizePhone(phone?: string | null): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 7 ? digits.slice(-9) : digits;
}

/**
 * Robust check to see if two phone numbers (or customer identifiers) refer to the same customer/phone
 */
export function isSamePhoneNumber(phone1?: string | null, phone2?: string | null): boolean {
  if (!phone1 || !phone2) return false;
  if (phone1 === phone2) return true;
  const n1 = normalizePhone(phone1);
  const n2 = normalizePhone(phone2);
  if (!n1 || !n2) return false;
  return n1 === n2 || n1.endsWith(n2) || n2.endsWith(n1);
}

