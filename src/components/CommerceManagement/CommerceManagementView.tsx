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

  const tabs = [
    {
      id: 'orders' as const,
      label: 'Đơn hàng',
      icon: ShoppingBag,
      to: '/orders',
    },
    {
      id: 'products' as const,
      label: 'Sản phẩm',
      icon: Package,
      to: '/orders?tab=products',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <div
          className="grid grid-cols-1 gap-2 sm:grid-cols-2"
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
                aria-controls={`${tab.id}-panel`}
                className={`commerce-section-tab flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                  isActive
                    ? 'border-indigo-200 bg-indigo-50 text-indigo-900 shadow-sm'
                    : 'border-transparent bg-white text-slate-600 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    isActive ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <Icon aria-hidden="true" className="commerce-section-tab-icon h-4 w-4" />
                </span>
                <span className="min-w-0 text-sm font-bold">{tab.label}</span>
              </NavLink>
            );
          })}
        </div>
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
