import type { Customer, CustomerGroupId, CustomerGroupInfo, CustomerStatus } from '../types';

export function getStatusColorClass(status: CustomerStatus | string): string {
  switch (status) {
    case 'Won':
      return 'bg-emerald-100 text-[#00793d] border-emerald-300 font-bold';
    case 'Contacted':
      return 'bg-blue-100 text-blue-800 border-blue-300 font-bold';
    case 'Quoted':
      return 'bg-amber-100 text-amber-800 border-amber-300 font-bold';
    case 'New Lead':
      return 'bg-purple-100 text-purple-800 border-purple-300 font-bold';
    case 'Lost':
      return 'bg-rose-100 text-rose-800 border-rose-300 font-bold';
    default:
      return 'bg-slate-100 text-slate-800 border-slate-300 font-bold';
  }
}

export function getOwnerBadgeClass(_ownerName?: string): string {
  return 'text-slate-800 font-medium';
}

export function getOwnerAvatar(ownerName?: string): string {
  if (!ownerName) return '';
  const trimmed = ownerName.trim();
  if (trimmed.includes('Ánh')) {
    return 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250';
  }
  if (trimmed.includes('Hà')) {
    return 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=250';
  }
  if (trimmed.includes('Nam')) {
    return 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=250';
  }
  if (trimmed.includes('Đức')) {
    return 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=250';
  }
  if (trimmed.includes('Hương')) {
    return 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=250';
  }
  return `https://api.dicebear.com/10.x/avataaars/svg?seed=${encodeURIComponent(trimmed)}`;
}

export const CUSTOMER_GROUPS: Record<CustomerGroupId, CustomerGroupInfo> = {
  group_1: {
    id: 'group_1',
    name: 'Khách mới',
    description: 'Chưa được tư vấn & chưa phát sinh đơn hàng',
    badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
  group_2: {
    id: 'group_2',
    name: 'Đã hỏi giá',
    description: 'Đã tư vấn/báo giá nhưng chưa mua',
    badgeColor: 'bg-sky-50 text-sky-700 border-sky-200',
  },
  group_3: {
    id: 'group_3',
    name: 'Đã mua 1 lần',
    description: 'Khách đã mua 1 đơn duy nhất - Cần chăm sóc quay lại',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  group_4: {
    id: 'group_4',
    name: 'Đã mua từ 2 lần trở lên (VIP)',
    description: 'Khách hàng thân thiết / VIP mua nhiều lần',
    badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
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
  if (customer.group && Object.hasOwn(CUSTOMER_GROUPS, customer.group)) {
    return customer.group;
  }

  // Legacy fallback for customer records created before the independent group field.
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

export function formatDate(dateValue?: string | Date): string {
  if (!dateValue) return 'N/A';

  if (typeof dateValue === 'string') {
    const dateOnlyMatch = dateValue.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);
    if (dateOnlyMatch && !dateValue.includes('T')) {
      const [, year, month, day] = dateOnlyMatch;
      return `${day}/${month}/${year}`;
    }
  }

  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (Number.isNaN(date.getTime())) return String(dateValue);

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

export function formatTime(dateValue?: string | Date): string {
  if (!dateValue) return '';
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '';
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function formatDateTime(dateValue?: string | Date): string {
  if (!dateValue) return 'N/A';
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (Number.isNaN(date.getTime())) return String(dateValue);
  return `${formatDate(date)} ${formatTime(date)}`;
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

/**
 * Formats a phone number into international +country_code format (e.g. +84908123456)
 */
export function formatPhoneWithCountryCode(phone?: string | null, country?: string | null): string {
  if (!phone) return '';
  let raw = phone.trim();
  if (raw.startsWith('cust_')) {
    raw = raw.replace('cust_', '');
  }
  if (!raw) return '';

  // If already starts with '+', keep '+' and strip non-digits
  if (raw.startsWith('+')) {
    const digitsOnly = raw.slice(1).replace(/\D/g, '');
    return digitsOnly ? `+${digitsOnly}` : '';
  }

  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';

  // If already has 84 country code (Vietnam)
  if (digits.startsWith('84') && digits.length >= 10) {
    return `+${digits}`;
  }

  // If already has 60 country code (Malaysia)
  if (digits.startsWith('60') && digits.length >= 9) {
    return `+${digits}`;
  }

  // If starts with 0
  if (digits.startsWith('0')) {
    if (country && (country.toLowerCase().includes('malaysia') || country.toLowerCase() === 'my')) {
      return `+60${digits.slice(1)}`;
    }
    return `+84${digits.slice(1)}`;
  }

  // If 9 digits (standard VN number without leading 0)
  if (digits.length === 9) {
    return `+84${digits}`;
  }

  // Default fallback: prepend +
  return `+${digits}`;
}

/**
 * Compare two Vietnamese names by given name (last word), then middle/first name, for standard A-Z alphabetical sorting.
 */
export function compareVietnameseNames(nameA: string = '', nameB: string = ''): number {
  const partsA = nameA.trim().split(/\s+/).filter(Boolean);
  const partsB = nameB.trim().split(/\s+/).filter(Boolean);

  const firstNameA = partsA.length > 0 ? partsA[partsA.length - 1] : '';
  const firstNameB = partsB.length > 0 ? partsB[partsB.length - 1] : '';

  const firstNameComparison = firstNameA.localeCompare(firstNameB, 'vi', { sensitivity: 'base' });
  if (firstNameComparison !== 0) {
    return firstNameComparison;
  }

  const middleAndLastNameA = partsA.slice(0, -1).join(' ');
  const middleAndLastNameB = partsB.slice(0, -1).join(' ');

  const restComparison = middleAndLastNameA.localeCompare(middleAndLastNameB, 'vi', { sensitivity: 'base' });
  if (restComparison !== 0) {
    return restComparison;
  }

  return nameA.localeCompare(nameB, 'vi', { sensitivity: 'base' });
}


