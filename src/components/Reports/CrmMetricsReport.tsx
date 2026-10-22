import React from 'react';
import type { Customer } from '../../types';
import { calculateCrmMetrics, formatVND } from '../../utils/crmUtils';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from 'recharts';

interface CrmMetricsReportProps {
  customers: Customer[];
}

const COLORS = ['#6366f1', '#10b981'];

export const CrmMetricsReport: React.FC<CrmMetricsReportProps> = ({ customers }) => {
  const metrics = calculateCrmMetrics(customers);

  const newVsReturningData = [
    { name: 'Khách Mới (≤1 đơn)', count: metrics.newCustomersCount },
    { name: 'Khách Quay Lại (≥2 đơn)', count: metrics.returningCustomersCount },
  ];

  return (
    <div className="space-y-6">
      
      {/* 4 Required CRM Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <div className="text-xs text-slate-400">1. Khách Mới vs Khách Quay Lại</div>
          <div className="text-2xl font-bold text-white mt-1">
            {metrics.newCustomersCount} / {metrics.returningCustomersCount}
          </div>
          <div className="text-[11px] text-indigo-400 mt-1">Tỷ lệ giữ chân cao</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <div className="text-xs text-slate-400">2. Giá Trị Đơn Trung Bình (AOV)</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">
            {formatVND(metrics.aov)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Average Order Value</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <div className="text-xs text-slate-400">3. Giá Trị Vòng Đời Khách (LTV)</div>
          <div className="text-2xl font-bold text-[#7c86ff] mt-1">
            {formatVND(metrics.ltv)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Customer Lifetime Value</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <div className="text-xs text-slate-400">4. Tỷ Lệ Mua Lại (Repeat Rate)</div>
          <div className="text-2xl font-bold text-amber-300 mt-1">
            {metrics.repeatPurchaseRate.toFixed(1)}%
          </div>
          <div className="text-[11px] text-emerald-400 mt-1">Nhờ Automation WhatsApp</div>
        </div>

      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
          <h3 className="font-bold text-white text-sm">Cơ Cấu Khách Mới vs Khách Quay Lại</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={newVsReturningData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                  label={({ name, percent }) => `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                >
                  {newVsReturningData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* LTV & Purchase Value Distribution */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-white text-sm">Top Khách Hàng Có LTV Cao Nhất</h3>
          </div>
          <div className="h-64 overflow-y-auto">
            <div className="space-y-2">
              {customers
                .slice()
                .sort((a, b) => b.totalSpent - a.totalSpent)
                .slice(0, 5)
                .map((c, i) => (
                  <div key={c.id} className="bg-slate-800/80 p-3 rounded-xl flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-white">#{i + 1} {c.name}</div>
                      <div className="text-[10px] text-slate-400">
                        {c.phone}{c.country ? ` • ${c.country}` : ''} ({c.totalOrders} đơn)
                      </div>
                    </div>
                    <div className="text-right font-bold text-emerald-400 text-sm">
                      {formatVND(c.totalSpent)}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};
