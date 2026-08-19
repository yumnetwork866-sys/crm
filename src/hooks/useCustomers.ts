import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { INITIAL_CUSTOMERS } from '../data/mockData';
import type { AppUser, CentralMessage, Customer, CustomerStatus } from '../types';
import { getCustomerGroup, isSamePhoneNumber } from '../utils/crmUtils';
import { api } from '../utils/apiClient';
import { mapApiCustomerToFrontend } from '../utils/apiMappers';
import { queryKeys } from '../lib/queryClient';

const STORAGE_KEY_CUSTOMERS = 'yumcrm_customers_v2';

const loadCustomers = (): Customer[] => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_CUSTOMERS);
    return saved ? JSON.parse(saved) : INITIAL_CUSTOMERS;
  } catch {
    return INITIAL_CUSTOMERS;
  }
};

export interface CustomerFilterModel {
  searchQuery: string;
  setSearchQuery: Dispatch<SetStateAction<string>>;
  selectedStatus: string;
  setSelectedStatus: Dispatch<SetStateAction<string>>;
  selectedSource: string;
  setSelectedSource: Dispatch<SetStateAction<string>>;
  selectedGender: string;
  setSelectedGender: Dispatch<SetStateAction<string>>;
  selectedGroup: string;
  setSelectedGroup: Dispatch<SetStateAction<string>>;
  selectedOwner: string;
  setSelectedOwner: Dispatch<SetStateAction<string>>;
  selectedOptIn: string;
  setSelectedOptIn: Dispatch<SetStateAction<string>>;
  startDate: string;
  setStartDate: Dispatch<SetStateAction<string>>;
  endDate: string;
  setEndDate: Dispatch<SetStateAction<string>>;
  filteredCustomers: Customer[];
  isCustomerOptedIn: (customer: Customer) => boolean;
}

const matchesGender = (customerGender: string | undefined, filterGender: string) => {
  if (!filterGender || filterGender === 'ALL') return true;
  if (!customerGender) return false;
  const customerValue = customerGender.trim().toLowerCase();
  const filterValue = filterGender.trim().toLowerCase();
  if (filterValue === 'nam') return ['nam', 'male', 'm'].includes(customerValue);
  if (filterValue === 'nữ' || filterValue === 'nu') {
    return ['nữ', 'nu', 'female', 'f'].includes(customerValue);
  }
  if (filterValue === 'khác' || filterValue === 'khac') {
    return ['khác', 'khac', 'other'].includes(customerValue)
      || !['nam', 'male', 'm', 'nữ', 'nu', 'female', 'f'].includes(customerValue);
  }
  return customerValue === filterValue;
};

export function useCustomers(currentUser: AppUser | null) {
  const queryClient = useQueryClient();
  const customersQuery = useQuery<Customer[]>({
    queryKey: queryKeys.customers,
    queryFn: async () => {
      const response = await api.get<unknown>('/customers');
      const customerList = Array.isArray(response)
        ? response
        : typeof response === 'object' && response !== null
          && 'data' in response && Array.isArray(response.data)
          ? response.data
          : [];
      return customerList.map(mapApiCustomerToFrontend);
    },
    enabled: Boolean(currentUser),
    initialData: loadCustomers,
    initialDataUpdatedAt: 0,
  });
  const customers = useMemo(() => customersQuery.data ?? [], [customersQuery.data]);
  const setCustomers: Dispatch<SetStateAction<Customer[]>> = useCallback((update) => {
    queryClient.setQueryData<Customer[]>(queryKeys.customers, (current = []) =>
      typeof update === 'function' ? update(current) : update
    );
  }, [queryClient]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedSource, setSelectedSource] = useState('ALL');
  const [selectedGender, setSelectedGender] = useState('ALL');
  const [selectedGroup, setSelectedGroup] = useState('ALL');
  const [selectedOwner, setSelectedOwner] = useState('ALL');
  const [selectedOptIn, setSelectedOptIn] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_CUSTOMERS, JSON.stringify(customers));
    } catch (error) {
      console.error('Error saving customers to localStorage', error);
    }
  }, [customers]);

  const fetchCustomers = useCallback(async () => {
    await customersQuery.refetch();
  }, [customersQuery]);


  const saveMutation = useMutation({
    mutationFn: async (data: Partial<Customer>) => {
      const response = data.id
        ? await api.put<any>(`/customers/${data.id}`, data)
        : await api.post<any>('/customers', data);
      return mapApiCustomerToFrontend(response);
    },
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.customers });
      const previous = queryClient.getQueryData<Customer[]>(queryKeys.customers) || [];
      if (data.id) {
        queryClient.setQueryData<Customer[]>(queryKeys.customers, (current = []) =>
          current.map((customer) => customer.id === data.id ? { ...customer, ...data } as Customer : customer)
        );
        return { previous, optimisticId: data.id };
      }

      const optimistic: Customer = {
        id: `cust_${Date.now()}`,
        phone: data.phone || '',
        name: data.name || '',
        gender: data.gender || 'Nữ',
        address: data.address || 'Kuala Lumpur, Malaysia',
        email: data.email,
        note: data.note || '',
        source: data.source || 'Facebook',
        campaign: data.campaign || 'Default Campaign',
        adSet: data.adSet,
        landingPage: data.landingPage,
        firstContact: data.firstContact || new Date().toISOString().split('T')[0],
        lastContact: data.lastContact || new Date().toISOString().split('T')[0],
        owner: data.owner || 'Nguyễn Văn Ánh',
        status: data.status || 'New Lead',
        notes: data.notes || [],
        totalOrders: 0,
        totalSpent: 0,
        interestedProducts: data.interestedProducts || [],
        whatsappOptIn: data.whatsappOptIn ?? true,
        whatsappOptInDate: new Date().toISOString().split('T')[0],
        orders: [],
      };
      queryClient.setQueryData<Customer[]>(queryKeys.customers, [optimistic, ...previous]);
      return { previous, optimisticId: optimistic.id };
    },
    onError: (_error, _data, context) => {
      if (context) queryClient.setQueryData(queryKeys.customers, context.previous);
    },
    onSuccess: (saved, _data, context) => {
      queryClient.setQueryData<Customer[]>(queryKeys.customers, (current = []) =>
        current.map((customer) => customer.id === context?.optimisticId ? saved : customer)
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.customers }),
  });

  const importMutation = useMutation({
    mutationFn: async (newCustomers: Customer[]) => newCustomers,
    onMutate: async (newCustomers) => {
      const previous = queryClient.getQueryData<Customer[]>(queryKeys.customers) || [];
      queryClient.setQueryData<Customer[]>(queryKeys.customers, [...newCustomers, ...previous]);
      return { previous };
    },
    onError: (_error, _customers, context) => {
      if (context) queryClient.setQueryData(queryKeys.customers, context.previous);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (customerId: string) => api.delete(`/customers/${customerId}`),
    onMutate: async (customerId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.customers });
      const previous = queryClient.getQueryData<Customer[]>(queryKeys.customers) || [];
      queryClient.setQueryData<Customer[]>(queryKeys.customers, (current = []) =>
        current.filter((customer) => customer.id !== customerId)
      );
      return { previous };
    },
    onError: (_error, _customerId, context) => {
      if (context) queryClient.setQueryData(queryKeys.customers, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.customers }),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ customerId, status }: { customerId: string; status: CustomerStatus }) => {
      const customer = queryClient.getQueryData<Customer[]>(queryKeys.customers)?.find((item) => item.id === customerId);
      await api.put(`/customers/${customerId}`, { status });
      await api.post(`/customers/${customerId}/notes`, {
        content: `Chuyển trạng thái từ "${customer?.status || ''}" sang "${status}".`,
        type: 'system',
        author: 'Hệ Thống',
      });
      return mapApiCustomerToFrontend(await api.get<any>(`/customers/${customerId}`));
    },
    onMutate: async ({ customerId, status }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.customers });
      const previous = queryClient.getQueryData<Customer[]>(queryKeys.customers) || [];
      queryClient.setQueryData<Customer[]>(queryKeys.customers, (current = []) =>
        current.map((customer) => customer.id === customerId ? {
          ...customer,
          status,
          notes: [...(customer.notes || []), {
            id: `n_${Date.now()}`,
            author: 'Hệ Thống',
            content: `Chuyển trạng thái từ "${customer.status}" sang "${status}".`,
            createdAt: new Date().toLocaleString('vi-VN'),
            type: 'system' as const,
          }],
        } : customer)
      );
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

  const optInMutation = useMutation({
    mutationFn: async ({ customerId, whatsappOptIn }: { customerId: string; whatsappOptIn: boolean }) =>
      mapApiCustomerToFrontend(await api.put<any>(`/customers/${customerId}`, { whatsappOptIn })),
    onMutate: async ({ customerId, whatsappOptIn }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.customers });
      const previous = queryClient.getQueryData<Customer[]>(queryKeys.customers) || [];
      queryClient.setQueryData<Customer[]>(queryKeys.customers, (current = []) =>
        current.map((customer) => customer.id === customerId ? { ...customer, whatsappOptIn } : customer)
      );
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

  const noteMutation = useMutation({
    mutationFn: async ({ customerId, noteText, author }: { customerId: string; noteText: string; author: string }) => {
      await api.post(`/customers/${customerId}/notes`, { content: noteText, type: 'note', author });
      return mapApiCustomerToFrontend(await api.get<any>(`/customers/${customerId}`));
    },
    onMutate: async ({ customerId, noteText, author }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.customers });
      const previous = queryClient.getQueryData<Customer[]>(queryKeys.customers) || [];
      queryClient.setQueryData<Customer[]>(queryKeys.customers, (current = []) =>
        current.map((customer) => customer.id === customerId ? {
          ...customer,
          notes: [{ id: `n_${Date.now()}`, author, content: noteText, createdAt: new Date().toLocaleString('vi-VN'), type: 'note' as const }, ...customer.notes],
        } : customer)
      );
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

  const automationMutation = useMutation({
    mutationFn: async () => {
      await Promise.all(customers.map(async (customer) => {
        if (customer.totalOrders < 1 || !customer.automationSequence) return;
        const stepNames = ['Ngày +3 (Lời cảm ơn & HDSD)', 'Ngày +5 (Hỏi trải nghiệm)', 'Ngày +7 (Giải đáp & Gợi ý)', 'Ngày +15 (Gửi Voucher 20%)'];
        const nextStep = (customer.automationSequence.currentStep % 4) + 1;
        const stepName = stepNames[nextStep - 1];
        await api.post(`/customers/${customer.id}/automation-logs`, {
          step: nextStep,
          stepName,
          message: `[Tự Động Kích Hoạt - ${stepName}] Chào ${customer.name}, VietCRM vừa tự động gửi tin chăm sóc cho bạn theo tiến trình!`,
          status: 'Read',
        });
      }));
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: queryKeys.customers });
      const previous = queryClient.getQueryData<Customer[]>(queryKeys.customers) || [];
      const stepNames = ['Ngày +3 (Lời cảm ơn & HDSD)', 'Ngày +5 (Hỏi trải nghiệm)', 'Ngày +7 (Giải đáp & Gợi ý)', 'Ngày +15 (Gửi Voucher 20%)'];
      queryClient.setQueryData<Customer[]>(queryKeys.customers, previous.map((customer) => {
        if (customer.totalOrders < 1 || !customer.automationSequence) return customer;
        const nextStep = (customer.automationSequence.currentStep % 4) + 1;
        const stepName = stepNames[nextStep - 1];
        return { ...customer, automationSequence: { ...customer.automationSequence, active: true, currentStep: nextStep, logs: [...customer.automationSequence.logs, {
          step: nextStep,
          stepName,
          sentAt: new Date().toLocaleString('vi-VN'),
          message: `[Tự Động Kích Hoạt - ${stepName}] Chào ${customer.name}, VietCRM vừa tự động gửi tin chăm sóc cho bạn theo tiến trình!`,
          status: 'Read' as const,
        }] } };
      }));
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context) queryClient.setQueryData(queryKeys.customers, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.customers }),
  });

  const saveCustomer = useCallback(async (data: Partial<Customer>) => {
    await saveMutation.mutateAsync(data).catch((error) => console.error('Error saving customer:', error));
  }, [saveMutation]);
  const importCustomers = useCallback((newCustomers: Customer[]) => importMutation.mutate(newCustomers), [importMutation]);
  const deleteCustomer = useCallback(async (customerId: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa khách hàng này khỏi CRM?')) return false;
    try {
      await deleteMutation.mutateAsync(customerId);
      return true;
    } catch (error) {
      console.error('Error deleting customer:', error);
      return false;
    }
  }, [deleteMutation]);
  const updateStatus = useCallback(async (customerId: string, status: CustomerStatus) => {
    await statusMutation.mutateAsync({ customerId, status }).catch((error) => console.error('Error updating status:', error));
  }, [statusMutation]);
  const toggleOptIn = useCallback(async (customerId: string) => {
    const customer = queryClient.getQueryData<Customer[]>(queryKeys.customers)?.find((item) => item.id === customerId);
    if (customer) await optInMutation.mutateAsync({ customerId, whatsappOptIn: !customer.whatsappOptIn }).catch((error) => console.error('Error updating opt-in:', error));
  }, [optInMutation, queryClient]);
  const addNote = useCallback(async (customerId: string, noteText: string) => {
    const customer = queryClient.getQueryData<Customer[]>(queryKeys.customers)?.find((item) => item.id === customerId);
    if (customer) await noteMutation.mutateAsync({ customerId, noteText, author: customer.owner }).catch((error) => console.error('Error adding note:', error));
  }, [noteMutation, queryClient]);
  const runAutomationSimulation = useCallback(async () => {
    await automationMutation.mutateAsync().catch((error) => console.error('Error running automation:', error));
  }, [automationMutation]);

  const customerCounts = useMemo(
    () => ({
      total: customers.length,
      g1: customers.filter((customer) => getCustomerGroup(customer) === 'group_1').length,
      g2: customers.filter((customer) => getCustomerGroup(customer) === 'group_2').length,
      g3: customers.filter((customer) => getCustomerGroup(customer) === 'group_3').length,
      g4: customers.filter((customer) => getCustomerGroup(customer) === 'group_4').length,
    }),
    [customers]
  );

  const resetCustomers = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY_CUSTOMERS);
    queryClient.setQueryData(queryKeys.customers, INITIAL_CUSTOMERS);
  }, [queryClient]);

  const buildFilterModel = useCallback((messages: CentralMessage[]): CustomerFilterModel => {
    const chattedIdentifiers = new Set<string>();
    messages.forEach((message) => {
      if (message.customerPhone) {
        const phone = message.customerPhone.replace(/\D/g, '');
        if (phone) chattedIdentifiers.add(phone.length >= 7 ? phone.slice(-9) : phone);
      }
      if (message.customerId) {
        const identifier = message.customerId.startsWith('cust_')
          ? message.customerId.replace('cust_', '').replace(/\D/g, '')
          : message.customerId;
        if (identifier) {
          chattedIdentifiers.add(identifier.length >= 7 ? identifier.slice(-9) : identifier);
        }
      }
    });

    const isCustomerOptedIn = (customer: Customer) => {
      if (customer.whatsappOptIn || chattedIdentifiers.has(customer.id)) return true;
      const phone = customer.phone?.replace(/\D/g, '') || '';
      if (phone && (chattedIdentifiers.has(phone) || chattedIdentifiers.has(phone.slice(-9)))) return true;
      return messages.some(
        (message) => message.customerId === customer.id
          || isSamePhoneNumber(message.customerPhone, customer.phone)
          || isSamePhoneNumber(message.customerId, customer.phone)
      );
    };

    const normalizedQuery = searchQuery.toLowerCase().trim();
    const filteredCustomers = customers.filter((customer) => {
      if (normalizedQuery) {
        const matches = customer.name.toLowerCase().includes(normalizedQuery)
          || customer.phone.includes(normalizedQuery)
          || Boolean(customer.email?.toLowerCase().includes(normalizedQuery))
          || customer.campaign.toLowerCase().includes(normalizedQuery)
          || Boolean(customer.address?.toLowerCase().includes(normalizedQuery))
          || Boolean(customer.note?.toLowerCase().includes(normalizedQuery));
        if (!matches) return false;
      }
      if (selectedStatus !== 'ALL' && customer.status !== selectedStatus) return false;
      if (selectedSource !== 'ALL' && customer.source !== selectedSource) return false;
      if (!matchesGender(customer.gender, selectedGender)) return false;
      if (selectedOwner !== 'ALL' && customer.owner !== selectedOwner) return false;
      if (selectedOptIn === 'optin' && !isCustomerOptedIn(customer)) return false;
      if (selectedOptIn === 'no_optin' && isCustomerOptedIn(customer)) return false;
      if (selectedGroup !== 'ALL' && getCustomerGroup(customer) !== selectedGroup) return false;
      if (startDate && customer.firstContact && customer.firstContact < startDate) return false;
      if (endDate && customer.firstContact && customer.firstContact > endDate) return false;
      return true;
    });

    return {
      searchQuery,
      setSearchQuery,
      selectedStatus,
      setSelectedStatus,
      selectedSource,
      setSelectedSource,
      selectedGender,
      setSelectedGender,
      selectedGroup,
      setSelectedGroup,
      selectedOwner,
      setSelectedOwner,
      selectedOptIn,
      setSelectedOptIn,
      startDate,
      setStartDate,
      endDate,
      setEndDate,
      filteredCustomers,
      isCustomerOptedIn,
    };
  }, [
    customers,
    searchQuery,
    selectedStatus,
    selectedSource,
    selectedGender,
    selectedGroup,
    selectedOwner,
    selectedOptIn,
    startDate,
    endDate,
  ]);

  const mutationError = saveMutation.error || importMutation.error || deleteMutation.error
    || statusMutation.error || optInMutation.error || noteMutation.error || automationMutation.error;
  return {
    customers,
    setCustomers,
    customerCounts,
    fetchCustomers,
    saveCustomer,
    importCustomers,
    deleteCustomer,
    updateStatus,
    toggleOptIn,
    addNote,
    runAutomationSimulation,
    resetCustomers,
    buildFilterModel,
    isLoading: customersQuery.isLoading,
    isFetching: customersQuery.isFetching,
    isError: customersQuery.isError || Boolean(mutationError),
    error: customersQuery.error || mutationError,
    isMutating: saveMutation.isPending || importMutation.isPending || deleteMutation.isPending
      || statusMutation.isPending || optInMutation.isPending || noteMutation.isPending || automationMutation.isPending,
  };
}
