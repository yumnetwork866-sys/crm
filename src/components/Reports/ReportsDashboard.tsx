import React, { useState, useMemo } from 'react';
import type { Customer, MarketingCampaignReport, BroadcastCampaign, AppUser } from '../../types';
import { MarketingReport } from './MarketingReport';
import { SalesReport } from './SalesReport';
import { WhatsAppReport } from './WhatsAppReport';
import { CrmMetricsReport } from './CrmMetricsReport';
import {
  exportMarketingReportCsv,
  exportSalesReportCsv,
  exportCustomersCsv,
  exportOrdersCsv,
  exportWhatsAppReportCsv,
  exportFullExecutiveSummaryCsv,
} from '../../utils/reportExporter';
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  MessageSquare,
  RefreshCw,
  Download,
  FileSpreadsheet,
  ChevronDown,
  Calendar,
  Filter,
} from 'lucide-react';

interface ReportsDashboardProps {
  customers: Customer[];
  marketingReports: MarketingCampaignReport[];
  campaigns: BroadcastCampaign[];
  currentUser?: AppUser | null;
  onUpdateMarketingReports?: (reports: MarketingCampaignReport[]) => void;
}

export const ReportsDashboard: React.FC<ReportsDashboardProps> = ({
  customers,
  marketingReports,
  campaigns,
  currentUser,
  onUpdateMarketingReports,
}) => {
  const isAdmin = currentUser?.role === 'Admin';
  const [subTab, setSubTab] = useState<'marketing' | 'sales' | 'whatsapp' | 'crm'>('marketing');
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

  // Date Filter States
  const [datePreset, setDatePreset] = useState<'all' | 'today' | '7days' | 'this_month' | 'custom'>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Handle Preset Changes
  const handlePresetChange = (preset: 'all' | 'today' | '7days' | 'this_month' | 'custom') => {
    setDatePreset(preset);
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    } else if (preset === 'today') {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === '7days') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      setStartDate(d.toISOString().split('T')[0]);
      setEndDate(todayStr);
    } else if (preset === 'this_month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      setStartDate(firstDay);
      setEndDate(todayStr);
    }
  };

  // Filtered Customers based on date range
  const filteredCustomers = useMemo(() => {
    if (!startDate && !endDate) return customers;

    return customers.filter((c) => {
      const fcDate = c.firstContact ? c.firstContact.slice(0, 10) : '';
      
      // Check if contact date falls in range
      const contactInRange = (!startDate || fcDate >= startDate) && (!endDate || fcDate <= endDate);
      
      // Check if customer has any order in date range
      const hasOrderInRange = c.orders && c.orders.some((o) => {
        const oDate = o.date ? o.date.slice(0, 10) : '';
        return (!startDate || oDate >= startDate) && (!endDate || oDate <= endDate);
      });

      return contactInRange || hasOrderInRange;
    });
  }, [customers, startDate, endDate]);

  // Filtered Broadcast Campaigns based on date range
  const filteredCampaigns = useMemo(() => {
    if (!startDate && !endDate) return campaigns;
    return campaigns.filter((camp) => {
      const cDate = camp.createdAt ? camp.createdAt.slice(0, 10) : '';
      return (!startDate || cDate >= startDate) && (!endDate || cDate <= endDate);
    });
  }, [campaigns, startDate, endDate]);

  const handleExportCurrentTab = () => {
    if (!isAdmin) {
      alert('Quyền bị hạn chế: Chỉ tài khoản Admin mới có quyền xuất dữ liệu.');
      return;
    }
    switch (subTab) {
      case 'marketing':
        exportMarketingReportCsv(marketingReports);
        break;
      case 'sales':
        exportSalesReportCsv(filteredCustomers);
        break;
      case 'whatsapp':
        exportWhatsAppReportCsv(filteredCampaigns);
        break;
      case 'crm':
        exportFullExecutiveSummaryCsv(filteredCustomers, marketingReports, filteredCampaigns);
        break;
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Header & Global Export Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-400" />
            <span>Trung Tâm Báo Cáo & Analytics CRM</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Xuất dữ liệu lưu trữ ngoại tuyến sang file CSV/Excel hỗ trợ tiếng Việt có dấu.
          </p>
        </div>

        {/* Global Export Button Group */}
        {isAdmin ? (
          <div className="relative flex items-center space-x-2">
            <button
              onClick={handleExportCurrentTab}
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 transition cursor-pointer active:scale-95"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Xuất Báo Cáo Tab Này (CSV)</span>
            </button>

            <div className="relative">
              <button
                onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                className="export-dropdown-btn p-2.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-700 transition cursor-pointer"
                title="Tùy chọn xuất các tập tin dữ liệu khác"
              >
                <ChevronDown className="w-4 h-4" />
              </button>

              {isExportMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-2 z-50 text-xs animate-fade-in space-y-1">
                  <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-800">
                    Tùy Chọn Xuất File Dữ Liệu
                  </div>

                  <button
                    onClick={() => {
                      exportFullExecutiveSummaryCsv(filteredCustomers, marketingReports, filteredCampaigns);
                      setIsExportMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl text-emerald-300 hover:bg-slate-800 font-semibold flex items-center space-x-2 transition"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                    <span>Báo Cáo Tổng Hợp Executive (Full)</span>
                  </button>

                  <button
                    onClick={() => {
                      exportMarketingReportCsv(marketingReports);
                      setIsExportMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl text-slate-200 hover:bg-slate-800 flex items-center space-x-2 transition"
                  >
                    <TrendingUp className="w-4 h-4 text-indigo-400" />
                    <span>Báo Cáo Marketing Ads (CPL/ROAS)</span>
                  </button>

                  <button
                    onClick={() => {
                      exportSalesReportCsv(filteredCustomers);
                      setIsExportMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl text-slate-200 hover:bg-slate-800 flex items-center space-x-2 transition"
                  >
                    <DollarSign className="w-4 h-4 text-emerald-400" />
                    <span>Báo Cáo Hiệu Suất Đội Ngũ Sales</span>
                  </button>

                  <button
                    onClick={() => {
                      exportCustomersCsv(filteredCustomers);
                      setIsExportMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl text-slate-200 hover:bg-slate-800 flex items-center space-x-2 transition"
                  >
                    <Download className="w-4 h-4 text-indigo-300" />
                    <span>Danh Sách Khách Hàng Dưới Bộ Lọc</span>
                  </button>

                  <button
                    onClick={() => {
                      exportOrdersCsv(filteredCustomers);
                      setIsExportMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl text-slate-200 hover:bg-slate-800 flex items-center space-x-2 transition"
                  >
                    <Download className="w-4 h-4 text-emerald-300" />
                    <span>Chi Tiết Dữ Liệu Các Đơn Hàng</span>
                  </button>

                  <button
                    onClick={() => {
                      exportWhatsAppReportCsv(filteredCampaigns);
                      setIsExportMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl text-slate-200 hover:bg-slate-800 flex items-center space-x-2 transition"
                  >
                    <MessageSquare className="w-4 h-4 text-teal-400" />
                    <span>Báo Cáo Broadcast WhatsApp</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="inline-flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-medium bg-slate-800/40 text-slate-500 border border-slate-800/80 cursor-not-allowed opacity-60" title="Chỉ tài khoản Admin mới có quyền xuất dữ liệu báo cáo">
            <FileSpreadsheet className="w-4 h-4 text-slate-500" />
            <span>Xuất Báo Cáo (Chỉ Admin)</span>
          </div>
        )}
      </div>

      {/* Date Range Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="flex items-center space-x-2 text-slate-300 font-semibold text-xs shrink-0">
          <Calendar className="w-4 h-4 text-indigo-400" />
          <span>Lọc Báo Cáo Theo Thời Gian:</span>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          {/* Quick Presets */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-medium">
            <button
              onClick={() => handlePresetChange('all')}
              className={`px-3 py-1.5 rounded-lg transition ${
                datePreset === 'all'
                  ? 'bg-indigo-600 text-white font-semibold shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Tất cả
            </button>
            <button
              onClick={() => handlePresetChange('today')}
              className={`px-3 py-1.5 rounded-lg transition ${
                datePreset === 'today'
                  ? 'bg-indigo-600 text-white font-semibold shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Hôm nay
            </button>
            <button
              onClick={() => handlePresetChange('7days')}
              className={`px-3 py-1.5 rounded-lg transition ${
                datePreset === '7days'
                  ? 'bg-indigo-600 text-white font-semibold shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              7 ngày qua
            </button>
            <button
              onClick={() => handlePresetChange('this_month')}
              className={`px-3 py-1.5 rounded-lg transition ${
                datePreset === 'this_month'
                  ? 'bg-indigo-600 text-white font-semibold shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Tháng này
            </button>
          </div>

          {/* Custom Date Pickers */}
          <div className="flex items-center space-x-2 text-xs">
            <div className="flex items-center space-x-1 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5">
              <span className="text-slate-500 text-[11px]">Từ:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setDatePreset('custom');
                }}
                className="bg-transparent text-slate-200 focus:outline-none text-xs cursor-pointer"
              />
            </div>

            <span className="text-slate-500 text-xs">-</span>

            <div className="flex items-center space-x-1 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5">
              <span className="text-slate-500 text-[11px]">Đến:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setDatePreset('custom');
                }}
                className="bg-transparent text-slate-200 focus:outline-none text-xs cursor-pointer"
              />
            </div>

            {(startDate || endDate) && (
              <button
                onClick={() => handlePresetChange('all')}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 underline ml-1 cursor-pointer"
              >
                Xóa bộ lọc
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Sub-navigation tabs */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-2 flex flex-wrap gap-2 text-xs font-semibold">
        <button
          onClick={() => setSubTab('marketing')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl transition ${
            subTab === 'marketing'
              ? 'bg-indigo-600 text-white shadow'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Báo Cáo Marketing (CPL & ROAS)</span>
        </button>

        <button
          onClick={() => setSubTab('sales')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl transition ${
            subTab === 'sales'
              ? 'bg-indigo-600 text-white shadow'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>Báo Cáo Sales (Phễu & Doanh Thu)</span>
        </button>

        <button
          onClick={() => setSubTab('whatsapp')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl transition ${
            subTab === 'whatsapp'
              ? 'bg-indigo-600 text-white shadow'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Báo Cáo WhatsApp (Tỷ Lệ Đọc)</span>
        </button>

        <button
          onClick={() => setSubTab('crm')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl transition ${
            subTab === 'crm'
              ? 'bg-indigo-600 text-white shadow'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <RefreshCw className="w-4 h-4" />
          <span>Báo Cáo CRM (AOV & LTV)</span>
        </button>
      </div>

      {/* Render selected sub-report with filtered data */}
      {subTab === 'marketing' && (
        <MarketingReport
          customers={filteredCustomers}
          marketingReports={marketingReports}
          onUpdateMarketingReports={onUpdateMarketingReports}
          isAdmin={isAdmin}
        />
      )}

      {subTab === 'sales' && (
        <SalesReport customers={filteredCustomers} isAdmin={isAdmin} />
      )}

      {subTab === 'whatsapp' && (
        <WhatsAppReport customers={filteredCustomers} campaigns={filteredCampaigns} isAdmin={isAdmin} />
      )}

      {subTab === 'crm' && (
        <CrmMetricsReport customers={filteredCustomers} isAdmin={isAdmin} />
      )}

    </div>
  );
};

