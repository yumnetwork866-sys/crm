import React, { useState } from 'react';
import { AppUser } from '../../types';
import { LogIn, LogOut, X, Mail, Lock, Loader2 } from 'lucide-react';
import { YumLogo } from '../Common/YumLogo';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: AppUser[];
  currentUser: AppUser | null;
  onSelectUser: (user: AppUser | null) => void;
  isMandatory?: boolean;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  users,
  currentUser,
  onSelectUser,
  isMandatory = false,
}) => {
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleCustomLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = emailInput.trim().toLowerCase();
    const cleanPass = passwordInput.trim();

    if (!cleanEmail || !cleanPass) {
      setLoginError('Vui lòng nhập đầy đủ Email và Mật khẩu.');
      return;
    }

    setIsLoading(true);
    setLoginError('');

    try {
      // Gọi API Backend thật để lấy JWT Token
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password: cleanPass }),
      });

      const data = await response.json();

      if (!response.ok) {
        setLoginError(data.error || 'Email hoặc mật khẩu không chính xác.');
        setIsLoading(false);
        return;
      }

      // Lưu JWT Token thật vào localStorage
      if (data.token) {
        localStorage.setItem('vietcrm_jwt_token', data.token);
      }

      // Cập nhật user trong App state
      const loggedInUser: AppUser = {
        id: data.user.id,
        name: data.user.name,
        email: data.user.email,
        role: data.user.role,
        avatar: data.user.avatar || '',
        phone: data.user.phone || '',
        department: data.user.department || 'Sales',
        status: data.user.status || 'active',
        lastActive: 'Đang hoạt động',
        assignedLeadsCount: data.user.assignedLeadsCount || 0,
        totalRevenue: data.user.totalRevenue || 0,
      };

      onSelectUser(loggedInUser);
      setLoginError('');
      setIsLoading(false);
      if (!isMandatory) onClose();
    } catch (err) {
      // Fallback: thử tìm trong danh sách users local nếu backend offline
      const found = users.find((u) => u.email.toLowerCase() === cleanEmail);
      if (found) {
        if (found.status === 'inactive') {
          setLoginError('Tài khoản này đang bị vô hiệu hóa.');
        } else {
          onSelectUser(found);
          setLoginError('');
          if (!isMandatory) onClose();
        }
      } else {
        setLoginError('Không thể kết nối máy chủ. Vui lòng thử lại.');
      }
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('vietcrm_jwt_token');
    onSelectUser(null);
    if (!isMandatory) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fade-in">
      {/* High Contrast Light Modal Card */}
      <div className="bg-white border border-slate-200 rounded-3xl max-w-[500px] w-full p-6 sm:p-8 shadow-2xl relative overflow-hidden text-slate-900 ring-1 ring-slate-900/10">
        
        {/* Subtle decorative accent background glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-red-100 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-red-100 rounded-full blur-3xl pointer-events-none" />

        {/* Highlighted Close Button */}
        {!isMandatory && (
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-950 rounded-full border border-slate-300 transition cursor-pointer shadow-xs"
            title="Đóng"
          >
            <X className="w-5 h-5 text-slate-700" />
          </button>
        )}

        {/* Modal Header */}
        <div className="flex flex-col space-y-3 mb-6 border-b border-slate-200 pb-5">
          <YumLogo size="lg" showText={false} />
          <div>
            <h2 className="text-lg font-black text-slate-950 tracking-tight">
              {isMandatory ? 'Đăng Nhập Hệ Thống YumNetwork CRM' : 'Đăng Nhập Tài Khoản'}
            </h2>
            <p className="text-xs font-black text-slate-900 mt-1">
              {currentUser
                ? `Đang đăng nhập với vai trò ${currentUser.role}`
                : 'Vui lòng nhập Email & Mật khẩu để truy cập dữ liệu'}
            </p>
          </div>
        </div>

        {/* Current User Card if Logged In */}
        {currentUser && (
          <div className="bg-slate-50 border border-emerald-300 p-4 rounded-2xl mb-6 flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center space-x-3 min-w-0 flex-1">
              <img
                src={currentUser.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                alt={currentUser.name}
                className="w-11 h-11 rounded-xl object-cover border border-slate-300 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                  <span className="font-extrabold text-slate-950 text-sm whitespace-nowrap">{currentUser.name}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-300 whitespace-nowrap">
                    Đang Đăng Nhập
                  </span>
                </div>
                <div className="text-xs text-slate-600 truncate mt-0.5 font-medium">{currentUser.email} • {currentUser.role}</div>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-rose-100 text-rose-700 border border-rose-300 hover:bg-rose-600 hover:text-white transition cursor-pointer whitespace-nowrap shrink-0 shadow-xs"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Đăng xuất</span>
            </button>
          </div>
        )}

        {/* Direct Email/Password Form */}
        <form onSubmit={handleCustomLogin} className="space-y-5">
          <div>
            <label className="block text-xs font-black text-slate-950 mb-1.5">Email Tài Khoản *</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-600 absolute left-3.5 top-3.5" />
              <input
                type="email"
                required
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="Nhập email tài khoản của bạn..."
                className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-4 py-3 text-xs text-slate-950 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent font-bold shadow-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-black text-slate-950 mb-1.5">Mật Khẩu *</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-600 absolute left-3.5 top-3.5" />
              <input
                type="password"
                required
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Nhập mật khẩu..."
                className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-4 py-3 text-xs text-slate-950 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent font-bold shadow-xs"
              />
            </div>
          </div>

          {loginError && (
            <div className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 p-3 rounded-xl shadow-xs">
              {loginError}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-extrabold text-xs transition flex items-center justify-center space-x-2 cursor-pointer shadow-lg shadow-red-600/30 transform hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang đăng nhập...</span>
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>Đăng Nhập Vào YumNetwork CRM</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
