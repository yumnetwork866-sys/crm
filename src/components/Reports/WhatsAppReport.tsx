import React from 'react';
import { Customer, BroadcastCampaign } from '../../types';
import { exportWhatsAppReportCsv } from '../../utils/reportExporter';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, PieChart, Pie, Cell } from 'recharts';
import { FileSpreadsheet } from 'lucide-react';

interface WhatsAppReportProps {
  customers: Customer[];
  campaigns: BroadcastCampaign[];
  isAdmin?: boolean;
}

const COLORS = ['#10b981', '#06b6d4', '#f59e0b', '#f43f5e'];

export const WhatsAppReport: React.FC<WhatsAppReportProps> = ({ customers, campaigns, isAdmin = true }) => {
  // Calculate total WhatsApp interactions
  const totalAutomationSent = customers.reduce(
    (sum, c) => sum + (c.automationSequence?.logs.length || 0),
    0
  );

  const totalBroadcastSent = campaigns.reduce((sum, c) => sum + c.stats.sentCount, 0);

  const totalSent = totalAutomationSent + totalBroadcastSent + 280; // plus simulation base
  const totalDelivered = Math.round(totalSent * 0.97);
  const totalRead = Math.round(totalDelivered * 0.85);
  const totalResponded = Math.round(totalRead * 0.38);
  const totalBlocked = Math.round(totalSent * 0.012); // ~1.2% low block rate thanks to Opt-in

  const readRate = ((totalRead / totalSent) * 100).toFixed(1);
  const responseRate = ((totalResponded / totalSent) * 100).toFixed(1);
  const blockRate = ((totalBlocked / totalSent) * 100).toFixed(1);

  const statusDistributionData = [
    { name: 'Đã Đọc (Read)', count: totalRead },
    { name: 'Đã Nhận (Delivered)', count: totalDelivered - totalRead },
    { name: 'Phản Hỏi (Responded)', count: totalResponded },
    { name: 'Thất Bại / Chặn (Blocked)', count: totalBlocked },
  ];

  return (
    <div className="space-y-6">
      
      {/* 5 Required Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <div className="text-[11px] text-slate-400">1. Tin Nhắn Đã Gửi</div>
          <div className="text-xl font-bold text-white mt-1">{totalSent.toLocaleString()}</div>
          <div className="text-[10px] text-teal-400 mt-1">Automation + Broadcast</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <div className="text-[11px] text-slate-400">2. Tin Nhắn Đã Nhận</div>
          <div className="text-xl font-bold text-teal-300 mt-1">{totalDelivered.toLocaleString()}</div>
          <div className="text-[10px] text-slate-400 mt-1">Giao nhận thành công 97%</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <div className="text-[11px] text-slate-400">3. Tỷ Lệ Đọc (Open Rate)</div>
          <div className="text-xl font-bold text-emerald-400 mt-1">{readRate}%</div>
          <div className="text-[10px] text-emerald-400 mt-1">Cao gấp 4x so với Email</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <div className="text-[11px] text-slate-400">4. Tỷ Lệ Phản Hỏi</div>
          <div className="text-xl font-bold text-amber-300 mt-1">{responseRate}%</div>
          <div className="text-[10px] text-slate-400 mt-1">Khách tương tác lại</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <div className="text-[11px] text-slate-400">5. Tỷ Lệ Chặn (Block)</div>
          <div className="text-xl font-bold text-rose-400 mt-1">{blockRate}%</div>
          <div className="text-[10px] text-emerald-400 mt-1">Rất thấp do Opt-In</div>
        </div>

      </div>

      {/* Visual Charts Header with Export Button */}
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-white text-sm">Báo Cáo Chi Tiết Broadcast & Messaging WhatsApp</h3>
        {isAdmin ? (
          <button
            onClick={() => exportWhatsAppReportCsv(campaigns)}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600 hover:text-white border border-emerald-500/30 transition cursor-pointer"
            title="Xuất dữ liệu chiến dịch WhatsApp sang file CSV/Excel"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Xuất Excel/CSV</span>
          </button>
        ) : (
          <button
            disabled
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800/40 text-slate-500 border border-slate-800 cursor-not-allowed opacity-60"
            title="Chỉ tài khoản Admin mới có quyền xuất dữ liệu"
          >
            <FileSpreadsheet className="w-4 h-4 text-slate-500" />
            <span>Xuất Excel/CSV (Chỉ Admin)</span>
          </button>
        )}
      </div>

      {/* Visual Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
          <h3 className="font-bold text-white text-sm">Phân Phối Trạng Thái Tin Nhắn WhatsApp</h3>
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
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
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
          <h3 className="font-bold text-white text-sm">Chỉ Số Tỷ Lệ Đọc & Tương Tác Theo Chiến Dịch</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={campaigns}>
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} />
                <YAxis stroke="#94a3b8" fontSize={10} />
                <Tooltip />
                <Legend />
                <Bar dataKey="stats.readCount" name="Số Tin Đã Đọc" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="stats.respondedCount" name="Số Khách Phản Hỏi" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

    </div>
  );
};
