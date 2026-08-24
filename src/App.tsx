import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
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

import { CustomerDetailModal } from './components/CustomerManagement/CustomerDetailModal';
import { CustomerFormModal } from './components/CustomerManagement/CustomerFormModal';
import { AddOrderModal } from './components/CustomerManagement/AddOrderModal';
import { CustomerChatModal } from './components/CustomerManagement/CustomerChatModal';
import { LoginModal } from './components/Auth/LoginModal';
import { UserFormModal } from './components/UserManagement/UserFormModal';
import type { AutomationSection } from './components/Automation/AutomationHub';

// Lazy-loaded route components for Code Splitting
const CustomerList = React.lazy(() =>
  import('./components/CustomerManagement/CustomerList').then((m) => ({ default: m.CustomerList }))
);
const CommerceManagementView = React.lazy(() =>
  import('./components/CommerceManagement/CommerceManagementView').then((m) => ({ default: m.CommerceManagementView }))
);
const SegmentationView = React.lazy(() =>
  import('./components/CustomerSegmentation/SegmentationView').then((m) => ({ default: m.SegmentationView }))
);
const AutomationHub = React.lazy(() =>
  import('./components/Automation/AutomationHub').then((m) => ({ default: m.AutomationHub }))
);
const ReportsDashboard = React.lazy(() =>
  import('./components/Reports/ReportsDashboard').then((m) => ({ default: m.ReportsDashboard }))
);
const UserManagementView = React.lazy(() =>
  import('./components/UserManagement/UserManagementView').then((m) => ({ default: m.UserManagementView }))
);
const CentralizedMessageView = React.lazy(() =>
  import('./components/Messages/CentralizedMessageView').then((m) => ({ default: m.CentralizedMessageView }))
);
const MetaVerificationView = React.lazy(() =>
  import('./components/Meta/MetaVerificationView').then((m) => ({ default: m.MetaVerificationView }))
);
const PublicLandingView = React.lazy(() =>
  import('./components/Landing/PublicLandingView').then((m) => ({ default: m.PublicLandingView }))
);
const PrivacyPolicyView = React.lazy(() =>
  import('./components/Legal/PrivacyPolicyView').then((m) => ({ default: m.PrivacyPolicyView }))
);
const TermsOfServiceView = React.lazy(() =>
  import('./components/Legal/TermsOfServiceView').then((m) => ({ default: m.TermsOfServiceView }))
);
const DataDeletionView = React.lazy(() =>
  import('./components/Legal/DataDeletionView').then((m) => ({ default: m.DataDeletionView }))
);

const STORAGE_KEY_MARKETING_REPORTS = 'yumcrm_marketing_reports_v2';

const RouteLoading: React.FC = () => (
  <div className="flex-1 flex flex-col items-center justify-center min-h-100 py-12">
    <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-3" />
    <span className="text-xs font-semibold text-slate-500">Đang tải trang...</span>
  </div>
);

const getActiveTabFromPath = (pathname: string): ActiveTab => {
  const segment = pathname.replace(/^\//, '').split('/')[0];
  const validTabs: ActiveTab[] = [
    'crm',
    'orders',
    'products',
    'segmentation',
    'automation',
    'reports',
    'users',
    'messages',
    'meta-verification',
  ];
  return validTabs.includes(segment as ActiveTab) ? (segment as ActiveTab) : 'crm';
};

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeTab = useMemo(() => getActiveTabFromPath(location.pathname), [location.pathname]);

  // Backward compatibility with previous hash routes
  useEffect(() => {
    const hash = window.location.hash;
    if (hash === '#privacy') void navigate('/privacy', { replace: true });
    else if (hash === '#terms') void navigate('/terms', { replace: true });
    else if (hash === '#data-deletion' || hash.startsWith('#data-deletion')) void navigate('/data-deletion', { replace: true });
    else if (hash === '#meta-verification') void navigate('/meta-verification', { replace: true });
  }, [navigate]);

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
    void navigate('/automation');
  };

  const handleTabChange = (tab: ActiveTab) => {
    if (tab === 'users' && !isAdmin) {
      void navigate('/crm');
    } else {
      if (tab === 'automation') setAutomationSection('workflow');
      void navigate(`/${tab}`);
    }
  };

  return (
    <Suspense fallback={<RouteLoading />}>
      <Routes>
        {/* Public Legal & Review Routes (Accessible with or without login) */}
        <Route
          path="/privacy"
          element={<PrivacyPolicyView onBackToApp={() => { void navigate(currentUser ? '/crm' : '/'); }} />}
        />
        <Route
          path="/terms"
          element={<TermsOfServiceView onBackToApp={() => { void navigate(currentUser ? '/crm' : '/'); }} />}
        />
        <Route
          path="/data-deletion"
          element={<DataDeletionView onBackToApp={() => { void navigate(currentUser ? '/crm' : '/'); }} />}
        />
        <Route
          path="/meta-verification"
          element={
            <div className="min-h-screen bg-slate-950 p-4 sm:p-8">
              <div className="max-w-7xl mx-auto mb-6 flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <span className="text-white font-bold text-lg">YumNetwork CRM Meta Review Portal</span>
                </div>
                <button
                  onClick={() => { void navigate(currentUser ? '/crm' : '/'); }}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition shadow-lg cursor-pointer"
                >
                  {currentUser ? 'Quay lại CRM' : 'Quay lại Đăng Nhập'}
                </button>
              </div>
              <MetaVerificationView
                onNavigateLegal={(page) => { void navigate(`/${page === 'deletion' ? 'data-deletion' : page}`); }}
              />
            </div>
          }
        />

        {/* Public Landing & Login flow for unauthenticated users */}
        {!currentUser ? (
          <Route
            path="*"
            element={
              <>
                <PublicLandingView
                  onOpenLogin={() => setIsLoginOpen(true)}
                  onNavigateLegal={(page) => { void navigate(`/${page === 'deletion' ? 'data-deletion' : page}`); }}
                  onQuickDemoLogin={() => {
                    selectUser(users[0]);
                    void navigate('/crm');
                  }}
                />
                <LoginModal
                  isOpen={isLoginOpen}
                  isMandatory={false}
                  onClose={() => setIsLoginOpen(false)}
                />
              </>
            }
          />
        ) : (
          /* Authenticated CRM Layout & Routes */
          <Route
            element={
              <div
                className={`light-mode bg-slate-50 text-slate-900 flex flex-col font-sans transition-colors duration-200 ${
                  activeTab === 'messages' ? 'h-screen overflow-hidden' : 'min-h-screen'
                }`}
              >
                <Header
                  onChangeTab={handleTabChange}
                  customers={customers}
                  currentUser={currentUser}
                  unreadMessagesCount={unreadMessagesCount}
                  onOpenLoginModal={() => setIsLoginOpen(true)}
                  onOpenUsersTab={() => handleTabChange('users')}
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

                <main
                  className={`flex-1 w-full ${
                    activeTab === 'messages'
                      ? 'p-0 flex flex-col min-h-0 overflow-hidden'
                      : 'max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6'
                  }`}
                >
                  <Suspense fallback={<RouteLoading />}>
                    <Outlet />
                  </Suspense>
                </main>

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

                <NotificationToast
                  toast={toastNotification}
                  onClose={() => setToastNotification(null)}
                  onOpenMessage={(msg) => {
                    void navigate('/messages');
                    handleSelectCustomerThread(msg.customerId);
                  }}
                />
              </div>
            }
          >
            <Route path="/" element={<Navigate to="/crm" replace />} />
            <Route
              path="/crm"
              element={
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
              }
            />
            <Route
              path="/orders"
              element={
                <CommerceManagementView
                  customers={customers}
                  products={products}
                  onCreateOrder={handleCreateOrderCentral}
                  onUpdateOrderStatus={handleUpdateOrderStatus}
                  onDeleteOrder={handleDeleteOrder}
                  onImportOrders={handleImportOrders}
                  onAddProduct={handleAddProduct}
                  onEditProduct={handleEditProduct}
                  onDeleteProduct={handleDeleteProduct}
                  onImportProducts={handleImportProducts}
                />
              }
            />
            <Route path="/products" element={<Navigate to="/orders?tab=products" replace />} />
            <Route
              path="/segmentation"
              element={
                <SegmentationView
                  customers={customers}
                  onSelectCustomer={(cust) => {
                    setSelectedCustomer(cust);
                    setIsDetailOpen(true);
                  }}
                  onNavigateToBroadcast={handleNavigateToBroadcastGroup}
                />
              }
            />
            <Route
              path="/automation"
              element={
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
              }
            />
            <Route
              path="/reports"
              element={
                <ReportsDashboard
                  customers={customers}
                  marketingReports={marketingReports}
                  campaigns={campaigns}
                  currentUser={currentUser}
                  onUpdateMarketingReports={(reports) => setMarketingReports(reports)}
                />
              }
            />
            <Route
              path="/users"
              element={
                isAdmin ? (
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
                    onNavigateToWhatsApp={() => { void navigate('/meta-verification'); }}
                  />
                ) : (
                  <Navigate to="/crm" replace />
                )
              }
            />
            <Route
              path="/messages"
              element={
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
              }
            />
            <Route path="*" element={<Navigate to="/crm" replace />} />
          </Route>
        )}
      </Routes>
    </Suspense>
  );
}
