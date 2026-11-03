import React, { useMemo } from 'react';
import type { Customer } from '../../types';
import { formatVND, getCustomerGroup } from '../../utils/crmUtils';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { useAuth } from '../../contexts/AuthContext';

interface SalesReportProps {
  customers: Customer[];
  dateRange?: { start: string; end: string };
}

export const SalesReport: React.FC<SalesReportProps> = ({ customers, dateRange }) => {
  const { users } = useAuth();

  // Khi có bộ lọc thời gian, chỉ tính ĐƠN HÀNG nằm trong khoảng lọc
  // (totalOrders/totalSpent gốc là số liệu trọn đời, không khớp cửa sổ lọc)
  const rangeActive = Boolean(dateRange?.start || dateRange?.end);
  const baseCustomers = useMemo(() => {
    if (!rangeActive) return customers;
    return customers.map((c) => {
      const inRangeOrders = (c.orders || []).filter((o) => {
        const od = (o.date || '').slice(0, 10);
        return (!dateRange?.start || od >= dateRange.start) && (!dateRange?.end || od <= dateRange.end);
      });
      if (inRangeOrders.length === (c.orders || []).length) return c;
      return {
        ...c,
        totalOrders: inRangeOrders.length,
        totalSpent: inRangeOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0),
      };
    });
  }, [customers, rangeActive, dateRange?.start, dateRange?.end]);

  const totalLeads = baseCustomers.length;
  // Tiêu chí thống nhất: khách ĐÃ MUA = có ít nhất 1 đơn hàng thật trong hệ thống
  const hasOrders = (c: Customer) => c.totalOrders >= 1;
  const wonCustomers = baseCustomers.filter(hasOrders);
  const wonCount = wonCustomers.length;
  const conversionRate = totalLeads > 0 ? ((wonCount / totalLeads) * 100).toFixed(1) : '0';
  const totalRevenue = baseCustomers.reduce((sum, c) => sum + c.totalSpent, 0);

  // Phễu bán hàng — suy bậc của từng khách ĐÚNG theo cùng công thức phân nhóm ở tab khách hàng
  // (getCustomerGroup): Khách mới / Đã hỏi giá / Đã mua 1 lần / VIP → tổng = tổng số khách, không trùng lặp
  const groupOf = (c: Customer) => getCustomerGroup(c);
  const noOrdersLost = (c: Customer) => groupOf(c) === 'group_2' && c.status === 'Lost';
  const funnelData = [
    { name: 'Khách mới', count: baseCustomers.filter((c) => groupOf(c) === 'group_1').length, fill: '#6366f1' },
    { name: 'Đã liên hệ', count: baseCustomers.filter((c) => groupOf(c) === 'group_2' && c.status === 'Contacted').length, fill: '#06b6d4' },
    { name: 'Đã hỏi giá', count: baseCustomers.filter((c) => groupOf(c) === 'group_2' && (c.status === 'Quoted' || c.status === 'Won')).length, fill: '#f59e0b' },
    { name: 'Đã mua 1 lần', count: baseCustomers.filter((c) => groupOf(c) === 'group_3').length, fill: '#10b981' },
    { name: 'VIP (≥2 đơn)', count: baseCustomers.filter((c) => groupOf(c) === 'group_4').length, fill: '#7c3aed' },
    { name: 'Thất bại', count: baseCustomers.filter(noOrdersLost).length, fill: '#f43f5e' },
  ];

  const salesRepNames = useMemo(() => {
    const names = new Set<string>();
    for (const u of users) {
      if (u.status === 'active' && u.name?.trim()) {
        names.add(u.name.trim());
      }
    }
    for (const c of baseCustomers) {
      const owner = c.owner?.trim();
      if (owner && !['Chưa phân công', 'Unassigned'].includes(owner)) {
        names.add(owner);
      }
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'vi'));
  }, [users, baseCustomers]);

  // Sales Rep Performance — cùng tiêu chí: Đã Mua = có ít nhất 1 đơn hàng thật
  const salesRepPerformance = salesRepNames.map((repName) => {
    const assigned = baseCustomers.filter((c) => c.owner === repName);
    const won = assigned.filter(hasOrders);
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
          <div className="text-xs text-slate-400">Tổng khách</div>
          <div className="text-2xl font-bold text-white mt-1">{totalLeads} khách</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <div className="text-xs text-slate-400">Khách đã mua</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">{wonCount} khách</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <div className="text-xs text-slate-400">Tỷ lệ chuyển đổi</div>
          <div className="text-2xl font-bold text-amber-400 mt-1">{conversionRate}%</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <div className="text-xs text-slate-400">Tổng doanh thu</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">{formatVND(totalRevenue)}</div>
        </div>
      </div>

      {/* Funnel & Rep Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Sales Pipeline Funnel */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
          <h3 className="font-bold text-white text-sm">Phễu bán hàng</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnelData} layout="vertical">
                <XAxis type="number" stroke="#94a3b8" />
                <YAxis dataKey="name" type="category" tick={{ fill: '#000' }} tickLine={false} fontSize={12} width={110} />
                <Tooltip />
                <Bar dataKey="count" name="Số khách" fill="#10b981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sales Rep Revenue */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
          <h3 className="font-bold text-white text-sm">Doanh thu theo sales</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salesRepPerformance}>
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} />
                <YAxis stroke="#94a3b8" fontSize={10} />
                <Tooltip formatter={(value) => formatVND(Number(value ?? 0))} />
                <Bar dataKey="revenue" name="Doanh Thu (VND)" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Sales Rep Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h3 className="font-bold text-white text-sm">Hiệu suất theo sales</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-800 text-slate-300 uppercase text-[10px]">
                <th className="py-2.5 px-4">Sales</th>
                <th className="py-2.5 px-3 text-right">Khách được giao</th>
                <th className="py-2.5 px-3 text-right">Đã mua</th>
                <th className="py-2.5 px-3 text-right">Chuyển đổi %</th>
                <th className="py-2.5 px-4 text-right">Doanh thu</th>
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
