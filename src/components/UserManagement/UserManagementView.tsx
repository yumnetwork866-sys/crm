import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { AppUser, PermissionDefinition, RolePermissionPolicy, UserRole } from '../../types';
import { api } from '../../utils/apiClient';
import { useAuth } from '../../contexts/AuthContext';
import {
  cacheRoleColors,
  getRoleColor as getCachedRoleColor,
  loadRoleColorCache,
} from '../../utils/roleColors';
import {
  Users,
  ShieldCheck,
  CheckCircle2,
  ShieldAlert,
  History,
  Bot,
} from 'lucide-react';
import { AiManagementPanel } from './AiManagementPanel';
import { UserDirectoryTab } from './components/UserDirectoryTab';
import { ROLE_COLOR_PRESETS, RolePermissionsMatrixTab } from './components/RolePermissionsMatrixTab';

interface UserManagementViewProps {
  users: AppUser[];
  currentUser: AppUser | null;
  onAddUser: () => void;
  onEditUser: (user: AppUser) => void;
  onDeleteUser: (userId: string) => Promise<void>;
  onToggleUserStatus: (userId: string) => Promise<void>;
}

const AUDIT_LOGS = [
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

  const activeSubTab = useMemo<'accounts' | 'permissions' | 'ai' | 'audit'>(() => {
    const segments = location.pathname.replace(/^\//, '').split('/');
    if (segments[0] === 'users') {
      const sub = segments[1];
      if (sub === 'permissions') return 'permissions';
      if (sub === 'ai') return 'ai';
      if (sub === 'logs' || sub === 'audit') return 'audit';
      if (sub === 'accounts') return 'accounts';
    }
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    if (tabParam === 'permissions') return 'permissions';
    if (tabParam === 'ai') return 'ai';
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
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [permissionsError, setPermissionsError] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('Admin');
  const { refreshCurrentUser, refreshUsers } = useAuth();

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
    void refreshUsers();
  }, [refreshUsers]);

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
          onClick={() => navigate('/users/ai')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer ${
            activeSubTab === 'ai'
              ? 'bg-white text-indigo-700 shadow-sm border border-slate-200'
              : 'text-slate-700 hover:text-slate-950'
          }`}
        >
          <Bot className="w-4 h-4" />
          AI
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
        <UserDirectoryTab
          users={users}
          currentUser={currentUser}
          rolePolicies={rolePolicies}
          searchTerm={searchTerm}
          onSearchTermChange={setSearchTerm}
          roleFilter={roleFilter}
          onRoleFilterChange={setRoleFilter}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          onAddUser={onAddUser}
          onEditUser={onEditUser}
          onDeleteUser={onDeleteUser}
          onToggleUserStatus={onToggleUserStatus}
          getRoleTextStyle={getRoleTextStyle}
          getRoleBadgeStyle={getRoleBadgeStyle}
        />
      )}

      {/* SUB-TAB 2: ROLE PERMISSIONS MATRIX */}
      {activeSubTab === 'permissions' && (
        <RolePermissionsMatrixTab
          currentUser={currentUser}
          permissionDefinitions={permissionDefinitions}
          rolePolicies={rolePolicies}
          setRolePolicies={setRolePolicies}
          permissionDrafts={permissionDrafts}
          setPermissionDrafts={setPermissionDrafts}
          roleColorDrafts={roleColorDrafts}
          setRoleColorDrafts={setRoleColorDrafts}
          paletteColors={paletteColors}
          setPaletteColors={setPaletteColors}
          permissionsLoading={permissionsLoading}
          permissionsError={permissionsError}
          setPermissionsError={setPermissionsError}
          selectedRole={selectedRole}
          setSelectedRole={setSelectedRole}
          getRoleColor={getRoleColor}
          getRoleTextStyle={getRoleTextStyle}
          refreshUsers={refreshUsers}
          refreshCurrentUser={refreshCurrentUser}
        />
      )}

      {/* SUB-TAB 3: AI MANAGEMENT */}
      {activeSubTab === 'ai' && <AiManagementPanel />}

      {/* SUB-TAB 4: AUTH SECURITY LOGS */}
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
                {AUDIT_LOGS.map((log) => (
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
