import React, { useState, useEffect } from 'react';
import { Customer, CustomerStatus, CustomerOrder, BroadcastCampaign, AppUser, Product, MarketingCampaignReport } from './types';
import { INITIAL_CUSTOMERS, INITIAL_CAMPAIGNS, INITIAL_MARKETING_REPORTS, INITIAL_USERS, INITIAL_PRODUCT_LIST } from './data/mockData';
import { getCustomerGroup } from './utils/crmUtils';
import { api, getStoredToken } from './utils/apiClient';

import { Header } from './components/Header';
import { Navigation, ActiveTab } from './components/Navigation';

import { CustomerList } from './components/CustomerManagement/CustomerList';
import { CustomerDetailModal } from './components/CustomerManagement/CustomerDetailModal';
import { CustomerFormModal } from './components/CustomerManagement/CustomerFormModal';
import { AddOrderModal } from './components/CustomerManagement/AddOrderModal';
import { CustomerChatModal } from './components/CustomerManagement/CustomerChatModal';

import { SegmentationView } from './components/CustomerSegmentation/SegmentationView';
import { AutomationView } from './components/Automation/AutomationView';
import { BroadcastView } from './components/Broadcast/BroadcastView';
import { ReportsDashboard } from './components/Reports/ReportsDashboard';
import { UserManagementView } from './components/UserManagement/UserManagementView';
import { ProductManagementView } from './components/ProductManagement/ProductManagementView';
import { OrderManagementView } from './components/OrderManagement/OrderManagementView';
import { MetaVerificationView } from './components/Meta/MetaVerificationView';
import { PrivacyPolicyView } from './components/Legal/PrivacyPolicyView';
import { TermsOfServiceView } from './components/Legal/TermsOfServiceView';
import { DataDeletionView } from './components/Legal/DataDeletionView';

import { LoginModal } from './components/Auth/LoginModal';
import { UserFormModal } from './components/UserManagement/UserFormModal';

const STORAGE_KEY_CUSTOMERS = 'yumcrm_customers_v2';
const STORAGE_KEY_CAMPAIGNS = 'yumcrm_campaigns_v2';
const STORAGE_KEY_USERS = 'yumcrm_users_v2';
const STORAGE_KEY_CURRENT_USER = 'yumcrm_current_user_v2';
const STORAGE_KEY_PRODUCTS = 'yumcrm_products_v2';
const STORAGE_KEY_MARKETING_REPORTS = 'yumcrm_marketing_reports_v2';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('crm');
  const [legalView, setLegalView] = useState<'privacy' | 'terms' | 'deletion' | null>(() => {
    const hash = window.location.hash;
    if (hash === '#privacy') return 'privacy';
    if (hash === '#terms') return 'terms';
    if (hash === '#data-deletion' || hash.startsWith('#data-deletion')) return 'deletion';
    return null;
  });

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash === '#privacy') setLegalView('privacy');
      else if (hash === '#terms') setLegalView('terms');
      else if (hash === '#data-deletion' || hash.startsWith('#data-deletion')) setLegalView('deletion');
      else setLegalView(null);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Load persistent customers
  const [customers, setCustomers] = useState<Customer[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CUSTOMERS);
      return saved ? JSON.parse(saved) : INITIAL_CUSTOMERS;
    } catch {
      return INITIAL_CUSTOMERS;
    }
  });

  // Load persistent campaigns
  const [campaigns, setCampaigns] = useState<BroadcastCampaign[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CAMPAIGNS);
      return saved ? JSON.parse(saved) : INITIAL_CAMPAIGNS;
    } catch {
      return INITIAL_CAMPAIGNS;
    }
  });

  // Load persistent products
  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PRODUCTS);
      return saved ? JSON.parse(saved) : INITIAL_PRODUCT_LIST;
    } catch {
      return INITIAL_PRODUCT_LIST;
    }
  });

  // Sync products to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_PRODUCTS, JSON.stringify(products));
    } catch (e) {
      console.error('Error saving products to localStorage', e);
    }
  }, [products]);
  const [users, setUsers] = useState<AppUser[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_USERS);
      return saved ? JSON.parse(saved) : INITIAL_USERS;
    } catch {
      return INITIAL_USERS;
    }
  });

  // Load active logged-in user
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CURRENT_USER);
      if (saved) return JSON.parse(saved);
      return null;
    } catch {
      return null;
    }
  });

  const [marketingReports, setMarketingReports] = useState<MarketingCampaignReport[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_MARKETING_REPORTS);
      return saved ? JSON.parse(saved) : INITIAL_MARKETING_REPORTS;
    } catch {
      return INITIAL_MARKETING_REPORTS;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_MARKETING_REPORTS, JSON.stringify(marketingReports));
    } catch (e) {
      console.error('Error saving marketing reports to localStorage', e);
    }
  }, [marketingReports]);

  // Sync with Backend API if server is online
  useEffect(() => {
    const fetchApiData = async () => {
      try {
        const health: any = await api.get('/health');
        if (health && health.status === 'ok') {
          // Server is online, load data if token or public data
          const apiCustomers = await api.get<Customer[]>('/customers').catch(() => null);
          if (apiCustomers && Array.isArray(apiCustomers)) {
            setCustomers(apiCustomers);
          }
          const apiProducts = await api.get<Product[]>('/products').catch(() => null);
          if (apiProducts && Array.isArray(apiProducts)) {
            setProducts(apiProducts);
          }
          const apiCampaigns = await api.get<BroadcastCampaign[]>('/campaigns').catch(() => null);
          if (apiCampaigns && Array.isArray(apiCampaigns)) {
            setCampaigns(apiCampaigns);
          }
        }
      } catch (err) {
        // Backend offline, fallback to local storage mode
      }
    };
    fetchApiData();
  }, []);

  const [autoSimCounter, setAutoSimCounter] = useState(1);
  const [, setCurrencyTick] = useState(0);

  // Theme state (fixed to light mode)
  const [theme] = useState<'light'>('light');

  // Modals state
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const [orderCustomer, setOrderCustomer] = useState<Customer | null>(null);
  const [isOrderOpen, setIsOrderOpen] = useState(false);

  const [chatCustomer, setChatCustomer] = useState<Customer | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);

  const [broadcastDefaultGroup, setBroadcastDefaultGroup] = useState<string>('Tất cả khách hàng');

  // Auth & User Management Modals
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isUserFormOpen, setIsUserFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);

  // Sync state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_CUSTOMERS, JSON.stringify(customers));
    } catch (e) {
      console.error('Error saving customers to localStorage', e);
    }
  }, [customers]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_CAMPAIGNS, JSON.stringify(campaigns));
    } catch (e) {
      console.error('Error saving campaigns to localStorage', e);
    }
  }, [campaigns]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
    } catch (e) {
      console.error('Error saving users to localStorage', e);
    }
  }, [users]);

  useEffect(() => {
    try {
      if (currentUser) {
        localStorage.setItem(STORAGE_KEY_CURRENT_USER, JSON.stringify(currentUser));
      } else {
        localStorage.removeItem(STORAGE_KEY_CURRENT_USER);
      }
    } catch (e) {
      console.error('Error saving current user to localStorage', e);
    }
  }, [currentUser]);

  // Customer Group Counts
  const customerCounts = {
    total: customers.length,
    g1: customers.filter((c) => getCustomerGroup(c) === 'group_1').length,
    g2: customers.filter((c) => getCustomerGroup(c) === 'group_2').length,
    g3: customers.filter((c) => getCustomerGroup(c) === 'group_3').length,
    g4: customers.filter((c) => getCustomerGroup(c) === 'group_4').length,
  };

  // Handlers
  const handleSaveCustomer = (data: Partial<Customer>) => {
    if (data.id) {
      // Edit existing
      setCustomers((prev) =>
        prev.map((c) => (c.id === data.id ? ({ ...c, ...data } as Customer) : c))
      );
    } else {
      // Add new
      const newCust: Customer = {
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
      setCustomers((prev) => [newCust, ...prev]);
    }
  };

  const handleImportCustomers = (newCusts: Customer[]) => {
    setCustomers((prev) => [...newCusts, ...prev]);
  };

  const handleImportProducts = (newPrds: Product[]) => {
    setProducts((prev) => [...newPrds, ...prev]);
  };

  const handleImportOrders = (importedOrders: { customerPhone: string; order: CustomerOrder }[]) => {
    setCustomers((prev) => {
      let updatedList = [...prev];
      importedOrders.forEach(({ customerPhone, order }) => {
        const normalizedPhone = customerPhone.replace(/\s+/g, '');
        let targetCustIndex = updatedList.findIndex(
          (c) => c.phone.replace(/\s+/g, '') === normalizedPhone
        );

        if (targetCustIndex === -1) {
          const newCustId = `cust_ord_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
          const newCust: Customer = {
            id: newCustId,
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
            interestedProducts: order.products.map((p) => p.productName),
            whatsappOptIn: true,
            whatsappOptInDate: new Date().toISOString().split('T')[0],
            orders: [{ ...order, customerId: newCustId }],
          };
          updatedList = [newCust, ...updatedList];
        } else {
          const existingCust = updatedList[targetCustIndex];
          const newOrder = { ...order, customerId: existingCust.id };
          const updatedOrders = [newOrder, ...(existingCust.orders || [])];
          const completedOrders = updatedOrders.filter((o) => o.status === 'Completed');
          const totalSpent = completedOrders.reduce((sum, o) => sum + o.totalAmount, 0);

          updatedList[targetCustIndex] = {
            ...existingCust,
            status: existingCust.status === 'Won' ? 'Won' : (order.status === 'Completed' ? 'Won' : existingCust.status),
            orders: updatedOrders,
            totalOrders: updatedOrders.length,
            totalSpent,
            lastPurchaseDate: order.date,
          };
        }
      });
      return updatedList;
    });
  };

  const handleDeleteCustomer = (id: string) => {
    if (confirm('Bạn có chắc chắn muốn xóa khách hàng này khỏi CRM?')) {
      setCustomers((prev) => prev.filter((c) => c.id !== id));
      if (selectedCustomer?.id === id) setIsDetailOpen(false);
    }
  };

  const handleUpdateStatus = (customerId: string, newStatus: CustomerStatus) => {
    setCustomers((prev) =>
      prev.map((c) => {
        if (c.id === customerId) {
          const updatedNotes = [
            ...(c.notes || []),
            {
              id: `n_${Date.now()}`,
              author: 'Hệ Thống',
              content: `Chuyển trạng thái từ "${c.status}" sang "${newStatus}".`,
              createdAt: new Date().toLocaleString('vi-VN'),
              type: 'system' as const,
            },
          ];
          return { ...c, status: newStatus, notes: updatedNotes };
        }
        return c;
      })
    );

    if (selectedCustomer?.id === customerId) {
      setSelectedCustomer((prev) => (prev ? { ...prev, status: newStatus } : null));
    }
  };

  const handleToggleOptIn = (customerId: string) => {
    setCustomers((prev) =>
      prev.map((c) =>
        c.id === customerId ? { ...c, whatsappOptIn: !c.whatsappOptIn } : c
      )
    );
    if (selectedCustomer?.id === customerId) {
      setSelectedCustomer((prev) =>
        prev ? { ...prev, whatsappOptIn: !prev.whatsappOptIn } : null
      );
    }
  };

  const handleAddNote = (customerId: string, noteText: string) => {
    setCustomers((prev) =>
      prev.map((c) => {
        if (c.id === customerId) {
          const newNote = {
            id: `n_${Date.now()}`,
            author: c.owner,
            content: noteText,
            createdAt: new Date().toLocaleString('vi-VN'),
            type: 'note' as const,
          };
          return { ...c, notes: [newNote, ...c.notes] };
        }
        return c;
      })
    );

    if (selectedCustomer?.id === customerId) {
      setSelectedCustomer((prev) =>
        prev
          ? {
              ...prev,
              notes: [
                {
                  id: `n_${Date.now()}`,
                  author: prev.owner,
                  content: noteText,
                  createdAt: new Date().toLocaleString('vi-VN'),
                  type: 'note',
                },
                ...prev.notes,
              ],
            }
          : null
      );
    }
  };

  const handleAddOrder = (customerId: string, newOrder: CustomerOrder) => {
    setCustomers((prev) =>
      prev.map((c) => {
        if (c.id === customerId) {
          const updatedOrders = [newOrder, ...c.orders];
          const totalOrders = updatedOrders.length;
          const totalSpent = updatedOrders.reduce((sum, o) => sum + o.totalAmount, 0);

          // Initialize or advance Automation sequence
          const nowStr = new Date().toLocaleString('vi-VN');
          const currentSeq = c.automationSequence || {
            active: true,
            currentStep: 0,
            startDate: newOrder.date,
            logs: [],
          };

          const updatedSeq = {
            ...currentSeq,
            active: true,
            currentStep: Math.max(1, currentSeq.currentStep),
            logs: [
              ...currentSeq.logs,
              {
                step: 1,
                stepName: 'Ngày +3 (Lời cảm ơn)',
                sentAt: nowStr,
                message: `Cảm ơn ${c.name} đã mua hàng! Kích hoạt quy trình tự động chăm sóc dịch vụ...`,
                status: 'Delivered' as const,
              },
            ],
          };

          return {
            ...c,
            status: 'Won',
            totalOrders,
            totalSpent,
            lastPurchaseDate: newOrder.date,
            orders: updatedOrders,
            automationSequence: updatedSeq,
          };
        }
        return c;
      })
    );

    alert('Tạo đơn hàng thành công! Đã tự động kích hoạt quy trình Chăm sóc WhatsApp Ngày +3!');
  };

  const handleSendCustomMessage = (customerId: string, messageText: string) => {
    const nowStr = new Date().toLocaleString('vi-VN');
    setCustomers((prev) =>
      prev.map((c) => {
        if (c.id === customerId) {
          const seq = c.automationSequence || {
            active: true,
            currentStep: 1,
            startDate: new Date().toISOString().split('T')[0],
            logs: [],
          };

          const newLog = {
            step: seq.currentStep || 1,
            stepName: 'Tin nhắn trực tiếp',
            sentAt: nowStr,
            message: messageText,
            status: 'Read' as const,
          };

          return {
            ...c,
            automationSequence: {
              ...seq,
              logs: [...seq.logs, newLog],
            },
          };
        }
        return c;
      })
    );
  };

  // Run Automation Simulation logic
  const handleRunAutomationSim = () => {
    const nowStr = new Date().toLocaleString('vi-VN');
    setCustomers((prev) =>
      prev.map((c) => {
        if (c.totalOrders >= 1 && c.automationSequence) {
          const stepNames = [
            'Ngày +3 (Lời cảm ơn & HDSD)',
            'Ngày +5 (Hỏi trải nghiệm)',
            'Ngày +7 (Giải đáp & Gợi ý)',
            'Ngày +15 (Gửi Voucher 20%)',
          ];
          const nextStep = (c.automationSequence.currentStep % 4) + 1;
          const stepTitle = stepNames[nextStep - 1];

          const newLog = {
            step: nextStep,
            stepName: stepTitle,
            sentAt: nowStr,
            message: `[Tự Động Kích Hoạt - ${stepTitle}] Chào ${c.name}, VietCRM vừa tự động gửi tin chăm sóc cho bạn theo tiến trình!`,
            status: 'Read' as const,
          };

          return {
            ...c,
            automationSequence: {
              ...c.automationSequence,
              active: true,
              currentStep: nextStep,
              logs: [...c.automationSequence.logs, newLog],
            },
          };
        }
        return c;
      })
    );

    setAutoSimCounter((prev) => prev + 1);
    alert('Đã kích hoạt mô phỏng chạy gửi tin nhắn Automation Ngày +3, +5, +7, +15 thành công cho tất cả khách hàng!');
  };

  const handleLaunchCampaign = (newCampaign: BroadcastCampaign) => {
    setCampaigns((prev) => [newCampaign, ...prev]);
  };

  const handleResetData = () => {
    if (confirm('Khôi phục lại dữ liệu CRM ban đầu?')) {
      localStorage.removeItem(STORAGE_KEY_CUSTOMERS);
      localStorage.removeItem(STORAGE_KEY_CAMPAIGNS);
      localStorage.removeItem(STORAGE_KEY_USERS);
      localStorage.removeItem(STORAGE_KEY_CURRENT_USER);
      localStorage.removeItem(STORAGE_KEY_PRODUCTS);
      setCustomers(INITIAL_CUSTOMERS);
      setCampaigns(INITIAL_CAMPAIGNS);
      setUsers(INITIAL_USERS);
      setProducts(INITIAL_PRODUCT_LIST);
      setCurrentUser(INITIAL_USERS[0]);
      alert('Đã khôi phục dữ liệu mẫu VietCRM!');
    }
  };

  const handleNavigateToBroadcastGroup = (groupName: string) => {
    setBroadcastDefaultGroup(groupName);
    setActiveTab('broadcast');
  };

  // Product Handlers
  const handleAddProduct = (newPrd: Partial<Product>) => {
    const prd: Product = {
      id: newPrd.id || `prd_${Date.now()}`,
      code: newPrd.code || `SP-${Math.floor(100 + Math.random() * 900)}`,
      name: newPrd.name || '',
      category: newPrd.category || 'Mỹ Phẩm',
      price: newPrd.price || 0,
      costPrice: newPrd.costPrice || 0,
      stock: newPrd.stock ?? 50,
      status: newPrd.status || 'In Stock',
      sku: newPrd.sku || '',
      description: newPrd.description || '',
      image: newPrd.image || '',
    };
    setProducts((prev) => [prd, ...prev]);
  };

  const handleEditProduct = (updatedPrd: Product) => {
    setProducts((prev) => prev.map((p) => (p.id === updatedPrd.id ? updatedPrd : p)));
  };

  const handleDeleteProduct = (productId: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== productId));
  };

  // Order Handlers
  const handleCreateOrderCentral = (order: CustomerOrder) => {
    if (!order.customerId) return;
    setCustomers((prev) =>
      prev.map((c) => {
        if (c.id === order.customerId) {
          const updatedOrders = [order, ...(c.orders || [])];
          const completedOrders = updatedOrders.filter((o) => o.status === 'Completed');
          const totalSpent = completedOrders.reduce((sum, o) => sum + o.totalAmount, 0);
          return {
            ...c,
            status: c.status === 'Won' ? 'Won' : (order.status === 'Completed' ? 'Won' : c.status),
            orders: updatedOrders,
            totalOrders: updatedOrders.length,
            totalSpent,
            lastPurchaseDate: order.date,
          };
        }
        return c;
      })
    );
  };

  const handleUpdateOrderStatus = (orderId: string, customerId: string, newStatus: CustomerOrder['status']) => {
    setCustomers((prev) =>
      prev.map((c) => {
        if (c.id === customerId) {
          const updatedOrders = (c.orders || []).map((o) => (o.id === orderId ? { ...o, status: newStatus } : o));
          const completedOrders = updatedOrders.filter((o) => o.status === 'Completed');
          const totalSpent = completedOrders.reduce((sum, o) => sum + o.totalAmount, 0);
          return {
            ...c,
            orders: updatedOrders,
            totalSpent,
          };
        }
        return c;
      })
    );
  };

  const handleDeleteOrder = (orderId: string, customerId: string) => {
    setCustomers((prev) =>
      prev.map((c) => {
        if (c.id === customerId) {
          const updatedOrders = (c.orders || []).filter((o) => o.id !== orderId);
          const completedOrders = updatedOrders.filter((o) => o.status === 'Completed');
          const totalSpent = completedOrders.reduce((sum, o) => sum + o.totalAmount, 0);
          return {
            ...c,
            orders: updatedOrders,
            totalOrders: updatedOrders.length,
            totalSpent,
          };
        }
        return c;
      })
    );
  };

  // User Management Handlers
  const handleSaveUser = (data: Partial<AppUser> & { password?: string }) => {
    if (data.id) {
      setUsers((prev) =>
        prev.map((u) => (u.id === data.id ? ({ ...u, ...data } as AppUser) : u))
      );
      if (currentUser?.id === data.id) {
        setCurrentUser((prev) => (prev ? ({ ...prev, ...data } as AppUser) : null));
      }
      // Call backend API if available
      api.put(`/users/${data.id}`, data).catch(() => null);
    } else {
      const newUser: AppUser = {
        id: `usr_${Date.now()}`,
        name: data.name || '',
        email: data.email || '',
        phone: data.phone || '',
        role: data.role || 'Sales Rep',
        department: data.department || 'Phòng Sales',
        status: data.status || 'active',
        avatar: data.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
        lastActive: 'Vừa kích hoạt',
        assignedLeadsCount: 0,
        totalRevenue: 0,
      };
      setUsers((prev) => [...prev, newUser]);
      // Call backend API if available
      api.post('/users', { ...newUser, password: data.password || 'admin123' }).catch(() => null);
    }
  };

  const handleDeleteUser = (userId: string) => {
    if (confirm('Bạn có chắc chắn muốn xóa thành viên này khỏi hệ thống?')) {
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      if (currentUser?.id === userId) {
        setCurrentUser(null);
      }
    }
  };

  const handleToggleUserStatus = (userId: string) => {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          const nextStatus = u.status === 'active' ? 'inactive' : 'active';
          return { ...u, status: nextStatus };
        }
        return u;
      })
    );
  };

  const handleSwitchUser = (user: AppUser) => {
    if (user.status === 'inactive') {
      alert('Tài khoản này đang ở trạng thái Inactive (vô hiệu hóa).');
      return;
    }
    setCurrentUser(user);
    alert(`Đã chuyển tài khoản thành công sang: ${user.name} (${user.role})`);
  };

  if (legalView === 'privacy') {
    return <PrivacyPolicyView onBackToApp={() => { window.location.hash = ''; setLegalView(null); }} />;
  }
  if (legalView === 'terms') {
    return <TermsOfServiceView onBackToApp={() => { window.location.hash = ''; setLegalView(null); }} />;
  }
  if (legalView === 'deletion') {
    return <DataDeletionView onBackToApp={() => { window.location.hash = ''; setLegalView(null); }} />;
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <LoginModal
          isOpen={true}
          isMandatory={true}
          onClose={() => {}}
          users={users}
          currentUser={currentUser}
          onSelectUser={(u) => setCurrentUser(u)}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen light-mode bg-slate-50 text-slate-900 flex flex-col font-sans transition-colors duration-200">
      
      {/* Top Header & Nav Container */}
      <div className="sticky top-0 z-30 shadow-sm border-b border-slate-800/80 bg-slate-900/95 backdrop-blur-md">
        <Header
          customers={customers}
          currentUser={currentUser}
          theme={theme}
          onAddCustomer={() => {
            setEditingCustomer(null);
            setIsFormOpen(true);
          }}
          onRunAutomationSim={handleRunAutomationSim}
          onResetData={handleResetData}
          onOpenLoginModal={() => setIsLoginOpen(true)}
          onOpenUsersTab={() => setActiveTab('users')}
          activeTab={activeTab}
          usersCount={users.length}
          autoSimCount={autoSimCounter}
          onCurrencyChange={() => setCurrencyTick((t) => t + 1)}
        />

        <Navigation
          activeTab={activeTab}
          onChangeTab={setActiveTab}
          customerCounts={customerCounts}
          usersCount={users.length}
          ordersCount={customers.reduce((sum, c) => sum + (c.orders ? c.orders.length : 0), 0)}
          productsCount={products.length}
        />
      </div>

      {/* Main View Container */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'crm' && (
          <CustomerList
            customers={customers}
            currentUser={currentUser}
            onSelectCustomer={(cust) => {
              setSelectedCustomer(cust);
              setIsDetailOpen(true);
            }}
            onEditCustomer={(cust) => {
              setEditingCustomer(cust);
              setIsFormOpen(true);
            }}
            onDeleteCustomer={handleDeleteCustomer}
            onOpenAddModal={() => {
              setEditingCustomer(null);
              setIsFormOpen(true);
            }}
            onOpenAddOrder={(cust) => {
              setOrderCustomer(cust);
              setIsOrderOpen(true);
            }}
            onOpenChat={(cust) => {
              setChatCustomer(cust);
              setIsChatOpen(true);
            }}
            onUpdateStatus={handleUpdateStatus}
            onImportCustomers={handleImportCustomers}
          />
        )}

        {activeTab === 'orders' && (
          <OrderManagementView
            customers={customers}
            products={products}
            onCreateOrder={handleCreateOrderCentral}
            onUpdateOrderStatus={handleUpdateOrderStatus}
            onDeleteOrder={handleDeleteOrder}
            onImportOrders={handleImportOrders}
          />
        )}

        {activeTab === 'products' && (
          <ProductManagementView
            products={products}
            onAddProduct={handleAddProduct}
            onEditProduct={handleEditProduct}
            onDeleteProduct={handleDeleteProduct}
            onImportProducts={handleImportProducts}
          />
        )}

        {activeTab === 'meta-verification' && (
          <MetaVerificationView
            onNavigateLegal={(page) => {
              window.location.hash = `#${page === 'deletion' ? 'data-deletion' : page}`;
            }}
          />
        )}

        {activeTab === 'segmentation' && (
          <SegmentationView
            customers={customers}
            onSelectCustomer={(cust) => {
              setSelectedCustomer(cust);
              setIsDetailOpen(true);
            }}
            onNavigateToBroadcast={handleNavigateToBroadcastGroup}
          />
        )}

        {activeTab === 'automation' && (
          <AutomationView
            customers={customers}
            onRunSimulation={handleRunAutomationSim}
            onSelectCustomer={(cust) => {
              setSelectedCustomer(cust);
              setIsDetailOpen(true);
            }}
          />
        )}

        {activeTab === 'broadcast' && (
          <BroadcastView
            customers={customers}
            campaigns={campaigns}
            onLaunchCampaign={handleLaunchCampaign}
            defaultTargetGroup={broadcastDefaultGroup}
          />
        )}

        {activeTab === 'reports' && (
          <ReportsDashboard
            customers={customers}
            marketingReports={marketingReports}
            campaigns={campaigns}
            currentUser={currentUser}
            onUpdateMarketingReports={(reports) => setMarketingReports(reports)}
          />
        )}

        {activeTab === 'users' && (
          <UserManagementView
            users={users}
            currentUser={currentUser}
            onAddUser={() => {
              setEditingUser(null);
              setIsUserFormOpen(true);
            }}
            onEditUser={(u) => {
              setEditingUser(u);
              setIsUserFormOpen(true);
            }}
            onDeleteUser={handleDeleteUser}
            onToggleUserStatus={handleToggleUserStatus}
            onSwitchUser={handleSwitchUser}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 text-xs text-slate-400 py-6 text-center mt-auto space-y-2">
        <div className="flex flex-wrap items-center justify-center gap-4 text-slate-300 font-medium">
          <a href="#privacy" className="hover:text-red-400 transition">Privacy Policy</a>
          <span>•</span>
          <a href="#terms" className="hover:text-red-400 transition">Terms of Service</a>
          <span>•</span>
          <a href="#data-deletion" className="hover:text-red-400 transition">User Data Deletion</a>
          <span>•</span>
          <button onClick={() => setActiveTab('meta-verification')} className="text-red-400 font-bold hover:underline">
            Meta Verification Hub
          </button>
        </div>
        <div>
          YumNetwork CRM Platform &copy; 2026 — Quản Lý Khách Hàng, Phân Nhóm Tự Động & Meta Graph API Automation.
        </div>
      </footer>

      {/* Modals */}
      <CustomerDetailModal
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        customer={selectedCustomer}
        onOpenAddOrder={(cust) => {
          setOrderCustomer(cust);
          setIsOrderOpen(true);
        }}
        onOpenChat={(cust) => {
          setChatCustomer(cust);
          setIsChatOpen(true);
        }}
        onAddNote={handleAddNote}
        onUpdateStatus={handleUpdateStatus}
        onToggleOptIn={handleToggleOptIn}
      />

      <CustomerFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSave={handleSaveCustomer}
        initialData={editingCustomer}
      />

      <AddOrderModal
        isOpen={isOrderOpen}
        onClose={() => setIsOrderOpen(false)}
        customer={orderCustomer}
        onAddOrder={handleAddOrder}
      />

      <CustomerChatModal
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        customer={chatCustomer}
        onSendMessage={handleSendCustomMessage}
      />

      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        users={users}
        currentUser={currentUser}
        onSelectUser={(u) => setCurrentUser(u)}
      />

      <UserFormModal
        isOpen={isUserFormOpen}
        onClose={() => setIsUserFormOpen(false)}
        onSave={handleSaveUser}
        initialUser={editingUser}
      />

    </div>
  );
}

