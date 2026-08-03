import React from 'react';
import { ShieldCheck, UserCheck } from 'lucide-react';
import { Customer, AppUser } from '../types';
import { YumLogo } from './Common/YumLogo';

interface HeaderProps {
  customers: Customer[];
  currentUser: AppUser | null;
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
  onAddCustomer: () => void;
  onRunAutomationSim: () => void;
  onResetData: () => void;
  onOpenLoginModal: () => void;
  onOpenUsersTab?: () => void;
  activeTab?: string;
  usersCount?: number;
  autoSimCount: number;
  onCurrencyChange?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  onAddCustomer,
  onRunAutomationSim,
  onResetData,
  onOpenLoginModal,
  onOpenUsersTab,
  activeTab,
  usersCount,
  autoSimCount,
}) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800/60 text-white">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-between gap-4">
          
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <YumLogo size="md" showText={false} />
          </div>

          {/* Action Buttons & Profile */}
          <div className="flex items-center space-x-2 shrink-0">
            {/* Staff Permissions Button */}
            {onOpenUsersTab && (
              <button
                onClick={onOpenUsersTab}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer shadow-sm active:scale-95 ${
                  activeTab === 'users'
                    ? 'bg-purple-600 text-white border-purple-600 shadow-purple-500/30'
                    : 'bg-purple-100 dark:bg-purple-950/60 hover:bg-purple-200 dark:hover:bg-purple-900/60 text-purple-800 dark:text-purple-200 border-purple-300 dark:border-purple-500/40'
                }`}
                title="Phân quyền Nhân sự & Quản lý Đội ngũ"
              >
                <UserCheck className={`w-3.5 h-3.5 ${activeTab === 'users' ? 'text-white' : 'text-purple-600 dark:text-purple-300'}`} />
                <span className="hidden sm:inline font-bold">Phân Quyền Nhân Sự</span>
                {usersCount !== undefined && (
                  <span
                    className={`ml-1 px-1.5 py-0.2 text-[10px] rounded-full font-bold border ${
                      activeTab === 'users'
                        ? 'bg-purple-500/40 text-white border-purple-300/50'
                        : 'bg-purple-200 dark:bg-purple-800/80 text-purple-800 dark:text-purple-200 border-purple-300 dark:border-purple-600'
                    }`}
                  >
                    {usersCount}
                  </span>
                )}
              </button>
            )}

            <div className="h-6 w-[1px] bg-slate-800 mx-1" />

            {/* User Profile / Login Button */}
            <button
              onClick={onOpenLoginModal}
              className="flex items-center space-x-2 pl-1.5 pr-2.5 py-1 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 text-left transition cursor-pointer"
              title="Đăng nhập / Thay đổi tài khoản"
            >
              {currentUser ? (
                <>
                  <img
                    src={currentUser.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                    alt={currentUser.name}
                    className="w-7 h-7 rounded-lg object-cover border border-slate-600"
                  />
                  <div className="hidden md:block leading-none">
                    <div className="text-xs font-bold text-white max-w-[100px] truncate">{currentUser.name}</div>
                    <div className="text-[9px] text-[#be00f6] font-bold">{currentUser.role}</div>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-7 h-7 rounded-lg bg-indigo-600/30 text-indigo-300 flex items-center justify-center">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-semibold text-slate-200">Đăng Nhập</span>
                </>
              )}
            </button>
          </div>

        </div>
      </div>
    </header>
  );
};



