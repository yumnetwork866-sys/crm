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



