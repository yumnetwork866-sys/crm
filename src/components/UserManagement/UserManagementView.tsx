import React, { useEffect, useState } from 'react';
import type { AppUser, PermissionDefinition, RolePermissionPolicy, UserRole } from '../../types';
import { api } from '../../utils/apiClient';
import { Permission } from '../../lib/permissions';
import { useAuth } from '../../contexts/AuthContext';
import { formatVND } from '../../utils/crmUtils';
import {
  Users,
  ShieldCheck,
  UserPlus,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Edit2,
  Trash2,
  Phone,
  Award,
  ShieldAlert,
  History,
  Save,
  Loader2,
  AlertCircle,
  RotateCcw,
  ChevronRight
} from 'lucide-react';

interface UserManagementViewProps {
  users: AppUser[];
  currentUser: AppUser | null;
  onAddUser: () => void;
  onEditUser: (user: AppUser) => void;
  onDeleteUser: (userId: string) => Promise<void>;
  onToggleUserStatus: (userId: string) => Promise<void>;
}

export const UserManagementView: React.FC<UserManagementViewProps> = ({
  users,
  currentUser,
  onAddUser,
  onEditUser,
  onDeleteUser,
  onToggleUserStatus,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'accounts' | 'permissions' | 'audit'>('accounts');
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [permissionDefinitions, setPermissionDefinitions] = useState<PermissionDefinition[]>([]);
  const [rolePolicies, setRolePolicies] = useState<RolePermissionPolicy[]>([]);
  const [permissionDrafts, setPermissionDrafts] = useState<Record<string, string>>({});
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [permissionsError, setPermissionsError] = useState('');
  const [savingRole, setSavingRole] = useState<UserRole | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>('Admin');
  const { refreshCurrentUser } = useAuth();

  // Metrics
  const totalUsers = users.length;
  const activeUsers = users.filter((u) => u.status === 'active').length;
  const adminCount = users.filter((u) => u.role === 'Admin' || u.role === 'Sales Manager').length;
  const totalTeamRevenue = users.reduce((sum, u) => sum + (u.totalRevenue || 0), 0);

  // Filtered list
  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;

    return matchesSearch && matchesRole && matchesStatus;
  });

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'Admin':
        return 'bg-purple-100 text-purple-800 border-purple-300 font-extrabold';
      case 'Sales Manager':
        return 'bg-indigo-100 text-indigo-800 border-indigo-300 font-bold';
      case 'Sales Rep':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold';
      case 'Marketing Lead':
        return 'bg-amber-100 text-amber-800 border-amber-300 font-bold';
      case 'Customer Support':
        return 'bg-teal-100 text-teal-800 border-teal-300 font-bold';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  useEffect(() => {
    if (activeSubTab !== 'permissions' || rolePolicies.length > 0) return;
    let cancelled = false;
    setPermissionsLoading(true);
    setPermissionsError('');
    void api.get<{
      definitions: PermissionDefinition[];
      roles: RolePermissionPolicy[];
    }>('/permissions/roles')
      .then((data) => {
        if (cancelled) return;
        setPermissionDefinitions(data.definitions);
        setRolePolicies(data.roles);
        setPermissionDrafts(Object.fromEntries(data.roles.map((policy) => [policy.role, policy.permissions])));
      })
      .catch((error) => {
        if (!cancelled) setPermissionsError(error instanceof Error ? error.message : 'Không thể tải phân quyền.');
      })
      .finally(() => {
        if (!cancelled) setPermissionsLoading(false);
      });
    return () => { cancelled = true; };
  }, [activeSubTab, rolePolicies.length]);

  const togglePermission = (role: UserRole, definition: PermissionDefinition) => {
    if (role === 'Admin' && definition.bit === Permission.USERS_MANAGE.toString()) return;
    setPermissionDrafts((previous) => {
      const current = BigInt(previous[role] || '0');
      return { ...previous, [role]: (current ^ BigInt(definition.bit)).toString() };
    });
  };

  const selectedPolicy = rolePolicies.find((policy) => policy.role === selectedRole);
  const selectedMask = BigInt(permissionDrafts[selectedRole] || '0');
  const selectedRoleIsDirty = Boolean(
    selectedPolicy && permissionDrafts[selectedRole] !== selectedPolicy.permissions
  );

  const permissionGroups = permissionDefinitions.reduce<Array<{ name: string; permissions: PermissionDefinition[] }>>(
    (groups, definition) => {
      const currentGroup = groups.at(-1);
      if (currentGroup?.name === definition.group) currentGroup.permissions.push(definition);
      else groups.push({ name: definition.group, permissions: [definition] });
      return groups;
    },
    []
  );

  const resetRolePermissions = () => {
    if (!selectedPolicy) return;
    setPermissionDrafts((previous) => ({
      ...previous,
      [selectedRole]: selectedPolicy.permissions,
    }));
    setPermissionsError('');
  };

  const runUserAction = (action: () => Promise<void>) => {
    void action().catch((error) => {
      alert(error instanceof Error ? error.message : 'Không thể cập nhật tài khoản.');
    });
  };

  const saveRolePermissions = async (role: UserRole) => {
    setSavingRole(role);
    setPermissionsError('');
    try {
      const updated = await api.put<RolePermissionPolicy>(`/permissions/roles/${encodeURIComponent(role)}`, {
        permissions: permissionDrafts[role],
      });
      setRolePolicies((previous) => previous.map((policy) => policy.role === role ? updated : policy));
      setPermissionDrafts((previous) => ({ ...previous, [role]: updated.permissions }));
      if (currentUser?.role === role) await refreshCurrentUser();
    } catch (error) {
      setPermissionsError(error instanceof Error ? error.message : 'Không thể lưu phân quyền.');
    } finally {
      setSavingRole(null);
    }
  };

  // Static Auth Audit Logs
  const auditLogs = [
    {
      id: 'log-1',
      timestamp: '2026-08-03 16:45:12',
      user: 'Nguyễn Văn Ánh (Admin)',
      action: 'Đăng nhập hệ thống (Auth Login)',
      ip: '113.190.234.12',
      status: 'success',
    },
    {
      id: 'log-2',
      timestamp: '2026-08-03 15:30:00',
      user: 'Nguyễn Văn Ánh (Admin)',
      action: 'Cập nhật mật khẩu tài khoản Sales Rep',
      ip: '113.190.234.12',
      status: 'success',
    },
    {
      id: 'log-3',
      timestamp: '2026-08-03 14:10:45',
      user: 'Trần Thu Hà (Sales Manager)',
      action: 'Đồng bộ dữ liệu Facebook Lead Ads',
      ip: '14.232.109.88',
      status: 'success',
    },
    {
      id: 'log-4',
      timestamp: '2026-08-03 11:05:22',
      user: 'Vũ Thị Hương (Customer Support)',
      action: 'Thử đăng nhập sai mật khẩu (Failed Attempt)',
      ip: '27.72.95.14',
      status: 'warning',
    },
  ];

  return (
    <div className="space-y-6">

      {/* Top Header & Sub-tabs */}
      <div className="bg-white border border-slate-300 rounded-3xl p-6 shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>

          <h1 className="text-2xl font-black text-slate-950 tracking-tight">
            Trung Tâm Quản Trị Auth &amp; Phân Quyền Hệ Thống
          </h1>
        </div>

        {/* Sub-tab Selectors */}
        <div className="flex items-center bg-slate-100 p-1.5 rounded-2xl border border-slate-300 gap-1 self-stretch md:self-auto">
          <button
            onClick={() => setActiveSubTab('accounts')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer ${
              activeSubTab === 'accounts'
                ? 'bg-white text-indigo-700 shadow-sm border border-slate-200'
                : 'text-slate-700 hover:text-slate-950'
            }`}
          >
            <Users className="w-4 h-4" />
            Tài Khoản ({users.length})
          </button>
          <button
            onClick={() => setActiveSubTab('permissions')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer ${
              activeSubTab === 'permissions'
                ? 'bg-white text-indigo-700 shadow-sm border border-slate-200'
                : 'text-slate-700 hover:text-slate-950'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            Phân Quyền
          </button>
          <button
            onClick={() => setActiveSubTab('audit')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer ${
              activeSubTab === 'audit'
                ? 'bg-white text-indigo-700 shadow-sm border border-slate-200'
                : 'text-slate-700 hover:text-slate-950'
            }`}
          >
            <History className="w-4 h-4" />
            Lịch Sử Auth Logs
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: ACCOUNTS & PASSWORDS MANAGEMENT */}
      {activeSubTab === 'accounts' && (
        <>
          {/* Metrics Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-300 p-4 rounded-2xl flex items-center justify-between shadow-sm">
              <div>
                <div className="text-xs font-bold text-slate-600">Tổng Số Thành Viên</div>
                <div className="text-2xl font-black text-slate-950 mt-1">{totalUsers} nhân sự</div>

              </div>
              <div className="p-3 bg-indigo-100 text-indigo-700 rounded-xl border border-indigo-200">
                <Users className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white border border-slate-300 p-4 rounded-2xl flex items-center justify-between shadow-sm">
              <div>
                <div className="text-xs font-bold text-slate-600">Thành Viên Hoạt Động</div>
                <div className="text-2xl font-black text-emerald-700 mt-1">{activeUsers} Active</div>

              </div>
              <div className="p-3 bg-emerald-100 text-emerald-700 rounded-xl border border-emerald-200">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white border border-slate-300 p-4 rounded-2xl flex items-center justify-between shadow-sm">
              <div>
                <div className="text-xs font-bold text-slate-600">Quản Lý &amp; Admin</div>
                <div className="text-2xl font-black text-purple-700 mt-1">{adminCount} nhân sự</div>

              </div>
              <div className="p-3 bg-purple-100 text-purple-700 rounded-xl border border-purple-200">
                <ShieldCheck className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white border border-slate-300 p-4 rounded-2xl flex items-center justify-between shadow-sm">
              <div>
                <div className="text-xs font-bold text-slate-600">Tổng Doanh Thu Đội Ngũ</div>
                <div className="text-2xl font-black text-emerald-700 mt-1">{formatVND(totalTeamRevenue)}</div>

              </div>
              <div className="p-3 bg-emerald-100 text-emerald-700 rounded-xl border border-emerald-200">
                <Award className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Control Bar: Search & Action */}
          <div className="bg-white border border-slate-300 p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm theo tên hoặc email..."
                className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="flex items-center space-x-1.5 text-xs text-slate-700 font-bold">
                <Filter className="w-3.5 h-3.5" />
                <span>Vai Trò:</span>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-bold outline-none"
                >
                  <option value="all">Tất cả vai trò</option>
                  <option value="Admin">Admin</option>
                  <option value="Sales Manager">Sales Manager</option>
                  <option value="Sales Rep">Sales Rep</option>
                  <option value="Marketing Lead">Marketing Lead</option>
                  <option value="Customer Support">Customer Support</option>
                </select>
              </div>

              <div className="flex items-center space-x-1.5 text-xs text-slate-700 font-bold">
                <span>Trạng Thái:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-bold outline-none"
                >
                  <option value="all">Tất cả trạng thái</option>
                  <option value="active">Đang hoạt động (Active)</option>
                  <option value="inactive">Tạm khóa (Inactive)</option>
                </select>
              </div>

              <button
                onClick={onAddUser}
                className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-extrabold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md transition active:scale-95 cursor-pointer ml-auto md:ml-0"
              >
                <UserPlus className="w-4 h-4" />
                <span>+ Thêm Tài Khoản</span>
              </button>
            </div>
          </div>

          {/* User Accounts Table */}
          <div className="bg-white border border-slate-300 rounded-2xl overflow-hidden shadow-lg">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="font-extrabold text-slate-950 text-sm">Danh Sách Tài Khoản Auth System ({filteredUsers.length})</h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 uppercase text-[10px] font-black tracking-wider border-b border-slate-300">
                    <th className="py-3 px-4">Thành Viên</th>
                    <th className="py-3 px-3">Vai Trò</th>
                    <th className="py-3 px-3">Liên Hệ</th>
                    <th className="py-3 px-3 text-right">Đảm nhận</th>
                    <th className="py-3 px-3 text-right">Doanh Số</th>
                    <th className="py-3 px-3 text-center">Trạng Thái</th>
                    <th className="py-3 px-4 text-right">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-900 font-semibold">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500 font-bold">
                        Không tìm thấy tài khoản nhân sự phù hợp.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => {
                      const isCurrent = currentUser?.id === user.id;
                      return (
                        <tr
                          key={user.id}
                          className={`hover:bg-slate-50 transition ${
                            isCurrent ? 'bg-indigo-50/70' : 'bg-white'
                          }`}
                        >
                          {/* Name & Avatar */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center space-x-3">
                              <img
                                src={
                                  user.avatar ||
                                  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'
                                }
                                alt={user.name}
                                className="w-10 h-10 rounded-xl object-cover shrink-0 border border-slate-300 shadow-xs"
                              />
                              <div>
                                <div className="font-extrabold text-slate-950 text-xs flex items-center space-x-2">
                                  <span>{user.name}</span>
                                  {isCurrent && (
                                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-black border border-indigo-300">
                                      Tài Khoản Hiện Tại
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-600 font-medium mt-0.5">{user.email}</div>
                              </div>
                            </div>
                          </td>

                          {/* Role */}
                          <td className="py-3.5 px-3">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] border ${getRoleBadge(
                                user.role
                              )}`}
                            >
                              {user.role}
                            </span>

                          </td>

                          {/* Contact */}
                          <td className="py-3.5 px-3 text-slate-700">
                            <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-900">
                              <Phone className="w-3.5 h-3.5 text-slate-500" />
                              <span>{user.phone || 'Chưa cập nhật'}</span>
                            </div>
                          </td>

                          {/* Assigned Leads */}
                          <td className="py-3.5 px-3 text-right font-black text-slate-950">
                            {user.assignedLeadsCount || 0} khách
                          </td>

                          {/* Revenue */}
                          <td className="py-3.5 px-3 text-right font-black text-emerald-700">
                            {formatVND(user.totalRevenue || 0)}
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-3 text-center">
                            <button
                              onClick={() => runUserAction(() => onToggleUserStatus(user.id))}
                              className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full text-[10px] font-black border transition cursor-pointer ${
                                user.status === 'active'
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200'
                                  : 'bg-rose-100 text-rose-800 border-rose-300 hover:bg-rose-200'
                              }`}
                            >
                              {user.status === 'active' ? (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Active</span>
                                </>
                              ) : (
                                <>
                                  <XCircle className="w-3.5 h-3.5" />
                                  <span>Inactive</span>
                                </>
                              )}
                            </button>
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end space-x-1.5">

                              <button
                                onClick={() => onEditUser(user)}
                                className="p-1.5 rounded-lg text-slate-700 hover:text-indigo-600 hover:bg-slate-100 border border-slate-200 transition cursor-pointer"
                                title="Sửa thông tin / Đổi mật khẩu"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => runUserAction(() => onDeleteUser(user.id))}
                                className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 border border-rose-200 transition cursor-pointer"
                                title="Xóa tài khoản"
                              >
                                <Trash2 className="w-4 h-4" />
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
        </>
      )}

      {/* SUB-TAB 2: ROLE PERMISSION MATRIX */}
      {activeSubTab === 'permissions' && (
        <div className="overflow-hidden rounded-3xl border border-slate-300 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h2 className="text-lg font-black text-slate-950">Phân Quyền Vai Trò</h2>
            </div>
            {!permissionsLoading && permissionDefinitions.length > 0 && (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-extrabold text-slate-600">
                {permissionDefinitions.length} quyền
              </span>
            )}
          </div>

          {permissionsError && (
            <div className="mx-5 mt-5 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700 sm:mx-6">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {permissionsError}
            </div>
          )}

          {permissionsLoading ? (
            <div className="flex items-center justify-center gap-2 py-20 text-sm font-bold text-slate-600">
              <Loader2 className="h-5 w-5 animate-spin" /> Đang tải phân quyền...
            </div>
          ) : (
            <div className="grid min-h-150 lg:grid-cols-[260px_minmax(0,1fr)]">
              <aside className="border-b border-slate-200 bg-slate-50/80 p-3 lg:border-r lg:border-b-0">
                <div className="flex gap-2 overflow-x-auto pb-1 lg:block lg:space-y-1 lg:overflow-visible">
                  {rolePolicies.map((policy) => {
                    const role = policy.role;
                    const active = selectedRole === role;
                    const dirty = permissionDrafts[role] !== policy.permissions;
                    return (
                      <button
                        key={role}
                        type="button"
                        onClick={() => setSelectedRole(role)}
                        className={`group flex min-w-52 items-center gap-3 rounded-xl border px-3 py-3 text-left transition lg:min-w-0 lg:w-full ${
                          active
                            ? 'border-indigo-200 bg-white text-indigo-800 shadow-sm'
                            : 'border-transparent text-slate-700 hover:border-slate-200 hover:bg-white'
                        }`}
                      >
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-sm font-black ${getRoleBadge(role)}`}>
                          {role.charAt(0)}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-xs font-extrabold">{role}</span>
                        {dirty ? (
                          <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" title="Chưa lưu" />
                        ) : (
                          <ChevronRight className={`h-4 w-4 shrink-0 ${active ? 'text-indigo-500' : 'text-slate-300'}`} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </aside>

              <section className="relative bg-slate-50/30 p-4 sm:p-6">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-black text-slate-950">{selectedRole}</h3>
                    {selectedRoleIsDirty && (
                      <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                        Chưa lưu
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-4 pb-20">
                  {permissionGroups.map((group) => (
                    <div key={group.name} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                      <div className="border-b border-slate-100 bg-slate-50 px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-500">
                        {group.name}
                      </div>
                      <div className="divide-y divide-slate-100">
                        {group.permissions.map((definition) => {
                          const enabled = (selectedMask & BigInt(definition.bit)) === BigInt(definition.bit);
                          const locked = selectedRole === 'Admin' && definition.bit === Permission.USERS_MANAGE.toString();
                          return (
                            <button
                              key={definition.key}
                              type="button"
                              role="switch"
                              aria-checked={enabled}
                              disabled={locked || savingRole !== null}
                              onClick={() => togglePermission(selectedRole, definition)}
                              className="flex w-full items-center gap-4 px-4 py-3.5 text-left transition hover:bg-slate-50 disabled:cursor-not-allowed"
                              title={locked ? 'Admin phải giữ quyền quản lý tài khoản.' : undefined}
                            >
                              <span className="min-w-0 flex-1 text-xs font-extrabold text-slate-800">
                                {definition.label}
                              </span>
                              {locked && (
                                <span className="hidden text-[10px] font-bold text-slate-400 sm:inline">Bắt buộc</span>
                              )}
                              <span
                                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                                  enabled ? 'bg-indigo-600' : 'bg-slate-300'
                                } ${locked ? 'opacity-60' : ''}`}
                              >
                                <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                                  enabled ? 'translate-x-6' : 'translate-x-1'
                                }`} />
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {selectedRoleIsDirty && (
                  <div className="sticky bottom-4 z-10 flex flex-col gap-3 rounded-2xl border border-indigo-200 bg-white px-4 py-3 shadow-2xl sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-xs font-bold text-slate-800">Bạn có thay đổi chưa lưu</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={savingRole !== null}
                        onClick={resetRolePermissions}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-extrabold text-slate-600 transition hover:bg-slate-100 sm:flex-none"
                      >
                        <RotateCcw className="h-4 w-4" /> Hoàn tác
                      </button>
                      <button
                        type="button"
                        disabled={savingRole !== null}
                        onClick={() => void saveRolePermissions(selectedRole)}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-extrabold text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-60 sm:flex-none"
                      >
                        {savingRole === selectedRole ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        {savingRole === selectedRole ? 'Đang lưu...' : 'Lưu thay đổi'}
                      </button>
                    </div>
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 3: AUTH SECURITY LOGS */}
      {activeSubTab === 'audit' && (
        <div className="bg-white border border-slate-300 rounded-3xl p-6 shadow-lg space-y-6">
          <div className="border-b border-slate-200 pb-4 flex justify-between items-center">
            <div>
              <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
                <History className="w-5 h-5 text-indigo-600" />
                Nhật Ký Bảo Mật &amp; Đăng Nhập (Auth Audit Logs)
              </h2>

            </div>
            <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black border border-emerald-300">
              Live Monitoring Active
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border border-slate-300 rounded-2xl overflow-hidden">
              <thead>
                <tr className="bg-slate-100 text-slate-800 font-black text-[10px] uppercase tracking-wider border-b border-slate-300">
                  <th className="p-3.5">Thời Gian</th>
                  <th className="p-3.5">Tài Khoản Thao Tác</th>
                  <th className="p-3.5">Sự Kiện Auth / Thao Tác</th>
                  <th className="p-3.5">Địa Chỉ IP</th>
                  <th className="p-3.5 text-center">Trạng Thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-900 font-semibold">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="p-3.5 text-slate-600 font-mono font-bold">{log.timestamp}</td>
                    <td className="p-3.5 font-extrabold text-slate-950">{log.user}</td>
                    <td className="p-3.5 font-bold text-slate-900">{log.action}</td>
                    <td className="p-3.5 font-mono text-slate-600">{log.ip}</td>
                    <td className="p-3.5 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black border ${
                          log.status === 'success'
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : 'bg-rose-100 text-rose-800 border-rose-300'
                        }`}
                      >
                        {log.status === 'success' ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Success
                          </>
                        ) : (
                          <>
                            <ShieldAlert className="w-3 h-3 text-rose-600" />
                            Warning
                          </>
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};
