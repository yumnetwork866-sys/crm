import React from 'react';
import type { Customer, BroadcastCampaign } from '../../types';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, PieChart, Pie, Cell } from 'recharts';

interface WhatsAppReportProps {
  customers: Customer[];
  campaigns: BroadcastCampaign[];
}

const COLORS = ['#10b981', '#00793d', '#f59e0b', '#f43f5e'];

export const WhatsAppReport: React.FC<WhatsAppReportProps> = ({ customers, campaigns }) => {
  // Calculate total WhatsApp interactions
  const totalAutomationSent = customers.reduce(
    (sum, c) => sum + (c.automationSequence?.logs.length || 0),
    0
  );

  const totalBroadcastSent = campaigns.reduce((sum, c) => sum + c.stats.sentCount, 0);
  const totalDelivered = campaigns.reduce((sum, c) => sum + c.stats.deliveredCount, 0);
  const totalRead = campaigns.reduce((sum, c) => sum + c.stats.readCount, 0);
  const totalResponded = campaigns.reduce((sum, c) => sum + c.stats.respondedCount, 0);
  const totalFailed = campaigns.reduce((sum, c) => sum + (c.stats.failedCount || 0), 0);
  const totalSent = totalAutomationSent + totalBroadcastSent;

  const readRate = totalBroadcastSent > 0
    ? ((totalRead / totalBroadcastSent) * 100).toFixed(1)
    : '0.0';
  const responseRate = totalBroadcastSent > 0
    ? ((totalResponded / totalBroadcastSent) * 100).toFixed(1)
    : '0.0';
  const failureRate = totalBroadcastSent + totalFailed > 0
    ? ((totalFailed / (totalBroadcastSent + totalFailed)) * 100).toFixed(1)
    : '0.0';

  const statusDistributionData = [
    { name: 'Đã đọc', count: totalRead },
    { name: 'Đã nhận', count: totalDelivered - totalRead },
    { name: 'Phản hồi', count: totalResponded },
    { name: 'Gửi lỗi', count: totalFailed },
  ];

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
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
          <h3 className="font-bold text-white text-sm">Tin nhắn theo chiến dịch</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={campaigns}>
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} />
                <YAxis stroke="#94a3b8" fontSize={10} />
                <Tooltip />
                <Legend />
                <Bar dataKey="stats.readCount" name="Đã đọc" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="stats.respondedCount" name="Phản hồi" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

    </div>
  );
};
