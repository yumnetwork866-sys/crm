import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { AppUser, PermissionDefinition, RolePermissionPolicy, UserRole } from '../../types';
import { api } from '../../utils/apiClient';
import { Permission } from '../../lib/permissions';
import { useAuth } from '../../contexts/AuthContext';
import { formatVND } from '../../utils/crmUtils';
import {
  cacheRoleColors,
  getRoleColor as getCachedRoleColor,
  loadRoleColorCache,
} from '../../utils/roleColors';
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
  ChevronRight,
  Plus,
  X,
  Check,
} from 'lucide-react';

const ROLE_COLOR_PRESETS = [
  '#e11d48',
  '#d97706',
  '#2563eb',
  '#059669',
  '#9333ea',
  '#db2777',
  '#ea580c',
  '#0891b2',
  '#4f46e5',
  '#475569',
] as const;
const FALLBACK_ROLE_COLOR = '#475569';

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
  const location = useLocation();
  const navigate = useNavigate();

  const activeSubTab = useMemo<'accounts' | 'permissions' | 'audit'>(() => {
    const segments = location.pathname.replace(/^\//, '').split('/');
    if (segments[0] === 'users') {
      const sub = segments[1];
      if (sub === 'permissions') return 'permissions';
      if (sub === 'logs' || sub === 'audit') return 'audit';
      if (sub === 'accounts') return 'accounts';
    }
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    if (tabParam === 'permissions') return 'permissions';
    if (tabParam === 'logs' || tabParam === 'audit') return 'audit';
    return 'accounts';
  }, [location.pathname, location.search]);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [permissionDefinitions, setPermissionDefinitions] = useState<PermissionDefinition[]>([]);
  const [rolePolicies, setRolePolicies] = useState<RolePermissionPolicy[]>([]);
  const [permissionDrafts, setPermissionDrafts] = useState<Record<string, string>>({});
  const [roleColorDrafts, setRoleColorDrafts] = useState<Record<string, string>>(loadRoleColorCache);
  const [paletteColors, setPaletteColors] = useState<string[]>([...ROLE_COLOR_PRESETS]);
  const customColorInputRef = React.useRef<HTMLInputElement>(null);
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [permissionsError, setPermissionsError] = useState('');
  const [savingRole, setSavingRole] = useState<UserRole | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>('Admin');
  const [roleEditorMode, setRoleEditorMode] = useState<'create' | 'rename' | null>(null);
  const [roleName, setRoleName] = useState('');
  const [roleActionLoading, setRoleActionLoading] = useState(false);
  const { refreshCurrentUser, refreshUsers } = useAuth();

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

  const getRoleColor = (role: UserRole) =>
    roleColorDrafts[role]
    ?? rolePolicies.find((policy) => policy.role === role)?.color
    ?? getCachedRoleColor(role);

  const getRoleTextStyle = (role: UserRole): React.CSSProperties => {
    const color = getRoleColor(role);
    return {
      color,
      WebkitTextFillColor: color,
    };
  };

  const getRoleBadgeStyle = (role: UserRole): React.CSSProperties => {
    const color = getRoleColor(role);
    return {
      ...getRoleTextStyle(role),
      borderColor: `${color}55`,
      backgroundColor: `${color}18`,
    };
  };

  useEffect(() => {
    if (rolePolicies.length > 0) return;
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
        cacheRoleColors(Object.fromEntries(data.roles.map((policy) => [policy.role, policy.color])));
        setRolePolicies(data.roles);
        setPermissionDrafts(Object.fromEntries(data.roles.map((policy) => [policy.role, policy.permissions])));
        setRoleColorDrafts(Object.fromEntries(data.roles.map((policy) => [policy.role, policy.color])));
        setPaletteColors((current) => Array.from(new Set([
          ...current,
          ...data.roles.map((policy) => policy.color.toLowerCase()),
        ])));
        if (!data.roles.some((policy) => policy.role === selectedRole) && data.roles[0]) {
          setSelectedRole(data.roles[0].role);
        }
      })
      .catch((error) => {
        if (!cancelled) setPermissionsError(error instanceof Error ? error.message : 'Không thể tải phân quyền.');
      })
      .finally(() => {
        if (!cancelled) setPermissionsLoading(false);
      });
    return () => { cancelled = true; };
  }, [rolePolicies.length, selectedRole]);

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
    selectedPolicy && (
      permissionDrafts[selectedRole] !== selectedPolicy.permissions
      || roleColorDrafts[selectedRole] !== selectedPolicy.color
    )
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
    setRoleColorDrafts((previous) => ({
      ...previous,
      [selectedRole]: selectedPolicy.color,
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
        color: roleColorDrafts[role] ?? FALLBACK_ROLE_COLOR,
      });
      setRolePolicies((previous) => previous.map((policy) => policy.role === role ? updated : policy));
      setPermissionDrafts((previous) => ({ ...previous, [role]: updated.permissions }));
      setRoleColorDrafts((previous) => ({ ...previous, [role]: updated.color }));
      cacheRoleColors({ [role]: updated.color });
      await refreshUsers();
      if (currentUser?.role === role) await refreshCurrentUser();
    } catch (error) {
      setPermissionsError(error instanceof Error ? error.message : 'Không thể lưu phân quyền.');
    } finally {
      setSavingRole(null);
    }
  };

  const openCreateRole = () => {
    setRoleEditorMode('create');
    setRoleName('');
    setPermissionsError('');
  };

  const openRenameRole = () => {
    setRoleEditorMode('rename');
    setRoleName(selectedRole);
    setPermissionsError('');
  };

  const submitRoleEditor = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!roleName.trim()) return;
    setRoleActionLoading(true);
    setPermissionsError('');
    try {
      if (roleEditorMode === 'create') {
        const created = await api.post<RolePermissionPolicy>('/permissions/roles', { name: roleName });
        setRolePolicies((previous) => [...previous, created].sort((a, b) => a.role.localeCompare(b.role)));
        setPermissionDrafts((previous) => ({ ...previous, [created.role]: created.permissions }));
        setRoleColorDrafts((previous) => ({ ...previous, [created.role]: created.color }));
        cacheRoleColors({ [created.role]: created.color });
        setSelectedRole(created.role);
      } else if (roleEditorMode === 'rename') {
        const previousRole = selectedRole;
        const updated = await api.patch<RolePermissionPolicy>(
          `/permissions/roles/${encodeURIComponent(previousRole)}`,
          { name: roleName },
        );
        setRolePolicies((previous) => previous
          .map((policy) => policy.role === previousRole ? updated : policy)
          .sort((a, b) => a.role.localeCompare(b.role)));
        setPermissionDrafts((previous) => {
          const { [previousRole]: oldDraft, ...remaining } = previous;
          return { ...remaining, [updated.role]: oldDraft ?? updated.permissions };
        });
        setRoleColorDrafts((previous) => {
          const { [previousRole]: oldColor, ...remaining } = previous;
          const nextColor = oldColor ?? updated.color;
          cacheRoleColors({ [updated.role]: nextColor });
          return { ...remaining, [updated.role]: nextColor };
        });
        setSelectedRole(updated.role);
        await refreshUsers();
        if (currentUser?.role === previousRole) await refreshCurrentUser();
      }
      setRoleEditorMode(null);
      setRoleName('');
    } catch (error) {
      setPermissionsError(error instanceof Error ? error.message : 'Không thể cập nhật vai trò.');
    } finally {
      setRoleActionLoading(false);
    }
  };

  const deleteSelectedRole = async () => {
    const policy = rolePolicies.find((item) => item.role === selectedRole);
    if (!policy || selectedRole === 'Admin') return;
    if (policy.userCount > 0) {
      setPermissionsError(`Vai trò đang được gán cho ${policy.userCount} tài khoản. Hãy chuyển các tài khoản sang vai trò khác trước khi xóa.`);
      return;
    }
    if (!confirm(`Xóa vai trò “${selectedRole}”? Thao tác này không thể hoàn tác.`)) return;
    setRoleActionLoading(true);
    setPermissionsError('');
    try {
      await api.delete(`/permissions/roles/${encodeURIComponent(selectedRole)}`);
      const remaining = rolePolicies.filter((item) => item.role !== selectedRole);
      setRolePolicies(remaining);
      setPermissionDrafts((previous) => {
        const { [selectedRole]: _removed, ...rest } = previous;
        return rest;
      });
      setRoleColorDrafts((previous) => {
        const { [selectedRole]: _removed, ...rest } = previous;
        return rest;
      });
      setSelectedRole(remaining.find((item) => item.role === 'Admin')?.role || remaining[0]?.role || 'Admin');
    } catch (error) {
      setPermissionsError(error instanceof Error ? error.message : 'Không thể xóa vai trò.');
    } finally {
      setRoleActionLoading(false);
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

      {/* Sub-tab Selectors */}
      <div className="flex items-center bg-slate-100 p-1.5 rounded-2xl border border-slate-300 gap-1 w-fit">
        <button
          type="button"
          onClick={() => navigate('/users/accounts')}
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
          type="button"
          onClick={() => navigate('/users/permissions')}
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
          type="button"
          onClick={() => navigate('/users/logs')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer ${
            activeSubTab === 'audit'
              ? 'bg-white text-indigo-700 shadow-sm border border-slate-200'
              : 'text-slate-700 hover:text-slate-950'
          }`}
        >
          <History className="w-4 h-4" />
          Logs
        </button>
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
                  {rolePolicies.map((policy) => (
                    <option key={policy.role} value={policy.role}>{policy.role}</option>
                  ))}
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
                                  <span style={getRoleTextStyle(user.role)}>{user.name}</span>
                                </div>
                                <div className="text-[11px] text-slate-600 font-medium mt-0.5">{user.email}</div>
                              </div>
                            </div>
                          </td>

                          {/* Role */}
                          <td className="py-3.5 px-3">
                            <span
                              className="inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-bold"
                              style={getRoleBadgeStyle(user.role)}
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
            <button
              type="button"
              onClick={openCreateRole}
              disabled={roleActionLoading}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-extrabold text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-60"
            >
              <Plus className="h-4 w-4" /> Thêm vai trò
            </button>
          </div>

          {roleEditorMode && (
            <form
              onSubmit={(event) => void submitRoleEditor(event)}
              className="mx-5 mt-5 flex flex-col gap-3 rounded-2xl border border-indigo-200 bg-indigo-50/70 p-4 sm:mx-6 sm:flex-row sm:items-end"
            >
              <label className="min-w-0 flex-1 text-xs font-extrabold text-slate-800">
                {roleEditorMode === 'create' ? 'Tên vai trò mới' : `Đổi tên “${selectedRole}”`}
                <input
                  autoFocus
                  value={roleName}
                  onChange={(event) => setRoleName(event.target.value)}
                  maxLength={50}
                  placeholder="Ví dụ: Trưởng nhóm CSKH"
                  className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-950 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setRoleEditorMode(null)}
                  disabled={roleActionLoading}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-extrabold text-slate-700 hover:bg-slate-50"
                >
                  <X className="h-4 w-4" /> Hủy
                </button>
                <button
                  type="submit"
                  disabled={roleActionLoading || roleName.trim().length < 2}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-extrabold text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {roleActionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {roleEditorMode === 'create' ? 'Tạo vai trò' : 'Lưu tên'}
                </button>
              </div>
            </form>
          )}

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
                    const dirty = permissionDrafts[role] !== policy.permissions
                      || roleColorDrafts[role] !== policy.color;
                    return (
                      <div
                        key={role}
                        className={`group flex min-w-60 items-center rounded-xl border transition lg:min-w-0 lg:w-full ${
                          active
                            ? 'border-indigo-200 bg-white text-indigo-800 shadow-sm'
                            : 'border-transparent text-slate-700 hover:border-slate-200 hover:bg-white'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedRole(role)}
                          className="flex min-w-0 flex-1 items-center gap-2 px-3 py-3 text-left"
                        >
                          <span className="min-w-0 flex-1">
                            <span
                              className="block truncate text-xs font-extrabold"
                              style={getRoleTextStyle(role)}
                            >
                              {role}
                            </span>
                            <span className="mt-0.5 block text-[10px] font-semibold text-slate-400">{policy.userCount} tài khoản</span>
                          </span>
                          {dirty ? (
                            <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" title="Chưa lưu" />
                          ) : (
                            <ChevronRight className={`h-4 w-4 shrink-0 ${active ? 'text-indigo-500' : 'text-slate-300'}`} />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </aside>

              <section className="relative bg-slate-50/30 p-4 sm:p-6">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3
                      className="text-base font-black"
                      style={getRoleTextStyle(selectedRole)}
                    >
                      {selectedRole}
                    </h3>

                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={openRenameRole}
                      disabled={selectedRole === 'Admin' || roleActionLoading}
                      title={selectedRole === 'Admin' ? 'Không thể đổi tên vai trò Admin hệ thống.' : 'Đổi tên vai trò'}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-extrabold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Edit2 className="h-3.5 w-3.5" /> Đổi tên
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteSelectedRole()}
                      disabled={selectedRole === 'Admin' || roleActionLoading}
                      title={selectedRole === 'Admin' ? 'Không thể xóa vai trò Admin hệ thống.' : 'Xóa vai trò'}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-extrabold text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Xóa
                    </button>
                  </div>
                </div>

                <div className="space-y-4 pb-20">
                  <fieldset>
                    <div className="flex flex-wrap items-center gap-2">
                        {paletteColors.map((color) => {
                          const isSelected = getRoleColor(selectedRole) === color;
                          return (
                            <div key={color} className="group relative">
                              <button
                                type="button"
                                onClick={() => setRoleColorDrafts((previous) => ({ ...previous, [selectedRole]: color }))}
                                disabled={savingRole !== null}
                                aria-label={`Chọn màu ${color}`}
                                aria-pressed={isSelected}
                                title={color.toUpperCase()}
                                className={`flex h-8 w-8 items-center justify-center rounded-full border-2 border-white shadow-sm transition hover:scale-110 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 ${
                                  isSelected ? 'scale-110 ring-2 ring-slate-700 ring-offset-2' : ''
                                }`}
                                style={{ backgroundColor: color }}
                              >
                                {isSelected ? <Check className="h-4 w-4 text-white drop-shadow-sm" /> : null}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setPaletteColors((current) => {
                                    const remaining = current.filter((item) => item !== color);
                                    if (isSelected) {
                                      setRoleColorDrafts((previous) => ({
                                        ...previous,
                                        [selectedRole]: remaining[0] || ROLE_COLOR_PRESETS[0],
                                      }));
                                    }
                                    return remaining;
                                  });
                                }}
                                disabled={savingRole !== null}
                                aria-label={`Xóa màu ${color}`}
                                title="Xóa màu"
                                className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 opacity-0 shadow-sm transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-red-300 group-hover:opacity-100"
                              >
                                <X className="h-2.5 w-2.5" />
                              </button>
                            </div>
                          );
                        })}

                        <button
                          type="button"
                          onClick={() => customColorInputRef.current?.click()}
                          disabled={savingRole !== null}
                          aria-label="Thêm màu mới"
                          title="Thêm màu mới"
                          className="ml-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-dashed border-slate-300 bg-white text-slate-500 transition hover:scale-110 hover:border-slate-500 hover:bg-slate-50 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                        <input
                          ref={customColorInputRef}
                          type="color"
                          value={getRoleColor(selectedRole)}
                          onChange={(event) => {
                            const color = event.target.value.toLowerCase();
                            setRoleColorDrafts((previous) => ({ ...previous, [selectedRole]: color }));
                            setPaletteColors((current) => current.includes(color) ? current : [...current, color]);
                          }}
                          disabled={savingRole !== null}
                          aria-label="Thêm màu mới"
                          className="pointer-events-none absolute h-px w-px opacity-0"
                          tabIndex={-1}
                        />
                    </div>
                  </fieldset>

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
                  <div className="fixed bottom-4 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 flex-col gap-3 rounded-2xl border border-indigo-200 bg-white px-4 py-3 shadow-2xl sm:flex-row sm:items-center sm:justify-between">
                    <span
                      className="text-xs font-bold"
                      style={{ color: '#dc2626', WebkitTextFillColor: '#dc2626' }}
                    >
                      Bạn có thay đổi chưa lưu
                    </span>
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
                        {savingRole === selectedRole ? 'Đang lưu...' : 'Lưu'}
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
