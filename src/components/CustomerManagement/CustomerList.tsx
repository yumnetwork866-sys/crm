import React, { useMemo, useState } from 'react';
import {
  Crown,
  Download,
  Edit3,
  Filter,
  MessageSquare,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Search,
  ShoppingBag,
  Trash2,
  Upload,
  User,
  UserRoundX,
  Users,
  X,
} from 'lucide-react';
import type { AppUser, CentralMessage, Customer, CustomerGroupId, CustomerStatus } from '../../types';
import {
  CUSTOMER_GROUPS,
  formatDate,
  formatVND,
  getCustomerGroup,
  getOwnerBadgeClass,
  getStatusColorClass,
  isSamePhoneNumber,
} from '../../utils/crmUtils';
import type { CustomerFilterModel } from '../../hooks/useCustomers';
import { ImportCustomerCsvModal } from '../CsvImport/ImportCustomerCsvModal';

type WorkQueueFilter = 'all' | 'new' | 'quoted' | 'purchased_once' | 'vip' | 'unassigned';

interface CustomerListProps {
  customers: Customer[];
  centralMessages?: CentralMessage[];
  currentUser?: AppUser | null;
  filterModel: CustomerFilterModel;
  onSelectCustomer: (customer: Customer) => void;
  onEditCustomer: (customer: Customer) => void;
  onDeleteCustomer: (id: string) => void;
  onOpenAddModal: () => void;
  onOpenAddOrder: (customer: Customer) => void;
  onOpenChat: (customer: Customer) => void;
  onUpdateStatus: (customerId: string, status: CustomerStatus) => void;
  onUpdateGroup: (customerId: string, group: CustomerGroupId) => void;
  onUpdateOwner: (customerId: string, owner: string) => void;
  onImportCustomers?: (newCustomers: Customer[]) => void;
}

const UNASSIGNED_OWNERS = ['', 'Chưa phân công', 'Unassigned'];

const parseDisplayDate = (value: string) => {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (
    date.getFullYear() !== Number(year) ||
    date.getMonth() !== Number(month) - 1 ||
    date.getDate() !== Number(day)
  ) return null;
  return `${year}-${month}-${day}`;
};

export const CustomerList: React.FC<CustomerListProps> = ({
  customers,
  centralMessages = [],
  currentUser,
  filterModel,
  onSelectCustomer,
  onEditCustomer,
  onDeleteCustomer,
  onOpenAddModal,
  onOpenAddOrder,
  onOpenChat,
  onUpdateStatus,
  onUpdateGroup,
  onUpdateOwner,
  onImportCustomers,
}) => {
  const isAdmin = currentUser?.role === 'Admin';
  const [isImportCsvOpen, setIsImportCsvOpen] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [workQueueFilter, setWorkQueueFilter] = useState<WorkQueueFilter>('all');
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
    selectedOptIn,
    setSelectedOptIn,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    filteredCustomers,
    isCustomerOptedIn,
  } = filterModel;
  const [startDateInput, setStartDateInput] = useState(startDate ? formatDate(startDate) : '');
  const [endDateInput, setEndDateInput] = useState(endDate ? formatDate(endDate) : '');

  const handleStartDateChange = (value: string) => {
    setStartDateInput(value);
    if (!value) setStartDate('');
    else setStartDate(parseDisplayDate(value) || '');
  };

  const handleEndDateChange = (value: string) => {
    setEndDateInput(value);
    if (!value) setEndDate('');
    else setEndDate(parseDisplayDate(value) || '');
  };

  const clearDateFilters = () => {
    setStartDate('');
    setEndDate('');
    setStartDateInput('');
    setEndDateInput('');
  };

  const sources = useMemo(() => Array.from(new Set(customers.map((c) => c.source))).sort(), [customers]);
  const owners = useMemo(
    () => Array.from(new Set(customers.map((c) => c.owner).filter((owner) => owner && !UNASSIGNED_OWNERS.includes(owner)))).sort(),
    [customers]
  );

  const hasUnreadMessage = (customer: Customer) => centralMessages.some((message) =>
    message.sender === 'customer' && !message.isRead && (
      message.customerId === customer.id || isSamePhoneNumber(message.customerPhone, customer.phone)
    )
  );

  const matchesWorkQueue = (customer: Customer, filter: WorkQueueFilter) => {
    if (filter === 'new') return getCustomerGroup(customer) === 'group_1';
    if (filter === 'quoted') return getCustomerGroup(customer) === 'group_2';
    if (filter === 'purchased_once') return getCustomerGroup(customer) === 'group_3';
    if (filter === 'vip') return getCustomerGroup(customer) === 'group_4';
    if (filter === 'unassigned') return UNASSIGNED_OWNERS.includes(customer.owner || '');
    return true;
  };

  const displayedCustomers = useMemo(
    () => filteredCustomers.filter((customer) => matchesWorkQueue(customer, workQueueFilter)),
    [filteredCustomers, workQueueFilter]
  );

  const queueCounts = useMemo(() => ({
    new: customers.filter((customer) => getCustomerGroup(customer) === 'group_1').length,
    quoted: customers.filter((customer) => getCustomerGroup(customer) === 'group_2').length,
    purchased_once: customers.filter((customer) => getCustomerGroup(customer) === 'group_3').length,
    vip: customers.filter((customer) => getCustomerGroup(customer) === 'group_4').length,
    unassigned: customers.filter((customer) => UNASSIGNED_OWNERS.includes(customer.owner || '')).length,
  }), [customers]);

  const advancedFilterCount = [
    selectedSource !== 'ALL',
    selectedGender !== 'ALL',
    selectedGroup !== 'ALL',
    selectedOptIn !== 'ALL',
    Boolean(startDate || endDate),
  ].filter(Boolean).length;

  const hasAnyFilter = Boolean(
    searchQuery || selectedStatus !== 'ALL' || selectedOwner !== 'ALL' ||
    advancedFilterCount > 0 || workQueueFilter !== 'all'
  );

  const clearAllFilters = () => {
    setSearchQuery('');
    setSelectedStatus('ALL');
    setSelectedSource('ALL');
    setSelectedGender('ALL');
    setSelectedGroup('ALL');
    setSelectedOwner('ALL');
    setSelectedOptIn('ALL');
    clearDateFilters();
    setWorkQueueFilter('all');
  };

  const handleToggleSelectAll = () => {
    const visibleIds = displayedCustomers.map((customer) => customer.id);
    const areAllVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedCustomerIds.includes(id));
    setSelectedCustomerIds((current) => areAllVisibleSelected
      ? current.filter((id) => !visibleIds.includes(id))
      : Array.from(new Set([...current, ...visibleIds]))
    );
  };

  const handleToggleSelect = (id: string) => {
    setSelectedCustomerIds((current) => current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id]
    );
  };

  const exportCustomers = (records: Customer[]) => {
    if (!isAdmin) {
      alert('Quyền bị hạn chế: Chỉ tài khoản Admin mới có quyền xuất dữ liệu.');
      return;
    }
    const headers = [
      'ID', 'Name', 'Phone', 'Gender', 'Address', 'Email', 'Note', 'Source', 'Campaign',
      'AdSet', 'LandingPage', 'FirstContact', 'LastContact', 'Owner', 'Status', 'Group',
      'TotalOrders', 'TotalSpentVND', 'WhatsAppOptIn',
    ];
    const rows = records.map((customer) => [
      customer.id,
      `"${customer.name}"`,
      `"${customer.phone}"`,
      `"${customer.gender || ''}"`,
      `"${customer.address || ''}"`,
      `"${customer.email || ''}"`,
      `"${customer.note || ''}"`,
      `"${customer.source}"`,
      `"${customer.campaign}"`,
      `"${customer.adSet || ''}"`,
      `"${customer.landingPage || ''}"`,
      formatDate(customer.firstContact),
      formatDate(customer.lastContact),
      `"${customer.owner}"`,
      customer.status,
      CUSTOMER_GROUPS[getCustomerGroup(customer)].name,
      customer.totalOrders,
      customer.totalSpent,
      isCustomerOptedIn(customer) ? 'Opt-in' : 'No Opt-in',
    ]);
    const csvContent = `data:text/csv;charset=utf-8,\uFEFF${[headers.join(','), ...rows.map((row) => row.join(','))].join('\n')}`;
    const link = document.createElement('a');
    link.href = encodeURI(csvContent);
    link.download = `VietCRM_KhachHang_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const selectedCustomers = customers.filter((customer) => selectedCustomerIds.includes(customer.id));

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
    <div className="space-y-4">
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
              <option value="New Lead">New Lead</option>
              <option value="Contacted">Contacted</option>
              <option value="Quoted">Quoted</option>
              <option value="Won">Won</option>
              <option value="Lost">Lost</option>
            </select>

            <select
              value={selectedOwner}
              onChange={(event) => setSelectedOwner(event.target.value)}
              aria-label="Lọc theo Sales phụ trách"
              className="bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-700 focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">Tất cả Sales</option>
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
                      WhatsApp Opt-in
                      <select value={selectedOptIn} onChange={(event) => setSelectedOptIn(event.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-xs text-slate-800">
                        <option value="ALL">Tất cả Opt-in</option>
                        <option value="optin">Đã Opt-in</option>
                        <option value="no_optin">Chưa Opt-in</option>
                      </select>
                    </label>
                    <label className="text-xs font-semibold text-slate-600">
                      Tiếp cận từ ngày
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={10}
                        value={startDateInput}
                        onChange={(event) => handleStartDateChange(event.target.value)}
                        placeholder="dd/mm/yyyy"
                        aria-label="Ngày bắt đầu, định dạng dd/mm/yyyy"
                        className="mt-1 w-full bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-xs text-slate-800 placeholder-slate-400"
                      />
                    </label>
                    <label className="text-xs font-semibold text-slate-600">
                      Đến ngày
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={10}
                        value={endDateInput}
                        onChange={(event) => handleEndDateChange(event.target.value)}
                        placeholder="dd/mm/yyyy"
                        aria-label="Ngày kết thúc, định dạng dd/mm/yyyy"
                        className="mt-1 w-full bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-xs text-slate-800 placeholder-slate-400"
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
                  <button type="button" onClick={() => { setIsImportCsvOpen(true); setShowActionsMenu(false); }} className="w-full px-3 py-2.5 rounded-lg text-left text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 flex items-center gap-2">
                    <Upload className="w-4 h-4" /> Nhập từ CSV
                  </button>
                  <button type="button" onClick={() => { exportCustomers(displayedCustomers); setShowActionsMenu(false); }} disabled={!isAdmin} title={isAdmin ? 'Xuất danh sách đang hiển thị' : 'Chỉ Admin được xuất dữ liệu'} className="w-full px-3 py-2.5 rounded-lg text-left text-xs font-semibold text-slate-700 hover:bg-slate-100 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                    <Download className="w-4 h-4" /> Xuất CSV
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
            {selectedStatus !== 'ALL' && <FilterChip label={`Trạng thái: ${selectedStatus}`} onClear={() => setSelectedStatus('ALL')} />}
            {selectedOwner !== 'ALL' && <FilterChip label={`Sales: ${selectedOwner}`} onClear={() => setSelectedOwner('ALL')} />}
            {selectedSource !== 'ALL' && <FilterChip label={`Nguồn: ${selectedSource}`} onClear={() => setSelectedSource('ALL')} />}
            {selectedGroup !== 'ALL' && <FilterChip label={`Nhóm: ${CUSTOMER_GROUPS[selectedGroup as keyof typeof CUSTOMER_GROUPS]?.name}`} onClear={() => setSelectedGroup('ALL')} />}
            {selectedGender !== 'ALL' && <FilterChip label={`Giới tính: ${selectedGender}`} onClear={() => setSelectedGender('ALL')} />}
            {selectedOptIn !== 'ALL' && <FilterChip label={selectedOptIn === 'optin' ? 'Đã Opt-in' : 'Chưa Opt-in'} onClear={() => setSelectedOptIn('ALL')} />}
            {(startDate || endDate) && <FilterChip label={`Ngày: ${startDate ? formatDate(startDate) : '…'} – ${endDate ? formatDate(endDate) : '…'}`} onClear={clearDateFilters} />}
            <button type="button" onClick={clearAllFilters} className="ml-auto text-[11px] font-semibold text-indigo-600 hover:underline">Xóa tất cả</button>
          </div>
        )}
      </section>

      {selectedCustomerIds.length > 0 && (
        <section className="sticky top-[58px] z-20 bg-slate-900 text-white border border-slate-700 rounded-xl px-4 py-3 shadow-xl flex flex-wrap items-center gap-2">
          <div className="mr-2">
            <div className="text-sm font-bold">Đã chọn {selectedCustomerIds.length} khách hàng</div>
            <div className="text-[11px] text-slate-400">Thao tác áp dụng cho toàn bộ danh sách đã chọn</div>
          </div>
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
            <option value="New Lead">New Lead</option>
            <option value="Contacted">Contacted</option>
            <option value="Quoted">Quoted</option>
            <option value="Won">Won</option>
            <option value="Lost">Lost</option>
          </select>
          <button type="button" onClick={() => exportCustomers(selectedCustomers)} disabled={!isAdmin} className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50">
            <Download className="w-3.5 h-3.5" /> Xuất CSV
          </button>
          <button type="button" onClick={() => setSelectedCustomerIds([])} className="ml-auto px-3 py-2 rounded-lg hover:bg-slate-800 text-xs font-semibold flex items-center gap-1.5">
            <X className="w-4 h-4" /> Bỏ chọn
          </button>
        </section>
      )}

      <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-slate-500">
            Hiển thị <strong className="text-slate-900">{displayedCustomers.length}</strong> / {customers.length} khách hàng
          </p>

        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase text-[10px] tracking-wider font-bold">
                <th className="py-3 px-3 text-center w-10">
                  <input type="checkbox" checked={displayedCustomers.length > 0 && displayedCustomers.every((customer) => selectedCustomerIds.includes(customer.id))} onChange={handleToggleSelectAll} aria-label="Chọn tất cả khách đang hiển thị" className="w-4 h-4 accent-indigo-600" />
                </th>
                <th className="py-3 px-4">Khách hàng</th>
                <th className="py-3 px-3">Số điện thoại</th>
                <th className="py-3 px-3">Nguồn khách</th>
                <th className="py-3 px-3">Trạng thái</th>
                <th className="py-3 px-3">Sales phụ trách</th>
                <th className="py-3 px-4 text-right">Giá trị</th>
                <th className="py-3 px-4 text-center">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {displayedCustomers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-16">
                    <Users className="w-9 h-9 mx-auto text-slate-300" />
                    <div className="mt-3 font-semibold text-slate-600">Không tìm thấy khách hàng phù hợp</div>
                    <button type="button" onClick={clearAllFilters} className="mt-2 text-xs font-semibold text-indigo-600 hover:underline">Xóa bộ lọc và xem tất cả</button>
                  </td>
                </tr>
              ) : displayedCustomers.map((customer) => {
                const isSelected = selectedCustomerIds.includes(customer.id);
                const unread = hasUnreadMessage(customer);
                const group = getCustomerGroup(customer);
                const unassigned = UNASSIGNED_OWNERS.includes(customer.owner || '');
                return (
                  <tr key={customer.id} className={`group transition hover:bg-slate-50 ${isSelected ? 'bg-indigo-50' : ''}`}>
                    <td className="py-3 px-3 text-center">
                      <input type="checkbox" checked={isSelected} onChange={() => handleToggleSelect(customer.id)} aria-label={`Chọn ${customer.name}`} className="w-4 h-4 accent-indigo-600" />
                    </td>
                    <td className="py-3 px-4 min-w-[240px]">
                      <div className="flex items-center gap-3">
                        <img src={customer.avatar || `https://api.dicebear.com/10.x/clay/svg?topProbability=0&patternProbability=0&seed=${encodeURIComponent(customer.phone || customer.name)}`} alt="" className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 object-cover" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <button type="button" onClick={() => onSelectCustomer(customer)} className="font-bold text-slate-900 hover:text-indigo-600 text-sm text-left truncate block max-w-[170px]">{customer.name}</button>
                            <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold shrink-0 ${
                              customer.gender === 'Nam'
                                ? 'bg-sky-50 text-sky-700 border-sky-200'
                                : customer.gender === 'Nữ'
                                  ? 'bg-pink-50 text-pink-700 border-pink-200'
                                  : 'bg-slate-50 text-slate-700 border-slate-200'
                            }`}>
                              {customer.gender === 'Khác' || !customer.gender ? 'Chưa rõ' : customer.gender}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                            <select
                              value={group}
                              onChange={(event) => onUpdateGroup(customer.id, event.target.value as CustomerGroupId)}
                              aria-label={`Phân nhóm CRM của ${customer.name}`}
                              className={`max-w-32 rounded-full px-2 py-0.5 text-[10px] font-bold border focus:outline-none cursor-pointer ${CUSTOMER_GROUPS[group].badgeColor}`}
                            >
                              <option value="group_1">Khách mới</option>
                              <option value="group_2">Đã hỏi giá</option>
                              <option value="group_3">Đã mua 1 lần</option>
                              <option value="group_4">VIP</option>
                            </select>
                            {unread && <SignalBadge label="Chưa đọc" className="bg-teal-50 text-teal-700 border-teal-200" />}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className="font-medium text-slate-800 text-xs">{customer.phone || '—'}</span>
                    </td>
                    <td className="py-3 px-3 min-w-32">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <div className="font-bold text-indigo-700">{customer.source || 'Trực tiếp'}</div>
                        {isCustomerOptedIn(customer) ? (
                          <SignalBadge label="Opt-in" className="bg-emerald-50 text-emerald-700 border-emerald-200" />
                        ) : (
                          <SignalBadge label="No Opt-in" className="bg-rose-50 text-rose-700 border-rose-200" />
                        )}
                      </div>
                      {customer.campaign && !['N/A', 'n/a', 'NA', 'na', 'Default Campaign'].includes(customer.campaign.trim()) && (
                        <div className="mt-0.5 max-w-36 truncate text-[10px] text-slate-500" title={customer.campaign}>
                          {customer.campaign}
                        </div>
                      )}
                      <div className="mt-1 text-[10px] text-slate-400">Lần đầu: {formatDate(customer.firstContact)}</div>
                    </td>
                    <td className="py-3 px-3">
                      <select value={customer.status} onChange={(event) => onUpdateStatus(customer.id, event.target.value as CustomerStatus)} className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold border focus:outline-none cursor-pointer ${getStatusColorClass(customer.status)}`}>
                        <option value="New Lead">New Lead</option>
                        <option value="Contacted">Contacted</option>
                        <option value="Quoted">Quoted</option>
                        <option value="Won">Won</option>
                        <option value="Lost">Lost</option>
                      </select>
                    </td>

                    <td className="py-3 px-3">
                      {unassigned ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200"><UserRoundX className="w-3 h-3" /> Chưa phân công</span>
                      ) : (
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border ${getOwnerBadgeClass(customer.owner)}`}><User className="w-3 h-3" />{customer.owner}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right min-w-[130px]">
                      <div className="font-black text-emerald-700 text-sm">{formatVND(customer.totalSpent)}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{customer.totalOrders} đơn hàng</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-1">
                        <ActionButton title="Mở chat WhatsApp" onClick={() => onOpenChat(customer)}><MessageSquare className="w-4 h-4" /></ActionButton>
                        <ActionButton title="Tạo đơn hàng" onClick={() => onOpenAddOrder(customer)}><ShoppingBag className="w-4 h-4" /></ActionButton>
                        <ActionButton title="Chỉnh sửa khách hàng" onClick={() => onEditCustomer(customer)}><Edit3 className="w-4 h-4" /></ActionButton>
                        <ActionButton title="Xóa khách hàng" onClick={() => onDeleteCustomer(customer.id)} danger><Trash2 className="w-4 h-4" /></ActionButton>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {isImportCsvOpen && (
        <ImportCustomerCsvModal
          isOpen={isImportCsvOpen}
          onClose={() => setIsImportCsvOpen(false)}
          onImportCustomers={(newCustomers) => onImportCustomers?.(newCustomers)}
          existingCustomersCount={customers.length}
        />
      )}
    </div>
  );
};

const FilterChip = ({ label, onClear }: { label: string; onClear: () => void }) => (
  <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-1 text-[11px] font-semibold">
    {label}
    <button type="button" onClick={onClear} aria-label={`Xóa bộ lọc ${label}`} className="hover:text-rose-600"><X className="w-3 h-3" /></button>
  </span>
);

const SignalBadge = ({ label, className }: { label: string; className: string }) => (
  <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${className}`}>{label}</span>
);

const ActionButton = ({ title, onClick, danger = false, children }: { title: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) => (
  <button
    type="button"
    title={title}
    aria-label={title}
    onClick={onClick}
    className={`p-2 rounded-lg transition ${
      danger
        ? 'text-rose-600 hover:bg-rose-50'
        : 'text-slate-600 hover:text-indigo-600 hover:bg-indigo-50'
    }`}
  >
    {children}
  </button>
);
