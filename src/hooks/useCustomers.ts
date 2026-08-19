import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { INITIAL_CUSTOMERS } from '../data/mockData';
import type { AppUser, CentralMessage, Customer, CustomerStatus } from '../types';
import { getCustomerGroup, isSamePhoneNumber } from '../utils/crmUtils';
import { api } from '../utils/apiClient';
import { mapApiCustomerToFrontend } from '../utils/apiMappers';

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
  const [customers, setCustomers] = useState<Customer[]>(loadCustomers);
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
    if (!currentUser) return;
    try {
      const response = await api.get<any>('/customers');
      const customerList = Array.isArray(response) ? response : response?.data || [];
      if (Array.isArray(customerList)) {
        setCustomers(customerList.map(mapApiCustomerToFrontend));
      }
    } catch {
      // Keep local data when the backend is unavailable.
    }
  }, [currentUser]);

  useEffect(() => {
    void fetchCustomers();
  }, [fetchCustomers]);

  const saveCustomer = useCallback(async (data: Partial<Customer>) => {
    if (data.id) {
      let updatedCustomer: Customer | null = null;
      try {
        const response = await api.put<any>(`/customers/${data.id}`, data);
        if (response) updatedCustomer = mapApiCustomerToFrontend(response);
      } catch (error) {
        console.error('API error updating customer, falling back to local:', error);
      }

      setCustomers((previous) =>
        previous.map((customer) =>
          customer.id === data.id
            ? updatedCustomer || ({ ...customer, ...data } as Customer)
            : customer
        )
      );
      return;
    }

    let savedCustomer: Customer | null = null;
    try {
      const response = await api.post<any>('/customers', data);
      if (response) savedCustomer = mapApiCustomerToFrontend(response);
    } catch (error) {
      console.error('API error creating customer, falling back to local:', error);
    }

    const newCustomer: Customer = savedCustomer || {
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
    setCustomers((previous) => [newCustomer, ...previous]);
  }, []);

  const importCustomers = useCallback((newCustomers: Customer[]) => {
    setCustomers((previous) => [...newCustomers, ...previous]);
  }, []);

  const deleteCustomer = useCallback(async (customerId: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa khách hàng này khỏi CRM?')) return false;
    try {
      await api.delete(`/customers/${customerId}`);
    } catch (error) {
      console.error('API error deleting customer, falling back to local:', error);
    }
    setCustomers((previous) => previous.filter((customer) => customer.id !== customerId));
    return true;
  }, []);

  const updateStatus = useCallback(async (customerId: string, newStatus: CustomerStatus) => {
    const customer = customers.find((item) => item.id === customerId);
    if (!customer) return;

    let updatedCustomer: Customer | null = null;
    try {
      await api.put(`/customers/${customerId}`, { status: newStatus });
      await api.post(`/customers/${customerId}/notes`, {
        content: `Chuyển trạng thái từ "${customer.status}" sang "${newStatus}".`,
        type: 'system',
        author: 'Hệ Thống',
      });
      const response = await api.get<any>(`/customers/${customerId}`);
      if (response) updatedCustomer = mapApiCustomerToFrontend(response);
    } catch (error) {
      console.error('API error updating customer status, fallback to local:', error);
    }

    setCustomers((previous) =>
      previous.map((item) => {
        if (item.id !== customerId) return item;
        if (updatedCustomer) return updatedCustomer;
        return {
          ...item,
          status: newStatus,
          notes: [
            ...(item.notes || []),
            {
              id: `n_${Date.now()}`,
              author: 'Hệ Thống',
              content: `Chuyển trạng thái từ "${item.status}" sang "${newStatus}".`,
              createdAt: new Date().toLocaleString('vi-VN'),
              type: 'system' as const,
            },
          ],
        };
      })
    );
  }, [customers]);

  const toggleOptIn = useCallback(async (customerId: string) => {
    const customer = customers.find((item) => item.id === customerId);
    if (!customer) return;
    const whatsappOptIn = !customer.whatsappOptIn;

    let updatedCustomer: Customer | null = null;
    try {
      const response = await api.put<any>(`/customers/${customerId}`, { whatsappOptIn });
      if (response) updatedCustomer = mapApiCustomerToFrontend(response);
    } catch (error) {
      console.error('API error toggling opt-in, fallback to local:', error);
    }

    setCustomers((previous) =>
      previous.map((item) =>
        item.id === customerId ? updatedCustomer || { ...item, whatsappOptIn } : item
      )
    );
  }, [customers]);

  const addNote = useCallback(async (customerId: string, noteText: string) => {
    const customer = customers.find((item) => item.id === customerId);
    if (!customer) return;

    let updatedCustomer: Customer | null = null;
    try {
      await api.post(`/customers/${customerId}/notes`, {
        content: noteText,
        type: 'note',
        author: customer.owner,
      });
      const response = await api.get<any>(`/customers/${customerId}`);
      if (response) updatedCustomer = mapApiCustomerToFrontend(response);
    } catch (error) {
      console.error('API error adding note, fallback to local:', error);
    }

    setCustomers((previous) =>
      previous.map((item) => {
        if (item.id !== customerId) return item;
        if (updatedCustomer) return updatedCustomer;
        return {
          ...item,
          notes: [
            {
              id: `n_${Date.now()}`,
              author: item.owner,
              content: noteText,
              createdAt: new Date().toLocaleString('vi-VN'),
              type: 'note' as const,
            },
            ...item.notes,
          ],
        };
      })
    );
  }, [customers]);

  const runAutomationSimulation = useCallback(async () => {
    const now = new Date().toLocaleString('vi-VN');
    const stepNames = [
      'Ngày +3 (Lời cảm ơn & HDSD)',
      'Ngày +5 (Hỏi trải nghiệm)',
      'Ngày +7 (Giải đáp & Gợi ý)',
      'Ngày +15 (Gửi Voucher 20%)',
    ];

    try {
      await Promise.all(
        customers.map(async (customer) => {
          if (customer.totalOrders < 1 || !customer.automationSequence) return;
          const nextStep = (customer.automationSequence.currentStep % 4) + 1;
          const stepName = stepNames[nextStep - 1];
          await api.post(`/customers/${customer.id}/automation-logs`, {
            step: nextStep,
            stepName,
            message: `[Tự Động Kích Hoạt - ${stepName}] Chào ${customer.name}, VietCRM vừa tự động gửi tin chăm sóc cho bạn theo tiến trình!`,
            status: 'Read',
          });
        })
      );
      await fetchCustomers();
    } catch (error) {
      console.error('Failed to run simulation on backend:', error);
      setCustomers((previous) =>
        previous.map((customer) => {
          if (customer.totalOrders < 1 || !customer.automationSequence) return customer;
          const nextStep = (customer.automationSequence.currentStep % 4) + 1;
          const stepName = stepNames[nextStep - 1];
          return {
            ...customer,
            automationSequence: {
              ...customer.automationSequence,
              active: true,
              currentStep: nextStep,
              logs: [
                ...customer.automationSequence.logs,
                {
                  step: nextStep,
                  stepName,
                  sentAt: now,
                  message: `[Tự Động Kích Hoạt - ${stepName}] Chào ${customer.name}, VietCRM vừa tự động gửi tin chăm sóc cho bạn theo tiến trình!`,
                  status: 'Read' as const,
                },
              ],
            },
          };
        })
      );
    }
  }, [customers, fetchCustomers]);

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
    setCustomers(INITIAL_CUSTOMERS);
  }, []);

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
  };
}
