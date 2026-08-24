import React from 'react';
import { NavLink, useSearchParams } from 'react-router-dom';
import { Package, ShoppingBag } from 'lucide-react';
import type { Customer, CustomerOrder, Product } from '../../types';
import { OrderManagementView } from '../OrderManagement/OrderManagementView';
import { ProductManagementView } from '../ProductManagement/ProductManagementView';

interface CommerceManagementViewProps {
  customers: Customer[];
  products: Product[];
  onCreateOrder: (order: CustomerOrder) => void;
  onUpdateOrderStatus: (orderId: string, customerId: string, status: CustomerOrder['status']) => void;
  onDeleteOrder: (orderId: string, customerId: string) => void;
  onImportOrders?: (importedOrders: { customerPhone: string; order: CustomerOrder }[]) => void;
  onAddProduct: (product: Partial<Product>) => void;
  onEditProduct: (product: Product) => void;
  onDeleteProduct: (productId: string) => void;
  onImportProducts?: (products: Product[]) => void;
}

export const CommerceManagementView: React.FC<CommerceManagementViewProps> = ({
  customers,
  products,
  onCreateOrder,
  onUpdateOrderStatus,
  onDeleteOrder,
  onImportOrders,
  onAddProduct,
  onEditProduct,
  onDeleteProduct,
  onImportProducts,
}) => {
  const [searchParams] = useSearchParams();
  const activeSection = searchParams.get('tab') === 'products' ? 'products' : 'orders';
  const ordersCount = customers.reduce((total, customer) => total + (customer.orders?.length ?? 0), 0);

  const tabs = [
    {
      id: 'orders' as const,
      label: 'Đơn hàng',
      description: 'Quản lý và xử lý đơn',
      count: ordersCount,
      icon: ShoppingBag,
      to: '/orders',
    },
    {
      id: 'products' as const,
      label: 'Sản phẩm',
      description: 'Kho hàng và giá bán',
      count: products.length,
      icon: Package,
      to: '/orders?tab=products',
    },
  ];

  return (
    <div className="space-y-5">
      <div
        className="grid grid-cols-2 gap-1 rounded-2xl border border-slate-200 bg-slate-100 p-1.5 shadow-sm"
        role="tablist"
        aria-label="Quản lý bán hàng"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSection === tab.id;

          return (
            <NavLink
              key={tab.id}
              to={tab.to}
              role="tab"
              aria-selected={isActive}
              data-state={isActive ? 'active' : 'inactive'}
              aria-controls={`${tab.id}-panel`}
              className={`commerce-section-tab group flex min-w-0 items-center justify-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 ${
                isActive
                  ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200'
                  : 'text-slate-600 hover:bg-white/60 hover:text-slate-900'
              }`}
            >
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-colors ${
                isActive ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500 group-hover:text-slate-700'
              }`}>
                <Icon
                  className="commerce-section-tab-icon h-[18px] w-[18px]"
                  aria-hidden="true"
                  style={{ color: isActive ? '#ffffff' : '#000000', stroke: isActive ? '#ffffff' : '#000000' }}
                />
              </span>
              <span className="min-w-0 text-left">
                <span className="flex items-center gap-2">
                  <span className="text-sm font-extrabold">{tab.label}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                    isActive ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {tab.count}
                  </span>
                </span>
                <span className="hidden text-[11px] font-medium text-slate-500 sm:block">{tab.description}</span>
              </span>
            </NavLink>
          );
        })}
      </div>

      <section id="orders-panel" role="tabpanel" hidden={activeSection !== 'orders'}>
        <OrderManagementView
          customers={customers}
          products={products}
          onCreateOrder={onCreateOrder}
          onUpdateOrderStatus={onUpdateOrderStatus}
          onDeleteOrder={onDeleteOrder}
          onImportOrders={onImportOrders}
        />
      </section>

      <section id="products-panel" role="tabpanel" hidden={activeSection !== 'products'}>
        <ProductManagementView
          products={products}
          onAddProduct={onAddProduct}
          onEditProduct={onEditProduct}
          onDeleteProduct={onDeleteProduct}
          onImportProducts={onImportProducts}
        />
      </section>
    </div>
  );
};
