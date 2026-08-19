import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Customer, CustomerOrder } from '../types';
import { api } from '../utils/apiClient';
import { mapApiCustomerToFrontend } from '../utils/apiMappers';

interface UseOrdersOptions {
  setCustomers: Dispatch<SetStateAction<Customer[]>>;
}

const withOrderSummary = (customer: Customer, orders: CustomerOrder[]): Customer => {
  const completedOrders = orders.filter((order) => order.status === 'Completed');
  return {
    ...customer,
    orders,
    totalOrders: orders.length,
    totalSpent: completedOrders.reduce((sum, order) => sum + order.totalAmount, 0),
  };
};

export function useOrders({ setCustomers }: UseOrdersOptions) {
  const addOrder = useCallback(async (customerId: string, newOrder: CustomerOrder) => {
    let updatedCustomer: Customer | null = null;
    try {
      await api.post('/orders', {
        customerId,
        customerName: newOrder.customerName,
        customerPhone: newOrder.customerPhone,
        products: newOrder.products,
        totalAmount: newOrder.totalAmount,
        notes: newOrder.notes,
      });
      try {
        await api.post(`/customers/${customerId}/automation-logs`, {
          step: 1,
          stepName: 'Ngày +3 (Lời cảm ơn)',
          message: `Cảm ơn ${newOrder.customerName || 'Khách hàng'} đã mua hàng! Kích hoạt quy trình tự động chăm sóc dịch vụ...`,
          status: 'Delivered',
        });
      } catch (error) {
        console.error('Failed to create automation log on backend:', error);
      }
      const response = await api.get<any>(`/customers/${customerId}`);
      if (response) updatedCustomer = mapApiCustomerToFrontend(response);
    } catch (error) {
      console.error('API error adding order, falling back to local:', error);
    }

    setCustomers((previous) =>
      previous.map((customer) => {
        if (customer.id !== customerId) return customer;
        if (updatedCustomer) return updatedCustomer;

        const orders = [newOrder, ...customer.orders];
        const currentSequence = customer.automationSequence || {
          active: true,
          currentStep: 0,
          startDate: newOrder.date,
          logs: [],
        };
        return {
          ...withOrderSummary(customer, orders),
          status: 'Won',
          totalSpent: orders.reduce((sum, order) => sum + order.totalAmount, 0),
          lastPurchaseDate: newOrder.date,
          automationSequence: {
            ...currentSequence,
            active: true,
            currentStep: Math.max(1, currentSequence.currentStep),
            logs: [
              ...currentSequence.logs,
              {
                step: 1,
                stepName: 'Ngày +3 (Lời cảm ơn)',
                sentAt: new Date().toLocaleString('vi-VN'),
                message: `Cảm ơn ${customer.name} đã mua hàng! Kích hoạt quy trình tự động chăm sóc dịch vụ...`,
                status: 'Delivered' as const,
              },
            ],
          },
        };
      })
    );

    alert('Tạo đơn hàng thành công! Đã tự động kích hoạt quy trình Chăm sóc WhatsApp Ngày +3!');
  }, [setCustomers]);

  const createOrder = useCallback(async (order: CustomerOrder) => {
    if (!order.customerId) return;
    let updatedCustomer: Customer | null = null;
    try {
      await api.post('/orders', {
        customerId: order.customerId,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        products: order.products,
        totalAmount: order.totalAmount,
        notes: order.notes,
      });
      const response = await api.get<any>(`/customers/${order.customerId}`);
      if (response) updatedCustomer = mapApiCustomerToFrontend(response);
    } catch (error) {
      console.error('API error creating order central, falling back to local:', error);
    }

    setCustomers((previous) =>
      previous.map((customer) => {
        if (customer.id !== order.customerId) return customer;
        if (updatedCustomer) return updatedCustomer;
        return {
          ...withOrderSummary(customer, [order, ...(customer.orders || [])]),
          status: customer.status === 'Won'
            ? 'Won'
            : order.status === 'Completed'
              ? 'Won'
              : customer.status,
          lastPurchaseDate: order.date,
        };
      })
    );
  }, [setCustomers]);

  const updateOrderStatus = useCallback(async (
    orderId: string,
    customerId: string,
    status: CustomerOrder['status']
  ) => {
    let updatedCustomer: Customer | null = null;
    try {
      await api.patch(`/orders/${orderId}/status`, { status });
      const response = await api.get<any>(`/customers/${customerId}`);
      if (response) updatedCustomer = mapApiCustomerToFrontend(response);
    } catch (error) {
      console.error('API error updating order status, falling back to local:', error);
    }

    setCustomers((previous) =>
      previous.map((customer) => {
        if (customer.id !== customerId) return customer;
        if (updatedCustomer) return updatedCustomer;
        const orders = (customer.orders || []).map((order) =>
          order.id === orderId ? { ...order, status } : order
        );
        return withOrderSummary(customer, orders);
      })
    );
  }, [setCustomers]);

  const deleteOrder = useCallback((orderId: string, customerId: string) => {
    setCustomers((previous) =>
      previous.map((customer) =>
        customer.id === customerId
          ? withOrderSummary(
              customer,
              (customer.orders || []).filter((order) => order.id !== orderId)
            )
          : customer
      )
    );
  }, [setCustomers]);

  const importOrders = useCallback((importedOrders: { customerPhone: string; order: CustomerOrder }[]) => {
    setCustomers((previous) => {
      let updatedCustomers = [...previous];
      importedOrders.forEach(({ customerPhone, order }) => {
        const normalizedPhone = customerPhone.replace(/\s+/g, '');
        const customerIndex = updatedCustomers.findIndex(
          (customer) => customer.phone.replace(/\s+/g, '') === normalizedPhone
        );

        if (customerIndex === -1) {
          const customerId = `cust_ord_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
          updatedCustomers = [
            {
              id: customerId,
              phone: customerPhone,
              name: order.customerName || `Khách Hàng (${customerPhone})`,
              gender: 'Nữ',
              address: 'Malaysia',
              source: 'Direct',
              campaign: 'Import CSV Đơn Hàng',
              firstContact: new Date().toISOString().split('T')[0],
              lastContact: new Date().toISOString().split('T')[0],
              owner: 'Nguyễn Văn Ánh',
              status: order.status === 'Completed' ? 'Won' : 'Contacted',
              notes: [],
              totalOrders: 1,
              totalSpent: order.status === 'Completed' ? order.totalAmount : 0,
              interestedProducts: order.products.map((product) => product.productName),
              whatsappOptIn: true,
              whatsappOptInDate: new Date().toISOString().split('T')[0],
              orders: [{ ...order, customerId }],
            },
            ...updatedCustomers,
          ];
          return;
        }

        const customer = updatedCustomers[customerIndex];
        const importedOrder = { ...order, customerId: customer.id };
        updatedCustomers[customerIndex] = {
          ...withOrderSummary(customer, [importedOrder, ...(customer.orders || [])]),
          status: customer.status === 'Won'
            ? 'Won'
            : order.status === 'Completed'
              ? 'Won'
              : customer.status,
          lastPurchaseDate: order.date,
        };
      });
      return updatedCustomers;
    });
  }, [setCustomers]);

  return { addOrder, createOrder, updateOrderStatus, deleteOrder, importOrders };
}
