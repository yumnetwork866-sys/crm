import { useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Customer, CustomerOrder } from '../types';
import { queryKeys } from '../lib/queryClient';
import { api } from '../utils/apiClient';
import { mapApiCustomerToFrontend } from '../utils/apiMappers';

const withOrderSummary = (customer: Customer, orders: CustomerOrder[]): Customer => {
  const completedOrders = orders.filter((order) => order.status === 'Completed');
  return {
    ...customer,
    orders,
    totalOrders: orders.length,
    totalSpent: completedOrders.reduce((sum, order) => sum + order.totalAmount, 0),
  };
};

export function useOrders() {
  const queryClient = useQueryClient();

  const addMutation = useMutation({
    mutationFn: async ({ customerId, order }: { customerId: string; order: CustomerOrder }) => {
      await api.post('/orders', {
        customerId,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        products: order.products,
        totalAmount: order.totalAmount,
        notes: order.notes,
      });
      await api.post(`/customers/${customerId}/automation-logs`, {
        step: 1,
        stepName: 'Ngày +3 (Lời cảm ơn)',
        message: `Cảm ơn ${order.customerName || 'Khách hàng'} đã mua hàng! Kích hoạt quy trình tự động chăm sóc dịch vụ...`,
        status: 'Delivered',
      }).catch(() => null);
      return mapApiCustomerToFrontend(await api.get<any>(`/customers/${customerId}`));
    },
    onMutate: async ({ customerId, order }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.customers });
      const previous = queryClient.getQueryData<Customer[]>(queryKeys.customers) || [];
      queryClient.setQueryData<Customer[]>(queryKeys.customers, previous.map((customer) => {
        if (customer.id !== customerId) return customer;
        const orders = [order, ...customer.orders];
        const sequence = customer.automationSequence || {
          active: true,
          currentStep: 0,
          startDate: order.date,
          logs: [],
        };
        return {
          ...withOrderSummary(customer, orders),
          status: 'Won',
          totalSpent: orders.reduce((sum, item) => sum + item.totalAmount, 0),
          lastPurchaseDate: order.date,
          automationSequence: {
            ...sequence,
            active: true,
            currentStep: Math.max(1, sequence.currentStep),
            logs: [...sequence.logs, {
              step: 1,
              stepName: 'Ngày +3 (Lời cảm ơn)',
              sentAt: new Date().toLocaleString('vi-VN'),
              message: `Cảm ơn ${customer.name} đã mua hàng! Kích hoạt quy trình tự động chăm sóc dịch vụ...`,
              status: 'Delivered' as const,
            }],
          },
        };
      }));
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context) queryClient.setQueryData(queryKeys.customers, context.previous);
    },
    onSuccess: (saved) => {
      queryClient.setQueryData<Customer[]>(queryKeys.customers, (current = []) =>
        current.map((customer) => customer.id === saved.id ? saved : customer)
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.customers }),
  });

  const createMutation = useMutation({
    mutationFn: async (order: CustomerOrder) => {
      if (!order.customerId) throw new Error('Đơn hàng chưa có khách hàng.');
      await api.post('/orders', {
        customerId: order.customerId,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        products: order.products,
        totalAmount: order.totalAmount,
        notes: order.notes,
      });
      return mapApiCustomerToFrontend(await api.get<any>(`/customers/${order.customerId}`));
    },
    onMutate: async (order) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.customers });
      const previous = queryClient.getQueryData<Customer[]>(queryKeys.customers) || [];
      queryClient.setQueryData<Customer[]>(queryKeys.customers, previous.map((customer) => {
        if (customer.id !== order.customerId) return customer;
        return {
          ...withOrderSummary(customer, [order, ...(customer.orders || [])]),
          status: customer.status === 'Won' ? 'Won' : order.status === 'Completed' ? 'Won' : customer.status,
          lastPurchaseDate: order.date,
        };
      }));
      return { previous };
    },
    onError: (_error, _order, context) => {
      if (context) queryClient.setQueryData(queryKeys.customers, context.previous);
    },
    onSuccess: (saved) => {
      queryClient.setQueryData<Customer[]>(queryKeys.customers, (current = []) =>
        current.map((customer) => customer.id === saved.id ? saved : customer)
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.customers }),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ orderId, customerId, status }: { orderId: string; customerId: string; status: CustomerOrder['status'] }) => {
      await api.patch(`/orders/${orderId}/status`, { status });
      return mapApiCustomerToFrontend(await api.get<any>(`/customers/${customerId}`));
    },
    onMutate: async ({ orderId, customerId, status }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.customers });
      const previous = queryClient.getQueryData<Customer[]>(queryKeys.customers) || [];
      queryClient.setQueryData<Customer[]>(queryKeys.customers, previous.map((customer) => {
        if (customer.id !== customerId) return customer;
        return withOrderSummary(customer, customer.orders.map((order) =>
          order.id === orderId ? { ...order, status } : order
        ));
      }));
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context) queryClient.setQueryData(queryKeys.customers, context.previous);
    },
    onSuccess: (saved) => {
      queryClient.setQueryData<Customer[]>(queryKeys.customers, (current = []) =>
        current.map((customer) => customer.id === saved.id ? saved : customer)
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.customers }),
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ orderId, customerId }: { orderId: string; customerId: string }) => ({ orderId, customerId }),
    onMutate: async ({ orderId, customerId }) => {
      const previous = queryClient.getQueryData<Customer[]>(queryKeys.customers) || [];
      queryClient.setQueryData<Customer[]>(queryKeys.customers, previous.map((customer) =>
        customer.id === customerId
          ? withOrderSummary(customer, customer.orders.filter((order) => order.id !== orderId))
          : customer
      ));
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context) queryClient.setQueryData(queryKeys.customers, context.previous);
    },
  });

  const importMutation = useMutation({
    mutationFn: async (orders: { customerPhone: string; order: CustomerOrder }[]) => orders,
    onMutate: async (importedOrders) => {
      const previous = queryClient.getQueryData<Customer[]>(queryKeys.customers) || [];
      let updated = [...previous];
      importedOrders.forEach(({ customerPhone, order }) => {
        const normalizedPhone = customerPhone.replace(/\s+/g, '');
        const index = updated.findIndex((customer) => customer.phone.replace(/\s+/g, '') === normalizedPhone);
        if (index === -1) {
          const customerId = `cust_ord_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
          updated = [{
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
          }, ...updated];
          return;
        }
        const customer = updated[index];
        updated[index] = {
          ...withOrderSummary(customer, [{ ...order, customerId: customer.id }, ...customer.orders]),
          status: customer.status === 'Won' ? 'Won' : order.status === 'Completed' ? 'Won' : customer.status,
          lastPurchaseDate: order.date,
        };
      });
      queryClient.setQueryData(queryKeys.customers, updated);
      return { previous };
    },
    onError: (_error, _orders, context) => {
      if (context) queryClient.setQueryData(queryKeys.customers, context.previous);
    },
  });

  const addOrder = useCallback(async (customerId: string, order: CustomerOrder) => {
    const succeeded = await addMutation.mutateAsync({ customerId, order })
      .then(() => true)
      .catch((error) => {
        console.error('Error adding order:', error);
        return false;
      });
    if (succeeded) alert('Tạo đơn hàng thành công! Đã tự động kích hoạt quy trình Chăm sóc WhatsApp Ngày +3!');
  }, [addMutation]);
  const createOrder = useCallback(async (order: CustomerOrder) => {
    if (order.customerId) await createMutation.mutateAsync(order).catch((error) => console.error('Error creating order:', error));
  }, [createMutation]);
  const updateOrderStatus = useCallback(async (orderId: string, customerId: string, status: CustomerOrder['status']) => {
    await statusMutation.mutateAsync({ orderId, customerId, status }).catch((error) => console.error('Error updating order:', error));
  }, [statusMutation]);
  const deleteOrder = useCallback((orderId: string, customerId: string) => {
    deleteMutation.mutate({ orderId, customerId });
  }, [deleteMutation]);
  const importOrders = useCallback((orders: { customerPhone: string; order: CustomerOrder }[]) => {
    importMutation.mutate(orders);
  }, [importMutation]);

  const error = addMutation.error || createMutation.error || statusMutation.error || deleteMutation.error || importMutation.error;
  return {
    addOrder,
    createOrder,
    updateOrderStatus,
    deleteOrder,
    importOrders,
    isMutating: addMutation.isPending || createMutation.isPending || statusMutation.isPending || deleteMutation.isPending || importMutation.isPending,
    isError: Boolean(error),
    error,
  };
}
