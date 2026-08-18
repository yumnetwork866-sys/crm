import React, { useState, useEffect } from 'react';
import { Customer, CustomerStatus, CustomerOrder, BroadcastCampaign, AppUser, Product, MarketingCampaignReport, CentralMessage, MessageChannel } from './types';
import { INITIAL_CUSTOMERS, INITIAL_CAMPAIGNS, INITIAL_MARKETING_REPORTS, INITIAL_USERS, INITIAL_PRODUCT_LIST } from './data/mockData';
import { getCustomerGroup, isSamePhoneNumber } from './utils/crmUtils';
import { api, getStoredToken } from './utils/apiClient';
import { playNotificationSound } from './utils/audioUtils';

import { Header } from './components/Header';
import { Navigation, ActiveTab } from './components/Navigation';
import { NotificationToast } from './components/Common/NotificationToast';
import { CentralizedMessageView } from './components/Messages/CentralizedMessageView';

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
import { PublicLandingView } from './components/Landing/PublicLandingView';

import { LoginModal } from './components/Auth/LoginModal';
import { UserFormModal } from './components/UserManagement/UserFormModal';

const STORAGE_KEY_CUSTOMERS = 'yumcrm_customers_v2';
const STORAGE_KEY_CAMPAIGNS = 'yumcrm_campaigns_v2';
const STORAGE_KEY_USERS = 'yumcrm_users_v2';
const STORAGE_KEY_CURRENT_USER = 'yumcrm_current_user_v2';
const STORAGE_KEY_PRODUCTS = 'yumcrm_products_v2';
const STORAGE_KEY_MARKETING_REPORTS = 'yumcrm_marketing_reports_v2';
const STORAGE_KEY_CENTRAL_MESSAGES = 'yumcrm_central_messages_v2';

const INITIAL_CENTRAL_MESSAGES: CentralMessage[] = [];

const mapApiCustomerToFrontend = (apiCust: any): Customer => {
  const logs = apiCust.automationLogs || [];
  const currentStep = logs.length > 0 ? Math.max(...logs.map((l: any) => l.step)) : 0;
  
  const mappedLogs = logs.map((l: any) => ({
    step: l.step,
    stepName: l.stepName,
    sentAt: l.sentAt ? new Date(l.sentAt).toLocaleString('vi-VN') : '',
    message: l.message,
    status: l.status
  }));

  return {
    ...apiCust,
    firstContact: apiCust.firstContact ? new Date(apiCust.firstContact).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    lastContact: apiCust.lastContact ? new Date(apiCust.lastContact).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    whatsappOptInDate: apiCust.whatsappOptInDate ? new Date(apiCust.whatsappOptInDate).toISOString().split('T')[0] : undefined,
    lastPurchaseDate: apiCust.lastPurchaseDate ? new Date(apiCust.lastPurchaseDate).toISOString().split('T')[0] : undefined,
    notes: (apiCust.notes || []).map((n: any) => ({
      ...n,
      createdAt: n.createdAt ? new Date(n.createdAt).toLocaleString('vi-VN') : ''
    })),
    orders: (apiCust.orders || []).map((o: any) => ({
      ...o,
      date: o.date ? new Date(o.date).toISOString().split('T')[0] : '',
      products: o.products || []
    })),
    automationSequence: {
      active: apiCust.totalOrders > 0,
      currentStep,
      startDate: apiCust.lastPurchaseDate ? new Date(apiCust.lastPurchaseDate).toISOString().split('T')[0] : undefined,
      logs: mappedLogs
    }
  };
};

const mapApiCampaignToFrontend = (apiCamp: any): BroadcastCampaign => {
  return {
    ...apiCamp,
    createdAt: apiCamp.createdAt ? new Date(apiCamp.createdAt).toLocaleString('vi-VN') : '',
    stats: apiCamp.stats || {
      totalTargeted: apiCamp.totalTargeted ?? 0,
      optedInCount: apiCamp.optedInCount ?? 0,
      sentCount: apiCamp.sentCount ?? 0,
      deliveredCount: apiCamp.deliveredCount ?? 0,
      readCount: apiCamp.readCount ?? 0,
      respondedCount: apiCamp.respondedCount ?? 0,
    }
  };
};

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('crm');
  const [legalView, setLegalView] = useState<'privacy' | 'terms' | 'deletion' | 'meta-verification' | null>(() => {
    const hash = window.location.hash;
    if (hash === '#privacy') return 'privacy';
    if (hash === '#terms') return 'terms';
    if (hash === '#data-deletion' || hash.startsWith('#data-deletion')) return 'deletion';
    if (hash === '#meta-verification') return 'meta-verification';
    return null;
  });

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash === '#privacy') setLegalView('privacy');
      else if (hash === '#terms') setLegalView('terms');
      else if (hash === '#data-deletion' || hash.startsWith('#data-deletion')) setLegalView('deletion');
      else if (hash === '#meta-verification') setLegalView('meta-verification');
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

  // Central Messages & Notifications State
  const [centralMessages, setCentralMessages] = useState<CentralMessage[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CENTRAL_MESSAGES);
      if (!saved) return [];
      const parsed: CentralMessage[] = JSON.parse(saved);
      const sampleIds = new Set(['msg_1', 'msg_2', 'msg_3', 'msg_4', 'msg_5']);
      return parsed.filter((m) => !sampleIds.has(m.id));
    } catch {
      return [];
    }
  });

  const [toastNotification, setToastNotification] = useState<{
    message: CentralMessage;
    show: boolean;
  } | null>(null);

  const [selectedChatCustomerId, setSelectedChatCustomerId] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_CENTRAL_MESSAGES, JSON.stringify(centralMessages));
    } catch (e) {
      console.error('Error saving central messages to localStorage', e);
    }
  }, [centralMessages]);

  const unreadMessagesCount = centralMessages.filter((m) => !m.isRead && m.sender === 'customer').length;

  const handleSelectCustomerThread = (targetId: string) => {
    setSelectedChatCustomerId(targetId);
    setCentralMessages((prev) =>
      prev.map((msg) => {
        const match = msg.customerId === targetId || isSamePhoneNumber(msg.customerPhone, targetId);
        return match ? { ...msg, isRead: true } : msg;
      })
    );
  };

  // Sync with real WhatsApp Messages from Backend API & Webhook
  useEffect(() => {
    const knownMsgIds = new Set<string>();

    const pollRealWhatsAppMessages = async () => {
      try {
        const realMsgs = await api.get<CentralMessage[]>('/meta/messages');
        if (realMsgs && Array.isArray(realMsgs)) {
          // Detect newly arrived incoming customer messages
          const newIncoming = realMsgs.filter(
            (m) => !knownMsgIds.has(m.id) && m.sender === 'customer'
          );

          // Update known IDs
          realMsgs.forEach((m) => knownMsgIds.add(m.id));

          setCentralMessages((prev) => {
            // Keep optimistic/pending local messages so they don't disappear while syncing
            const backendIdSet = new Set(realMsgs.map((m) => m.id));
            const optimisticMsgs = prev.filter((m) => !backendIdSet.has(m.id) && m.id.startsWith('msg_'));
            const merged = [...realMsgs, ...optimisticMsgs];
            return merged.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
          });

          // Trigger notification for the latest new incoming message
          if (newIncoming.length > 0 && knownMsgIds.size > realMsgs.length) {
            const latestMsg = newIncoming[newIncoming.length - 1];
            playNotificationSound();
            setToastNotification({
              message: latestMsg,
              show: true,
            });
          }
        }
      } catch (e) {
        // Backend API offline fallback
      }
    };

    pollRealWhatsAppMessages();
    const interval = setInterval(pollRealWhatsAppMessages, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleSendCentralMessage = async (
    customerId: string,
    content: string,
    channel: MessageChannel = 'WhatsApp',
    explicitPhone?: string,
    explicitName?: string
  ) => {
    const cust = customers.find((c) => c.id === customerId || isSamePhoneNumber(c.phone, explicitPhone || customerId));
    const agentName = currentUser?.name || 'Nguyễn Văn Ánh';
    const phone = explicitPhone || cust?.phone || (customerId.startsWith('cust_') ? customerId.replace('cust_', '') : (customerId.replace(/\D/g, '').length >= 7 ? customerId : '')) || '';
    const name = explicitName || cust?.name || (phone ? `Khách Hàng (${phone})` : 'Khách Hàng');

    const tempMsg: CentralMessage = {
      id: `msg_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      customerId: cust?.id || customerId,
      customerName: name,
      customerPhone: phone,
      sender: 'agent',
      agentName,
      channel,
      content,
      timestamp: new Date().toISOString(),
      isRead: true,
    };

    setCentralMessages((prev) => [...prev, tempMsg]);

    // Send real WhatsApp Cloud API message via Backend endpoint
    try {
      const res: any = await api.post('/meta/messages/send', {
        customerId: cust?.id || customerId,
        customerName: name,
        customerPhone: phone,
        content,
        agentName
      });

      if (res && res.message) {
        setCentralMessages((prev) =>
          prev.map((m) => (m.id === tempMsg.id ? { ...m, id: res.message.id, isRealSent: res.isRealSent } : m))
        );
      }
    } catch (apiErr) {
      console.log('Real WhatsApp API offline fallback');
    }

    // Update customer last contact and append to customer notes timeline
    if (cust || phone) {
      setCustomers((prev) =>
        prev.map((c) => {
          if (c.id === customerId || (cust && c.id === cust.id) || isSamePhoneNumber(c.phone, phone)) {
            const newNote = {
              id: `n_wa_${Date.now()}`,
              author: agentName,
              content: `[WhatsApp Gửi đi] ${content}`,
              createdAt: new Date().toLocaleString('vi-VN'),
              type: 'whatsapp' as const,
            };
            return {
              ...c,
              lastContact: new Date().toISOString().split('T')[0],
              notes: [newNote, ...(c.notes || [])],
            };
          }
          return c;
        })
      );
    }
  };

  const handleDeleteThread = async (customerId: string) => {
    if (currentUser?.role !== 'Admin') {
      alert('Chỉ tài khoản Admin mới có quyền xóa hội thoại!');
      return;
    }

    // Extract all matching phone numbers and IDs for this thread
    const threadMsgs = centralMessages.filter((m) => m.customerId === customerId || isSamePhoneNumber(m.customerPhone, customerId));
    const threadPhone = threadMsgs[0]?.customerPhone || customers.find((c) => c.id === customerId)?.phone || customerId;
    const cleanPhone = threadPhone.replace(/\D/g, '');

    // Filter React centralMessages state completely
    setCentralMessages((prev) =>
      prev.filter((m) => {
        const isSameId = m.customerId === customerId;
        const isSamePhone = isSamePhoneNumber(m.customerPhone, threadPhone);
        return !isSameId && !isSamePhone;
      })
    );

    // Call Backend API with both customerId and customerPhone query param
    try {
      const queryPhone = cleanPhone ? `?customerPhone=${encodeURIComponent(cleanPhone)}` : '';
      await api.delete(`/meta/messages/thread/${encodeURIComponent(customerId)}${queryPhone}`);
    } catch (e) {
      console.error('Error deleting thread via API:', e);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (currentUser?.role !== 'Admin') {
      alert('Chỉ tài khoản Admin mới có quyền xóa tin nhắn!');
      return;
    }

    setCentralMessages((prev) => prev.filter((m) => m.id !== messageId));

    try {
      await api.delete(`/meta/messages/item/${encodeURIComponent(messageId)}`);
    } catch (e) {
      console.error('Error deleting message via API:', e);
    }
  };

  const handleSimulateIncomingMessage = () => {
    const sampleCust = customers[Math.floor(Math.random() * customers.length)] || {
      id: 'cust_1',
      name: 'Nguyễn Thị Minh Châu',
      phone: '0908123456',
    };

    const sampleContents = [
      'Dạ shop ơi, cho em hỏi sản phẩm mỹ phẩm này còn hàng trên WhatsApp không ạ?',
      'Anh muốn hỏi giá sỉ cho đơn 10 bộ về Kuala Lumpur qua WhatsApp ạ.',
      'Shop kiểm tra giúp em tình trạng đơn hàng với ạ!',
      'Mã ưu đãi 20% gửi qua WhatsApp áp dụng như nào shop nhỉ?',
      'Em vừa thanh toán đơn hàng rồi, shop xác nhận giúp em trên WhatsApp nhé!',
    ];
    const randomContent = sampleContents[Math.floor(Math.random() * sampleContents.length)];

    const incomingMsg: CentralMessage = {
      id: `msg_in_${Date.now()}`,
      customerId: sampleCust.id,
      customerName: sampleCust.name,
      customerPhone: sampleCust.phone,
      sender: 'customer',
      channel: 'WhatsApp',
      content: randomContent,
      timestamp: new Date().toISOString(),
      isRead: false,
    };

    setCentralMessages((prev) => [...prev, incomingMsg]);
    playNotificationSound();
    setToastNotification({
      message: incomingMsg,
      show: true,
    });
  };

  // Sync with Backend API if server is online - re-fetches whenever user logs in/out
  useEffect(() => {
    const fetchApiData = async () => {
      if (!currentUser) return; // Chỉ fetch khi đã đăng nhập
      try {
        const health: any = await api.get('/health');
        if (health && health.status === 'ok') {
          const apiCustomers = await api.get<any[]>('/customers').catch(() => null);
          if (apiCustomers && Array.isArray(apiCustomers)) {
            setCustomers(apiCustomers.map(mapApiCustomerToFrontend));
          }
          const apiProducts = await api.get<Product[]>('/products').catch(() => null);
          if (apiProducts && Array.isArray(apiProducts)) {
            setProducts(apiProducts);
          }
          const apiCampaigns = await api.get<any[]>('/campaigns').catch(() => null);
          if (apiCampaigns && Array.isArray(apiCampaigns)) {
            setCampaigns(apiCampaigns.map(mapApiCampaignToFrontend));
          }
        }
      } catch (err) {
        // Backend offline, fallback to local storage mode
      }
    };
    fetchApiData();
  }, [currentUser]); // ← Re-fetch khi currentUser thay đổi (đăng nhập / đăng xuất)


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

  const handleSaveCustomer = async (data: Partial<Customer>) => {
    if (data.id) {
      // Edit existing
      let updatedCust: Customer | null = null;
      try {
        const res = await api.put<any>(`/customers/${data.id}`, data);
        if (res) {
          updatedCust = mapApiCustomerToFrontend(res);
        }
      } catch (err) {
        console.error('API error updating customer, falling back to local:', err);
      }

      setCustomers((prev) =>
        prev.map((c) => {
          if (c.id === data.id) {
            return updatedCust || ({ ...c, ...data } as Customer);
          }
          return c;
        })
      );
      if (selectedCustomer?.id === data.id) {
        setSelectedCustomer((prev) => (prev ? { ...prev, ...data } : null));
      }
    } else {
      // Add new
      let savedCust: Customer | null = null;
      try {
        const res = await api.post<any>('/customers', data);
        if (res) {
          savedCust = mapApiCustomerToFrontend(res);
        }
      } catch (err) {
        console.error('API error creating customer, falling back to local:', err);
      }

      const newCust: Customer = savedCust || {
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

  const handleDeleteCustomer = async (id: string) => {
    if (confirm('Bạn có chắc chắn muốn xóa khách hàng này khỏi CRM?')) {
      try {
        await api.delete(`/customers/${id}`);
      } catch (err) {
        console.error('API error deleting customer, falling back to local:', err);
      }
      setCustomers((prev) => prev.filter((c) => c.id !== id));
      if (selectedCustomer?.id === id) setIsDetailOpen(false);
    }
  };

  const handleUpdateStatus = async (customerId: string, newStatus: CustomerStatus) => {
    const cust = customers.find((c) => c.id === customerId);
    if (!cust) return;
    const oldStatus = cust.status;

    let updatedCust: Customer | null = null;
    try {
      await api.put(`/customers/${customerId}`, { status: newStatus });
      const systemNoteContent = `Chuyển trạng thái từ "${oldStatus}" sang "${newStatus}".`;
      await api.post(`/customers/${customerId}/notes`, {
        content: systemNoteContent,
        type: 'system',
        author: 'Hệ Thống'
      });
      const res = await api.get<any>(`/customers/${customerId}`);
      if (res) {
        updatedCust = mapApiCustomerToFrontend(res);
      }
    } catch (err) {
      console.error('API error updating customer status, fallback to local:', err);
    }

    if (updatedCust) {
      setCustomers((prev) => prev.map((c) => (c.id === customerId ? updatedCust! : c)));
      if (selectedCustomer?.id === customerId) {
        setSelectedCustomer(updatedCust);
      }
    } else {
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
    }
  };

  const handleToggleOptIn = async (customerId: string) => {
    const cust = customers.find((c) => c.id === customerId);
    if (!cust) return;
    const newOptIn = !cust.whatsappOptIn;

    let updatedCust: Customer | null = null;
    try {
      const res = await api.put<any>(`/customers/${customerId}`, { whatsappOptIn: newOptIn });
      if (res) {
        updatedCust = mapApiCustomerToFrontend(res);
      }
    } catch (err) {
      console.error('API error toggling opt-in, fallback to local:', err);
    }

    if (updatedCust) {
      setCustomers((prev) => prev.map((c) => (c.id === customerId ? updatedCust! : c)));
      if (selectedCustomer?.id === customerId) {
        setSelectedCustomer(updatedCust);
      }
    } else {
      setCustomers((prev) =>
        prev.map((c) => (c.id === customerId ? { ...c, whatsappOptIn: newOptIn } : c))
      );
      if (selectedCustomer?.id === customerId) {
        setSelectedCustomer((prev) => (prev ? { ...prev, whatsappOptIn: newOptIn } : null));
      }
    }
  };

  const handleAddNote = async (customerId: string, noteText: string) => {
    const cust = customers.find((c) => c.id === customerId);
    if (!cust) return;

    let updatedCust: Customer | null = null;
    try {
      await api.post(`/customers/${customerId}/notes`, {
        content: noteText,
        type: 'note',
        author: cust.owner
      });
      const res = await api.get<any>(`/customers/${customerId}`);
      if (res) {
        updatedCust = mapApiCustomerToFrontend(res);
      }
    } catch (err) {
      console.error('API error adding note, fallback to local:', err);
    }

    if (updatedCust) {
      setCustomers((prev) => prev.map((c) => (c.id === customerId ? updatedCust! : c)));
      if (selectedCustomer?.id === customerId) {
        setSelectedCustomer(updatedCust);
      }
    } else {
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
    }
  };

  const handleAddOrder = async (customerId: string, newOrder: CustomerOrder) => {
    let updatedCust: Customer | null = null;
    try {
      await api.post('/orders', {
        customerId,
        customerName: newOrder.customerName,
        customerPhone: newOrder.customerPhone,
        products: newOrder.products,
        totalAmount: newOrder.totalAmount,
        notes: newOrder.notes
      });
      try {
        await api.post(`/customers/${customerId}/automation-logs`, {
          step: 1,
          stepName: 'Ngày +3 (Lời cảm ơn)',
          message: `Cảm ơn ${newOrder.customerName || 'Khách hàng'} đã mua hàng! Kích hoạt quy trình tự động chăm sóc dịch vụ...`,
          status: 'Delivered'
        });
      } catch (logErr) {
        console.error('Failed to create automation log on backend:', logErr);
      }
      const res = await api.get<any>(`/customers/${customerId}`);
      if (res) {
        updatedCust = mapApiCustomerToFrontend(res);
      }
    } catch (err) {
      console.error('API error adding order, falling back to local:', err);
    }

    if (updatedCust) {
      setCustomers((prev) => prev.map((c) => (c.id === customerId ? updatedCust! : c)));
      if (selectedCustomer?.id === customerId) {
        setSelectedCustomer(updatedCust);
      }
    } else {
      setCustomers((prev) =>
        prev.map((c) => {
          if (c.id === customerId) {
            const updatedOrders = [newOrder, ...c.orders];
            const totalOrders = updatedOrders.length;
            const totalSpent = updatedOrders.reduce((sum, o) => sum + o.totalAmount, 0);

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
    }

    alert('Tạo đơn hàng thành công! Đã tự động kích hoạt quy trình Chăm sóc WhatsApp Ngày +3!');
  };

  const handleSendCustomMessage = (customerId: string, messageText: string, phone?: string, name?: string) => {
    // Sync to Central WhatsApp Inbox & Meta Cloud API
    handleSendCentralMessage(customerId, messageText, 'WhatsApp', phone, name);
  };

  // Run Automation Simulation logic
  const handleRunAutomationSim = async () => {
    const nowStr = new Date().toLocaleString('vi-VN');
    
    const updatePromises = customers.map(async (c) => {
      if (c.totalOrders >= 1 && c.automationSequence) {
        const stepNames = [
          'Ngày +3 (Lời cảm ơn & HDSD)',
          'Ngày +5 (Hỏi trải nghiệm)',
          'Ngày +7 (Giải đáp & Gợi ý)',
          'Ngày +15 (Gửi Voucher 20%)',
        ];
        const nextStep = (c.automationSequence.currentStep % 4) + 1;
        const stepTitle = stepNames[nextStep - 1];
        const message = `[Tự Động Kích Hoạt - ${stepTitle}] Chào ${c.name}, VietCRM vừa tự động gửi tin chăm sóc cho bạn theo tiến trình!`;
        
        try {
          await api.post(`/customers/${c.id}/automation-logs`, {
            step: nextStep,
            stepName: stepTitle,
            message,
            status: 'Read'
          });
        } catch (err) {
          console.error(`Failed to post simulation log for customer ${c.id}:`, err);
        }
      }
    });

    try {
      await Promise.all(updatePromises);
      const health: any = await api.get('/health');
      if (health && health.status === 'ok') {
        const apiCustomers = await api.get<any[]>('/customers').catch(() => null);
        if (apiCustomers && Array.isArray(apiCustomers)) {
          setCustomers(apiCustomers.map(mapApiCustomerToFrontend));
        }
      }
    } catch (e) {
      console.error('Failed to run simulation on backend:', e);
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
    }

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
  const handleAddProduct = async (newPrd: Partial<Product>) => {
    let savedProduct: Product | null = null;
    try {
      const res = await api.post<Product>('/products', newPrd);
      if (res) savedProduct = res;
    } catch (err) {
      console.error('API error adding product, falling back to local:', err);
    }

    const prd: Product = savedProduct || {
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

  const handleEditProduct = async (updatedPrd: Product) => {
    let savedProduct: Product | null = null;
    try {
      const res = await api.put<Product>(`/products/${updatedPrd.id}`, updatedPrd);
      if (res) savedProduct = res;
    } catch (err) {
      console.error('API error updating product, falling back to local:', err);
    }

    setProducts((prev) => prev.map((p) => (p.id === updatedPrd.id ? (savedProduct || updatedPrd) : p)));
  };

  const handleDeleteProduct = async (productId: string) => {
    try {
      await api.delete(`/products/${productId}`);
    } catch (err) {
      console.error('API error deleting product, falling back to local:', err);
    }
    setProducts((prev) => prev.filter((p) => p.id !== productId));
  };

  // Order Handlers
  const handleCreateOrderCentral = async (order: CustomerOrder) => {
    if (!order.customerId) return;
    let updatedCust: Customer | null = null;
    try {
      await api.post('/orders', {
        customerId: order.customerId,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        products: order.products,
        totalAmount: order.totalAmount,
        notes: order.notes
      });
      const res = await api.get<any>(`/customers/${order.customerId}`);
      if (res) {
        updatedCust = mapApiCustomerToFrontend(res);
      }
    } catch (err) {
      console.error('API error creating order central, falling back to local:', err);
    }

    if (updatedCust) {
      setCustomers((prev) => prev.map((c) => (c.id === order.customerId ? updatedCust! : c)));
    } else {
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
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, customerId: string, newStatus: CustomerOrder['status']) => {
    let updatedCust: Customer | null = null;
    try {
      await api.patch(`/orders/${orderId}/status`, { status: newStatus });
      const res = await api.get<any>(`/customers/${customerId}`);
      if (res) {
        updatedCust = mapApiCustomerToFrontend(res);
      }
    } catch (err) {
      console.error('API error updating order status, falling back to local:', err);
    }

    if (updatedCust) {
      setCustomers((prev) => prev.map((c) => (c.id === customerId ? updatedCust! : c)));
      if (selectedCustomer?.id === customerId) {
        setSelectedCustomer(updatedCust);
      }
    } else {
      setCustomers((prev) =>
        prev.map((c) => {
          if (c.id === customerId) {
            const updatedOrders = (c.orders || []).map((o) => (o.id === orderId ? { ...o, status: newStatus } : o));
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
    }
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
  if (legalView === 'meta-verification') {
    return (
      <div className="min-h-screen bg-slate-950 p-4 sm:p-8">
        <div className="max-w-7xl mx-auto mb-6 flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <span className="text-white font-bold text-lg">YumNetwork CRM Meta Review Portal</span>
          </div>
          <button
            onClick={() => { window.location.hash = ''; setLegalView(null); }}
            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition shadow-lg"
          >
            Quay lại Đăng Nhập
          </button>
        </div>
        <MetaVerificationView
          onNavigateLegal={(page) => {
            window.location.hash = `#${page === 'deletion' ? 'data-deletion' : page}`;
          }}
        />
      </div>
    );
  }

  if (!currentUser) {
    return (
      <>
        <PublicLandingView
          onOpenLogin={() => setIsLoginOpen(true)}
          onNavigateLegal={(page) => {
            window.location.hash = `#${page === 'deletion' ? 'data-deletion' : page}`;
          }}
          onQuickDemoLogin={() => {
            setCurrentUser(users[0]);
          }}
        />

        <LoginModal
          isOpen={isLoginOpen}
          isMandatory={false}
          onClose={() => setIsLoginOpen(false)}
          users={users}
          currentUser={currentUser}
          onSelectUser={(u) => {
            setCurrentUser(u);
            if (u) setIsLoginOpen(false);
          }}
        />
      </>
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
          onChangeTab={(tab) => {
            if (tab === 'users' && currentUser?.role !== 'Admin') {
              setActiveTab('crm');
            } else {
              setActiveTab(tab);
            }
          }}
          customerCounts={customerCounts}
          usersCount={users.length}
          ordersCount={customers.reduce((sum, c) => sum + (c.orders ? c.orders.length : 0), 0)}
          productsCount={products.length}
          unreadMessagesCount={unreadMessagesCount}
          currentUser={currentUser}
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

        {activeTab === 'users' && currentUser?.role === 'Admin' && (
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
            onNavigateToWhatsApp={() => setActiveTab('meta-verification')}
          />
        )}

        {activeTab === 'messages' && (
          <CentralizedMessageView
            messages={centralMessages}
            customers={customers}
            currentUser={currentUser}
            selectedCustomerId={selectedChatCustomerId}
            onSelectCustomerThread={handleSelectCustomerThread}
            onSendMessage={handleSendCentralMessage}
            onOpenAddOrder={(cust) => {
              setOrderCustomer(cust);
              setIsOrderOpen(true);
            }}
            onSelectCustomerDetail={(cust) => {
              setSelectedCustomer(cust);
              setIsDetailOpen(true);
            }}
            onDeleteThread={handleDeleteThread}
            onDeleteMessage={handleDeleteMessage}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 text-xs text-slate-400 py-6 text-center mt-auto space-y-2">
        <div>
          YumNetwork CRM Platform &copy; 2026 — Quản Lý Khách Hàng, Phân Nhóm Tự Động &amp; Meta Graph API Automation.
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
        centralMessages={centralMessages}
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

      {/* Notification Toast Alert */}
      <NotificationToast
        toast={toastNotification}
        onClose={() => setToastNotification(null)}
        onOpenMessage={(msg) => {
          setActiveTab('messages');
          handleSelectCustomerThread(msg.customerId);
        }}
      />

    </div>
  );
}

