import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import type { Customer, CentralMessage, MessageChannel, AppUser } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { isSamePhoneNumber } from '../../utils/crmUtils';
import { QuickTemplatesModal } from '../../features/messages/components/QuickTemplatesModal';
import type {
  ActiveMessageFilter,
  BusinessPhoneNumber,
  ConversationSummary,
} from '../../features/messages/types';
import { useMessageComposer } from '../../features/messages/hooks/useMessageComposer';
import { useMessageInteractions } from '../../features/messages/hooks/useMessageInteractions';
import { useMessagePreferences } from '../../features/messages/hooks/useMessagePreferences';
import { useMessageThreads } from '../../features/messages/hooks/useMessageThreads';
import { useMessageViewport } from '../../features/messages/hooks/useMessageViewport';
import { ProductPickerModal } from '../../features/messages/components/ProductPickerModal';
import { Permission } from '../../lib/permissions';
import { MessageLightbox } from '../../features/messages/components/MessageLightbox';
import { UserInfoModal } from '../Common/UserInfoModal';
import { CustomerChatDrawer } from '../../features/messages/components/CustomerChatDrawer';
import { useAiProfile } from '../../features/messages/hooks/useAiProfile';
import { useThreadTyping } from '../../features/messages/hooks/useThreadTyping';
import { ThreadSidebar } from '../../features/messages/components/ThreadSidebar';
import { ConversationHeader } from '../../features/messages/components/ConversationHeader';
import { MessageVirtualList } from '../../features/messages/components/MessageVirtualList';
import { MessageComposerBar } from '../../features/messages/components/MessageComposerBar';

interface CentralizedMessageViewProps {
  messages: CentralMessage[];
  conversations?: ConversationSummary[];
  customers: Customer[];
  currentUser?: AppUser | null;
  businessPhones: BusinessPhoneNumber[];
  selectedPhoneId: string;
  onSelectBusinessPhone: (phoneId: string) => void;
  selectedCustomerId?: string | null;
  onSelectCustomerThread: (customerId: string, customerPhone?: string, messageIds?: string[]) => void;
  onSendMessage: (
    customerId: string,
    content: string,
    channel: MessageChannel,
    customerPhone?: string,
    customerName?: string,
    senderPhoneId?: string,
    replyTo?: { id: string; senderName: string; content: string }
  ) => void;
  onRetryMessage?: (messageId: string) => void;
  onOpenAddOrder: (customer: Customer) => void;
  onSelectCustomerDetail: (customer: Customer) => void;
  onAddNote: (
    customerId: string,
    noteText: string,
    customerPhone?: string,
    customerName?: string
  ) => void;
  onDeleteNote?: (customerId: string, noteId: string) => void;
  onDeleteThread?: (customerId: string) => void;
  onDeleteMessage?: (messageId: string) => void;
  hasOlderMessages?: boolean;
  isLoadingOlderMessages?: boolean;
  isLoadingThreads?: boolean;
  onLoadOlderMessages?: () => Promise<unknown>;
}

export const CentralizedMessageView: React.FC<CentralizedMessageViewProps> = ({
  messages,
  conversations = [],
  customers,
  currentUser,
  businessPhones,
  selectedPhoneId,
  onSelectBusinessPhone,
  selectedCustomerId,
  onSelectCustomerThread,
  onSendMessage,
  onRetryMessage,
  onOpenAddOrder,
  onSelectCustomerDetail,
  onAddNote,
  onDeleteNote,
  onDeleteThread,
  hasOlderMessages = false,
  isLoadingOlderMessages = false,
  isLoadingThreads = false,
  onLoadOlderMessages,
}) => {
  const { currentUser: authCurrentUser, users, hasPermission } = useAuth();
  const effectiveCurrentUser = authCurrentUser || currentUser;
  const aiProfile = useAiProfile().data;

  const [activeFilter, setActiveFilter] = useState<ActiveMessageFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [isChatSearchOpen, setIsChatSearchOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(() => (
    typeof window === 'undefined' || window.innerWidth >= 1024
  ));
  const [isCompactChatOpen, setIsCompactChatOpen] = useState(() => (
    Boolean(selectedCustomerId) && (typeof window === 'undefined' || window.innerWidth >= 640)
  ));
  const [selectedInfoUser, setSelectedInfoUser] = useState<AppUser | null>(null);
  const [previewLightboxImg, setPreviewLightboxImg] = useState<string | null>(null);
  const [isQuickTemplatesModalOpen, setIsQuickTemplatesModalOpen] = useState(false);
  const [isProductPickerOpen, setIsProductPickerOpen] = useState(false);

  const {
    soundEnabled,
    threadStatuses,
    pinnedThreadIds,
    togglePinThread,
    updateThreadStatus: handleUpdateThreadStatus,
  } = useMessagePreferences(selectedPhoneId);

  const isAdmin = hasPermission(Permission.MESSAGES_MANAGE);

  const { threads, filteredThreads, activeThread, groupedMessagesByDate } = useMessageThreads({
    messages,
    conversations,
    customers,
    pinnedThreadIds,
    activeFilter,
    searchQuery,
    selectedCustomerId,
    chatSearchQuery,
  });

  const activeCustomer = activeThread?.customer || null;
  const { typingUsers, notifyTyping, stopTyping } = useThreadTyping({
    threadId: activeThread?.threadId,
    customerPhone: activeThread?.customerPhone,
    businessPhoneNumberId: selectedPhoneId,
    currentUserId: effectiveCurrentUser?.id,
    currentUserEmail: effectiveCurrentUser?.email,
  });

  const {
    chatContainerRef,
    chatEndRef,
    showScrollBottomBtn,
    scrollToBottom,
  } = useMessageViewport({
    threadId: activeThread?.threadId,
    messageCount: activeThread?.messages.length || 0,
    isLoadingOlderMessages,
    hasOlderMessages,
    onLoadOlderMessages,
  });

  const displayedMessages = useMemo(
    () => groupedMessagesByDate.flatMap((group) => group.msgs),
    [groupedMessagesByDate],
  );

  useEffect(() => {
    if (typingUsers.length === 0 || showScrollBottomBtn) return;
    const frame = requestAnimationFrame(() => scrollToBottom('smooth'));
    return () => cancelAnimationFrame(frame);
  }, [scrollToBottom, showScrollBottomBtn, typingUsers.length]);

  const handleSelectThread = useCallback((threadId: string, phone: string, messageIds: string[]) => {
    setIsCompactChatOpen(true);
    onSelectCustomerThread(threadId, phone, messageIds);
  }, [onSelectCustomerThread]);

  useEffect(() => {
    const compactQuery = window.matchMedia('(max-width: 1023px)');
    const mobileQuery = window.matchMedia('(max-width: 639px)');
    const handleLayoutChange = (event: MediaQueryListEvent) => {
      if (event.matches) setIsDrawerOpen(false);
    };
    const handleMobileLayoutChange = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setIsCompactChatOpen(false);
        setIsDrawerOpen(false);
      }
    };
    compactQuery.addEventListener('change', handleLayoutChange);
    mobileQuery.addEventListener('change', handleMobileLayoutChange);
    if (mobileQuery.matches) setIsCompactChatOpen(false);
    return () => {
      compactQuery.removeEventListener('change', handleLayoutChange);
      mobileQuery.removeEventListener('change', handleMobileLayoutChange);
    };
  }, []);

  // Sync active thread selection & auto-mark active thread as read
  useEffect(() => {
    if (!activeThread) return;
    const isMatchedSelection =
      Boolean(selectedCustomerId) &&
      (activeThread.threadId === selectedCustomerId ||
        activeThread.customer?.id === selectedCustomerId ||
        activeThread.lastMessage.customerId === selectedCustomerId ||
        isSamePhoneNumber(activeThread.customerPhone, selectedCustomerId));
    if (!isMatchedSelection || activeThread.unreadCount > 0) {
      onSelectCustomerThread(
        activeThread.threadId,
        activeThread.customerPhone,
        activeThread.messages.map((m) => m.id)
      );
    }
  }, [activeThread, onSelectCustomerThread, selectedCustomerId]);

  const composer = useMessageComposer({
    activeThread,
    selectedPhoneId,
    soundEnabled,
    brandName: businessPhones.find((phone) => phone.id === selectedPhoneId)?.verifiedName || 'YumNetwork',
    onSendMessage,
  });

  const {
    messageReactions,
    activeReactionPickerMsgId,
    setActiveReactionPickerMsgId,
    showExpandedReactionPickerMsgId,
    setShowExpandedReactionPickerMsgId,
    highlightedMessageId,
    handleJumpToQuotedMessage,
    handleReactMessage,
    handleReplyMessage,
  } = useMessageInteractions({
    activeThread,
    selectedPhoneId,
    onReplyMessage: composer.handleReplyMessage,
  });

  return (
    <div className="whatsapp-page flex-1 flex flex-col min-h-0 h-full w-full overflow-hidden">
      {/* Main WhatsApp 3-Column Studio */}
      <div className="relative flex min-h-0 h-full w-full flex-1 flex-row overflow-hidden bg-white">

        {/* COLUMN 1: THREAD LIST & SEARCH */}
        <ThreadSidebar
          isCompactChatOpen={isCompactChatOpen}
          isDrawerOpen={isDrawerOpen}
          businessPhones={businessPhones}
          selectedPhoneId={selectedPhoneId}
          onSelectBusinessPhone={onSelectBusinessPhone}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          activeFilter={activeFilter}
          onSelectActiveFilter={setActiveFilter}
          threads={threads}
          filteredThreads={filteredThreads}
          activeThread={activeThread}
          threadStatuses={threadStatuses}
          draftsByThreadId={composer.draftsByThreadId}
          onSelectThread={handleSelectThread}
          togglePinThread={togglePinThread}
          onDeleteThread={onDeleteThread}
          isAdmin={isAdmin}
          effectiveCurrentUser={effectiveCurrentUser}
          isLoadingThreads={isLoadingThreads}
        />

        {/* COLUMN 2: AUTHENTIC WHATSAPP CHAT CANVAS */}
        <div className={`${isCompactChatOpen ? 'flex' : 'hidden sm:flex'} w-full flex-1 sm:w-3/5 sm:flex-none lg:w-auto lg:flex-1 bg-[#efeae2] flex-col h-full overflow-hidden min-w-0 relative`}>
          {activeThread ? (
            <>
              <ConversationHeader
                activeThread={activeThread}
                activeCustomer={activeCustomer}
                users={users}
                threadStatuses={threadStatuses}
                onUpdateThreadStatus={handleUpdateThreadStatus}
                onSelectUserForInfo={setSelectedInfoUser}
                onBackToThreads={() => {
                  setIsCompactChatOpen(false);
                  setIsDrawerOpen(false);
                }}
                isChatSearchOpen={isChatSearchOpen}
                onToggleChatSearch={() => setIsChatSearchOpen(!isChatSearchOpen)}
                chatSearchQuery={chatSearchQuery}
                onChatSearchQueryChange={setChatSearchQuery}
                onCloseChatSearch={() => {
                  setIsChatSearchOpen(false);
                  setChatSearchQuery('');
                }}
                isDrawerOpen={isDrawerOpen}
                onToggleDrawer={() => setIsDrawerOpen(!isDrawerOpen)}
              />

              <MessageVirtualList
                chatContainerRef={chatContainerRef}
                chatEndRef={chatEndRef}
                showScrollBottomBtn={showScrollBottomBtn}
                scrollToBottom={scrollToBottom}
                groupedMessagesByDate={groupedMessagesByDate}
                displayedMessages={displayedMessages}
                activeThread={activeThread}
                activeCustomer={activeCustomer}
                users={users}
                effectiveCurrentUser={effectiveCurrentUser}
                aiProfile={aiProfile}
                typingUsers={typingUsers}
                messageReactions={messageReactions}
                activeReactionPickerMsgId={activeReactionPickerMsgId}
                onSetActiveReactionPickerMsgId={setActiveReactionPickerMsgId}
                showExpandedReactionPickerMsgId={showExpandedReactionPickerMsgId}
                onSetShowExpandedReactionPickerMsgId={setShowExpandedReactionPickerMsgId}
                highlightedMessageId={highlightedMessageId}
                onReactMessage={handleReactMessage}
                onReplyMessage={handleReplyMessage}
                onJumpToQuotedMessage={handleJumpToQuotedMessage}
                onPreviewImage={setPreviewLightboxImg}
                onRetryMessage={onRetryMessage}
                isLoadingOlderMessages={isLoadingOlderMessages}
              />

              <MessageComposerBar
                composer={composer}
                notifyTyping={notifyTyping}
                stopTyping={stopTyping}
                onOpenProductPicker={() => setIsProductPickerOpen(true)}
                onOpenQuickTemplatesModal={() => setIsQuickTemplatesModalOpen(true)}
                activeThread={activeThread}
                brandName={businessPhones.find((phone) => phone.id === selectedPhoneId)?.verifiedName || 'YumNetwork'}
              />
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
              <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center text-slate-400 mb-3">
                <MessageSquare className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-slate-700">WhatsApp Web CRM</h3>
              <p className="text-xs text-slate-500 max-w-sm mt-1">
                Chọn một cuộc trò chuyện ở danh sách bên trái để bắt đầu nhắn tin và chăm sóc khách hàng.
              </p>
            </div>
          )}
        </div>

        {/* COLUMN 3: COLLAPSIBLE CRM CUSTOMER PROFILE & QUICK ORDER DRAWER */}
        <CustomerChatDrawer
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          activeThread={activeThread}
          activeCustomer={activeCustomer}
          users={users}
          onOpenAddOrder={onOpenAddOrder}
          onSelectCustomerDetail={onSelectCustomerDetail}
          onAddNote={onAddNote}
          onDeleteNote={onDeleteNote}
          onSelectUserForInfo={setSelectedInfoUser}
        />

      </div>

      <MessageLightbox imageUrl={previewLightboxImg} onClose={() => setPreviewLightboxImg(null)} />
      <UserInfoModal user={selectedInfoUser} onClose={() => setSelectedInfoUser(null)} />

      {/* Meta Catalog Product Picker Modal */}
      <ProductPickerModal
        isOpen={isProductPickerOpen}
        phoneNumberId={selectedPhoneId}
        catalogScopeId={businessPhones.find((phone) => phone.id === selectedPhoneId)?.wabaId || selectedPhoneId}
        onClose={() => setIsProductPickerOpen(false)}
        onSendProduct={(product, catalogId, customText) => {
          if (!activeThread) return;
          const tag = `[product:${JSON.stringify({
            catalog_id: catalogId,
            product_retailer_id: product.retailerId,
            name: product.name,
            price: product.price,
            currency: product.currency,
            image: product.imageUrl,
          })}]`;
          const finalContent = customText ? `${tag}\n${customText}` : tag;
          const targetId = activeThread.customer?.id || activeThread.lastMessage.customerId || activeThread.threadId;
          const targetPhone = activeThread.customerPhone || activeThread.customer?.phone || activeThread.lastMessage.customerPhone;
          const targetName = activeThread.customerName || activeThread.customer?.name || activeThread.lastMessage.customerName;
          onSendMessage(
            targetId,
            finalContent,
            'WhatsApp',
            targetPhone,
            targetName,
            selectedPhoneId
          );
        }}
      />

      {/* Quick Canned Templates Management Modal */}
      <QuickTemplatesModal
        isOpen={isQuickTemplatesModalOpen}
        onClose={() => setIsQuickTemplatesModalOpen(false)}
      />

    </div>
  );
};
