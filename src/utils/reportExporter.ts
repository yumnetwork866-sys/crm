import type { Customer, MarketingCampaignReport, BroadcastCampaign } from '../types';
import { downloadCsv } from './csvExport';
import { calculateCrmMetrics, formatVND } from './crmUtils';
import { SALES_REPS } from '../data/mockData';

// 1. Export Marketing Campaigns Report
export function exportMarketingReportCsv(marketingReports: MarketingCampaignReport[]) {
  const headers = [
    'Tên Campaign',
    'Kênh (Source)',
    'Số Leads',
    'Chi Phí Ads (VND)',
    'Doanh Thu (VND)',
    'Chi Phí / Lead - CPL (VND)',
    'ROAS (x)',
  ];

  const rows = marketingReports.map((r) => [
    r.campaignName,
    r.source,
    r.leadsCount,
    r.adSpend,
    r.revenue,
    r.cpl,
    `${r.roas}x`,
  ]);

  downloadCsv('Bao_Cao_Marketing_VietCRM', headers, rows);
}

// 2. Export Sales Performance Report
export function exportSalesReportCsv(customers: Customer[]) {
  const headers = [
    'Nhân Viên Sales',
    'Số Khách Được Giao',
    'Số Đơn Chốt (Won)',
    'Tỷ Lệ Chuyển Đổi (%)',
    'Tổng Doanh Thu (VND)',
  ];

  const rows = SALES_REPS.map((repName) => {
    const assigned = customers.filter((c) => c.owner === repName);
    const won = assigned.filter((c) => c.status === 'Won' || c.totalOrders >= 1);
    const rev = assigned.reduce((sum, c) => sum + c.totalSpent, 0);
    const conv = assigned.length > 0 ? ((won.length / assigned.length) * 100).toFixed(1) : '0';

    return [repName, assigned.length, won.length, `${conv}%`, rev];
  });

  downloadCsv('Bao_Cao_Sales_VietCRM', headers, rows);
}

// 3. Export Customers List
export function exportCustomersCsv(customers: Customer[]) {
  const headers = [
    'Mã KH',
    'Tên Khách Hàng',
    'Số Điện Thoại',
    'Giới Tính',
    'Địa Chỉ (Malaysia)',
    'Email',
    'Ghi Chú (Note)',
    'Trạng Thái CRM',
    'Nguồn (Source)',
    'Nhân Viên Phụ Trách',
    'Số Đơn Hàng',
    'Tổng Chi Tiêu (VND)',
    'Ngày Tiếp Nhận',
    'Lần Mua Gần Nhất',
  ];

  const rows = customers.map((c) => [
    c.id,
    c.name,
    c.phone,
    c.gender || 'Nữ',
    c.address || '',
    c.email || '',
    c.note || '',
    c.status,
    c.source,
    c.owner,
    c.totalOrders,
    c.totalSpent,
    c.firstContact || '',
    c.lastPurchaseDate || 'Chưa mua',
  ]);

  downloadCsv('Danh_Sach_Khach_Hang_VietCRM', headers, rows);
}

// 4. Export Orders List
export function exportOrdersCsv(customers: Customer[]) {
  const headers = [
    'Mã Đơn Hàng',
    'Tên Khách Hàng',
    'SĐT Khách Hàng',
    'Ngày Đặt Hàng',
    'Trạng Thái Đơn',
    'Chi Tiết Sản Phẩm',
    'Tổng Tiền (VND)',
    'Ghi Chú Đơn',
  ];

  const rows: (string | number)[][] = [];

  customers.forEach((c) => {
    (c.orders || []).forEach((ord) => {
      const itemsSummary = ord.products.map((p) => `${p.productName} (x${p.quantity})`).join('; ');
      rows.push([
        ord.orderCode,
        c.name,
        c.phone,
        ord.date,
        ord.status,
        itemsSummary,
        ord.totalAmount,
        ord.notes || '',
      ]);
    });
  });

  downloadCsv('Danh_Sach_Don_Hang_VietCRM', headers, rows);
}

// 5. Export WhatsApp Broadcast Report
export function exportWhatsAppReportCsv(campaigns: BroadcastCampaign[]) {
  const headers = [
    'Tên Chiến Dịch Broadcast',
    'Trạng Thái',
    'Nhóm Đối Tượng',
    'Tổng Số Đã Gửi',
    'Số Tin Đã Đọc',
    'Số Khách Phản Hỏi',
    'Số Gửi Thất Bại',
    'Thời Gian Tạo',
  ];

  const statusLabels: Record<BroadcastCampaign['status'], string> = {
    Draft: 'Nháp',
    Pending: 'Đang chờ',
    Sending: 'Đang gửi',
    Completed: 'Hoàn thành',
    PartiallyFailed: 'Hoàn thành một phần',
    Failed: 'Thất bại',
    Cancelled: 'Đã hủy',
  };
  const rows = campaigns.map((c) => [
    c.name,
    statusLabels[c.status],
    c.targetGroup,
    c.stats.sentCount,
    c.stats.readCount,
    c.stats.respondedCount,
    c.stats.failedCount || 0,
    c.createdAt || 'Tức thì',
  ]);

  downloadCsv('Bao_Cao_WhatsApp_VietCRM', headers, rows);
}

// 6. Export Full CRM Executive Summary
export function exportFullExecutiveSummaryCsv(
  customers: Customer[],
  marketingReports: MarketingCampaignReport[],
  campaigns: BroadcastCampaign[]
) {
  const metrics = calculateCrmMetrics(customers);
  const totalAdSpend = marketingReports.reduce((sum, r) => sum + r.adSpend, 0);
  const totalAdRevenue = marketingReports.reduce((sum, r) => sum + r.revenue, 0);
  const overallRoas = totalAdSpend > 0 ? (totalAdRevenue / totalAdSpend).toFixed(2) : '0';

  const headers = ['Hạng Mục / Chỉ Số CRM', 'Giá Trị Chi Tiết', 'Đơn Vị / Ghi Chú'];

  const rows = [
    ['--- CHỈ SỐ KHÁCH HÀNG & CRM ---', '', ''],
    ['Tổng Số Lead Khách Hàng', customers.length, 'Khách hàng'],
    ['Khách Hàng Đã Chốt Đơn (Won)', metrics.newCustomersCount + metrics.returningCustomersCount, 'Khách'],
    ['Tỷ Lệ Chuyển Đổi Sales', `${((metrics.totalCustomers / (customers.length || 1)) * 100).toFixed(1)}%`, 'Chuyển đổi'],
    ['Khách Mới (≤1 Đơn)', metrics.newCustomersCount, 'Khách'],
    ['Khách Quay Lại (≥2 Đơn)', metrics.returningCustomersCount, 'Khách quay lại'],
    ['Tỷ Lệ Mua Lại (Repeat Rate)', `${metrics.repeatPurchaseRate.toFixed(1)}%`, 'Khách thân thiết'],
    ['Giá Trị Đơn Trung Bình (AOV)', metrics.aov, 'VND'],
    ['Giá Trị Vòng Đời Khách (LTV)', metrics.ltv, 'VND'],
    ['Tổng Doanh Thu CRM', metrics.totalRevenue, 'VND'],

    ['--- CHỈ SỐ MARKETING & ADS ---', '', ''],
    ['Tổng Chi Phí Ads Marketing', totalAdSpend, 'VND'],
    ['Tổng Doanh Thu Từ Campaign Ads', totalAdRevenue, 'VND'],
    ['Chỉ Số ROAS Trung Bình', `${overallRoas}x`, 'Tỷ suất doanh thu / chi phí'],

    ['--- CHỈ SỐ WHATSAPP BROADCAST ---', '', ''],
    ['Tổng Số Chiến Dịch Broadcast', campaigns.length, 'Chiến dịch'],
    ['Tổng Tin Nhắn Broadcast Đã Gửi', campaigns.reduce((s, c) => s + c.stats.sentCount, 0), 'Tin nhắn'],
    ['Tổng Tin Nhắn Đã Đọc', campaigns.reduce((s, c) => s + c.stats.readCount, 0), 'Tin nhắn'],
    ['Tổng Khách Hàng Phản Hỏi', campaigns.reduce((s, c) => s + c.stats.respondedCount, 0), 'Khách hàng'],
  ];

  downloadCsv('Bao_Cao_Tong_Hop_VietCRM_Executive', headers, rows);
}
