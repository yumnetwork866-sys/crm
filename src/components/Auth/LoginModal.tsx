import React, { useState } from 'react';
import { LogIn, LogOut, X, Mail, Lock, Loader2 } from 'lucide-react';
import { YumLogo } from '../Common/YumLogo';
import { useAuth } from '../../contexts/AuthContext';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  isMandatory?: boolean;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  isMandatory = false,
}) => {
  const { currentUser, login, logout } = useAuth();
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleCustomLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim() || !passwordInput.trim()) {
      setLoginError('Vui lòng nhập đầy đủ Email và Mật khẩu.');
      return;
    }

    setIsLoading(true);
    setLoginError('');

    try {
      await login(emailInput, passwordInput);
      if (!isMandatory) onClose();
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Không thể đăng nhập. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
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
