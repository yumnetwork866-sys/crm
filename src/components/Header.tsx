import React, { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Users,
  Layers,
  Zap,
  BarChart3,
  ShoppingBag,
  Package,
  ShieldCheck,
  MessageSquare,
  LogOut,
  Camera,
  KeyRound,
} from 'lucide-react';
import type { Customer, AppUser } from '../types';
import { YumLogo } from './Common/YumLogo';
import type { ActiveTab } from './Navigation';
import { useAuth } from '../contexts/AuthContext';
import { ChangePasswordModal } from './Auth/ChangePasswordModal';
import { ChangeAvatarModal } from './Auth/ChangeAvatarModal';

interface HeaderProps {
  onChangeTab: (tab: ActiveTab) => void;
  customers: Customer[];
  currentUser: AppUser | null;
  unreadMessagesCount?: number;
  onOpenLoginModal: () => void;
  onOpenUsersTab?: () => void;
  onAddCustomer?: () => void;
  onRunAutomationSim?: () => void;
  onResetData?: () => void;
  usersCount?: number;
  autoSimCount?: number;
  onCurrencyChange?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onChangeTab,
  currentUser,
  unreadMessagesCount = 0,
  onOpenLoginModal,
}) => {
  const { logout } = useAuth();
  const isAdmin = currentUser?.role === 'Admin';
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  const navItems = [
    {
      id: 'crm' as ActiveTab,
      label: 'Khách Hàng',
      subtitle: 'Thông tin & Data',
      icon: Users,
    },
    {
      id: 'orders' as ActiveTab,
      label: 'Đơn Hàng',
      subtitle: 'Quản lý đơn & In HĐ',
      icon: ShoppingBag,
    },
    {
      id: 'products' as ActiveTab,
      label: 'Sản Phẩm',
      subtitle: 'Kho hàng & Giá bán',
      icon: Package,
    },
    {
      id: 'segmentation' as ActiveTab,
      label: 'Phân Nhóm',
      subtitle: 'Nhóm 1 - 4 Tự động',
      icon: Layers,
    },
    {
      id: 'automation' as ActiveTab,
      label: 'Automation',
      subtitle: 'Tự động & Gửi hàng loạt',
      icon: Zap,
    },
    {
      id: 'reports' as ActiveTab,
      label: 'Báo Cáo',
      subtitle: 'Analytics & Sales',
      icon: BarChart3,
    },
    {
      id: 'messages' as ActiveTab,
      label: 'WhatsApp',
      subtitle: 'WhatsApp Cloud API',
      icon: MessageSquare,
      badge: unreadMessagesCount,
    },
  ];

  return (
    <header className="app-topbar bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-30 shadow-md shrink-0">
      <div className="w-full px-4 sm:px-6 py-2">
        <div className="flex items-center justify-between gap-3">
          
          {/* 1. Left: Logo & Brand */}
          <div className="flex items-center space-x-2 shrink-0">
            <YumLogo size="md" showText={false} />
          </div>

          {/* 2. Center: Navigation Tabs (Direct Seamless Row without Card Wrapper) */}
          <nav className="flex-1 min-w-0 flex items-center justify-center overflow-x-auto no-scrollbar py-0.5">
            <div className="flex items-center space-x-1 sm:space-x-1.5">
              {navItems.map((item) => {
                const Icon = item.icon;
                const badge = item.badge;

                return (
                  <NavLink
                    key={item.id}
                    to={`/${item.id}`}
                    end
                    onClick={() => {
                      if (item.id === 'automation') onChangeTab(item.id);
                    }}
                    title={item.subtitle}
                    className={({ isActive }) => `topbar-nav-link group relative flex min-h-12 items-center gap-2.5 px-3.5 py-3 sm:px-4 rounded-xl text-left whitespace-nowrap transition-all duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400 ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-sm font-extrabold'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/80 font-semibold'
                    }`}
                  >
                    {({ isActive }) => (
                      <>
                        <Icon
                          aria-hidden="true"
                          className={`topbar-nav-icon w-5 h-5 shrink-0 ${isActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-900'}`}
                        />
                        <span className="text-sm font-bold tracking-tight">{item.label}</span>
                        {badge && badge > 0 ? (
                          <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 text-[10px] font-black leading-none text-white bg-rose-500 rounded-full">
                            {badge}
                          </span>
                        ) : null}
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </nav>

          {/* 3. Right: Circular User Avatar with Dropdown */}
          <div className="relative shrink-0" ref={dropdownRef}>
            {currentUser ? (
              <button
                type="button"
                onClick={() => setIsDropdownOpen((prev) => !prev)}
                aria-expanded={isDropdownOpen}
                aria-haspopup="true"
                className="relative flex items-center justify-center p-0.5 rounded-full ring-2 ring-slate-700 hover:ring-indigo-500 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-400"
                title={`${currentUser.name} (${currentUser.role})`}
              >
                <img
                  src={currentUser.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                  alt={currentUser.name}
                  className="w-8 h-8 rounded-full object-cover"
                />
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-slate-900 rounded-full" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenLoginModal}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-sm cursor-pointer"
                title="Đăng nhập tài khoản"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Đăng Nhập</span>
              </button>
            )}

            {/* Dropdown Menu */}
            {isDropdownOpen && currentUser && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-slate-900 border border-slate-700/90 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150 text-white">
                {/* User Info Header */}
                <div className="p-4 border-b border-slate-800 bg-slate-800/40">
                  <div className="flex items-center gap-3">
                    <img
                      src={currentUser.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                      alt={currentUser.name}
                      className="w-10 h-10 rounded-full object-cover border border-slate-600 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-white truncate">{currentUser.name}</div>
                      <div className="text-[11px] text-slate-400 truncate">{currentUser.email || currentUser.phone || currentUser.department || 'Nhân viên'}</div>
                      <span className={`inline-block mt-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        isAdmin
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                          : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                      }`}>
                        {currentUser.role}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Menu Actions */}
                <div className="p-1.5 space-y-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAvatarModalOpen(true);
                      setIsDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition text-left cursor-pointer"
                  >
                    <Camera className="w-4 h-4 text-emerald-400" />
                    <span>Đổi ảnh đại diện</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsPasswordModalOpen(true);
                      setIsDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition text-left cursor-pointer"
                  >
                    <KeyRound className="w-4 h-4 text-amber-400" />
                    <span>Đổi mật khẩu</span>
                  </button>

                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        onChangeTab('users');
                        setIsDropdownOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition text-left cursor-pointer"
                    >
                      <ShieldCheck className="w-4 h-4 text-purple-400" />
                      <span>Quản lý User & Phân quyền</span>
                    </button>
                  )}

                  <div className="my-1 border-t border-slate-800" />

                  <button
                    type="button"
                    onClick={() => {
                      logout();
                      setIsDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition text-left cursor-pointer font-medium"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Đăng xuất</span>
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      <ChangePasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
      />

      <ChangeAvatarModal
        isOpen={isAvatarModalOpen}
        onClose={() => setIsAvatarModalOpen(false)}
      />
    </header>
  );
};



