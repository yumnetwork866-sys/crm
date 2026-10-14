import React, { useMemo, useState } from 'react';
import type { AppUser, CentralMessage, Customer, CustomerGroupId, CustomerStatus } from '../../types';
import type { BusinessPhoneNumber } from '../../features/messages/types';
import {
  CUSTOMER_GROUPS,
  formatDate,
  getCustomerGroup,
  isSamePhoneNumber,
} from '../../utils/crmUtils';
import type { CustomerFilterModel } from '../../hooks/useCustomers';
import { ImportCustomerCsvModal } from '../CsvImport/ImportCustomerCsvModal';
import { UserInfoModal } from '../Common/UserInfoModal';
import { useAuth } from '../../contexts/AuthContext';
import { Permission } from '../../lib/permissions';
import { CustomerFilterBar, type WorkQueueFilter } from './components/CustomerFilterBar';
import { CustomerTable, type CustomerWhatsAppSourceInfo } from './components/CustomerTable';

interface CustomerListProps {
  customers: Customer[];
  centralMessages?: CentralMessage[];
  businessPhones?: BusinessPhoneNumber[];
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

const KNOWN_WHATSAPP_BRANDS: Record<string, { name: string; displayPhone: string; color: 'emerald' | 'purple' | 'blue' }> = {
  '1412496995272289': { name: 'Actiscar', displayPhone: '+60 11-5551 9250', color: 'emerald' },
  '1409649928889874': { name: 'Follicas', displayPhone: '+60 11-1096 6954', color: 'purple' },
  '1311189322067725': { name: 'Yum Network', displayPhone: '+60 11-1071 6895', color: 'blue' },
};

export const CustomerList: React.FC<CustomerListProps> = ({
  customers,
  centralMessages = [],
  businessPhones = [],
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
  const { hasPermission, users } = useAuth();
  const isAdmin = hasPermission(Permission.CUSTOMERS_EXPORT);
  const [isImportCsvOpen, setIsImportCsvOpen] = useState(false);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [workQueueFilter, setWorkQueueFilter] = useState<WorkQueueFilter>('all');
  const [selectedOwnerUser, setSelectedOwnerUser] = useState<AppUser | null>(null);

  const {
    setSearchQuery,
    setSelectedStatus,
    setSelectedSource,
    setSelectedGender,
    setSelectedGroup,
    setSelectedOwner,
    setStartDate,
    setEndDate,
    filteredCustomers,
  } = filterModel;

  const sources = useMemo(() => Array.from(new Set(customers.map((c) => c.source))).sort(), [customers]);
  const owners = useMemo(
    () => Array.from(new Set([
      ...users.filter((user) => user.status === 'active').map((user) => user.name),
      ...customers.map((customer) => customer.owner),
    ].filter((owner) => owner && !UNASSIGNED_OWNERS.includes(owner)))).sort((a, b) => a.localeCompare(b, 'vi')),
    [customers, users]
  );

  const customerWhatsAppSourceMap = useMemo(() => {
    const map = new Map<string, CustomerWhatsAppSourceInfo>();

    const phoneIdToInfo = new Map<string, { name: string; displayPhone: string; color: 'emerald' | 'purple' | 'blue' }>();
    for (const [id, info] of Object.entries(KNOWN_WHATSAPP_BRANDS)) {
      phoneIdToInfo.set(id, info);
    }
    if (businessPhones) {
      for (const bp of businessPhones) {
        const known = phoneIdToInfo.get(bp.id);
        const name = bp.verifiedName || known?.name || 'WhatsApp';
        const lower = name.toLowerCase();
        const color: 'emerald' | 'purple' | 'blue' = lower.includes('follicas') ? 'purple' : lower.includes('yum') ? 'blue' : 'emerald';
        phoneIdToInfo.set(bp.id, {
          name,
          displayPhone: bp.displayPhoneNumber || known?.displayPhone || '',
          color,
        });
      }
    }

    const msgsByCustId = new Map<string, Set<string>>();
    const msgsByPhoneSuffix = new Map<string, Set<string>>();

    if (centralMessages) {
      for (const msg of centralMessages) {
        if (!msg.businessPhoneNumberId) continue;
        if (msg.customerId) {
          if (!msgsByCustId.has(msg.customerId)) msgsByCustId.set(msg.customerId, new Set());
          msgsByCustId.get(msg.customerId)!.add(msg.businessPhoneNumberId);
        }
        const cleanPhone = (msg.customerPhone || '').replace(/\D/g, '');
        if (cleanPhone.length >= 7) {
          const suffix = cleanPhone.slice(-9);
          if (!msgsByPhoneSuffix.has(suffix)) msgsByPhoneSuffix.set(suffix, new Set());
          msgsByPhoneSuffix.get(suffix)!.add(msg.businessPhoneNumberId);
        }
      }
    }

    for (const customer of customers) {
      const isWhatsApp = (customer.source || '').toLowerCase().includes('whatsapp');
      if (!isWhatsApp) continue;

      const brandPhoneIds = new Set<string>();
      const fromId = msgsByCustId.get(customer.id);
      if (fromId) fromId.forEach((id) => brandPhoneIds.add(id));

      const cleanPhone = (customer.phone || '').replace(/\D/g, '');
      if (cleanPhone.length >= 7) {
        const fromPhone = msgsByPhoneSuffix.get(cleanPhone.slice(-9));
        if (fromPhone) fromPhone.forEach((id) => brandPhoneIds.add(id));
      }

      const brands: Array<{ name: string; displayPhone?: string; color: 'emerald' | 'purple' | 'blue' }> = [];
      for (const phoneId of brandPhoneIds) {
        const info = phoneIdToInfo.get(phoneId);
        if (info && !brands.some((b) => b.name === info.name)) {
          brands.push(info);
        }
      }

      if (customer.campaign) {
        const trimmed = customer.campaign.trim();
        const lower = trimmed.toLowerCase();
        if (!['n/a', 'na', 'default campaign', ''].includes(lower)) {
          if (lower.includes('actiscar')) {
            if (!brands.some((b) => b.name.toLowerCase().includes('actiscar'))) {
              brands.push({ name: 'Actiscar', displayPhone: '+60 11-5551 9250', color: 'emerald' });
            }
          } else if (lower.includes('follicas')) {
            if (!brands.some((b) => b.name.toLowerCase().includes('follicas'))) {
              brands.push({ name: 'Follicas', displayPhone: '+60 11-1096 6954', color: 'purple' });
            }
          } else if (lower.includes('yum')) {
            if (!brands.some((b) => b.name.toLowerCase().includes('yum'))) {
              brands.push({ name: 'Yum Network', displayPhone: '+60 11-1071 6895', color: 'blue' });
            }
          } else {
            const matchedBp = businessPhones?.find((bp) => bp.verifiedName.toLowerCase() === lower);
            if (matchedBp && !brands.some((b) => b.name === matchedBp.verifiedName)) {
              brands.push({
                name: matchedBp.verifiedName,
                displayPhone: matchedBp.displayPhoneNumber,
                color: 'emerald',
              });
            }
          }
        }
      }

      map.set(customer.id, { brands });
    }

    return map;
  }, [customers, centralMessages, businessPhones]);

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

  const clearAllFilters = () => {
    setSearchQuery('');
    setSelectedStatus('ALL');
    setSelectedSource('ALL');
    setSelectedGender('ALL');
    setSelectedGroup('ALL');
    setSelectedOwner('ALL');
    setStartDate('');
    setEndDate('');
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
      'TotalOrders', 'TotalSpentVND',
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
    ]);
    const csvContent = `data:text/csv;charset=utf-8,\uFEFF${[headers.join(','), ...rows.map((row) => row.join(','))].join('\n')}`;
    const link = document.createElement('a');
    link.href = encodeURI(csvContent);
    link.download = `YumNetworkCRM_KhachHang_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const selectedCustomers = customers.filter((customer) => selectedCustomerIds.includes(customer.id));

  return (
    <div className="space-y-4">
      <CustomerFilterBar
        filterModel={filterModel}
        workQueueFilter={workQueueFilter}
        setWorkQueueFilter={setWorkQueueFilter}
        queueCounts={queueCounts}
        sources={sources}
        owners={owners}
        isAdmin={isAdmin}
        displayedCustomers={displayedCustomers}
        selectedCustomerIds={selectedCustomerIds}
        setSelectedCustomerIds={setSelectedCustomerIds}
        selectedCustomers={selectedCustomers}
        onOpenAddModal={onOpenAddModal}
        onOpenImportCsv={() => setIsImportCsvOpen(true)}
        onExportCustomers={exportCustomers}
        onUpdateOwner={onUpdateOwner}
        onUpdateStatus={onUpdateStatus}
        clearAllFilters={clearAllFilters}
      />

      <CustomerTable
        customersTotalCount={customers.length}
        displayedCustomers={displayedCustomers}
        selectedCustomerIds={selectedCustomerIds}
        users={users}
        currentUser={currentUser}
        unassignedOwners={UNASSIGNED_OWNERS}
        customerWhatsAppSourceMap={customerWhatsAppSourceMap}
        hasUnreadMessage={hasUnreadMessage}
        onToggleSelectAll={handleToggleSelectAll}
        onToggleSelect={handleToggleSelect}
        onClearAllFilters={clearAllFilters}
        onSelectCustomer={onSelectCustomer}
        onEditCustomer={onEditCustomer}
        onDeleteCustomer={onDeleteCustomer}
        onOpenAddOrder={onOpenAddOrder}
        onOpenChat={onOpenChat}
        onUpdateStatus={onUpdateStatus}
        onUpdateGroup={onUpdateGroup}
        onSelectOwnerUser={(user) => setSelectedOwnerUser(user)}
      />

      <UserInfoModal user={selectedOwnerUser} onClose={() => setSelectedOwnerUser(null)} />

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
