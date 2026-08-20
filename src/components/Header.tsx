import React from 'react';
import {
  Users,
  Layers,
  Zap,
  Send,
  BarChart3,
  ShoppingBag,
  Package,
  ShieldCheck,
  MessageSquare
} from 'lucide-react';
import type { Customer, AppUser } from '../types';
import { YumLogo } from './Common/YumLogo';
import type { ActiveTab } from './Navigation';

interface HeaderProps {
  activeTab: ActiveTab;
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
  activeTab,
  onChangeTab,
  currentUser,
  unreadMessagesCount = 0,
  onOpenLoginModal,
}) => {
  const isAdmin = currentUser?.role === 'Admin';

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
      subtitle: 'Chăm sóc tự động',
      icon: Zap,
    },
    {
      id: 'broadcast' as ActiveTab,
      label: 'Gửi Hàng Loạt',
      subtitle: 'WhatsApp Campaign',
      icon: Send,
    },
    {
      id: 'reports' as ActiveTab,
      label: 'Báo Cáo',
      subtitle: 'Analytics & Sales',
      icon: BarChart3,
    },
    ...(isAdmin
      ? [
          {
            id: 'users' as ActiveTab,
            label: 'Quản Trị',
            subtitle: 'User & Phân quyền',
            icon: ShieldCheck,
          },
        ]
      : []),
    {
      id: 'messages' as ActiveTab,
      label: 'WhatsApp Inbox',
      subtitle: 'WhatsApp Cloud API',
      icon: MessageSquare,
      badge: unreadMessagesCount,
    },
  ];

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-30 shadow-md shrink-0">
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
                const isActive = activeTab === item.id;
                const badge = item.badge;

                return (
                  <button
                    key={item.id}
                    onClick={() => onChangeTab(item.id)}
                    title={item.subtitle}
                    className={`relative flex items-center gap-2 px-3 py-2.5 rounded-xl text-left whitespace-nowrap transition-all duration-150 cursor-pointer ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-sm font-extrabold'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/80 font-semibold'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} />
                    <span className="text-xs font-bold tracking-tight">{item.label}</span>
                    {badge && badge > 0 ? (
                      <span className="inline-flex items-center justify-center min-w-4.5 h-4.5 px-1 text-[9px] font-black leading-none text-white bg-rose-500 rounded-full">
                        {badge}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </nav>

          {/* 3. Right: User Profile / Login Button */}
          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={onOpenLoginModal}
              className="flex items-center space-x-2 pl-1.5 pr-2.5 py-1 rounded-xl bg-slate-800/90 hover:bg-slate-800 border border-slate-700 text-left transition cursor-pointer shadow-xs"
              title="Đăng nhập / Thay đổi tài khoản"
            >
              {currentUser ? (
                <>
                  <img
                    src={currentUser.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                    alt={currentUser.name}
                    className="w-7 h-7 rounded-lg object-cover border border-slate-600"
                  />
                  <div className="hidden sm:block leading-tight">
                    <div className="text-xs font-bold text-white max-w-[110px] truncate">{currentUser.name}</div>
                    <div className="text-[9px] text-[#be00f6] font-bold">{currentUser.role}</div>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-7 h-7 rounded-lg bg-indigo-600/30 text-indigo-300 flex items-center justify-center">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-slate-200">Đăng Nhập</span>
                </>
              )}
            </button>
          </div>

        </div>
      </div>
    </header>
  );
};



