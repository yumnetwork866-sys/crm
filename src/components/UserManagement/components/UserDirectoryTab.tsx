import React from 'react';
import type { AppUser, RolePermissionPolicy, UserRole } from '../../../types';
import { formatVND } from '../../../utils/crmUtils';
import {
  Users,
  ShieldCheck,
  UserPlus,
  Search,
  Filter,
  CheckCircle2,
  Edit2,
  Trash2,
  Phone,
  Award,
} from 'lucide-react';

interface UserDirectoryTabProps {
  users: AppUser[];
  currentUser: AppUser | null;
  rolePolicies: RolePermissionPolicy[];
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  roleFilter: string;
  onRoleFilterChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  onAddUser: () => void;
  onEditUser: (user: AppUser) => void;
  onDeleteUser: (userId: string) => Promise<void>;
  onToggleUserStatus: (userId: string) => Promise<void>;
  getRoleTextStyle: (role: UserRole) => React.CSSProperties;
  getRoleBadgeStyle: (role: UserRole) => React.CSSProperties;
}

export const UserDirectoryTab: React.FC<UserDirectoryTabProps> = ({
  users,
  currentUser,
  rolePolicies,
  searchTerm,
  onSearchTermChange,
  roleFilter,
  onRoleFilterChange,
  statusFilter,
  onStatusFilterChange,
  onAddUser,
  onEditUser,
  onDeleteUser,
  onToggleUserStatus,
  getRoleTextStyle,
  getRoleBadgeStyle,
}) => {
  const totalUsers = users.length;
  const activeUsers = users.filter((u) => u.status === 'active').length;
  const adminCount = users.filter((u) => u.role === 'Admin' || u.role === 'Sales Manager').length;
  const totalTeamRevenue = users.reduce((sum, u) => sum + (u.totalRevenue || 0), 0);

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;

    return matchesSearch && matchesRole && matchesStatus;
  });

  const runUserAction = (action: () => Promise<void>) => {
    void action().catch((error) => {
      alert(error instanceof Error ? error.message : 'Không thể cập nhật tài khoản.');
    });
  };

  return (
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
            onChange={(e) => onSearchTermChange(e.target.value)}
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
              onChange={(e) => onRoleFilterChange(e.target.value)}
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
              onChange={(e) => onStatusFilterChange(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-bold outline-none"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="active">Đang hoạt động</option>
              <option value="inactive">Tạm khóa</option>
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
                        <div className="inline-flex flex-col items-center justify-center">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={user.status === 'active'}
                            onClick={() => runUserAction(() => onToggleUserStatus(user.id))}
                            title={user.status === 'active' ? 'Đang kích hoạt (nhấn để tạm khóa)' : 'Đang tạm khóa (nhấn để kích hoạt)'}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                              user.status === 'active' ? 'bg-emerald-500' : 'bg-slate-300'
                            }`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                user.status === 'active' ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </button>
                          <span
                            className={`text-[10px] font-extrabold select-none mt-1 leading-none ${
                              user.status === 'active' ? 'text-emerald-600' : 'text-slate-400'
                            }`}
                          >
                            {user.status === 'active' ? 'Active' : 'Inactive'}
                          </span>
                        </div>
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
  );
};
