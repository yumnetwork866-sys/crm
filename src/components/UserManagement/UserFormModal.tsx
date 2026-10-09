import React, { useState, useEffect } from 'react';
import type { AppUser, UserRole } from '../../types';
import { X, User, Mail, Phone, Shield, Save, KeyRound, Loader2 } from 'lucide-react';
import { api } from '../../utils/apiClient';

interface UserFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (user: Partial<AppUser> & { password?: string }) => Promise<void>;
  initialUser?: AppUser | null;
}

const FALLBACK_ROLES: UserRole[] = ['Admin', 'Sales Manager', 'Sales Rep', 'Marketing Lead', 'Customer Support'];

export const UserFormModal: React.FC<UserFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialUser,
}) => {
  const [roles, setRoles] = useState<UserRole[]>(FALLBACK_ROLES);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<AppUser> & { password?: string }>({
    name: '',
    email: '',
    phone: '',
    role: 'Sales Rep',
    status: 'active',
    password: '',
  });

  useEffect(() => {
    setFormError(null);
    if (initialUser) {
      setFormData({ ...initialUser, password: '' });
    } else {
      setFormData({
        name: '',
        email: '',
        phone: '',
        role: 'Sales Rep',
        status: 'active',
        password: '',
      });
    }
  }, [initialUser, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    void api.get<{ roles: Array<{ role: UserRole }> }>('/permissions/roles')
      .then((data) => {
        if (!cancelled && data.roles.length > 0) setRoles(data.roles.map((item) => item.role));
      })
      .catch(() => null);
    return () => { cancelled = true; };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const name = formData.name?.trim() || '';
    const email = formData.email?.trim() || '';

    if (!name || !email) {
      setFormError('Vui lòng nhập Họ tên và Email / Tài khoản.');
      return;
    }

    if (formData.password && formData.password.length < 6) {
      setFormError('Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave({
        ...formData,
        name,
        email,
        phone: formData.phone?.trim() || '',
        avatar:
          formData.avatar ||
          `https://images.unsplash.com/photo-${
            Math.floor(Math.random() * 5) === 0 ? '1534528741775-53994a69daeb' : '1507003211169-0a1dd7228f2d'
          }?auto=format&fit=crop&q=80&w=250`,
        lastActive: 'Vừa tạo mới',
      });
      onClose();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Không thể lưu tài khoản.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl relative text-slate-100">
        
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-900 dark:text-slate-400 hover:text-black dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition cursor-pointer"
          title="Đóng"
        >
          <X className="w-5 h-5 text-slate-900 dark:text-slate-400" />
        </button>

        <h2 className="text-lg font-bold text-white mb-4">
          {initialUser ? 'Chỉnh Sửa Thông Tin Thành Viên' : 'Thêm Thành Viên Mới'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Họ & Tên *</label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                required
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nguyễn Văn A"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Email / Account */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Email / Tài Khoản Đăng Nhập *</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                required
                value={formData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="VD: admin hoặc nguyenvana@yumnetwork.vn"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Phone */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Số Điện Thoại</label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={formData.phone || ''}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="0912 345 678"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Role */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Vai Trò (Role)</label>
            <div className="relative">
              <Shield className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <select
                value={formData.role || 'Sales Rep'}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 appearance-none"
              >
                {roles.map((role) => (
                  <option key={role} value={role} className="bg-slate-900 text-white">
                    {role}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              {initialUser ? 'Đổi Mật Khẩu Mới (để trống nếu không đổi)' : 'Mật Khẩu Mặc Định *'}
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="password"
                value={formData.password || ''}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder={initialUser ? 'Nhập mật khẩu mới...' : 'Mật khẩu đăng nhập (VD: admin123)'}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Status Toggle */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
            <div>
              <span className="block text-xs font-semibold text-white">
                Trạng thái tài khoản
              </span>
              <span className="text-[11px] text-slate-400 mt-0.5 block">
                {formData.status === 'active' ? 'Đang kích hoạt hoạt động' : 'Tài khoản đang bị tạm khóa'}
              </span>
            </div>

            <div className="flex flex-col items-center">
              <button
                type="button"
                role="switch"
                aria-checked={formData.status === 'active'}
                onClick={() =>
                  setFormData((prev) => ({
                    ...prev,
                    status: prev.status === 'active' ? 'inactive' : 'active',
                  }))
                }
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  formData.status === 'active' ? 'bg-emerald-500' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    formData.status === 'active' ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
              <span
                className={`text-[10px] font-bold select-none mt-1 leading-none ${
                  formData.status === 'active' ? 'text-emerald-400' : 'text-slate-500'
                }`}
              >
                {formData.status === 'active' ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>

          {formError && (
            <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-xs text-rose-300 font-medium">
              {formError}
            </div>
          )}

          <div className="pt-2 flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 transition disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition flex items-center space-x-1.5 shadow-md shadow-indigo-600/20 disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang lưu...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>{initialUser ? 'Lưu Thay Đổi' : 'Tạo Thành Viên'}</span>
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
