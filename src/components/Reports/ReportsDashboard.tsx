import React, { useState, useMemo } from 'react';
import type { Customer, BroadcastCampaign } from '../../types';
import { SalesReport } from './SalesReport';
import { WhatsAppReport } from './WhatsAppReport';
import { CrmMetricsReport } from './CrmMetricsReport';
import {
  BarChart3,
  DollarSign,
  MessageSquare,
  RefreshCw,
} from 'lucide-react';

interface ReportsDashboardProps {
  customers: Customer[];
  campaigns: BroadcastCampaign[];
}

export const ReportsDashboard: React.FC<ReportsDashboardProps> = ({
  customers,
  campaigns,
}) => {
  const [subTab, setSubTab] = useState<'sales' | 'whatsapp' | 'crm'>('sales');

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

  return (
    <div className="space-y-6">
      
      {/* Top Header & Global Export Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-400" />
            <span>Trung Tâm Báo Cáo & Analytics CRM</span>
          </h2>
        </div>
      </div>

      {/* Date Filter */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Quick Presets Dropdown */}
        <select
          value={datePreset}
          onChange={(e) => handlePresetChange(e.target.value as 'all' | 'today' | '7days' | 'this_month' | 'custom')}
          className="bg-slate-950 border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-100 min-w-[190px] focus:outline-none focus:border-indigo-500 shadow-sm cursor-pointer"
        >
          <option value="all">Tất cả thời gian</option>
          <option value="today">Hôm nay</option>
          <option value="7days">7 ngày qua</option>
          <option value="this_month">Tháng này</option>
          <option value="custom">Tùy chọn ngày</option>
        </select>

        {/* Custom Date Pickers - Chỉ hiện khi chọn dropdown Tùy chọn ngày */}
        {datePreset === 'custom' && (
          <div className="flex items-center space-x-2 text-sm">
            <div className="flex items-center space-x-1.5 bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2">
              <span className="text-slate-400 text-xs">Từ:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent text-slate-100 focus:outline-none text-sm cursor-pointer"
              />
            </div>

            <span className="text-slate-500 text-sm">-</span>

            <div className="flex items-center space-x-1.5 bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2">
              <span className="text-slate-400 text-xs">Đến:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent text-slate-100 focus:outline-none text-sm cursor-pointer"
              />
            </div>

            {(startDate || endDate) && (
              <button
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                }}
                className="text-xs text-indigo-400 hover:text-indigo-300 underline ml-1 cursor-pointer"
              >
                Xóa ngày đã chọn
              </button>
            )}
          </div>
        )}
      </div>

      {/* Sub-navigation tabs */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-2 flex flex-wrap gap-2 text-xs font-semibold">
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
      {subTab === 'sales' && (
        <SalesReport customers={filteredCustomers} />
      )}

      {subTab === 'whatsapp' && (
        <WhatsAppReport customers={filteredCustomers} campaigns={filteredCampaigns} />
      )}

      {subTab === 'crm' && (
        <CrmMetricsReport customers={filteredCustomers} />
      )}

    </div>
  );
};

