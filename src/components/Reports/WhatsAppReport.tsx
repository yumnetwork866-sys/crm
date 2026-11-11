import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, PieChart, Pie, Cell } from 'recharts';
import type { WhatsAppReportStats } from '../../hooks/useWhatsAppReport';

interface WhatsAppReportProps {
  stats?: WhatsAppReportStats;
  isLoading?: boolean;
}

const COLORS = ['#10b981', '#00793d', '#f59e0b', '#f43f5e'];

export const WhatsAppReport: React.FC<WhatsAppReportProps> = ({ stats, isLoading }) => {
  const totalSent = stats?.sent ?? 0;
  const totalDelivered = stats?.delivered ?? 0;
  const readRate = stats?.readRate ?? 0;
  const responseRate = stats?.responseRate ?? 0;
  const failureRate = stats?.failureRate ?? 0;
  const statusDistributionData = stats?.statusDistribution ?? [];
  const dailyData = stats?.daily ?? [];

  if (isLoading && !stats) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center text-sm text-slate-400">
        Đang tải thống kê WhatsApp...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* 5 Required Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <div className="text-[11px] text-slate-400">Tin nhắn đã gửi</div>
          <div className="text-xl font-bold text-white mt-1">{totalSent.toLocaleString()}</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <div className="text-[11px] text-slate-400">Tin nhắn đã nhận</div>
          <div className="text-xl font-bold text-[#00793d] mt-1">{totalDelivered.toLocaleString()}</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <div className="text-[11px] text-slate-400">Tỷ lệ đọc</div>
          <div className="text-xl font-bold text-emerald-400 mt-1">{readRate}%</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <div className="text-[11px] text-slate-400">Tỷ lệ phản hồi</div>
          <div className="text-xl font-bold text-amber-300 mt-1">{responseRate}%</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <div className="text-[11px] text-slate-400">Tỷ lệ gửi lỗi</div>
          <div className="text-xl font-bold text-rose-400 mt-1">{failureRate}%</div>
        </div>

      </div>

      {/* Visual Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
          <h3 className="font-bold text-white text-sm">Trạng thái tin nhắn</h3>
          <div className="h-64">
            {statusDistributionData.every((entry) => entry.count === 0) ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Chưa có dữ liệu tin nhắn
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusDistributionData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="count"
                    label={({ name, percent }) => `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                  >
                    {statusDistributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
          <h3 className="font-bold text-white text-sm">Tin nhắn theo ngày</h3>
          <div className="h-64">
            {dailyData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Chưa có dữ liệu tin nhắn
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyData}>
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={9} />
                  <YAxis stroke="#94a3b8" fontSize={10} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="sent" name="Đã gửi" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="received" name="Đã nhận" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

      </div>

    </div>
  );
};
