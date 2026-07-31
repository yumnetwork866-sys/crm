import React from 'react';
import { Customer } from '../../types';
import { formatVND } from '../../utils/crmUtils';
import { SALES_REPS } from '../../data/mockData';
import { exportSalesReportCsv } from '../../utils/reportExporter';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { FileSpreadsheet } from 'lucide-react';

interface SalesReportProps {
  customers: Customer[];
  isAdmin?: boolean;
}

export const SalesReport: React.FC<SalesReportProps> = ({ customers, isAdmin = true }) => {
  const totalLeads = customers.length;
  const wonCustomers = customers.filter((c) => c.status === 'Won' || c.totalOrders >= 1);
  const wonCount = wonCustomers.length;
  const conversionRate = totalLeads > 0 ? ((wonCount / totalLeads) * 100).toFixed(1) : '0';
  const totalRevenue = customers.reduce((sum, c) => sum + c.totalSpent, 0);

  // Status Funnel Breakdown
  const statusCounts = {
    'New Lead': customers.filter((c) => c.status === 'New Lead').length,
    Contacted: customers.filter((c) => c.status === 'Contacted').length,
    Quoted: customers.filter((c) => c.status === 'Quoted').length,
    Won: wonCount,
    Lost: customers.filter((c) => c.status === 'Lost').length,
  };

  const funnelData = [
    { name: '1. Khách Mới', count: statusCounts['New Lead'], fill: '#6366f1' },
    { name: '2. Đã Liên Hệ', count: statusCounts['Contacted'], fill: '#06b6d4' },
    { name: '3. Đã Báo Giá', count: statusCounts['Quoted'], fill: '#f59e0b' },
    { name: '4. Chốt Đơn (Won)', count: statusCounts['Won'], fill: '#10b981' },
    { name: '5. Thất Bại (Lost)', count: statusCounts['Lost'], fill: '#f43f5e' },
  ];

  // Sales Rep Performance
  const salesRepPerformance = SALES_REPS.map((repName) => {
    const assigned = customers.filter((c) => c.owner === repName);
    const won = assigned.filter((c) => c.status === 'Won' || c.totalOrders >= 1);
    const rev = assigned.reduce((sum, c) => sum + c.totalSpent, 0);
    const conv = assigned.length > 0 ? ((won.length / assigned.length) * 100).toFixed(1) : '0';

    return {
      name: repName,
      assignedCount: assigned.length,
      wonCount: won.length,
      conversionRate: parseFloat(conv),
      revenue: rev,
    };
  });

  return (
    <div className="space-y-6">
      
      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <div className="text-xs text-slate-400">Số Khách Mới Tiếp Nhận</div>
          <div className="text-2xl font-bold text-white mt-1">{totalLeads} khách</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <div className="text-xs text-slate-400">Số Khách Đã Mua (Won)</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">{wonCount} khách</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <div className="text-xs text-slate-400">Tỷ Lệ Chuyển Đổi Sales</div>
          <div className="text-2xl font-bold text-amber-400 mt-1">{conversionRate}%</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <div className="text-xs text-slate-400">Tổng Doanh Thu Sales</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">{formatVND(totalRevenue)}</div>
        </div>
      </div>

      {/* Funnel & Rep Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Sales Pipeline Funnel */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
          <h3 className="font-bold text-white text-sm">Phễu Chuyển Đổi Khách Hàng (Sales Funnel)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnelData} layout="vertical">
                <XAxis type="number" stroke="#94a3b8" />
                <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={11} width={120} />
                <Tooltip />
                <Bar dataKey="count" name="Số lượng" fill="#10b981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sales Rep Revenue */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
          <h3 className="font-bold text-white text-sm">Doanh Thu Theo Nhân Viên Phụ Trách</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salesRepPerformance}>
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} />
                <YAxis stroke="#94a3b8" fontSize={10} />
                <Tooltip formatter={(val: number) => formatVND(val)} />
                <Bar dataKey="revenue" name="Doanh Thu (VND)" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Sales Rep Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h3 className="font-bold text-white text-sm">Bảng Hiệu Suất Chi Tiết Của Đội Ngũ Sales</h3>
          {isAdmin ? (
            <button
              onClick={() => exportSalesReportCsv(customers)}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600 hover:text-white border border-emerald-500/30 transition cursor-pointer self-start sm:self-auto"
              title="Xuất bảng báo cáo Sales sang file CSV/Excel"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Xuất Excel/CSV</span>
            </button>
          ) : (
            <button
              disabled
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800/40 text-slate-500 border border-slate-800 cursor-not-allowed opacity-60 self-start sm:self-auto"
              title="Chỉ tài khoản Admin mới có quyền xuất dữ liệu"
            >
              <FileSpreadsheet className="w-4 h-4 text-slate-500" />
              <span>Xuất Excel/CSV (Chỉ Admin)</span>
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-800 text-slate-300 uppercase text-[10px]">
                <th className="py-2.5 px-4">Nhân Viên Sales</th>
                <th className="py-2.5 px-3 text-right">Khách Được Giao</th>
                <th className="py-2.5 px-3 text-right">Số Đơn Won</th>
                <th className="py-2.5 px-3 text-right">Tỷ Lệ Chuyển Đổi %</th>
                <th className="py-2.5 px-4 text-right">Tổng Doanh Thu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {salesRepPerformance.map((rep, idx) => (
                <tr key={idx} className="hover:bg-slate-800/40">
                  <td className="py-3 px-4 font-bold text-white">{rep.name}</td>
                  <td className="py-3 px-3 text-right text-slate-300">{rep.assignedCount}</td>
                  <td className="py-3 px-3 text-right font-bold text-emerald-400">{rep.wonCount}</td>
                  <td className="py-3 px-3 text-right text-amber-300 font-bold">{rep.conversionRate}%</td>
                  <td className="py-3 px-4 text-right font-bold text-emerald-400">{formatVND(rep.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
