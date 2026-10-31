import React, { useState } from 'react';
import {
  Crown,
  Download,
  Filter,
  MessageSquare,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Search,
  ShoppingBag,
  Upload,
  UserRoundX,
  Users,
  X,
  Zap,
} from 'lucide-react';
import type { Customer, CustomerStatus } from '../../../types';
import type { CustomerFilterModel } from '../../../hooks/useCustomers';
import { CUSTOMER_GROUPS, formatDate, getCustomerStatusLabel } from '../../../utils/crmUtils';

export type WorkQueueFilter = 'all' | 'new' | 'quoted' | 'purchased_once' | 'vip' | 'unassigned';

interface CustomerFilterBarProps {
  filterModel: CustomerFilterModel;
  workQueueFilter: WorkQueueFilter;
  setWorkQueueFilter: React.Dispatch<React.SetStateAction<WorkQueueFilter>>;
  queueCounts: {
    new: number;
    quoted: number;
    purchased_once: number;
    vip: number;
    unassigned: number;
  };
  sources: string[];
  owners: string[];
  isAdmin: boolean;
  displayedCustomers: Customer[];
  selectedCustomerIds: string[];
  setSelectedCustomerIds: React.Dispatch<React.SetStateAction<string[]>>;
  selectedCustomers: Customer[];
  onOpenAddModal: () => void;
  onOpenImportCsv: () => void;
  onExportCustomers: (records: Customer[]) => void;
  onExportCustomersExcel: (records: Customer[]) => void;
  isExportingExcel: boolean;
  onUpdateOwner: (customerId: string, owner: string) => void;
  onUpdateStatus: (customerId: string, status: CustomerStatus) => void;
  onOpenQuickAssign: (customerIds: string[]) => void;
  clearAllFilters: () => void;
}

const FilterChip = ({ label, onClear }: { label: string; onClear: () => void }) => (
  <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-1 text-[11px] font-semibold">
    {label}
    <button type="button" onClick={onClear} aria-label={`Xóa bộ lọc ${label}`} className="hover:text-rose-600">
      <X className="w-3 h-3" />
    </button>
  </span>
);

export const CustomerFilterBar: React.FC<CustomerFilterBarProps> = ({
  filterModel,
  workQueueFilter,
  setWorkQueueFilter,
  queueCounts,
  sources,
  owners,
  isAdmin,
  displayedCustomers,
  selectedCustomerIds,
  setSelectedCustomerIds,
  selectedCustomers,
  onOpenAddModal,
  onOpenImportCsv,
  onExportCustomers,
  onExportCustomersExcel,
  isExportingExcel,
  onUpdateOwner,
  onUpdateStatus,
  onOpenQuickAssign,
  clearAllFilters,
}) => {
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkOwner, setBulkOwner] = useState('');

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
    startDate,
    setStartDate,
    endDate,
    setEndDate,
  } = filterModel;

  const clearDateFilters = () => {
    setStartDate('');
    setEndDate('');
  };

  const advancedFilterCount = [
    selectedSource !== 'ALL',
    selectedGender !== 'ALL',
    selectedGroup !== 'ALL',
    Boolean(startDate || endDate),
  ].filter(Boolean).length;

  const hasAnyFilter = Boolean(
    searchQuery || selectedStatus !== 'ALL' || selectedOwner !== 'ALL' ||
    advancedFilterCount > 0 || workQueueFilter !== 'all'
  );

  const queueCards: Array<{
    id: Exclude<WorkQueueFilter, 'all'>;
    label: string;
    count: number;
    icon: React.ComponentType<{ className?: string }>;
    accent: string;
  }> = [
    { id: 'new', label: 'Khách mới', count: queueCounts.new, icon: Users, accent: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
    { id: 'quoted', label: 'Đã hỏi giá', count: queueCounts.quoted, icon: MessageSquare, accent: 'text-sky-700 bg-sky-50 border-sky-200' },
    { id: 'purchased_once', label: 'Đã mua 1 lần', count: queueCounts.purchased_once, icon: ShoppingBag, accent: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
    { id: 'vip', label: 'VIP', count: queueCounts.vip, icon: Crown, accent: 'text-purple-700 bg-purple-50 border-purple-200' },
    { id: 'unassigned', label: 'Chưa phân Sales', count: queueCounts.unassigned, icon: UserRoundX, accent: 'text-rose-700 bg-rose-50 border-rose-200' },
  ];

  return (
    <>
      <section aria-label="Phân nhóm khách hàng" className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
        {queueCards.map((card) => {
          const Icon = card.icon;
          const isActive = workQueueFilter === card.id;
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => setWorkQueueFilter(isActive ? 'all' : card.id)}
              aria-pressed={isActive}
              title={card.label}
              className={`min-h-20 rounded-xl border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-md ${card.accent} ${
                isActive ? 'ring-2 ring-indigo-500 ring-offset-2 shadow-sm' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-2xl font-black leading-none">{card.count}</div>
                  <div className="mt-2 text-xs font-bold truncate">{card.label}</div>
                </div>
                <span className="w-8 h-8 rounded-lg bg-white/70 border border-white flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4" />
                </span>
              </div>
            </button>
          );
        })}
      </section>

      <section className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col xl:flex-row gap-3">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Tìm theo tên, SĐT, email hoặc chiến dịch..."
              className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <div className="grid grid-cols-2 sm:flex gap-2">
            <select
              value={selectedStatus}
              onChange={(event) => setSelectedStatus(event.target.value)}
              aria-label="Lọc theo trạng thái"
              className="bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-700 focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">Tất cả trạng thái</option>
              {(['New Lead', 'Contacted', 'Quoted', 'Won', 'Lost'] as CustomerStatus[]).map((status) => (
                <option key={status} value={status}>{getCustomerStatusLabel(status)}</option>
              ))}
            </select>

            <select
              value={selectedOwner}
              onChange={(event) => setSelectedOwner(event.target.value)}
              aria-label="Lọc theo người phụ trách"
              className="bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-700 focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">Tất cả Sales</option>
              <option value="UNASSIGNED">Chưa phân công</option>
              {owners.map((owner) => <option key={owner} value={owner}>{owner}</option>)}
            </select>

            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowAdvancedFilters((current) => !current);
                  setShowActionsMenu(false);
                }}
                aria-expanded={showAdvancedFilters}
                className={`w-full px-3 py-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition ${
                  showAdvancedFilters || advancedFilterCount > 0
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-300'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                <Filter className="w-4 h-4" />
                Bộ lọc
                {advancedFilterCount > 0 && <span className="bg-indigo-600 text-white rounded-full px-1.5 py-0.5 text-[10px]">{advancedFilterCount}</span>}
              </button>

              {showAdvancedFilters && (
                <div className="fixed inset-x-4 top-24 z-40 bg-white border border-slate-200 rounded-2xl shadow-2xl p-4 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[min(42rem,calc(100vw-2rem))]">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Bộ lọc nâng cao</h3>
                    </div>
                    <button type="button" onClick={() => setShowAdvancedFilters(false)} aria-label="Đóng bộ lọc" className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <label className="text-xs font-semibold text-slate-600">
                      Nguồn khách
                      <select value={selectedSource} onChange={(event) => setSelectedSource(event.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-xs text-slate-800">
                        <option value="ALL">Tất cả nguồn</option>
                        {sources.map((source) => <option key={source} value={source}>{source}</option>)}
                      </select>
                    </label>
                    <label className="text-xs font-semibold text-slate-600">
                      Phân nhóm CRM
                      <select value={selectedGroup} onChange={(event) => setSelectedGroup(event.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-xs text-slate-800">
                        <option value="ALL">Tất cả nhóm</option>
                        <option value="group_1">Khách mới</option>
                        <option value="group_2">Đã hỏi giá</option>
                        <option value="group_3">Đã mua 1 lần</option>
                        <option value="group_4">VIP — đã mua ≥2 lần</option>
                      </select>
                    </label>
                    <label className="text-xs font-semibold text-slate-600">
                      Giới tính
                      <select value={selectedGender} onChange={(event) => setSelectedGender(event.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-xs text-slate-800">
                        <option value="ALL">Tất cả giới tính</option>
                        <option value="Nam">Nam</option>
                        <option value="Nữ">Nữ</option>
                        <option value="Khác">Khác</option>
                      </select>
                    </label>

                    <label className="text-xs font-semibold text-slate-600">
                      Tiếp cận từ ngày
                      <input
                        type="date"
                        value={startDate}
                        max={endDate || undefined}
                        onChange={(event) => setStartDate(event.target.value)}
                        aria-label="Ngày bắt đầu"
                        className="mt-1 w-full cursor-pointer rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-800"
                      />
                    </label>
                    <label className="text-xs font-semibold text-slate-600">
                      Đến ngày
                      <input
                        type="date"
                        value={endDate}
                        min={startDate || undefined}
                        onChange={(event) => setEndDate(event.target.value)}
                        aria-label="Ngày kết thúc"
                        className="mt-1 w-full cursor-pointer rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-800"
                      />
                    </label>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between">
                    <button type="button" onClick={clearAllFilters} className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-rose-600 flex items-center gap-1.5">
                      <RotateCcw className="w-3.5 h-3.5" /> Xóa bộ lọc
                    </button>
                    <button type="button" onClick={() => setShowAdvancedFilters(false)} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold">Xong</button>
                  </div>
                </div>
              )}
            </div>

            <button type="button" onClick={onOpenAddModal} className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-sm flex items-center justify-center gap-1.5">
              <Plus className="w-4 h-4" /> Thêm khách hàng
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowActionsMenu((current) => !current);
                  setShowAdvancedFilters(false);
                }}
                aria-label="Thêm thao tác"
                aria-expanded={showActionsMenu}
                className="w-full h-full min-h-10 px-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl flex items-center justify-center"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
              {showActionsMenu && (
                <div className="absolute right-0 top-full mt-2 z-40 w-48 bg-white border border-slate-200 rounded-xl shadow-xl p-1.5">
                  <button type="button" onClick={() => { onOpenImportCsv(); setShowActionsMenu(false); }} className="w-full px-3 py-2.5 rounded-lg text-left text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 flex items-center gap-2">
                    <Upload className="w-4 h-4" /> Nhập từ CSV
                  </button>
                  <button type="button" onClick={() => { onExportCustomers(displayedCustomers); setShowActionsMenu(false); }} disabled={!isAdmin} title={isAdmin ? 'Xuất danh sách đang hiển thị' : 'Chỉ Admin được xuất dữ liệu'} className="w-full px-3 py-2.5 rounded-lg text-left text-xs font-semibold text-slate-700 hover:bg-slate-100 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                    <Download className="w-4 h-4" /> Xuất CSV
                  </button>
                  <button type="button" onClick={() => { onExportCustomersExcel(displayedCustomers); setShowActionsMenu(false); }} disabled={!isAdmin || isExportingExcel || displayedCustomers.length === 0} title={isAdmin ? 'Mỗi workspace WhatsApp được xuất thành một sheet' : 'Chỉ Admin được xuất dữ liệu'} className="w-full px-3 py-2.5 rounded-lg text-left text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                    <Download className="w-4 h-4" /> {isExportingExcel ? 'Đang xuất Excel…' : 'Xuất Excel'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {hasAnyFilter && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
            <span className="text-[11px] font-semibold text-slate-500">Đang lọc:</span>
            {workQueueFilter !== 'all' && <FilterChip label={queueCards.find((card) => card.id === workQueueFilter)?.label || workQueueFilter} onClear={() => setWorkQueueFilter('all')} />}
            {selectedStatus !== 'ALL' && <FilterChip label={`Trạng thái: ${getCustomerStatusLabel(selectedStatus)}`} onClear={() => setSelectedStatus('ALL')} />}
            {selectedOwner !== 'ALL' && <FilterChip label={selectedOwner === 'UNASSIGNED' ? 'Sales: Chưa phân công' : `Sales: ${selectedOwner}`} onClear={() => setSelectedOwner('ALL')} />}
            {selectedSource !== 'ALL' && <FilterChip label={`Nguồn: ${selectedSource}`} onClear={() => setSelectedSource('ALL')} />}
            {selectedGroup !== 'ALL' && <FilterChip label={`Nhóm: ${CUSTOMER_GROUPS[selectedGroup as keyof typeof CUSTOMER_GROUPS]?.name}`} onClear={() => setSelectedGroup('ALL')} />}
            {selectedGender !== 'ALL' && <FilterChip label={`Giới tính: ${selectedGender}`} onClear={() => setSelectedGender('ALL')} />}
            {(startDate || endDate) && <FilterChip label={`Ngày: ${startDate ? formatDate(startDate) : '…'} – ${endDate ? formatDate(endDate) : '…'}`} onClear={clearDateFilters} />}
            <button type="button" onClick={clearAllFilters} className="ml-auto text-[11px] font-semibold text-indigo-600 hover:underline">Xóa tất cả</button>
          </div>
        )}
      </section>

      {selectedCustomerIds.length > 0 && (
        <section className="sticky top-14.5 z-20 bg-slate-900 text-white border border-slate-700 rounded-xl px-4 py-3 shadow-xl flex flex-wrap items-center gap-2">
          <div className="mr-2">
            <div className="text-sm font-bold">Đã chọn {selectedCustomerIds.length} khách hàng</div>
          </div>
          <button
            type="button"
            onClick={() => {
              onOpenQuickAssign(selectedCustomerIds);
              setSelectedCustomerIds([]);
            }}
            className="px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 border border-amber-500 text-xs font-bold flex items-center gap-1.5"
            title="Chia nhanh các khách đã chọn cho nhiều sales"
          >
            <Zap className="w-3.5 h-3.5" /> Chia nhanh
          </button>
          <select
            value={bulkOwner}
            onChange={(event) => {
              const owner = event.target.value;
              setBulkOwner(owner);
              if (!owner) return;
              selectedCustomerIds.forEach((customerId) => onUpdateOwner(customerId, owner));
              setSelectedCustomerIds([]);
              setBulkOwner('');
            }}
            className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-xs text-white"
          >
            <option value="">Gán Sales…</option>
            {owners.map((owner) => <option key={owner} value={owner}>{owner}</option>)}
          </select>
          <select
            value={bulkStatus}
            onChange={(event) => {
              const status = event.target.value as CustomerStatus;
              setBulkStatus(event.target.value);
              if (!event.target.value) return;
              selectedCustomerIds.forEach((customerId) => onUpdateStatus(customerId, status));
              setSelectedCustomerIds([]);
              setBulkStatus('');
            }}
            className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-xs text-white"
          >
            <option value="">Đổi trạng thái…</option>
            {(['New Lead', 'Contacted', 'Quoted', 'Won', 'Lost'] as CustomerStatus[]).map((status) => (
              <option key={status} value={status}>{getCustomerStatusLabel(status)}</option>
            ))}
          </select>
          <button type="button" onClick={() => onExportCustomers(selectedCustomers)} disabled={!isAdmin} className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50">
            <Download className="w-3.5 h-3.5" /> Xuất CSV
          </button>
          <button type="button" onClick={() => onExportCustomersExcel(selectedCustomers)} disabled={!isAdmin || isExportingExcel} className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 border border-indigo-500 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50">
            <Download className="w-3.5 h-3.5" /> {isExportingExcel ? 'Đang xuất…' : 'Xuất Excel'}
          </button>
          <button type="button" onClick={() => setSelectedCustomerIds([])} className="ml-auto px-3 py-2 rounded-lg hover:bg-slate-800 text-xs font-semibold flex items-center gap-1.5">
            <X className="w-4 h-4" /> Bỏ chọn
          </button>
        </section>
      )}
    </>
  );
};
