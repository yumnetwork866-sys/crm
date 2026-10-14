import React from 'react';
import {
  Edit3,
  MessageSquare,
  ShoppingBag,
  Trash2,
  UserRoundX,
  Users,
} from 'lucide-react';
import type { AppUser, Customer, CustomerGroupId, CustomerStatus } from '../../../types';
import {
  CUSTOMER_GROUPS,
  formatDate,
  formatVND,
  getCustomerGroup,
  getCustomerAvatar,
  getOwnerAvatar,
  getDiceBearAvatar,
  STAFF_DICEBEAR_STYLE,
  getStatusColorClass,
} from '../../../utils/crmUtils';
import { findUserByName, getUserRoleTextStyle } from '../../../utils/roleColors';

export interface CustomerWhatsAppSourceInfo {
  brands: Array<{ name: string; displayPhone?: string; color: 'emerald' | 'purple' | 'blue' }>;
}

interface CustomerTableProps {
  customersTotalCount: number;
  displayedCustomers: Customer[];
  selectedCustomerIds: string[];
  users: AppUser[];
  currentUser?: AppUser | null;
  unassignedOwners: string[];
  customerWhatsAppSourceMap: Map<string, CustomerWhatsAppSourceInfo>;
  hasUnreadMessage: (customer: Customer) => boolean;
  onToggleSelectAll: () => void;
  onToggleSelect: (id: string) => void;
  onClearAllFilters: () => void;
  onSelectCustomer: (customer: Customer) => void;
  onEditCustomer: (customer: Customer) => void;
  onDeleteCustomer: (id: string) => void;
  onOpenAddOrder: (customer: Customer) => void;
  onOpenChat: (customer: Customer) => void;
  onUpdateStatus: (customerId: string, status: CustomerStatus) => void;
  onUpdateGroup: (customerId: string, group: CustomerGroupId) => void;
  onSelectOwnerUser: (user: AppUser) => void;
}

const SignalBadge = ({ label, className }: { label: string; className: string }) => (
  <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${className}`}>{label}</span>
);

const ActionButton = ({
  title,
  onClick,
  danger = false,
  children,
}: {
  title: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) => (
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

export const CustomerTable: React.FC<CustomerTableProps> = ({
  customersTotalCount,
  displayedCustomers,
  selectedCustomerIds,
  users,
  currentUser,
  unassignedOwners,
  customerWhatsAppSourceMap,
  hasUnreadMessage,
  onToggleSelectAll,
  onToggleSelect,
  onClearAllFilters,
  onSelectCustomer,
  onEditCustomer,
  onDeleteCustomer,
  onOpenAddOrder,
  onOpenChat,
  onUpdateStatus,
  onUpdateGroup,
  onSelectOwnerUser,
}) => {
  return (
    <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          Hiển thị <strong className="text-slate-900">{displayedCustomers.length}</strong> / {customersTotalCount} khách hàng
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase text-[10px] tracking-wider font-bold">
              <th className="py-3 px-3 text-center w-10">
                <input
                  type="checkbox"
                  checked={displayedCustomers.length > 0 && displayedCustomers.every((customer) => selectedCustomerIds.includes(customer.id))}
                  onChange={onToggleSelectAll}
                  aria-label="Chọn tất cả khách đang hiển thị"
                  className="w-4 h-4 accent-indigo-600"
                />
              </th>
              <th className="py-3 px-4">Khách hàng</th>
              <th className="py-3 px-3">Số điện thoại</th>
              <th className="py-3 px-3">Nguồn khách</th>
              <th className="py-3 px-3">Trạng thái</th>
              <th className="py-3 px-3">Phụ trách</th>
              <th className="py-3 px-4 text-right">Đơn hàng</th>
              <th className="py-3 px-4 text-center">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {displayedCustomers.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-16">
                  <Users className="w-9 h-9 mx-auto text-slate-300" />
                  <div className="mt-3 font-semibold text-slate-600">Không tìm thấy khách hàng phù hợp</div>
                  <button type="button" onClick={onClearAllFilters} className="mt-2 text-xs font-semibold text-indigo-600 hover:underline">
                    Xóa bộ lọc và xem tất cả
                  </button>
                </td>
              </tr>
            ) : (
              displayedCustomers.map((customer) => {
                const isSelected = selectedCustomerIds.includes(customer.id);
                const unread = hasUnreadMessage(customer);
                const group = getCustomerGroup(customer);
                const unassigned = unassignedOwners.includes(customer.owner || '');
                const ownerUser = findUserByName(users, customer.owner)
                  ?? (currentUser?.name === customer.owner ? currentUser : undefined);

                return (
                  <tr key={customer.id} className={`group transition hover:bg-slate-50 ${isSelected ? 'bg-indigo-50' : ''}`}>
                    <td className="py-3 px-3 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSelect(customer.id)}
                        aria-label={`Chọn ${customer.name}`}
                        className="w-4 h-4 accent-indigo-600"
                      />
                    </td>
                    <td className="py-3 px-4 min-w-60">
                      <div className="flex items-center gap-3">
                        <img
                          src={getCustomerAvatar(customer.avatar, customer.phone || customer.name)}
                          alt=""
                          className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 object-cover"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              type="button"
                              onClick={() => onSelectCustomer(customer)}
                              className="font-bold text-slate-900 hover:text-indigo-600 text-sm text-left truncate block max-w-[170px]"
                            >
                              {customer.name}
                            </button>
                            <span
                              className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold shrink-0 ${
                                customer.gender === 'Nam'
                                  ? 'bg-sky-50 text-sky-700 border-sky-200'
                                  : customer.gender === 'Nữ'
                                    ? 'bg-pink-50 text-pink-700 border-pink-200'
                                    : 'bg-slate-50 text-slate-700 border-slate-200'
                              }`}
                            >
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
                      <span className="font-medium text-slate-800 text-xs">
                        {customer.phone || customer.whatsappRecipientId || '—'}
                      </span>
                    </td>
                    <td className="py-3 px-3 min-w-36">
                      {(() => {
                        const isWhatsApp = (customer.source || '').toLowerCase().includes('whatsapp');
                        const waInfo = isWhatsApp ? customerWhatsAppSourceMap.get(customer.id) : null;
                        const brands = waInfo?.brands || [];
                        const isBrandInCampaign = brands.some((b) => b.name.toLowerCase() === (customer.campaign || '').trim().toLowerCase());
                        const displayCampaign = (!isBrandInCampaign && customer.campaign && !['N/A', 'n/a', 'NA', 'na', 'Default Campaign'].includes(customer.campaign.trim()))
                          ? customer.campaign.trim()
                          : null;

                        if (isWhatsApp) {
                          return (
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-[#1fa855] text-xs">
                                  WhatsApp
                                </span>
                                {brands.map((b) => {
                                  const badgeStyle = b.color === 'purple'
                                    ? 'bg-purple-50 text-purple-700 border-purple-200'
                                    : b.color === 'blue'
                                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                                      : 'bg-emerald-50 text-emerald-700 border-emerald-200';
                                  return (
                                    <span
                                      key={b.name}
                                      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${badgeStyle}`}
                                      title={b.displayPhone ? `${b.name} (${b.displayPhone})` : b.name}
                                    >
                                      {b.name}
                                    </span>
                                  );
                                })}
                              </div>
                              {brands.length > 0 && brands.some((b) => b.displayPhone) && (
                                <div className="text-[10px] text-slate-500 font-mono">
                                  {brands.map((b) => b.displayPhone).filter(Boolean).join(' • ')}
                                </div>
                              )}
                              {displayCampaign && (
                                <div className="mt-0.5 max-w-36 truncate text-[10px] text-slate-500" title={displayCampaign}>
                                  {displayCampaign}
                                </div>
                              )}
                              <div className="mt-0.5 text-[10px] text-slate-400">Lần đầu: {formatDate(customer.firstContact)}</div>
                            </div>
                          );
                        }

                        return (
                          <div className="flex flex-col gap-0.5">
                            <div className="font-bold text-indigo-700">{customer.source || 'Trực tiếp'}</div>
                            {customer.campaign && !['N/A', 'n/a', 'NA', 'na', 'Default Campaign'].includes(customer.campaign.trim()) && (
                              <div className="mt-0.5 max-w-36 truncate text-[10px] text-slate-500" title={customer.campaign}>
                                {customer.campaign}
                              </div>
                            )}
                            <div className="mt-0.5 text-[10px] text-slate-400">Lần đầu: {formatDate(customer.firstContact)}</div>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="py-3 px-3">
                      <select
                        value={customer.status}
                        onChange={(event) => onUpdateStatus(customer.id, event.target.value as CustomerStatus)}
                        className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold border focus:outline-none cursor-pointer ${getStatusColorClass(customer.status)}`}
                      >
                        <option value="New Lead">New Lead</option>
                        <option value="Contacted">Contacted</option>
                        <option value="Quoted">Quoted</option>
                        <option value="Won">Won</option>
                        <option value="Lost">Lost</option>
                      </select>
                    </td>

                    <td className="py-3 px-3 min-w-[200px]">
                      {unassigned ? (
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                            <UserRoundX className="w-4 h-4" />
                          </div>
                          <span className="text-sm font-medium text-slate-400">Chưa phân công</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <img
                            src={ownerUser?.avatar || getOwnerAvatar(customer.owner)}
                            alt={ownerUser?.name || customer.owner}
                            className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 object-cover shrink-0"
                            onError={(e) => {
                              e.currentTarget.src = getDiceBearAvatar(customer.owner, STAFF_DICEBEAR_STYLE);
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => ownerUser && onSelectOwnerUser(ownerUser)}
                            disabled={!ownerUser}
                            title={ownerUser ? `Xem thông tin ${ownerUser.name}` : undefined}
                            className="whitespace-nowrap text-sm font-bold hover:underline disabled:cursor-default disabled:no-underline"
                            style={getUserRoleTextStyle(ownerUser)}
                          >
                            {ownerUser?.name || customer.owner}
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right min-w-[130px]">
                      <div className="font-black text-emerald-700 text-sm">{formatVND(customer.totalSpent)}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{customer.totalOrders} đơn hàng</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-1">
                        <ActionButton title="Mở chat WhatsApp" onClick={() => onOpenChat(customer)}>
                          <MessageSquare className="w-4 h-4" />
                        </ActionButton>
                        <ActionButton title="Tạo đơn hàng" onClick={() => onOpenAddOrder(customer)}>
                          <ShoppingBag className="w-4 h-4" />
                        </ActionButton>
                        <ActionButton title="Chỉnh sửa khách hàng" onClick={() => onEditCustomer(customer)}>
                          <Edit3 className="w-4 h-4" />
                        </ActionButton>
                        <ActionButton title="Xóa khách hàng" onClick={() => onDeleteCustomer(customer.id)} danger>
                          <Trash2 className="w-4 h-4" />
                        </ActionButton>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};
