import React, { useState } from 'react';
import { AppUser, UserRole } from '../../types';
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
  LogIn,
  Mail,
  Phone,
  Building2,
  Award,
  DollarSign
} from 'lucide-react';

interface UserManagementViewProps {
  users: AppUser[];
  currentUser: AppUser | null;
  onAddUser: () => void;
  onEditUser: (user: AppUser) => void;
  onDeleteUser: (userId: string) => void;
  onToggleUserStatus: (userId: string) => void;
  onSwitchUser: (user: AppUser) => void;
}

export const UserManagementView: React.FC<UserManagementViewProps> = ({
  users,
  currentUser,
  onAddUser,
  onEditUser,
  onDeleteUser,
  onToggleUserStatus,
  onSwitchUser,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Metrics
  const totalUsers = users.length;
  const activeUsers = users.filter((u) => u.status === 'active').length;
  const adminCount = users.filter((u) => u.role === 'Admin' || u.role === 'Sales Manager').length;
  const totalTeamRevenue = users.reduce((sum, u) => sum + (u.totalRevenue || 0), 0);

  // Filtered list
  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.department.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;

    return matchesSearch && matchesRole && matchesStatus;
  });

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'Admin':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'Sales Manager':
        return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
      case 'Sales Rep':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'Marketing Lead':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'Customer Support':
        return 'bg-teal-500/20 text-teal-300 border-teal-500/30';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400">Tổng Số Thành Viên</div>
            <div className="text-2xl font-bold text-white mt-1">{totalUsers} nhân sự</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Toàn hệ thống CRM</div>
          </div>
          <div className="p-3 bg-indigo-600/20 text-indigo-400 rounded-xl border border-indigo-500/30">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400">Thành Viên Hoạt Động</div>
            <div className="text-2xl font-bold text-emerald-400 mt-1">{activeUsers} Active</div>
            <div className="text-[11px] text-emerald-400 mt-0.5">Tài khoản khả dụng</div>
          </div>
          <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400">Quản Lý & Admin</div>
            <div className="text-2xl font-bold mt-1" style={{ color: '#7e22ce' }}>{adminCount} nhân sự</div>
            <div className="text-[11px] mt-0.5 font-medium" style={{ color: '#7e22ce' }}>Quyền Quản Trị Hệ Thống</div>
          </div>
          <div className="p-3 rounded-xl border" style={{ backgroundColor: 'rgba(126, 34, 206, 0.15)', borderColor: 'rgba(126, 34, 206, 0.3)', color: '#7e22ce' }}>
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400">Tổng Doanh Thu Đội Ngũ</div>
            <div className="text-2xl font-bold mt-1" style={{ color: '#00793d' }}>{formatVND(totalTeamRevenue)}</div>
            <div className="text-[11px] mt-0.5 font-medium" style={{ color: '#00793d' }}>Doanh số cộng dồn</div>
          </div>
          <div className="p-3 rounded-xl border" style={{ backgroundColor: 'rgba(0, 121, 61, 0.15)', borderColor: 'rgba(0, 121, 61, 0.3)', color: '#00793d' }}>
            <Award className="w-6 h-6" />
          </div>
        </div>

      </div>

      {/* Control Bar: Search & Action */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo tên, email, phòng ban..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          
          <div className="flex items-center space-x-1.5 text-xs text-slate-400">
            <Filter className="w-3.5 h-3.5" />
            <span>Vai Trò:</span>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="all">Tất cả vai trò</option>
              <option value="Admin">Admin</option>
              <option value="Sales Manager">Sales Manager</option>
              <option value="Sales Rep">Sales Rep</option>
              <option value="Marketing Lead">Marketing Lead</option>
              <option value="Customer Support">Customer Support</option>
            </select>
          </div>

          <div className="flex items-center space-x-1.5 text-xs text-slate-400">
            <span>Trạng Thái:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="active">Đang hoạt động (Active)</option>
              <option value="inactive">Tạm khóa (Inactive)</option>
            </select>
          </div>

          <button
            onClick={onAddUser}
            className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition active:scale-95 cursor-pointer ml-auto md:ml-0"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ Thêm Thành Viên</span>
          </button>

        </div>

      </div>

      {/* Team Members List / Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="font-bold text-white text-sm">Danh Sách Nhân Sự VietCRM ({filteredUsers.length})</h3>
          <span className="text-xs text-slate-400">
            Tài khoản hiện tại: <strong className="text-indigo-400">{currentUser?.name || 'Khách / Chưa Đăng Nhập'}</strong>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <th className="py-3 px-4">Thành Viên</th>
                <th className="py-3 px-3">Vai Trò & Phòng Ban</th>
                <th className="py-3 px-3">Liên Hệ</th>
                <th className="py-3 px-3 text-right">Lead Đảm Nhận</th>
                <th className="py-3 px-3 text-right">Doanh Số (VND)</th>
                <th className="py-3 px-3 text-center">Trạng Thái</th>
                <th className="py-3 px-4 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    Không tìm thấy thành viên phù hợp với bộ lọc.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const isCurrent = currentUser?.id === user.id;
                  return (
                    <tr
                      key={user.id}
                      className={`hover:bg-slate-100/50 dark:hover:bg-slate-800/40 transition ${
                        isCurrent ? 'bg-indigo-50/80 dark:bg-indigo-950/40' : 'bg-white dark:bg-transparent'
                      }`}
                    >
                      {/* Name & Avatar */}
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-3">
                          <img
                            src={
                              user.avatar ||
                              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'
                            }
                            alt={user.name}
                            className="w-10 h-10 rounded-xl object-cover shrink-0 border border-slate-700"
                          />
                          <div>
                            <div className="font-bold text-slate-900 text-xs flex items-center space-x-2">
                              <span>{user.name}</span>
                              {isCurrent && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30">
                                  Bạn
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5">{user.email}</div>
                          </div>
                        </div>
                      </td>

                      {/* Role & Department */}
                      <td className="py-3 px-3">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getRoleBadge(
                            user.role
                          )}`}
                        >
                          {user.role}
                        </span>
                        <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          <span>{user.department}</span>
                        </div>
                      </td>

                      {/* Contact */}
                      <td className="py-3 px-3 text-slate-400">
                        <div className="flex items-center space-x-1.5">
                          <Phone className="w-3 h-3 text-slate-500" />
                          <span>{user.phone || 'Chưa cập nhật'}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Hoạt động: {user.lastActive}</div>
                      </td>

                      {/* Assigned Leads */}
                      <td className="py-3 px-3 text-right font-bold text-white">
                        {user.assignedLeadsCount || 0} khách
                      </td>

                      {/* Revenue */}
                      <td className="py-3 px-3 text-right font-bold text-emerald-400">
                        {formatVND(user.totalRevenue || 0)}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => onToggleUserStatus(user.id)}
                          className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold border transition cursor-pointer ${
                            user.status === 'active'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20'
                          }`}
                        >
                          {user.status === 'active' ? (
                            <>
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Active</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3" />
                              <span>Inactive</span>
                            </>
                          )}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            onClick={() => onSwitchUser(user)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-300 hover:bg-indigo-500/20 transition cursor-pointer"
                            title="Đăng nhập / Chuyển tài khoản này"
                          >
                            <LogIn className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => onEditUser(user)}
                            className="p-1.5 rounded-lg text-slate-900 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition cursor-pointer font-bold"
                            title="Chỉnh sửa thông tin"
                          >
                            <Edit2 className="w-4 h-4 text-slate-900 dark:text-slate-300" />
                          </button>

                          <button
                            onClick={() => onDeleteUser(user.id)}
                            className="p-1.5 rounded-lg text-slate-900 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 transition cursor-pointer font-bold"
                            title="Xóa thành viên"
                          >
                            <Trash2 className="w-4 h-4 text-slate-900 dark:text-slate-300" />
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

    </div>
  );
};
