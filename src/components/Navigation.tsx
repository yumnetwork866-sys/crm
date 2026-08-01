import React from 'react';
import { Users, Layers, Zap, Send, BarChart3, ShoppingBag, Package } from 'lucide-react';

export type ActiveTab = 'crm' | 'orders' | 'products' | 'segmentation' | 'automation' | 'broadcast' | 'reports' | 'users';

interface NavigationProps {
  activeTab: ActiveTab;
  onChangeTab: (tab: ActiveTab) => void;
  customerCounts: {
    total: number;
    g1: number;
    g2: number;
    g3: number;
    g4: number;
  };
  usersCount?: number;
  ordersCount?: number;
  productsCount?: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onChangeTab,
  customerCounts,
  usersCount = 5,
  ordersCount = 0,
  productsCount = 0,
}) => {
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
  ];

  return (
    <nav className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex space-x-1 sm:space-x-2 overflow-x-auto py-2.5 no-scrollbar items-center">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onChangeTab(item.id)}
                className={`group flex items-center space-x-2.5 px-3.5 py-2 rounded-xl text-left whitespace-nowrap transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25 border border-indigo-500 font-semibold'
                    : 'text-slate-800 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/80 dark:hover:bg-slate-800/60 border border-transparent font-medium'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 transition-colors ${
                    isActive ? 'text-white' : 'text-slate-900 dark:text-slate-100 group-hover:text-black dark:group-hover:text-white'
                  }`}
                />
                <div className="flex flex-col justify-center leading-none">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs sm:text-sm font-bold tracking-tight">{item.label}</span>
                  </div>
                  <span
                    className={`text-[10px] mt-1 ${
                      isActive ? 'text-indigo-100 font-normal' : 'text-slate-700 dark:text-slate-300 font-normal'
                    }`}
                  >
                    {item.subtitle}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

