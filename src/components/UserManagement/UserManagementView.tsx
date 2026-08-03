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
  Phone,
  Building2,
  Award,
  KeyRound,
  ShieldAlert,
  History,
  Lock,
  Check,
  Ban
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
  const [activeSubTab, setActiveSubTab] = useState<'accounts' | 'permissions' | 'audit'>('accounts');
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

  // Static Permission Matrix Data
  const permissionModules = [
    {
      module: 'Quản Lý Khách Hàng (Customer CRM)',
      description: 'Xem data khách hàng, chỉnh sửa thông tin, phân nhóm G1-G4',
      Admin: true,
      'Sales Manager': true,
      'Sales Rep': true,
      'Marketing Lead': true,
      'Customer Support': true,
    },
    {
      module: 'Quản Lý Đơn Hàng & In Hóa Đơn',
      description: 'Tạo đơn mới, cập nhật trạng thái giao hàng, in hóa đơn GTGT',
      Admin: true,
      'Sales Manager': true,
      'Sales Rep': true,
      'Marketing Lead': false,
      'Customer Support': true,
    },
    {
      module: 'Quản Lý Kho & Giá Bán Sản Phẩm',
      description: 'Cập nhật danh mục sản phẩm, quản lý tồn kho, thay đổi giá',
      Admin: true,
      'Sales Manager': true,
      'Sales Rep': false,
      'Marketing Lead': false,
      'Customer Support': false,
    },
    {
      module: 'Automation & WhatsApp Campaigns',
      description: 'Tạo chuỗi chăm sóc tự động, gửi tin nhắn hàng loạt WhatsApp',
      Admin: true,
      'Sales Manager': true,
      'Sales Rep': false,
      'Marketing Lead': true,
      'Customer Support': false,
    },
    {
      module: 'Báo Cáo Doanh Số & Analytics',
      description: 'Xem biểu đồ doanh thu, báo cáo Telesales, hiệu quả quảng cáo',
      Admin: true,
      'Sales Manager': true,
      'Sales Rep': false,
      'Marketing Lead': true,
      'Customer Support': false,
    },
    {
      module: 'Quản Trị Auth & Đổi Mật Khẩu Hệ Thống',
      description: 'Tạo/xóa tài khoản nhân sự, phân quyền vai trò, xem audit logs',
      Admin: true,
      'Sales Manager': false,
      'Sales Rep': false,
      'Marketing Lead': false,
      'Customer Support': false,
    },
  ];

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
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-100 text-purple-800 text-xs font-black border border-purple-300 mb-2">
            <KeyRound className="w-4 h-4" />
            Admin Security &amp; Authorization Center
          </div>
          <h1 className="text-2xl font-black text-slate-950 tracking-tight">
            Trung Tâm Quản Trị Auth &amp; Phân Quyền Hệ Thống
          </h1>
          <p className="text-xs font-bold text-slate-600 mt-1">
            Quản lý tài khoản đăng nhập, đổi mật khẩu, cấp quyền truy cập và kiểm soát an toàn dữ liệu CRM.
          </p>
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
            Ma Trận Phân Quyền
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
                <div className="text-[11px] text-slate-500 font-semibold mt-0.5">Toàn hệ thống CRM</div>
              </div>
              <div className="p-3 bg-indigo-100 text-indigo-700 rounded-xl border border-indigo-200">
                <Users className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white border border-slate-300 p-4 rounded-2xl flex items-center justify-between shadow-sm">
              <div>
                <div className="text-xs font-bold text-slate-600">Thành Viên Hoạt Động</div>
                <div className="text-2xl font-black text-emerald-700 mt-1">{activeUsers} Active</div>
                <div className="text-[11px] text-emerald-700 font-semibold mt-0.5">Tài khoản khả dụng</div>
              </div>
              <div className="p-3 bg-emerald-100 text-emerald-700 rounded-xl border border-emerald-200">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white border border-slate-300 p-4 rounded-2xl flex items-center justify-between shadow-sm">
              <div>
                <div className="text-xs font-bold text-slate-600">Quản Lý &amp; Admin</div>
                <div className="text-2xl font-black text-purple-700 mt-1">{adminCount} nhân sự</div>
                <div className="text-[11px] text-purple-700 font-semibold mt-0.5">Quyền Quản Trị Hệ Thống</div>
              </div>
              <div className="p-3 bg-purple-100 text-purple-700 rounded-xl border border-purple-200">
                <ShieldCheck className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white border border-slate-300 p-4 rounded-2xl flex items-center justify-between shadow-sm">
              <div>
                <div className="text-xs font-bold text-slate-600">Tổng Doanh Thu Đội Ngũ</div>
                <div className="text-2xl font-black text-emerald-700 mt-1">{formatVND(totalTeamRevenue)}</div>
                <div className="text-[11px] text-emerald-700 font-semibold mt-0.5">Doanh số cộng dồn</div>
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
                placeholder="Tìm theo tên, email, phòng ban..."
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
                <span>+ Thêm Tài Khoản Nhân Sự</span>
              </button>
            </div>
          </div>

          {/* User Accounts Table */}
          <div className="bg-white border border-slate-300 rounded-2xl overflow-hidden shadow-lg">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="font-extrabold text-slate-950 text-sm">Danh Sách Tài Khoản Auth System ({filteredUsers.length})</h3>
              <span className="text-xs text-slate-700 font-bold">
                Tài khoản đang đăng nhập: <strong className="text-indigo-600 font-black">{currentUser?.name || 'Khách / Chưa Đăng Nhập'}</strong>
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 uppercase text-[10px] font-black tracking-wider border-b border-slate-300">
                    <th className="py-3 px-4">Thành Viên</th>
                    <th className="py-3 px-3">Vai Trò &amp; Phòng Ban</th>
                    <th className="py-3 px-3">Liên Hệ &amp; Mật Khẩu</th>
                    <th className="py-3 px-3 text-right">Lead Đảm Nhận</th>
                    <th className="py-3 px-3 text-right">Doanh Số (VND)</th>
                    <th className="py-3 px-3 text-center">Trạng Thái Auth</th>
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

                          {/* Role & Department */}
                          <td className="py-3.5 px-3">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] border ${getRoleBadge(
                                user.role
                              )}`}
                            >
                              {user.role}
                            </span>
                            <div className="text-[10px] text-slate-600 font-medium mt-1 flex items-center gap-1">
                              <Building2 className="w-3 h-3 text-slate-500" />
                              <span>{user.department}</span>
                            </div>
                          </td>

                          {/* Contact & Password */}
                          <td className="py-3.5 px-3 text-slate-700">
                            <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-900">
                              <Phone className="w-3.5 h-3.5 text-slate-500" />
                              <span>{user.phone || 'Chưa cập nhật'}</span>
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono font-bold mt-1 flex items-center gap-1">
                              <KeyRound className="w-3 h-3 text-amber-600" />
                              <span>Pass: {user.password ? '••••••••' : 'admin123'}</span>
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
                              onClick={() => onToggleUserStatus(user.id)}
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
                                onClick={() => onSwitchUser(user)}
                                className="px-2.5 py-1.5 rounded-lg text-indigo-700 bg-indigo-50 hover:bg-indigo-600 hover:text-white border border-indigo-200 transition cursor-pointer text-[11px] font-extrabold flex items-center gap-1 shadow-xs"
                                title="Đăng nhập nhanh với vai trò này"
                              >
                                <LogIn className="w-3.5 h-3.5" />
                                <span>Đăng nhập</span>
                              </button>

                              <button
                                onClick={() => onEditUser(user)}
                                className="p-1.5 rounded-lg text-slate-700 hover:text-indigo-600 hover:bg-slate-100 border border-slate-200 transition cursor-pointer"
                                title="Sửa thông tin / Đổi mật khẩu"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => onDeleteUser(user.id)}
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
        <div className="bg-white border border-slate-300 rounded-3xl p-6 shadow-lg space-y-6">
          <div className="border-b border-slate-200 pb-4 flex justify-between items-center">
            <div>
              <h2 className="text-lg font-black text-slate-950">Ma Trận Phân Quyền Vai Trò (Role Access Control)</h2>
              <p className="text-xs text-slate-600 font-semibold mt-0.5">
                Bảng quy định quyền hạn truy cập module của từng vai trò tài khoản nhân sự trong hệ thống.
              </p>
            </div>
            <span className="px-3 py-1 rounded-full bg-indigo-100 text-indigo-800 text-xs font-black border border-indigo-300">
              RBAC Policy Enabled
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border border-slate-300 rounded-2xl overflow-hidden">
              <thead>
                <tr className="bg-slate-100 text-slate-800 font-black text-[11px] uppercase border-b border-slate-300">
                  <th className="p-4">Module / Tính Năng CRM</th>
                  <th className="p-4 text-center bg-purple-50 text-purple-900 border-l border-slate-300">Admin</th>
                  <th className="p-4 text-center bg-indigo-50 text-indigo-900 border-l border-slate-300">Sales Manager</th>
                  <th className="p-4 text-center bg-emerald-50 text-emerald-900 border-l border-slate-300">Sales Rep</th>
                  <th className="p-4 text-center bg-amber-50 text-amber-900 border-l border-slate-300">Marketing Lead</th>
                  <th className="p-4 text-center bg-teal-50 text-teal-900 border-l border-slate-300">Customer Support</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-900 font-semibold">
                {permissionModules.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="p-4">
                      <div className="font-black text-slate-950 text-xs">{item.module}</div>
                      <div className="text-[11px] text-slate-600 font-medium mt-0.5">{item.description}</div>
                    </td>

                    {/* Admin */}
                    <td className="p-4 text-center border-l border-slate-200 bg-purple-50/30">
                      {item.Admin ? (
                        <Check className="w-5 h-5 text-emerald-600 mx-auto stroke-[3]" />
                      ) : (
                        <Ban className="w-4 h-4 text-slate-300 mx-auto" />
                      )}
                    </td>

                    {/* Sales Manager */}
                    <td className="p-4 text-center border-l border-slate-200 bg-indigo-50/30">
                      {item['Sales Manager'] ? (
                        <Check className="w-5 h-5 text-emerald-600 mx-auto stroke-[3]" />
                      ) : (
                        <Ban className="w-4 h-4 text-slate-300 mx-auto" />
                      )}
                    </td>

                    {/* Sales Rep */}
                    <td className="p-4 text-center border-l border-slate-200 bg-emerald-50/30">
                      {item['Sales Rep'] ? (
                        <Check className="w-5 h-5 text-emerald-600 mx-auto stroke-[3]" />
                      ) : (
                        <Ban className="w-4 h-4 text-slate-300 mx-auto" />
                      )}
                    </td>

                    {/* Marketing Lead */}
                    <td className="p-4 text-center border-l border-slate-200 bg-amber-50/30">
                      {item['Marketing Lead'] ? (
                        <Check className="w-5 h-5 text-emerald-600 mx-auto stroke-[3]" />
                      ) : (
                        <Ban className="w-4 h-4 text-slate-300 mx-auto" />
                      )}
                    </td>

                    {/* Customer Support */}
                    <td className="p-4 text-center border-l border-slate-200 bg-teal-50/30">
                      {item['Customer Support'] ? (
                        <Check className="w-5 h-5 text-emerald-600 mx-auto stroke-[3]" />
                      ) : (
                        <Ban className="w-4 h-4 text-slate-300 mx-auto" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
              <p className="text-xs text-slate-600 font-semibold mt-0.5">
                Theo dõi các sự kiện đăng nhập, cập nhật mật khẩu và thay đổi quyền hạn tài khoản trong thời gian thực.
              </p>
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
