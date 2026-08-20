import React, { useEffect, useMemo, useState } from 'react';
import type { AppUser, Customer, MarketingCampaignReport } from './types';
import { INITIAL_MARKETING_REPORTS } from './data/mockData';
import { useAuth } from './contexts/AuthContext';
import { useCustomers } from './hooks/useCustomers';
import { useCentralMessages } from './hooks/useCentralMessages';
import { useOrders } from './hooks/useOrders';
import { useProducts } from './hooks/useProducts';
import { useCampaigns } from './hooks/useCampaigns';

import { Header } from './components/Header';
import type { ActiveTab } from './components/Navigation';
import { NotificationToast } from './components/Common/NotificationToast';
import { CentralizedMessageView } from './components/Messages/CentralizedMessageView';

import { CustomerList } from './components/CustomerManagement/CustomerList';
import { CustomerDetailModal } from './components/CustomerManagement/CustomerDetailModal';
import { CustomerFormModal } from './components/CustomerManagement/CustomerFormModal';
import { AddOrderModal } from './components/CustomerManagement/AddOrderModal';
import { CustomerChatModal } from './components/CustomerManagement/CustomerChatModal';

import { SegmentationView } from './components/CustomerSegmentation/SegmentationView';
import { AutomationHub } from './components/Automation/AutomationHub';
import type { AutomationSection } from './components/Automation/AutomationHub';
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
    updateGroup: handleUpdateGroup,
    toggleOptIn: handleToggleOptIn,
    addNote: handleAddNote,
    runAutomationSimulation,
    resetCustomers,
    buildFilterModel,
    isFetching: isCustomersFetching,
    isError: isCustomersError,
  } = useCustomers(currentUser);
  const {
    products,
    addProduct: handleAddProduct,
    editProduct: handleEditProduct,
    deleteProduct: handleDeleteProduct,
    importProducts: handleImportProducts,
    resetProducts,
    isFetching: isProductsFetching,
    isError: isProductsError,
  } = useProducts(currentUser);
  const {
    campaigns,
    whatsappTemplates,
    approvedTemplates,
    isTemplatesLoading,
    templatesError,
    refetchTemplates,
    createTemplate: handleCreateTemplate,
    isCreateTemplatePending,
    createTemplateError,
    resetCreateTemplateError,
    launchCampaign: handleLaunchCampaign,
    resetCampaigns,
    isFetching: isCampaignsFetching,
    isError: isCampaignsError,
    isLaunchPending: isCampaignLaunchPending,
    launchError: campaignLaunchError,
    resetLaunchError: resetCampaignLaunchError,
  } = useCampaigns(currentUser);
  const {
    addOrder: handleAddOrder,
    createOrder: handleCreateOrderCentral,
    updateOrderStatus: handleUpdateOrderStatus,
    deleteOrder: handleDeleteOrder,
    importOrders: handleImportOrders,
    isMutating: isOrdersMutating,
    isError: isOrdersError,
  } = useOrders();
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
    hasOlderMessages,
    isLoadingOlderMessages,
    loadOlderMessages,
    isFetching: isMessagesFetching,
    isError: isMessagesError,
  } = useCentralMessages({ customers, setCustomers, currentUser });
  const customerFilterModel = useMemo(
    () => buildFilterModel(centralMessages),
    [buildFilterModel, centralMessages]
  );
  const isBackgroundFetching = isCustomersFetching || isProductsFetching
    || isCampaignsFetching || isMessagesFetching || isOrdersMutating;
  const hasDataError = isCustomersError || isProductsError || isCampaignsError
    || isMessagesError || isOrdersError;

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_MARKETING_REPORTS, JSON.stringify(marketingReports));
    } catch (error) {
      console.error('Error saving marketing reports to localStorage', error);
    }
  }, [marketingReports]);

  const [autoSimCounter, setAutoSimCounter] = useState(1);
  const [, setCurrencyTick] = useState(0);


  // Modals state
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const [orderCustomer, setOrderCustomer] = useState<Customer | null>(null);
  const [isOrderOpen, setIsOrderOpen] = useState(false);

  const [chatCustomer, setChatCustomer] = useState<Customer | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);

  const [automationSection, setAutomationSection] = useState<AutomationSection>('workflow');
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

  const handleResetData = () => {
    if (confirm('Khôi phục lại dữ liệu CRM ban đầu?')) {
      resetCustomers();
      resetProducts();
      resetCampaigns();
      resetAuth();
      alert('Đã khôi phục dữ liệu mẫu VietCRM!');
    }
  };

  const handleNavigateToBroadcastGroup = (groupName: string) => {
    setBroadcastDefaultGroup(groupName);
    setAutomationSection('broadcast');
    setActiveTab('automation');
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
            if (tab === 'automation') setAutomationSection('workflow');
            setActiveTab(tab);
          }
        }}
        customers={customers}
        currentUser={currentUser}
        unreadMessagesCount={unreadMessagesCount}
        onOpenLoginModal={() => setIsLoginOpen(true)}
        onOpenUsersTab={() => setActiveTab('users')}
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

      {(isBackgroundFetching || hasDataError) && (
        <div
          role={hasDataError ? 'alert' : 'status'}
          className={`px-4 py-2 text-center text-xs font-bold ${
            hasDataError
              ? 'bg-amber-50 text-amber-800 border-b border-amber-200'
              : 'bg-sky-50 text-sky-700 border-b border-sky-200'
          }`}
        >
          {hasDataError
            ? 'Một số dữ liệu chưa đồng bộ được. Hệ thống đang hiển thị cache gần nhất và sẽ tự thử lại.'
            : 'Đang đồng bộ dữ liệu mới nhất…'}
        </div>
      )}

      {/* Main View Container */}
      <main className={`flex-1 w-full ${activeTab === 'messages' ? 'p-0 flex flex-col min-h-0 overflow-hidden' : 'max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6'}`}>
        {activeTab === 'crm' && (
          <CustomerList
            customers={customers}
            centralMessages={centralMessages}
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
            onUpdateGroup={(customerId, group) => {
              void handleUpdateGroup(customerId, group);
            }}
            onUpdateOwner={(customerId, owner) => {
              void handleSaveCustomer({ id: customerId, owner });
            }}
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
          <AutomationHub
            activeSection={automationSection}
            onChangeSection={setAutomationSection}
            customers={customers}
            campaigns={campaigns}
            templates={whatsappTemplates}
            approvedTemplates={approvedTemplates}
            isTemplatesLoading={isTemplatesLoading}
            templatesError={templatesError}
            onRefetchTemplates={() => void refetchTemplates()}
            defaultTargetGroup={broadcastDefaultGroup}
            onRunSimulation={handleRunAutomationSim}
            onSelectCustomer={(cust) => {
              setSelectedCustomer(cust);
              setIsDetailOpen(true);
            }}
            onLaunchCampaign={handleLaunchCampaign}
            isLaunchPending={isCampaignLaunchPending}
            launchError={campaignLaunchError}
            onResetLaunchError={resetCampaignLaunchError}
            onCreateTemplate={handleCreateTemplate}
            isCreateTemplatePending={isCreateTemplatePending}
            createTemplateError={createTemplateError}
            onResetCreateTemplateError={resetCreateTemplateError}
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
            hasOlderMessages={hasOlderMessages}
            isLoadingOlderMessages={isLoadingOlderMessages}
            onLoadOlderMessages={loadOlderMessages}
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
