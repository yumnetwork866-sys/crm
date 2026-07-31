import React, { useState } from 'react';
import { Customer, MarketingCampaignReport, LeadSource } from '../../types';
import { formatVND } from '../../utils/crmUtils';
import { exportMarketingReportCsv } from '../../utils/reportExporter';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, PieChart, Pie, Cell } from 'recharts';
import { Download, FileSpreadsheet, Plus, Edit3, X, Save, DollarSign } from 'lucide-react';

interface MarketingReportProps {
  customers: Customer[];
  marketingReports: MarketingCampaignReport[];
  onUpdateMarketingReports?: (reports: MarketingCampaignReport[]) => void;
  isAdmin?: boolean;
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];

const LEAD_SOURCES: LeadSource[] = ['Facebook', 'TikTok', 'Google', 'Website', 'Referral', 'Direct'];

export const MarketingReport: React.FC<MarketingReportProps> = ({
  customers,
  marketingReports,
  onUpdateMarketingReports,
  isAdmin = true,
}) => {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [draftReports, setDraftReports] = useState<MarketingCampaignReport[]>([]);

  // State for new campaign row
  const [newCampaignName, setNewCampaignName] = useState('');
  const [newSource, setNewSource] = useState<LeadSource>('Facebook');
  const [newAdSpend, setNewAdSpend] = useState<number>(0);
  const [newLeadsCount, setNewLeadsCount] = useState<number>(0);
  const [newRevenue, setNewRevenue] = useState<number>(0);

  const handleOpenEditModal = () => {
    setDraftReports(JSON.parse(JSON.stringify(marketingReports)));
    setIsEditModalOpen(true);
  };

  const handleDraftAdSpendChange = (index: number, newSpend: number) => {
    const updated = [...draftReports];
    updated[index].adSpend = newSpend;
    // Recalculate CPL & ROAS
    const leads = updated[index].leadsCount || 1;
    const rev = updated[index].revenue || 0;
    updated[index].cpl = Math.round(newSpend / leads);
    updated[index].roas = newSpend > 0 ? Number((rev / newSpend).toFixed(2)) : 0;
    setDraftReports(updated);
  };

  const handleDraftRevenueChange = (index: number, newRev: number) => {
    const updated = [...draftReports];
    updated[index].revenue = newRev;
    const spend = updated[index].adSpend || 0;
    updated[index].roas = spend > 0 ? Number((newRev / spend).toFixed(2)) : 0;
    setDraftReports(updated);
  };

  const handleDraftLeadsChange = (index: number, newLeads: number) => {
    const updated = [...draftReports];
    updated[index].leadsCount = newLeads;
    const spend = updated[index].adSpend || 0;
    updated[index].cpl = newLeads > 0 ? Math.round(spend / newLeads) : 0;
    setDraftReports(updated);
  };

  const handleRemoveDraftRow = (index: number) => {
    setDraftReports(draftReports.filter((_, i) => i !== index));
  };

  const handleAddCampaignRow = () => {
    if (!newCampaignName.trim()) return;
    const leads = newLeadsCount || 1;
    const cpl = Math.round(newAdSpend / leads);
    const roas = newAdSpend > 0 ? Number((newRevenue / newAdSpend).toFixed(2)) : 0;

    const newItem: MarketingCampaignReport = {
      campaignName: newCampaignName.trim(),
      source: newSource,
      leadsCount: newLeadsCount,
      adSpend: newAdSpend,
      revenue: newRevenue,
      cpl,
      roas,
    };

    setDraftReports([...draftReports, newItem]);
    setNewCampaignName('');
    setNewAdSpend(0);
    setNewLeadsCount(0);
    setNewRevenue(0);
  };

  const handleSaveModal = () => {
    if (onUpdateMarketingReports) {
      onUpdateMarketingReports(draftReports);
    }
    setIsEditModalOpen(false);
  };

  // Aggregate leads by source
  const sourceCounts: Record<string, number> = {};
  customers.forEach((c) => {
    sourceCounts[c.source] = (sourceCounts[c.source] || 0) + 1;
  });

  const sourceData = Object.keys(sourceCounts).map((source) => ({
    name: source,
    leads: sourceCounts[source],
  }));

  // Dynamic metrics calculation
  const totalAdSpend = marketingReports.reduce((sum, r) => sum + r.adSpend, 0);
  const totalRevenue = marketingReports.reduce((sum, r) => sum + r.revenue, 0);
  const totalLeads = customers.length || marketingReports.reduce((sum, r) => sum + r.leadsCount, 0);
  const avgCPL = totalLeads > 0 ? Math.round(totalAdSpend / totalLeads) : 0;
  const avgROAS = totalAdSpend > 0 ? (totalRevenue / totalAdSpend).toFixed(2) : '0';

  return (
    <div className="space-y-6">
      
      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <div className="text-xs text-slate-400">Tổng Số Lead Mới</div>
          <div className="text-2xl font-bold text-white mt-1">{totalLeads} Leads</div>
          <div className="text-[11px] text-emerald-400 mt-1">Từ tất cả các kênh</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <div className="text-xs text-slate-400">Tổng Chi Phí Quảng Cáo (AdSpend)</div>
          <div className="text-2xl font-bold text-indigo-400 mt-1">
            {formatVND(totalAdSpend)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Tổng chi phí theo bộ lọc</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <div className="text-xs text-slate-400">Chi Phí Trung Bình / Lead (CPL)</div>
          <div className="text-2xl font-bold text-amber-400 mt-1">
            {formatVND(avgCPL)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">= Tổng AdSpend / Số Lead</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <div className="text-xs text-slate-400">Tỷ Suất ROAS Trung Bình</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">{avgROAS}x</div>
          <div className="text-[11px] text-emerald-400 mt-1">= Doanh Thu / Chi Phí Ads</div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Leads by Source Pie Chart */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
          <h3 className="font-bold text-white text-sm">Lead Theo Từng Nguồn (Source)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={sourceData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="leads"
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                >
                  {sourceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Campaign Performance Bar Chart */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
          <h3 className="font-bold text-white text-sm">Hiệu Quả Doanh Thu & Lead Theo Campaign</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={marketingReports}>
                <XAxis dataKey="campaignName" stroke="#94a3b8" fontSize={10} tick={{ fontSize: 9 }} />
                <YAxis stroke="#94a3b8" fontSize={10} />
                <Tooltip formatter={(value: number) => formatVND(value)} />
                <Legend />
                <Bar dataKey="revenue" name="Doanh Thu (VND)" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="adSpend" name="Chi Phí Ads (VND)" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Campaign Detail Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h3 className="font-bold text-white text-sm">Bảng Chi Tiết CPL & ROAS Theo Campaign</h3>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={handleOpenEditModal}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600 hover:text-white border border-indigo-500/30 transition cursor-pointer"
              title="Nhập & Cập nhật chi phí Quảng cáo (Ad Spend) cho các chiến dịch"
            >
              <DollarSign className="w-4 h-4 text-indigo-400" />
              <span>Quản Lý / Nhập Chi Phí Ads</span>
            </button>

            {isAdmin ? (
              <button
                onClick={() => exportMarketingReportCsv(marketingReports)}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600 hover:text-white border border-emerald-500/30 transition cursor-pointer"
                title="Xuất bảng báo cáo Marketing sang file CSV/Excel"
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
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-800 text-slate-300 uppercase text-[10px] tracking-wider">
                <th className="py-2.5 px-4">Tên Campaign</th>
                <th className="py-2.5 px-3">Kênh</th>
                <th className="py-2.5 px-3 text-right">Số Lead</th>
                <th className="py-2.5 px-3 text-right">Chi Phí Ads</th>
                <th className="py-2.5 px-3 text-right">Doanh Thu</th>
                <th className="py-2.5 px-3 text-right">Chi Phí / Lead (CPL)</th>
                <th className="py-2.5 px-4 text-right">ROAS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {marketingReports.map((r, i) => (
                <tr key={i} className="hover:bg-slate-800/40">
                  <td className="py-3 px-4 font-bold text-white">{r.campaignName}</td>
                  <td className="py-3 px-3 text-indigo-300 font-semibold">{r.source}</td>
                  <td className="py-3 px-3 text-right font-bold">{r.leadsCount}</td>
                  <td className="py-3 px-3 text-right text-slate-400 font-semibold">{formatVND(r.adSpend)}</td>
                  <td className="py-3 px-3 text-right text-emerald-400 font-bold">{formatVND(r.revenue)}</td>
                  <td className="py-3 px-3 text-right text-amber-300 font-semibold">{formatVND(r.cpl)}</td>
                  <td className="py-3 px-4 text-right font-bold text-emerald-400">{r.roas}x</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ad Spend & Campaign Edit Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Quản Lý & Cập Nhật Chi Phí Ads (Ad Spend)</h3>
                  <p className="text-xs text-slate-400">
                    Nhập chi phí ngân sách quảng cáo cho từng chiến dịch để tính chính xác CPL & ROAS
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 overflow-y-auto space-y-6 flex-1 text-xs">
              {/* Existing Campaigns Table */}
              <div className="space-y-2">
                <div className="font-semibold text-slate-200 text-sm">Các Chiến Dịch Đang Chạy</div>
                
                <div className="overflow-x-auto border border-slate-800 rounded-xl">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-800 text-slate-300 uppercase text-[10px] tracking-wider">
                        <th className="py-2.5 px-3">Tên Campaign</th>
                        <th className="py-2.5 px-2">Kênh</th>
                        <th className="py-2.5 px-2 text-right">Lead</th>
                        <th className="py-2.5 px-3 text-right">Chi Phí Ads (VND)</th>
                        <th className="py-2.5 px-3 text-right">Doanh Thu (VND)</th>
                        <th className="py-2.5 px-2 text-right">CPL</th>
                        <th className="py-2.5 px-2 text-right">ROAS</th>
                        <th className="py-2.5 px-2 text-center">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-300">
                      {draftReports.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/30">
                          <td className="py-2 px-3 font-semibold text-white">{row.campaignName}</td>
                          <td className="py-2 px-2 text-indigo-300">{row.source}</td>
                          <td className="py-2 px-2 text-right">
                            <input
                              type="number"
                              min="0"
                              value={row.leadsCount}
                              onChange={(e) => handleDraftLeadsChange(idx, Number(e.target.value))}
                              className="w-16 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-right text-white focus:outline-none focus:border-indigo-500"
                            />
                          </td>
                          <td className="py-2 px-3 text-right">
                            <input
                              type="number"
                              step="50000"
                              min="0"
                              value={row.adSpend}
                              onChange={(e) => handleDraftAdSpendChange(idx, Number(e.target.value))}
                              className="w-32 bg-slate-950 border border-indigo-500/50 text-indigo-300 rounded px-2 py-1 text-right font-mono font-bold focus:outline-none focus:border-indigo-400"
                            />
                          </td>
                          <td className="py-2 px-3 text-right">
                            <input
                              type="number"
                              step="100000"
                              min="0"
                              value={row.revenue}
                              onChange={(e) => handleDraftRevenueChange(idx, Number(e.target.value))}
                              className="w-32 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-right text-emerald-400 font-mono font-bold focus:outline-none focus:border-emerald-500"
                            />
                          </td>
                          <td className="py-2 px-2 text-right text-amber-300 font-medium">
                            {formatVND(row.cpl)}
                          </td>
                          <td className="py-2 px-2 text-right font-bold text-emerald-400">
                            {row.roas}x
                          </td>
                          <td className="py-2 px-2 text-center">
                            <button
                              onClick={() => handleRemoveDraftRow(idx)}
                              className="text-rose-400 hover:text-rose-300 p-1 hover:bg-rose-500/10 rounded transition"
                              title="Xóa chiến dịch này"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Add New Campaign Section */}
              <div className="bg-white dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 p-4 rounded-xl space-y-3 shadow-sm">
                <div className="font-semibold text-indigo-700 dark:text-indigo-300 text-xs flex items-center space-x-1.5">
                  <Plus className="w-4 h-4 text-indigo-700 dark:text-indigo-300" />
                  <span>Thêm Chiến Dịch / Kênh Quảng Cáo Mới</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-700 dark:text-slate-400 font-semibold mb-1">Tên Campaign</label>
                    <input
                      type="text"
                      placeholder="VD: FB Tet Sale 2026"
                      value={newCampaignName}
                      onChange={(e) => setNewCampaignName(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-700 dark:text-slate-400 font-semibold mb-1">Kênh Source</label>
                    <select
                      value={newSource}
                      onChange={(e) => setNewSource(e.target.value as LeadSource)}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 font-medium"
                    >
                      {LEAD_SOURCES.map((s) => (
                        <option key={s} value={s} className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-700 dark:text-slate-400 font-semibold mb-1">Số Lead Mới</label>
                    <input
                      type="number"
                      min="0"
                      value={newLeadsCount}
                      onChange={(e) => setNewLeadsCount(Number(e.target.value))}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-700 dark:text-slate-400 font-semibold mb-1">Chi Phí Ads (VND)</label>
                    <input
                      type="number"
                      min="0"
                      step="100000"
                      placeholder="VD: 5000000"
                      value={newAdSpend}
                      onChange={(e) => setNewAdSpend(Number(e.target.value))}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-indigo-700 dark:text-indigo-300 font-mono font-bold focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-700 dark:text-slate-400 font-semibold mb-1">Doanh Thu (VND)</label>
                    <input
                      type="number"
                      min="0"
                      step="500000"
                      placeholder="VD: 25000000"
                      value={newRevenue}
                      onChange={(e) => setNewRevenue(Number(e.target.value))}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-[#00793d] dark:text-emerald-400 font-mono font-bold focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleAddCampaignRow}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-900 dark:bg-slate-800 text-white dark:text-indigo-300 hover:bg-indigo-600 dark:hover:bg-slate-700 hover:text-white transition cursor-pointer flex items-center space-x-1 shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Thêm Hàng Này</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="text-xs text-slate-400">
                Lưu lại sẽ cập nhật ngay biểu đồ & tỷ lệ CPL / ROAS
              </div>

              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleSaveModal}
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg transition flex items-center space-x-1.5 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Lưu Cập Nhật</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

