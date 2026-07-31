import React, { useState } from 'react';
import { AppUser } from '../../types';
import { LogIn, LogOut, ShieldCheck, UserCheck, Check, Sparkles, X, Mail, Lock } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: AppUser[];
  currentUser: AppUser | null;
  onSelectUser: (user: AppUser | null) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  users,
  currentUser,
  onSelectUser,
}) => {
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('••••••••');
  const [loginError, setLoginError] = useState('');

  if (!isOpen) return null;

  const handleCustomLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const found = users.find((u) => u.email.toLowerCase() === emailInput.trim().toLowerCase());
    if (found) {
      if (found.status === 'inactive') {
        setLoginError('Tài khoản này đang bị vô hiệu hóa.');
        return;
      }
      onSelectUser(found);
      setLoginError('');
      onClose();
    } else {
      setLoginError('Không tìm thấy tài khoản với email này trong hệ thống.');
    }
  };

  const handleQuickLogin = (user: AppUser) => {
    onSelectUser(user);
    setLoginError('');
    onClose();
  };

  const handleLogout = () => {
    onSelectUser(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative overflow-hidden text-slate-100">
        
        {/* Decorative background glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-900 dark:text-slate-400 hover:text-black dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition cursor-pointer"
          title="Đóng"
        >
          <X className="w-5 h-5 text-slate-900 dark:text-slate-400" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center space-x-3 mb-6">
          <div className="h-10 w-10 rounded-2xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Đăng Nhập & Chuyển Tài Khoản</h2>
            <p className="text-xs text-slate-400">
              {currentUser
                ? `Đang đăng nhập với vai trò ${currentUser.role}`
                : 'Chọn tài khoản nhân viên hoặc đăng nhập credential'}
            </p>
          </div>
        </div>

        {/* Current User Card if Logged In */}
        {currentUser && (
          <div className="bg-slate-800/80 border border-emerald-500/40 p-4 rounded-2xl mb-6 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <img
                src={currentUser.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                alt={currentUser.name}
                className="w-11 h-11 rounded-xl object-cover border border-slate-700"
              />
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-white text-sm">{currentUser.name}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                    Đang Đăng Nhập
                  </span>
                </div>
                <div className="text-xs text-slate-400">{currentUser.email} • {currentUser.role}</div>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500 hover:text-white transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Đăng xuất</span>
            </button>
          </div>
        )}

        {/* Direct Email/Password Form */}
        <form onSubmit={handleCustomLogin} className="space-y-3 mb-6">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Email Tài Khoản</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="Ví dụ: anh.nguyen@vietcrm.vn"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Mật Khẩu</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Mật khẩu"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {loginError && (
            <div className="text-xs text-rose-400 bg-rose-950/40 border border-rose-800/50 p-2.5 rounded-xl">
              {loginError}
            </div>
          )}

          <button
            type="submit"
            className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition flex items-center justify-center space-x-2 cursor-pointer shadow-md shadow-indigo-600/20"
          >
            <LogIn className="w-4 h-4" />
            <span>Đăng Nhập Vào VietCRM</span>
          </button>
        </form>
      </div>
    </div>
  );
};
