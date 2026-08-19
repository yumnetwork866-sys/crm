import React, { useState } from 'react';
import { Layers, Users, ShoppingBag, ArrowRight, Send, DollarSign, CheckCircle2 } from 'lucide-react';
import type { Customer, CustomerGroupId } from '../../types';
import { CUSTOMER_GROUPS, formatVND, getCustomerGroup } from '../../utils/crmUtils';

interface SegmentationViewProps {
  customers: Customer[];
  onSelectCustomer: (customer: Customer) => void;
  onNavigateToBroadcast: (groupName: string) => void;
}

export const SegmentationView: React.FC<SegmentationViewProps> = ({
  customers,
  onSelectCustomer,
  onNavigateToBroadcast,
}) => {
  const [activeGroupTab, setActiveGroupTab] = useState<CustomerGroupId>('group_1');

  // Categorize customers into the 4 strict groups
  const groupedCustomers: Record<CustomerGroupId, Customer[]> = {
    group_1: [],
    group_2: [],
    group_3: [],
    group_4: [],
  };

  customers.forEach((c) => {
    const groupKey = getCustomerGroup(c);
    groupedCustomers[groupKey].push(c);
  });

  const totalRevenue = customers.reduce((sum, c) => sum + c.totalSpent, 0);

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-indigo-600 dark:text-indigo-400 font-bold text-xs uppercase tracking-wider">
              <Layers className="w-4 h-4" />
              <span>Hệ Thống Phân Nhóm Tự Động</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-1">CRM Phân Nhóm Khách Hàng (1 - 4)</h2>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 max-w-2xl">
              Dựa trên hành vi tương tác và lịch sử mua hàng, CRM tự động xếp hạng khách hàng để tối ưu hóa chiến dịch Marketing & Automation.
            </p>
          </div>

          <div className="flex items-center space-x-3 bg-slate-800/80 px-4 py-2.5 rounded-xl border border-slate-700/60 text-xs text-slate-300">
            <div>
              <span className="text-slate-400">Tổng Số Khách:</span>
              <span className="font-bold text-slate-900 dark:text-white ml-1.5">{customers.length} khách</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Group Cards Overview Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {(Object.keys(CUSTOMER_GROUPS) as CustomerGroupId[]).map((groupId) => {
          const groupConfig = CUSTOMER_GROUPS[groupId];
          const members = groupedCustomers[groupId];
          const count = members.length;
          const revenue = members.reduce((sum, m) => sum + m.totalSpent, 0);
          const percentRevenue = totalRevenue > 0 ? ((revenue / totalRevenue) * 100).toFixed(1) : '0';
          const isActive = activeGroupTab === groupId;

          return (
            <div
              key={groupId}
              onClick={() => setActiveGroupTab(groupId)}
              className={`p-5 rounded-2xl border cursor-pointer transition-all duration-200 relative overflow-hidden ${
                isActive
                  ? 'bg-slate-800/90 border-indigo-500 shadow-xl ring-2 ring-indigo-500/50'
                  : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-800/50'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${groupConfig.badgeColor}`}>
                  {groupConfig.name}
                </span>
                <span className="text-xs font-bold text-white bg-slate-800 px-2 py-0.5 rounded-md">
                  {count} khách
                </span>
              </div>

              <p className="text-[11px] text-slate-400 min-h-[32px] line-clamp-2">
                {groupConfig.description}
              </p>

              <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                <div>
                  <div className="text-[10px] text-slate-400">Doanh thu nhóm</div>
                  <div className="font-bold text-emerald-400">{formatVND(revenue)}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-slate-400">Tỷ trọng</div>
                  <div className="font-bold text-[#be00f6]">{percentRevenue}%</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Group Active View */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className={`text-sm px-3 py-1 rounded-full font-bold border ${CUSTOMER_GROUPS[activeGroupTab].badgeColor}`}>
                {CUSTOMER_GROUPS[activeGroupTab].name}
              </span>
              <span className="text-sm font-semibold text-slate-300">
                ({groupedCustomers[activeGroupTab].length} khách hàng)
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {CUSTOMER_GROUPS[activeGroupTab].description}
            </p>
          </div>

          <button
            onClick={() => onNavigateToBroadcast(CUSTOMER_GROUPS[activeGroupTab].name)}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-semibold shadow-md flex items-center space-x-1.5 transition self-start sm:self-auto"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Gửi WhatsApp Cho Nhóm Này</span>
          </button>
        </div>

        {/* Member Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-800/70 text-slate-400 border-b border-slate-800 uppercase text-[10px] tracking-wider">
                <th className="py-2.5 px-4">Tên Khách Hàng</th>
                <th className="py-2.5 px-3">SĐT / Quốc Gia</th>
                <th className="py-2.5 px-3">Kênh Tiếp Cận</th>
                <th className="py-2.5 px-3">Trạng Thái</th>
                <th className="py-2.5 px-3 text-right">Tổng Mua (VND)</th>
                <th className="py-2.5 px-4 text-center">Chi Tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {groupedCustomers[activeGroupTab].length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-500">
                    Chưa có khách hàng nào thuộc phân nhóm này.
                  </td>
                </tr>
              ) : (
                groupedCustomers[activeGroupTab].map((cust) => (
                  <tr key={cust.id} className="transition">
                    <td className="py-3 px-4 font-bold text-slate-900">{cust.name}</td>
                    <td className="py-3 px-3 text-slate-400">
                      {cust.phone} ({cust.country})
                    </td>
                    <td className="py-3 px-3 text-indigo-300">{cust.source}</td>
                    <td className="py-3 px-3 font-semibold text-slate-200">{cust.status}</td>
                    <td className="py-3 px-3 text-right font-bold text-emerald-400">
                      {formatVND(cust.totalSpent)} ({cust.totalOrders} đơn)
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => onSelectCustomer(cust)}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition"
                      >
                        Xem
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>

    </div>
  );
};
