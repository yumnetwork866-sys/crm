import React, { useEffect, useMemo, useState } from 'react';
import type { AppUser, BroadcastCampaign, Customer, MarketingCampaignReport } from './types';
import { INITIAL_CAMPAIGNS, INITIAL_MARKETING_REPORTS } from './data/mockData';
import { api } from './utils/apiClient';
import { mapApiCampaignToFrontend } from './utils/apiMappers';
import { useAuth } from './contexts/AuthContext';
import { useCustomers } from './hooks/useCustomers';
import { useCentralMessages } from './hooks/useCentralMessages';
import { useOrders } from './hooks/useOrders';
import { useProducts } from './hooks/useProducts';

import { Header } from './components/Header';
import { ActiveTab } from './components/Navigation';
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

const STORAGE_KEY_CAMPAIGNS = 'yumcrm_campaigns_v2';
const STORAGE_KEY_MARKETING_REPORTS = 'yumcrm_marketing_reports_v2';

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

  const {
    users,
    currentUser,
    isAdmin,
    selectUser,
    saveUser: handleSaveUser,
    deleteUser: handleDeleteUser,
    toggleUserStatus: handleToggleUserStatus,
    switchUser: handleSwitchUser,
    resetAuth,
  } = useAuth();

  const [campaigns, setCampaigns] = useState<BroadcastCampaign[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CAMPAIGNS);
      return saved ? JSON.parse(saved) : INITIAL_CAMPAIGNS;
    } catch {
      return INITIAL_CAMPAIGNS;
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

  const {
    customers,
    setCustomers,
    saveCustomer: handleSaveCustomer,
    importCustomers: handleImportCustomers,
    deleteCustomer,
    updateStatus: handleUpdateStatus,
    toggleOptIn: handleToggleOptIn,
    addNote: handleAddNote,
    runAutomationSimulation,
    resetCustomers,
    buildFilterModel,
  } = useCustomers(currentUser);
  const {
    products,
    addProduct: handleAddProduct,
    editProduct: handleEditProduct,
    deleteProduct: handleDeleteProduct,
    importProducts: handleImportProducts,
    resetProducts,
  } = useProducts(currentUser);
  const {
    addOrder: handleAddOrder,
    createOrder: handleCreateOrderCentral,
    updateOrderStatus: handleUpdateOrderStatus,
    deleteOrder: handleDeleteOrder,
    importOrders: handleImportOrders,
  } = useOrders({ setCustomers });
  const {
    messages: centralMessages,
    unreadCount: unreadMessagesCount,
    toastNotification,
    setToastNotification,
    selectedCustomerId: selectedChatCustomerId,
    selectCustomerThread: handleSelectCustomerThread,
    sendMessage: handleSendCentralMessage,
    deleteThread: handleDeleteThread,
    deleteMessage: handleDeleteMessage,
  } = useCentralMessages({ customers, setCustomers, currentUser });
  const customerFilterModel = useMemo(
    () => buildFilterModel(centralMessages),
    [buildFilterModel, centralMessages]
  );

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_CAMPAIGNS, JSON.stringify(campaigns));
    } catch (error) {
      console.error('Error saving campaigns to localStorage', error);
    }
  }, [campaigns]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_MARKETING_REPORTS, JSON.stringify(marketingReports));
    } catch (error) {
      console.error('Error saving marketing reports to localStorage', error);
    }
  }, [marketingReports]);

  useEffect(() => {
    if (!currentUser) return;
    api.get<any[]>('/campaigns')
      .then((response) => {
        if (Array.isArray(response)) setCampaigns(response.map(mapApiCampaignToFrontend));
      })
      .catch(() => null);
  }, [currentUser]);

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

  useEffect(() => {
    if (!selectedCustomer) return;
    const latestCustomer = customers.find((customer) => customer.id === selectedCustomer.id);
    if (!latestCustomer) {
      setSelectedCustomer(null);
      setIsDetailOpen(false);
      return;
    }
    if (latestCustomer !== selectedCustomer) setSelectedCustomer(latestCustomer);
  }, [customers, selectedCustomer]);

  const handleDeleteCustomer = async (customerId: string) => {
    const wasDeleted = await deleteCustomer(customerId);
    if (wasDeleted && selectedCustomer?.id === customerId) setIsDetailOpen(false);
  };

  const handleSendCustomMessage = (
    customerId: string,
    messageText: string,
    phone?: string,
    name?: string
  ) => {
    void handleSendCentralMessage(customerId, messageText, 'WhatsApp', phone, name);
  };

  const handleRunAutomationSim = async () => {
    await runAutomationSimulation();
    setAutoSimCounter((previous) => previous + 1);
    alert('Đã kích hoạt mô phỏng chạy gửi tin nhắn Automation Ngày +3, +5, +7, +15 thành công cho tất cả khách hàng!');
  };

  const handleLaunchCampaign = (newCampaign: BroadcastCampaign) => {
    setCampaigns((prev) => [newCampaign, ...prev]);
  };

  const handleResetData = () => {
    if (confirm('Khôi phục lại dữ liệu CRM ban đầu?')) {
      localStorage.removeItem(STORAGE_KEY_CAMPAIGNS);
      resetCustomers();
      resetProducts();
      resetAuth();
      setCampaigns(INITIAL_CAMPAIGNS);
      alert('Đã khôi phục dữ liệu mẫu VietCRM!');
    }
  };

  const handleNavigateToBroadcastGroup = (groupName: string) => {
    setBroadcastDefaultGroup(groupName);
    setActiveTab('broadcast');
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
            selectUser(users[0]);
          }}
        />

        <LoginModal
          isOpen={isLoginOpen}
          isMandatory={false}
          onClose={() => setIsLoginOpen(false)}
        />
      </>
    );
  }

  return (
    <div className={`light-mode bg-slate-50 text-slate-900 flex flex-col font-sans transition-colors duration-200 ${activeTab === 'messages' ? 'h-screen overflow-hidden' : 'min-h-screen'}`}>
      
      {/* Single Unified Topbar Header */}
      <Header
        activeTab={activeTab}
        onChangeTab={(tab) => {
          if (tab === 'users' && !isAdmin) {
            setActiveTab('crm');
          } else {
            setActiveTab(tab);
          }
        }}
        customers={customers}
        currentUser={currentUser}
        unreadMessagesCount={unreadMessagesCount}
        onOpenLoginModal={() => setIsLoginOpen(true)}
        onOpenUsersTab={() => setActiveTab('users')}
        theme={theme}
        onAddCustomer={() => {
          setEditingCustomer(null);
          setIsFormOpen(true);
        }}
        onRunAutomationSim={handleRunAutomationSim}
        onResetData={handleResetData}
        usersCount={users.length}
        autoSimCount={autoSimCounter}
        onCurrencyChange={() => setCurrencyTick((t) => t + 1)}
      />

      {/* Main View Container */}
      <main className={`flex-1 w-full ${activeTab === 'messages' ? 'p-0 flex flex-col min-h-0 overflow-hidden' : 'max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6'}`}>
        {activeTab === 'crm' && (
          <CustomerList
            customers={customers}
            currentUser={currentUser}
            filterModel={customerFilterModel}
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
            centralMessages={centralMessages}
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

        {activeTab === 'users' && isAdmin && (
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

      {/* Footer (hidden on WhatsApp Studio to ensure single full-screen inbox) */}
      {activeTab !== 'messages' && (
        <footer className="bg-slate-900 border-t border-slate-800 text-xs text-slate-400 py-6 text-center mt-auto space-y-2 shrink-0">
          <div>
            YumNetwork CRM Platform &copy; 2026 — Quản Lý Khách Hàng, Phân Nhóm Tự Động &amp; Meta Graph API Automation.
          </div>
        </footer>
      )}

      {/* Modals */}
      <CustomerDetailModal
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        customer={selectedCustomer}
        centralMessages={centralMessages}
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
        currentUser={currentUser}
        centralMessages={centralMessages}
        onSendMessage={handleSendCustomMessage}
      />

      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
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
