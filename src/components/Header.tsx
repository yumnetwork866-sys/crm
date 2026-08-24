import React, { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Users,
  Layers,
  Zap,
  BarChart3,
  ShoppingBag,
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
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    let targetScrollLeft = nav.scrollLeft;
    let animationFrame: number | null = null;

    const animateScroll = () => {
      const distance = targetScrollLeft - nav.scrollLeft;
      if (Math.abs(distance) < 0.5) {
        nav.scrollLeft = targetScrollLeft;
        animationFrame = null;
        return;
      }

      nav.scrollLeft += distance * 0.18;
      animationFrame = requestAnimationFrame(animateScroll);
    };

    const handleWheel = (event: WheelEvent) => {
      if (nav.scrollWidth <= nav.clientWidth || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;

      const maxScrollLeft = nav.scrollWidth - nav.clientWidth;
      const deltaMultiplier = event.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? 16
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
          ? nav.clientWidth
          : 1;
      const nextScrollLeft = Math.max(
        0,
        Math.min(maxScrollLeft, targetScrollLeft + event.deltaY * deltaMultiplier),
      );
      if (nextScrollLeft === targetScrollLeft) return;

      event.preventDefault();
      targetScrollLeft = nextScrollLeft;
      if (animationFrame === null) animationFrame = requestAnimationFrame(animateScroll);
    };

    nav.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      nav.removeEventListener('wheel', handleWheel);
      if (animationFrame !== null) cancelAnimationFrame(animationFrame);
    };
  }, []);

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
      label: 'Bán Hàng',
      subtitle: 'Đơn hàng & Sản phẩm',
      icon: ShoppingBag,
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
    <header className="app-topbar sticky top-0 z-30 shrink-0 border-b border-slate-800/80 bg-slate-950/95 text-white shadow-[0_8px_24px_rgba(15,23,42,0.16)] backdrop-blur-xl">
      <div className="w-full px-3 py-2 sm:px-4">
        <div className="flex items-center justify-between gap-2.5">
          
          {/* 1. Left: Logo & Brand */}
          <div className="flex items-center space-x-2 shrink-0">
            <YumLogo size="md" showText={false} />
          </div>

          {/* 2. Center: Navigation Tabs (Direct Seamless Row without Card Wrapper) */}
          <nav
            ref={navRef}
            className="topbar-nav-shell min-w-0 flex-1 touch-pan-x overflow-x-auto overscroll-x-contain rounded-2xl border border-white/5 bg-slate-900/70 p-1 no-scrollbar"
          >
            <div className="flex w-max min-w-full items-center justify-center gap-1">
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
                    className={({ isActive }) => `topbar-nav-link group relative flex min-h-11 grow shrink-0 basis-auto items-center justify-center gap-2 px-3 py-2.5 sm:px-3.5 rounded-xl text-left whitespace-nowrap transition-[background-color,background-image,color,box-shadow,transform] duration-200 ease-out cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400 ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-[0_6px_16px_rgba(79,70,229,0.3)] ring-1 ring-white/15 font-extrabold'
                        : 'text-slate-300 hover:-translate-y-px hover:bg-white/[0.07] hover:text-white font-semibold'
                    }`}
                  >
                    {({ isActive }) => (
                      <>
                        <Icon
                          aria-hidden="true"
                          className={`topbar-nav-icon h-4.5 w-4.5 shrink-0 transition-colors duration-200 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-indigo-300'}`}
                        />
                        <span className="text-sm font-bold tracking-tight">{item.label}</span>
                        {badge && badge > 0 ? (
                          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-black leading-none text-white shadow-sm ring-2 ring-slate-900/60">
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
