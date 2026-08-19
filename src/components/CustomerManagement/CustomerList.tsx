import React, { useState } from 'react';
import {
  Search, Filter, Plus, Download, Upload, User, Phone, Globe, ShoppingBag,
  MessageSquare, MoreHorizontal, Trash2, Edit3, ShieldCheck, ShieldAlert,
  ChevronRight, ArrowUpDown, Tag, FileSpreadsheet, Calendar, RotateCcw
} from 'lucide-react';
import type { Customer, CustomerStatus, AppUser } from '../../types';
import { CUSTOMER_GROUPS, formatVND, formatDate, getCustomerGroup, getStatusColorClass, getOwnerBadgeClass } from '../../utils/crmUtils';
import type { CustomerFilterModel } from '../../hooks/useCustomers';
import { ImportCustomerCsvModal } from '../CsvImport/ImportCustomerCsvModal';

interface CustomerListProps {
  customers: Customer[];
  currentUser?: AppUser | null;
  filterModel: CustomerFilterModel;
  onSelectCustomer: (customer: Customer) => void;
  onEditCustomer: (customer: Customer) => void;
  onDeleteCustomer: (id: string) => void;
  onOpenAddModal: () => void;
  onOpenAddOrder: (customer: Customer) => void;
  onOpenChat: (customer: Customer) => void;
  onUpdateStatus: (customerId: string, status: CustomerStatus) => void;
  onImportCustomers?: (newCustomers: Customer[]) => void;
}

export const CustomerList: React.FC<CustomerListProps> = ({
  customers,
  currentUser,
  filterModel,
  onSelectCustomer,
  onEditCustomer,
  onDeleteCustomer,
  onOpenAddModal,
  onOpenAddOrder,
  onOpenChat,
  onUpdateStatus,
  onImportCustomers,
}) => {
  const isAdmin = currentUser?.role === 'Admin';
  const [isImportCsvOpen, setIsImportCsvOpen] = useState(false);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const {
    searchQuery,
    setSearchQuery,
    selectedStatus,
    setSelectedStatus,
    selectedSource,
    setSelectedSource,
    selectedGender,
    setSelectedGender,
    selectedGroup,
    setSelectedGroup,
    selectedOwner,
    setSelectedOwner,
    selectedOptIn,
    setSelectedOptIn,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    filteredCustomers,
    isCustomerOptedIn: checkIsCustomerOptedIn,
  } = filterModel;

  const handleToggleSelectAll = () => {
    if (selectedCustomerIds.length === filteredCustomers.length && filteredCustomers.length > 0) {
      setSelectedCustomerIds([]);
    } else {
      setSelectedCustomerIds(filteredCustomers.map((c) => c.id));
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedCustomerIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Quick Date Helpers
  const handleSetToday = () => {
    const today = new Date().toISOString().split('T')[0];
    setStartDate(today);
    setEndDate(today);
  };

  const handleSetLast7Days = () => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 7);
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  const handleSetThisMonth = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    setStartDate(firstDay.toISOString().split('T')[0]);
    setEndDate(now.toISOString().split('T')[0]);
  };

  const handleClearDateFilter = () => {
    setStartDate('');
    setEndDate('');
  };


  // Unique values for dropdowns
  const sources = Array.from(new Set(customers.map((c) => c.source)));
  const owners = Array.from(new Set(customers.map((c) => c.owner)));

  // Export CSV
  const handleExportCSV = () => {
    if (!isAdmin) {
      alert('Quyền bị hạn chế: Chỉ tài khoản Admin mới có quyền xuất dữ liệu.');
      return;
    }
    const headers = [
      'ID', 'Name', 'Phone', 'Gender', 'Address', 'Email', 'Note',
      'Source', 'Campaign', 'AdSet', 'LandingPage', 'FirstContact', 'LastContact',
      'Owner', 'Status', 'Group', 'TotalOrders', 'TotalSpentVND', 'WhatsAppOptIn'
    ];

    const rows = filteredCustomers.map((c) => [
      c.id,
      `"${c.name}"`,
      `"${c.phone}"`,
      `"${c.gender || ''}"`,
      `"${c.address || ''}"`,
      `"${c.email || ''}"`,
      `"${c.note || ''}"`,
      `"${c.source}"`,
      `"${c.campaign}"`,
      `"${c.adSet || ''}"`,
      `"${c.landingPage || ''}"`,
      c.firstContact,
      c.lastContact,
      `"${c.owner}"`,
      c.status,
      CUSTOMER_GROUPS[getCustomerGroup(c)].name,
      c.totalOrders,
      c.totalSpent,
      checkIsCustomerOptedIn(c) ? 'Opt-in' : 'No Opt-in'
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `VietCRM_KhachHang_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      
      {/* Top Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
        
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm theo Tên, SĐT, Email, Chiến dịch..."
              className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsImportCsvOpen(true)}
              className="px-3 py-2 bg-emerald-700/80 hover:bg-emerald-600 text-white border border-emerald-600/40 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer shadow-sm"
              title="Nhập danh sách khách hàng hàng loạt bằng file CSV"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Nhập CSV</span>
            </button>

            {isAdmin ? (
              <button
                onClick={handleExportCSV}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-medium flex items-center space-x-1.5 transition cursor-pointer"
                title="Xuất danh sách ra file CSV"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Xuất CSV</span>
              </button>
            ) : (
              <button
                disabled
                className="px-3 py-2 bg-slate-800/40 text-slate-500 border border-slate-800/80 rounded-xl text-xs font-medium flex items-center space-x-1.5 cursor-not-allowed opacity-60"
                title="Chỉ tài khoản Admin mới có quyền xuất dữ liệu"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Xuất CSV (Chỉ Admin)</span>
              </button>
            )}

            <button
              onClick={onOpenAddModal}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/30 flex items-center space-x-1.5 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm Khách Hàng</span>
            </button>
          </div>

        </div>

        {/* Filter Dropdowns Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-xs pt-1">
          
          {/* Group Filter */}
          <div>
            <label className="block text-[10px] text-slate-700 dark:text-slate-300 font-semibold mb-0.5">Phân Nhóm CRM</label>
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs focus:outline-none"
            >
              <option value="ALL">Tất cả nhóm (1 - 4)</option>
              <option value="group_1">Nhóm 1: Khách mới</option>
              <option value="group_2">Nhóm 2: Đã hỏi giá</option>
              <option value="group_3">Nhóm 3: Đã mua 1 lần</option>
              <option value="group_4">Nhóm 4: Đã mua ≥2 lần (VIP)</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-[10px] text-slate-700 dark:text-slate-300 font-semibold mb-0.5">Trạng Thái</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs focus:outline-none"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="New Lead">New Lead</option>
              <option value="Contacted">Contacted</option>
              <option value="Quoted">Quoted</option>
              <option value="Won">Won</option>
              <option value="Lost">Lost</option>
            </select>
          </div>

          {/* Source Filter */}
          <div>
            <label className="block text-[10px] text-slate-700 dark:text-slate-300 font-semibold mb-0.5">Nguồn Khách (Source)</label>
            <select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs focus:outline-none"
            >
              <option value="ALL">Tất cả nguồn</option>
              {sources.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Gender Filter */}
          <div>
            <label className="block text-[10px] text-slate-700 dark:text-slate-300 font-semibold mb-0.5">Giới Tính</label>
            <select
              value={selectedGender}
              onChange={(e) => setSelectedGender(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs focus:outline-none"
            >
              <option value="ALL">Tất cả giới tính</option>
              <option value="Nam">Nam</option>
              <option value="Nữ">Nữ</option>
              <option value="Khác">Khác</option>
            </select>
          </div>

          {/* Owner Filter */}
          <div>
            <label className="block text-[10px] text-slate-700 dark:text-slate-300 font-semibold mb-0.5">Nhân Viên Phụ Trách</label>
            <select
              value={selectedOwner}
              onChange={(e) => setSelectedOwner(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs focus:outline-none"
            >
              <option value="ALL">Tất cả nhân viên</option>
              {owners.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>

          {/* Opt-In (WABA) Filter */}
          <div>
            <label className="block text-[10px] text-slate-700 dark:text-slate-300 font-semibold mb-0.5">Trạng Thái Opt-In</label>
            <select
              value={selectedOptIn}
              onChange={(e) => setSelectedOptIn(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs focus:outline-none"
            >
              <option value="ALL">Tất cả Opt-In</option>
              <option value="optin">✓ Opt-in (Đã nhắn WABA)</option>
              <option value="no_optin">! No Opt-in (Chưa nhắn WABA)</option>
            </select>
          </div>

        </div>

        {/* Date Filter Row (firstContact) */}
        <div className="pt-2 border-t border-slate-800/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-2 text-xs">
          <div className="flex items-center space-x-2 text-slate-800 dark:text-slate-200 font-semibold shrink-0">
            <Calendar className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
            <span>Khoảng thời gian tiếp cận (firstContact):</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <div className="flex items-center space-x-1.5 bg-slate-800 border border-slate-700/80 rounded-lg px-2 py-1">
              <span className="text-[10px] text-slate-300 font-medium">Từ ngày:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent text-white text-xs focus:outline-none cursor-pointer"
              />
            </div>

            <span className="text-slate-500 font-bold">-</span>

            <div className="flex items-center space-x-1.5 bg-slate-800 border border-slate-700/80 rounded-lg px-2 py-1">
              <span className="text-[10px] text-slate-300 font-medium">Đến ngày:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent text-white text-xs focus:outline-none cursor-pointer"
              />
            </div>

            {/* Quick Presets */}
            <div className="flex items-center space-x-1.5 ml-auto md:ml-2">
              <button
                type="button"
                onClick={handleSetToday}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md text-[11px] font-medium transition cursor-pointer border border-slate-700/60"
              >
                Hôm nay
              </button>
              <button
                type="button"
                onClick={handleSetLast7Days}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md text-[11px] font-medium transition cursor-pointer border border-slate-700/60"
              >
                7 ngày qua
              </button>
              <button
                type="button"
                onClick={handleSetThisMonth}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md text-[11px] font-medium transition cursor-pointer border border-slate-700/60"
              >
                Tháng này
              </button>
              {(startDate || endDate) && (
                <button
                  type="button"
                  onClick={handleClearDateFilter}
                  className="px-2.5 py-1 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 rounded-md text-[11px] font-semibold transition cursor-pointer border border-rose-800/40 flex items-center space-x-1"
                  title="Xóa bộ lọc ngày"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Xóa lọc ngày</span>
                </button>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Customer Table Container */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        
        {/* Table Summary Bar */}
        <div className="px-5 py-3 bg-slate-800/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
          <div className="flex flex-wrap items-center gap-2">
            <span>
              Hiển thị <span className="font-bold text-white">{filteredCustomers.length}</span> / {customers.length} khách hàng
            </span>

            {selectedCustomerIds.length > 0 && (
              <span className="font-semibold text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Đã chọn: {selectedCustomerIds.length} / {filteredCustomers.length}
              </span>
            )}
            {selectedGender !== 'ALL' && (
              <span className="font-semibold text-xs px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30 flex items-center space-x-1">
                <span>Giới tính: {selectedGender}</span>
                <button onClick={() => setSelectedGender('ALL')} className="hover:text-white ml-1 font-bold text-sm cursor-pointer">×</button>
              </span>
            )}
            {selectedStatus !== 'ALL' && (
              <span className="font-semibold text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center space-x-1">
                <span>Trạng thái: {selectedStatus}</span>
                <button onClick={() => setSelectedStatus('ALL')} className="hover:text-white ml-1 font-bold text-sm cursor-pointer">×</button>
              </span>
            )}
            {selectedSource !== 'ALL' && (
              <span className="font-semibold text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center space-x-1">
                <span>Nguồn: {selectedSource}</span>
                <button onClick={() => setSelectedSource('ALL')} className="hover:text-white ml-1 font-bold text-sm cursor-pointer">×</button>
              </span>
            )}
            {selectedOptIn !== 'ALL' && (
              <span className={`font-semibold text-xs px-2.5 py-0.5 rounded-full border flex items-center space-x-1 ${
                selectedOptIn === 'optin'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
              }`}>
                <span>Opt-in: {selectedOptIn === 'optin' ? '✓ Opt-in (Đã nhắn WABA)' : '! No Opt-in'}</span>
                <button onClick={() => setSelectedOptIn('ALL')} className="hover:text-white ml-1 font-bold text-sm cursor-pointer">×</button>
              </span>
            )}
            {selectedGroup !== 'ALL' && (
              <span className="font-semibold text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center space-x-1">
                <span>Nhóm: {CUSTOMER_GROUPS[selectedGroup as keyof typeof CUSTOMER_GROUPS]?.name || selectedGroup}</span>
                <button onClick={() => setSelectedGroup('ALL')} className="hover:text-white ml-1 font-bold text-sm cursor-pointer">×</button>
              </span>
            )}
            {(startDate || endDate) && (
              <span className="font-mono text-[11px] text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20 flex items-center space-x-1">
                <span>Ngày: {startDate || '...'} đến {endDate || '...'}</span>
                <button onClick={handleClearDateFilter} className="hover:text-white ml-1 font-bold text-sm cursor-pointer">×</button>
              </span>
            )}
          </div>
          {(selectedStatus !== 'ALL' || selectedSource !== 'ALL' || selectedGender !== 'ALL' || selectedGroup !== 'ALL' || selectedOwner !== 'ALL' || selectedOptIn !== 'ALL' || searchQuery || startDate || endDate) && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedStatus('ALL');
                setSelectedSource('ALL');
                setSelectedGender('ALL');
                setSelectedGroup('ALL');
                setSelectedOwner('ALL');
                setSelectedOptIn('ALL');
                setStartDate('');
                setEndDate('');
              }}
              className="text-indigo-400 hover:underline text-[11px] cursor-pointer font-medium ml-auto"
            >
              Xóa tất cả bộ lọc
            </button>
          )}
        </div>

        {/* Table Element */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-800/90 text-slate-300 border-b border-slate-800 uppercase text-[10px] tracking-wider font-semibold">
                <th className="py-3 px-3 text-center w-10">
                  <input
                    type="checkbox"
                    checked={
                      filteredCustomers.length > 0 &&
                      selectedCustomerIds.length === filteredCustomers.length
                    }
                    onChange={handleToggleSelectAll}
                    title="Chọn tất cả / Bỏ chọn tất cả"
                    className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600"
                  />
                </th>
                <th className="py-3 px-4">Khách Hàng (Malaysia)</th>
                <th className="py-3 px-3">Số Điện Thoại</th>
                <th className="py-3 px-3">Nguồn Khách (Source)</th>
                <th className="py-3 px-3">Trạng Thái</th>
                <th className="py-3 px-3">Sales Phụ Trách</th>
                <th className="py-3 px-3">Phân Nhóm CRM</th>
                <th className="py-3 px-4 text-right">Đơn Hàng & Giá Trị</th>
                <th className="py-3 px-4 text-center">Hành Động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-slate-500">
                    Không tìm thấy khách hàng nào phù hợp với bộ lọc.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((cust) => {
                  const grpKey = getCustomerGroup(cust);
                  const grpInfo = CUSTOMER_GROUPS[grpKey];
                  const isSelected = selectedCustomerIds.includes(cust.id);
                  const isBatchActive = selectedCustomerIds.length > 0;
                  const isOptedIn = checkIsCustomerOptedIn(cust);

                  return (
                    <tr
                      key={cust.id}
                      className={`transition group ${isSelected ? 'bg-indigo-50/80' : ''}`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(cust.id)}
                          className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600"
                        />
                      </td>

                      {/* Customer Info */}
                      <td className="py-3 px-4">
                        <div className="min-w-[140px]">
                          <button
                            onClick={() => onSelectCustomer(cust)}
                            className="font-bold text-slate-100 hover:text-indigo-400 text-sm text-left transition cursor-pointer"
                            title="Click để xem chi tiết khách hàng"
                          >
                            {cust.name}
                          </button>
                        </div>
                      </td>

                      {/* Phone Number */}
                      <td className="py-3 px-3">
                        <div className="space-y-1">
                          <div className="font-mono text-xs font-semibold text-slate-200">
                            {cust.phone}
                          </div>
                          <div>
                            {isOptedIn ? (
                              <span
                                className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.2 rounded"
                                title="Đã có tin nhắn tương tác với WABA (WhatsApp Business Account)"
                              >
                                ✓ Opt-in
                              </span>
                            ) : (
                              <span
                                className="inline-flex items-center gap-1 text-[10px] font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30 px-1.5 py-0.2 rounded"
                                title="Chưa có tin nhắn tương tác với WABA"
                              >
                                ! No Opt-in
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Lead Source */}
                      <td className="py-3 px-3">
                        <div className="space-y-0.5">
                          <div className="font-semibold text-indigo-300">{cust.source}</div>
                          <div className="text-[11px] text-slate-400 truncate max-w-[140px]" title={cust.campaign}>
                            {cust.campaign}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            Lần đầu: {formatDate(cust.firstContact)}
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3">
                        <select
                          value={cust.status}
                          onChange={(e) => onUpdateStatus(cust.id, e.target.value as CustomerStatus)}
                          className={`rounded-lg px-2.5 py-1 text-[11px] font-bold border focus:outline-none cursor-pointer transition shadow-sm ${getStatusColorClass(cust.status)}`}
                        >
                          <option value="New Lead" className="bg-white text-purple-800 dark:bg-slate-900 dark:text-purple-300 font-bold">New Lead</option>
                          <option value="Contacted" className="bg-white text-blue-800 dark:bg-slate-900 dark:text-blue-300 font-bold">Contacted</option>
                          <option value="Quoted" className="bg-white text-amber-800 dark:bg-slate-900 dark:text-amber-300 font-bold">Quoted</option>
                          <option value="Won" className="bg-white text-emerald-800 dark:bg-slate-900 dark:text-emerald-300 font-bold">Won</option>
                          <option value="Lost" className="bg-white text-rose-800 dark:bg-slate-900 dark:text-rose-300 font-bold">Lost</option>
                        </select>
                      </td>

                      {/* Sales Phụ Trách */}
                      <td className="py-3 px-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border shadow-xs ${getOwnerBadgeClass(cust.owner)}`}>
                          <User className="w-3 h-3 shrink-0" />
                          <span>{cust.owner}</span>
                        </span>
                      </td>

                      {/* CRM Segmentation Group */}
                      <td className="py-3 px-3">
                        <span className={`inline-block text-[11px] px-2 py-0.5 rounded-full font-semibold border ${grpInfo.badgeColor}`}>
                          {grpInfo.name}
                        </span>
                      </td>

                      {/* Orders & Total Spent */}
                      <td className="py-3 px-3 text-right">
                        <div className="font-bold text-emerald-400 text-sm">
                          {formatVND(cust.totalSpent)}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {cust.totalOrders} đơn hàng
                        </div>
                        {cust.lastPurchaseDate && (
                          <div className="text-[10px] text-slate-500">
                            Lần cuối: {formatDate(cust.lastPurchaseDate)}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          
                          <button
                            onClick={() => onOpenChat(cust)}
                            className="p-1.5 rounded-lg text-teal-400 hover:bg-teal-500/20 transition"
                            title="Mở Chat WhatsApp"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => onOpenAddOrder(cust)}
                            className="p-1.5 rounded-lg text-emerald-400 hover:bg-emerald-500/20 transition"
                            title="Tạo đơn hàng mới"
                          >
                            <ShoppingBag className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => onEditCustomer(cust)}
                            className="p-1.5 rounded-lg text-slate-900 dark:text-indigo-400 hover:text-indigo-600 hover:bg-slate-200 dark:hover:bg-indigo-500/20 transition cursor-pointer font-bold"
                            title="Chỉnh sửa thông tin"
                          >
                            <Edit3 className="w-4 h-4 text-slate-900 dark:text-indigo-400" />
                          </button>

                          <button
                            onClick={() => onDeleteCustomer(cust.id)}
                            className="p-1.5 rounded-lg text-slate-900 dark:text-rose-400 hover:text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-500/20 transition cursor-pointer font-bold"
                            title="Xóa khách hàng"
                          >
                            <Trash2 className="w-4 h-4 text-slate-900 dark:text-rose-400" />
                          </button>

                        </div>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* CSV Import Modal */}
      {isImportCsvOpen && (
        <ImportCustomerCsvModal
          isOpen={isImportCsvOpen}
          onClose={() => setIsImportCsvOpen(false)}
          onImportCustomers={(newCustomers) => {
            if (onImportCustomers) {
              onImportCustomers(newCustomers);
            }
          }}
          existingCustomersCount={customers.length}
        />
      )}

    </div>
  );
};
