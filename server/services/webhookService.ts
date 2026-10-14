import { prisma } from '../lib/prisma';
import type { InMemoryMessage } from './messageStore';
import { messageStore } from './messageStore';
import { getIntegrationSetting, updateIntegrationSetting } from './metaApiClient';
import { realtimeHub } from './realtimeHub';
import { aggregateCampaign } from './campaignWorker';
import { enqueueDifyAutoReply, enqueueMediaPrefetch } from './queueService';
import { getPhoneLookupVariants, normalizePhoneE164 } from '../utils/phone';

/**
 * Verifies webhook subscription request from Meta
 */
export async function verifyWebhookChallenge(query: any): Promise<{ isValid: boolean; challenge?: string }> {
  const mode = query['hub.mode'];
  const token = query['hub.verify_token'];
  const challenge = query['hub.challenge'];

  const setting = await getIntegrationSetting();
  const validTokens = [
    setting.whatsappVerifyToken,
    process.env.META_VERIFY_TOKEN,
  ].filter(Boolean).map((t) => String(t).trim());

  console.log(`[META WEBHOOK VERIFY REQUEST] Received mode: "${mode}", token: "${token}"`);

  if (mode === 'subscribe' && token && validTokens.includes(String(token).trim())) {
    console.log('Meta Webhook Verified Successfully! Returning challenge:', challenge);
    return { isValid: true, challenge: String(challenge) };
  }

  console.warn(`Meta Webhook Verification Failed. Expected Token: "${validTokens.join(' | ')}", Received Token: "${token}"`);
  return { isValid: false };
}
const KNOWN_BRAND_NAMES: Record<string, string> = {
  '1412496995272289': 'Actiscar',
  '1409649928889874': 'Follicas',
  '1311189322067725': 'Yum Network',
};

export async function resolveWhatsAppBrandName(businessPhoneNumberId?: string | null): Promise<string | undefined> {
  if (!businessPhoneNumberId) return undefined;
  if (KNOWN_BRAND_NAMES[businessPhoneNumberId]) {
    return KNOWN_BRAND_NAMES[businessPhoneNumberId];
  }
  const conn = await prisma.whatsAppConnection.findUnique({
    where: { phoneNumberId: businessPhoneNumberId },
    select: { verifiedName: true }
  }).catch(() => null);
  return conn?.verifiedName || undefined;
}

/**
 * Match incoming phone number to an existing CRM customer or auto-create a new CRM customer
 */
export async function matchCustomerByPhone(
  fromPhone: string,
  senderName: string,
  businessPhoneNumberId?: string
): Promise<{ customerId: string; customerName: string; isCrmCustomer: boolean }> {
  const cleanFrom = fromPhone.replace(/\D/g, '');
  const e164Phone = normalizePhoneE164(fromPhone);
  let matchedCustomerId = `cust_${cleanFrom}`;
  let matchedCustomerName = senderName;
  let isCrmCustomer = false;

  try {
    const phoneVariants = getPhoneLookupVariants(fromPhone);

    const matchedCustomer = phoneVariants.length > 0
      ? await prisma.customer.findFirst({
          where: {
            phone: { in: phoneVariants }
          },
          select: { id: true, name: true, phone: true, campaign: true }
        })
      : null;

    if (matchedCustomer) {
      matchedCustomerId = matchedCustomer.id;
      matchedCustomerName = matchedCustomer.name || senderName;
      isCrmCustomer = true;
      const brandName = await resolveWhatsAppBrandName(businessPhoneNumberId);
      const updateData: any = { lastContact: new Date() };
      if (e164Phone && matchedCustomer.phone !== e164Phone) {
        updateData.phone = e164Phone;
      }
      if (brandName && (!matchedCustomer.campaign || ['N/A', 'n/a', 'NA', 'na', 'Default Campaign', ''].includes(matchedCustomer.campaign.trim()))) {
        updateData.campaign = brandName;
      }
      // Auto-update lastContact and brand on the existing CRM customer
      await prisma.customer.update({
        where: { id: matchedCustomer.id },
        data: updateData
      }).catch(() => {});
      realtimeHub.broadcast('customers:sync', { source: 'whatsapp-activity', customerId: matchedCustomer.id });
      console.log(`[WEBHOOK CUSTOMER MATCH] Matched incoming phone ${fromPhone} to CRM customer: ${matchedCustomer.name} (${matchedCustomer.id})`);
    } else if (cleanFrom.length >= 7 && e164Phone) {
      // Auto-create new customer in CRM so they immediately appear in the Customer page
      const defaultName = (senderName && !senderName.startsWith('Khách WhatsApp'))
        ? senderName
        : `Khách WhatsApp (${cleanFrom.slice(-4)})`;
      const brandName = await resolveWhatsAppBrandName(businessPhoneNumberId);

      const newCustomer = await prisma.customer.create({
        data: {
          phone: e164Phone,
          name: defaultName,
          source: 'WhatsApp',
          campaign: brandName || 'N/A',
          status: 'New Lead',
          group: 'group_1',
          firstContact: new Date(),
          lastContact: new Date(),
          ownerId: null,
        }
      });
      matchedCustomerId = newCustomer.id;
      matchedCustomerName = newCustomer.name;
      isCrmCustomer = true;
      console.log(`[WEBHOOK AUTO-CREATED CUSTOMER] Auto-created CRM customer ${newCustomer.name} (${newCustomer.id}) for phone ${e164Phone} from brand ${brandName || 'N/A'}`);
      realtimeHub.broadcast('customers:sync', { source: 'whatsapp-auto-create', customerId: newCustomer.id });
    }
  } catch (lookupErr) {
    console.warn('[WEBHOOK CUSTOMER LOOKUP ERROR]', lookupErr);
  }

  return { customerId: matchedCustomerId, customerName: matchedCustomerName, isCrmCustomer };
}

/**
 * Automatically sync and provision CRM customers for any WhatsApp conversations that lack customer records
 */
export async function syncExistingWhatsAppCustomersToCrm(): Promise<number> {
  try {
    const unlinkedMessages = await prisma.whatsAppMessage.findMany({
      where: {
        OR: [
          { customerId: null },
          { customerId: { startsWith: 'cust_' } }
        ]
      },
      select: {
        id: true,
        customerPhone: true,
        customerName: true,
        businessPhoneNumberId: true,
        timestamp: true,
      },
      orderBy: { timestamp: 'asc' }
    });

    let syncedCount = 0;
    if (unlinkedMessages.length > 0) {
      const phoneGroups = new Map<string, { phone: string; name: string; firstDate: Date; lastDate: Date; businessPhoneNumberId?: string; messageIds: string[] }>();
      for (const msg of unlinkedMessages) {
        const clean = (msg.customerPhone || '').replace(/\D/g, '');
        if (clean.length < 7) continue;
        const e164 = normalizePhoneE164(msg.customerPhone);
        if (!e164) continue;
        const existing = phoneGroups.get(e164);
        const msgDate = new Date(msg.timestamp);
        if (!existing) {
          phoneGroups.set(e164, {
            phone: e164,
            name: (msg.customerName && !msg.customerName.startsWith('Khách WhatsApp'))
              ? msg.customerName
              : `Khách WhatsApp (${clean.slice(-4)})`,
            firstDate: msgDate,
            lastDate: msgDate,
            businessPhoneNumberId: msg.businessPhoneNumberId || undefined,
            messageIds: [msg.id]
          });
        } else {
          existing.messageIds.push(msg.id);
          if (msg.businessPhoneNumberId && !existing.businessPhoneNumberId) {
            existing.businessPhoneNumberId = msg.businessPhoneNumberId;
          }
          if (msgDate < existing.firstDate) existing.firstDate = msgDate;
          if (msgDate > existing.lastDate) existing.lastDate = msgDate;
          if (msg.customerName && !msg.customerName.startsWith('Khách WhatsApp') && existing.name.startsWith('Khách WhatsApp')) {
            existing.name = msg.customerName;
          }
        }
      }

      for (const [e164, group] of phoneGroups.entries()) {
        const variants = getPhoneLookupVariants(e164);
        let customer = await prisma.customer.findFirst({
          where: { phone: { in: variants } }
        });

        if (!customer) {
          const brandName = await resolveWhatsAppBrandName(group.businessPhoneNumberId);
          customer = await prisma.customer.create({
            data: {
              phone: group.phone,
              name: group.name,
              source: 'WhatsApp',
              campaign: brandName || 'N/A',
              status: 'New Lead',
              group: 'group_1',
              firstContact: group.firstDate,
              lastContact: group.lastDate,
              ownerId: null,
            }
          });
          syncedCount++;
        }

        await prisma.whatsAppMessage.updateMany({
          where: { id: { in: group.messageIds } },
          data: { customerId: customer.id, customerName: customer.name }
        });
      }

      if (syncedCount > 0) {
        console.log(`[SYNC WHATSAPP TO CRM] Successfully provisioned ${syncedCount} customers from WhatsApp messages.`);
        realtimeHub.broadcast('customers:sync', { source: 'whatsapp-batch-sync' });
      }
    }

    // Reconcile and backfill brand name in campaign for existing WhatsApp customers
    const unbrandedCustomers = await prisma.customer.findMany({
      where: {
        source: 'WhatsApp',
        campaign: { in: ['N/A', 'n/a', 'NA', 'na', '', 'Default Campaign'] }
      },
      select: { id: true, phone: true }
    });

    let brandUpdatedCount = 0;
    for (const cust of unbrandedCustomers) {
      const variants = getPhoneLookupVariants(cust.phone);

      const msgWithPhone = await prisma.whatsAppMessage.findFirst({
        where: {
          businessPhoneNumberId: { not: null },
          OR: [
            { customerId: cust.id },
            ...(variants.length > 0 ? [{ customerPhone: { in: variants } }] : [])
          ]
        },
        select: { businessPhoneNumberId: true },
        orderBy: { timestamp: 'desc' }
      });

      if (msgWithPhone?.businessPhoneNumberId) {
        const brand = await resolveWhatsAppBrandName(msgWithPhone.businessPhoneNumberId);
        if (brand) {
          await prisma.customer.update({
            where: { id: cust.id },
            data: { campaign: brand }
          });
          brandUpdatedCount++;
        }
      }
    }

    if (brandUpdatedCount > 0) {
      console.log(`[SYNC WHATSAPP BRAND] Backfilled brand names for ${brandUpdatedCount} WhatsApp customers.`);
      realtimeHub.broadcast('customers:sync', { source: 'whatsapp-brand-reconcile' });
    }

    // Automatically promote any 'New Lead' customers to 'Contacted' if an agent has already replied
    const newLeadCustomers = await prisma.customer.findMany({
      where: { status: 'New Lead' },
      select: { id: true, phone: true }
    });

    let promotedCount = 0;
    for (const lead of newLeadCustomers) {
      const variants = getPhoneLookupVariants(lead.phone);

      const hasAgentReply = await prisma.whatsAppMessage.findFirst({
        where: {
          sender: 'agent',
          OR: [
            { customerId: lead.id },
            ...(variants.length > 0 ? [{ customerPhone: { in: variants } }] : [])
          ]
        },
        select: { id: true, timestamp: true },
        orderBy: { timestamp: 'desc' }
      });

      if (hasAgentReply) {
        await prisma.customer.update({
          where: { id: lead.id },
          data: {
            status: 'Contacted',
            lastContact: hasAgentReply.timestamp
          }
        });
        promotedCount++;
      }
    }

    if (promotedCount > 0) {
      console.log(`[SYNC WHATSAPP STATUS] Automatically promoted ${promotedCount} customers from 'New Lead' to 'Contacted' because replies were already sent.`);
      realtimeHub.broadcast('customers:sync', { source: 'whatsapp-status-reconcile' });
    }

    return syncedCount + promotedCount;
  } catch (err) {
    console.warn('[SYNC WHATSAPP CUSTOMERS ERROR]', err);
    return 0;
  }
}

/**
 * Extract incoming messages from diverse Meta Webhook payload formats
 */
export function extractWebhookItems(body: any): Array<{ msgData: any; valueObj: any }> {
  const extractedItems: Array<{ msgData: any; valueObj: any }> = [];

  const processValue = (val: any) => {
    if (!val || typeof val !== 'object') return;
    const targetVal = (val.value && typeof val.value === 'object' && Array.isArray(val.value.messages)) ? val.value : val;
    if (Array.isArray(targetVal.messages)) {
      for (const msgData of targetVal.messages) {
        extractedItems.push({ msgData, valueObj: targetVal });
      }
    }
  };

  if (Array.isArray(body?.entry)) {
    for (const entry of body.entry) {
      if (Array.isArray(entry?.changes)) {
        for (const change of entry.changes) {
          processValue(change?.value || change);
        }
      } else {
        processValue(entry);
      }
    }
  } else if (Array.isArray(body?.changes)) {
    for (const change of body.changes) {
      processValue(change?.value || change);
    }
  } else if (body?.value) {
    processValue(body.value);
  } else if (Array.isArray(body?.messages)) {
    processValue(body);
  } else if (Array.isArray(body)) {
    for (const item of body) {
      processValue(item?.value || item);
    }
  } else {
    processValue(body);
  }

  return extractedItems;
}

function extractWebhookStatuses(body: any): any[] {
  const statuses: any[] = [];
  const collect = (value: any) => {
    if (Array.isArray(value?.statuses)) statuses.push(...value.statuses);
  };
  if (Array.isArray(body?.entry)) {
    for (const entry of body.entry) {
      if (Array.isArray(entry?.changes)) {
        for (const change of entry.changes) collect(change?.value || change);
      } else collect(entry?.value || entry);
    }
  } else if (Array.isArray(body?.changes)) {
    for (const change of body.changes) collect(change?.value || change);
  } else {
    collect(body?.value || body);
  }
  return statuses;
}

function extractWebhookChanges(body: any): Array<{ field: string; value: any; entryId?: string }> {
  const changes: Array<{ field: string; value: any; entryId?: string }> = [];
  for (const entry of Array.isArray(body?.entry) ? body.entry : []) {
    for (const change of Array.isArray(entry?.changes) ? entry.changes : []) {
      changes.push({
        field: String(change?.field || ''),
        value: change?.value || {},
        entryId: entry?.id ? String(entry.id) : undefined,
      });
    }
  }
  return changes;
}

function getMessageText(msgData: any, businessPhoneNumberId?: string): string {
  const directText = msgData?.text?.body;
  if (directText) return directText;
  const phoneQuery = businessPhoneNumberId ? `?phoneId=${encodeURIComponent(businessPhoneNumberId)}` : '';
  if (msgData?.type === 'image') {
    const mediaId = msgData.image?.id;
    const caption = msgData.image?.caption || '';
    return mediaId
      ? `/api/meta/media/${mediaId}${phoneQuery}${caption ? `\n${caption}` : ''}`
      : caption ? `[Hình ảnh] ${caption}` : '[Hình ảnh]';
  }
  if (msgData?.type === 'sticker') {
    const mediaId = msgData.sticker?.id;
    return mediaId
      ? `/api/meta/media/${mediaId}${phoneQuery}`
      : '[Nhãn dán]';
  }
  if (msgData?.type === 'document') {
    const mediaId = msgData.document?.id;
    const filename = msgData.document?.filename || 'Tài liệu.pdf';
    const caption = msgData.document?.caption || '';
    const extraPhone = businessPhoneNumberId ? `&phoneId=${encodeURIComponent(businessPhoneNumberId)}` : '';
    return mediaId
      ? `/api/meta/media/${mediaId}?type=document&filename=${encodeURIComponent(filename)}${extraPhone}${caption ? `\n${caption}` : ''}`
      : caption ? `[Tài liệu] ${filename}\n${caption}` : `[Tài liệu] ${filename}`;
  }
  if (msgData?.type === 'audio') {
    const mediaId = msgData.audio?.id;
    const extraPhone = businessPhoneNumberId ? `&phoneId=${encodeURIComponent(businessPhoneNumberId)}` : '';
    return mediaId
      ? `/api/meta/media/${mediaId}?type=audio${extraPhone}`
      : '[Tin nhắn thoại (Audio)]';
  }
  if (msgData?.type === 'video') return '[Video]';
  if (msgData?.type === 'location') {
    return `[Vị trí] ${msgData.location?.name || ''} (${msgData.location?.latitude || ''}, ${msgData.location?.longitude || ''})`.trim();
  }
  return msgData?.type ? `[${msgData.type} message]` : 'Tin nhắn WhatsApp';
}

async function processIntegrationLifecycle(body: any): Promise<void> {
  for (const change of extractWebhookChanges(body)) {
    const eventName = String(change.value?.event || change.value?.type || '').toUpperCase();
    const isDisconnected = (change.field === 'account_update' && eventName === 'PARTNER_REMOVED')
      || change.field === 'account_offboarded';
    if (!isDisconnected) continue;

    const setting = await getIntegrationSetting();
    const eventWabaId = String(change.value?.waba_info?.waba_id || change.value?.waba_id || change.entryId || '');
    const disconnectedWabaId = eventWabaId || setting.whatsappWabaId || '';
    if (!disconnectedWabaId) continue;

    await prisma.whatsAppConnection.updateMany({
      where: { wabaId: disconnectedWabaId },
      data: { status: 'disconnected' },
    });

    // Offboarding one WABA must not disconnect every other number. Only move the
    // global default pointer when the active WABA is the one Meta removed.
    if (setting.whatsappWabaId === disconnectedWabaId) {
      const fallback = await prisma.whatsAppConnection.findFirst({
        where: { status: 'connected' },
        orderBy: { createdAt: 'asc' },
      });
      await updateIntegrationSetting(fallback ? {
        whatsappPhoneNumberId: fallback.phoneNumberId,
        whatsappWabaId: fallback.wabaId,
        metaBusinessId: fallback.businessId,
        whatsappAccessTokenEncrypted: fallback.accessTokenEncrypted,
        whatsappRegistrationPinEncrypted: fallback.registrationPinEncrypted,
        whatsappTokenExpiresAt: fallback.tokenExpiresAt,
        status: 'connected',
        lastConnectedAt: fallback.lastConnectedAt,
      } : {
        whatsappPhoneNumberId: null,
        whatsappWabaId: null,
        metaBusinessId: null,
        whatsappAccessTokenEncrypted: null,
        whatsappRegistrationPinEncrypted: null,
        whatsappTokenExpiresAt: null,
        status: 'disconnected',
        lastConnectedAt: null,
      }, { requirePersistence: true });
      realtimeHub.broadcast('integration:status', {
        status: fallback ? 'connected' : 'disconnected',
        reason: eventName || change.field,
        phoneNumberId: fallback?.phoneNumberId,
      });
    }
  }
}

async function processSmbContacts(body: any): Promise<number> {
  let processed = 0;
  for (const change of extractWebhookChanges(body)) {
    if (change.field !== 'smb_app_state_sync') continue;
    for (const state of Array.isArray(change.value?.state_sync) ? change.value.state_sync : []) {
      if (state?.type !== 'contact' || state?.contact?.action === 'remove') continue;
      const rawPhone = String(state?.contact?.phone_number || '');
      const digits = rawPhone.replace(/\D/g, '');
      if (digits.length < 7) continue;
      const e164 = normalizePhoneE164(rawPhone);
      if (!e164) continue;
      const variants = getPhoneLookupVariants(e164);
      const existing = await prisma.customer.findFirst({ where: { phone: { in: variants } } });
      if (!existing) {
        await prisma.customer.create({
          data: {
            phone: e164,
            name: state.contact.full_name || state.contact.first_name || `Liên hệ WhatsApp ${digits.slice(-4)}`,
            source: 'WhatsApp',
            ownerId: null,
          },
        });
      }
      processed++;
    }
  }
  if (processed > 0) realtimeHub.broadcast('customers:sync', { source: 'whatsapp-contacts' });
  return processed;
}

async function saveMirroredMessage(input: {
  msgData: any;
  customerPhone: string;
  businessPhoneNumberId?: string;
  sender: 'agent' | 'customer';
  customerName?: string;
  broadcast?: boolean;
}): Promise<boolean> {
  const { msgData, customerPhone, sender, broadcast = false } = input;
  if (!msgData?.id || !customerPhone) return false;
  const matched = await matchCustomerByPhone(
    customerPhone,
    input.customerName || `Khách WhatsApp (${customerPhone})`,
    input.businessPhoneNumberId
  );
  const mirrored: InMemoryMessage = {
    id: String(msgData.id),
    customerId: matched.customerId,
    customerName: matched.customerName,
    customerPhone,
    businessPhoneNumberId: input.businessPhoneNumberId,
    sender,
    agentName: sender === 'agent' ? 'WhatsApp Business App' : undefined,
    channel: 'WhatsApp',
    content: getMessageText(msgData, input.businessPhoneNumberId),
    timestamp: new Date(Number(msgData.timestamp) * 1000 || Date.now()).toISOString(),
    isRead: true,
  };
  const mirroredMediaId = msgData.image?.id || msgData.document?.id || msgData.audio?.id || msgData.sticker?.id;
  if (mirroredMediaId) {
    void enqueueMediaPrefetch({
      mediaId: mirroredMediaId,
      businessPhoneNumberId: input.businessPhoneNumberId,
    });
  }
  messageStore.add(mirrored);
  await prisma.whatsAppMessage.upsert({
    where: { id: mirrored.id },
    update: {},
    create: {
      id: mirrored.id,
      ...(matched.isCrmCustomer ? { customerId: matched.customerId } : {}),
      customerName: matched.customerName,
      customerPhone,
      businessPhoneNumberId: input.businessPhoneNumberId || null,
      sender: mirrored.sender,
      agentName: mirrored.agentName,
      channel: mirrored.channel,
      content: mirrored.content,
      isRead: true,
      timestamp: new Date(mirrored.timestamp),
    },
  });

  if (sender === 'agent' && matched.isCrmCustomer) {
    await prisma.customer.update({
      where: { id: matched.customerId },
      data: {
        lastContact: new Date(mirrored.timestamp),
        status: 'Contacted',
      },
    }).catch(() => {});
    realtimeHub.broadcast('customers:sync', { source: 'whatsapp-agent-reply', customerId: matched.customerId });
  }

  if (broadcast) realtimeHub.broadcast('message:new', mirrored);
  return true;
}

async function processSmbMessages(body: any): Promise<number> {
  let processed = 0;
  let historyChanged = false;
  for (const change of extractWebhookChanges(body)) {
    if (change.field === 'smb_message_echoes') {
      for (const message of Array.isArray(change.value?.message_echoes) ? change.value.message_echoes : []) {
        if (await saveMirroredMessage({
          msgData: message,
          customerPhone: String(message?.to || ''),
          businessPhoneNumberId: String(change.value?.metadata?.phone_number_id || '') || undefined,
          sender: 'agent',
          broadcast: true,
        })) processed++;
      }
    }
    if (change.field === 'history') {
      const businessPhone = String(change.value?.metadata?.display_phone_number || '').replace(/\D/g, '');
      for (const batch of Array.isArray(change.value?.history) ? change.value.history : []) {
        for (const thread of Array.isArray(batch?.threads) ? batch.threads : []) {
          for (const message of Array.isArray(thread?.messages) ? thread.messages : []) {
            const from = String(message?.from || '').replace(/\D/g, '');
            const isAgent = Boolean(businessPhone && from === businessPhone);
            const customerPhone = isAgent ? String(message?.to || thread?.id || '') : String(message?.from || thread?.id || '');
            if (await saveMirroredMessage({
              msgData: message,
              customerPhone,
              businessPhoneNumberId: String(change.value?.metadata?.phone_number_id || '') || undefined,
              sender: isAgent ? 'agent' : 'customer',
            })) {
              processed++;
              historyChanged = true;
            }
          }
        }
      }
    }
  }
  if (historyChanged) realtimeHub.broadcast('messages:sync', { source: 'whatsapp-history' });
  return processed;
}

async function processWebhookStatuses(body: any) {
  const affectedCampaigns = new Set<string>();
  for (const item of extractWebhookStatuses(body)) {
    if (!item?.id || !item?.status) continue;
    const eventAt = new Date(Number(item.timestamp) * 1000 || Date.now());

    // 1. Process Campaign Broadcast Recipient status
    const recipient = await prisma.broadcastRecipient.findUnique({
      where: { metaMessageId: item.id },
      select: { id: true, campaignId: true },
    }).catch(() => null);

    if (recipient) {
      if (item.status === 'delivered') {
        await prisma.broadcastRecipient.updateMany({
          where: { id: recipient.id, status: 'Sent' },
          data: { status: 'Delivered', deliveredAt: eventAt },
        });
      } else if (item.status === 'read') {
        await prisma.broadcastRecipient.updateMany({
          where: { id: recipient.id, status: { in: ['Sent', 'Delivered'] } },
          data: { status: 'Read', deliveredAt: eventAt, readAt: eventAt },
        });
      } else if (item.status === 'failed') {
        const error = item.errors?.[0];
        await prisma.broadcastRecipient.updateMany({
          where: { id: recipient.id, status: { in: ['Pending', 'Processing', 'Retry', 'Sent'] } },
          data: {
            status: 'Failed',
            lastErrorCode: error?.code ? String(error.code) : 'META_FAILED',
            lastErrorMessage: error?.title || error?.message || 'Meta báo gửi thất bại.',
          },
        });
      }
      affectedCampaigns.add(recipient.campaignId);
    }

    // 2. Process Direct 1-1 Chat Message status (WhatsAppMessage)
    const directMsg = await prisma.whatsAppMessage.findUnique({
      where: { id: item.id },
      select: { id: true, status: true, customerId: true, customerPhone: true },
    }).catch(() => null);

    if (directMsg) {
      if (item.status === 'sent') {
        if (directMsg.status === 'sending') {
          await prisma.whatsAppMessage.update({
            where: { id: item.id },
            data: { status: 'sent' },
          });
          messageStore.updateMessage(item.id, { status: 'sent' });
          realtimeHub.broadcast('message:status', {
            id: item.id,
            status: 'sent',
            customerId: directMsg.customerId,
            customerPhone: directMsg.customerPhone,
            timestamp: eventAt.toISOString(),
          });
        }
      } else if (item.status === 'delivered') {
        if (directMsg.status !== 'read') {
          await prisma.whatsAppMessage.update({
            where: { id: item.id },
            data: { status: 'delivered', deliveredAt: eventAt },
          });
          messageStore.updateMessage(item.id, { status: 'delivered', deliveredAt: eventAt.toISOString() });
          realtimeHub.broadcast('message:status', {
            id: item.id,
            status: 'delivered',
            deliveredAt: eventAt.toISOString(),
            customerId: directMsg.customerId,
            customerPhone: directMsg.customerPhone,
            timestamp: eventAt.toISOString(),
          });
        }
      } else if (item.status === 'read') {
        await prisma.whatsAppMessage.update({
          where: { id: item.id },
          data: { status: 'read', isRead: true, readAt: eventAt },
        });
        messageStore.updateMessage(item.id, { status: 'read', isRead: true, readAt: eventAt.toISOString() });
        realtimeHub.broadcast('message:status', {
          id: item.id,
          status: 'read',
          isRead: true,
          readAt: eventAt.toISOString(),
          customerId: directMsg.customerId,
          customerPhone: directMsg.customerPhone,
          timestamp: eventAt.toISOString(),
        });
      } else if (item.status === 'failed') {
        const error = item.errors?.[0];
        const errCode = error?.code ? String(error.code) : 'META_FAILED';
        let errMsg = error?.title || error?.message || 'Meta báo gửi thất bại.';
        if (error?.code === 131047) {
          errMsg = 'Quá 24 giờ kể từ tin nhắn cuối của khách. Hãy dùng tin nhắn mẫu (template).';
        } else if (error?.code === 131026) {
          errMsg = 'Không thể gửi đến số này (Số chưa kích hoạt WhatsApp hoặc đã chặn).';
        }
        await prisma.whatsAppMessage.update({
          where: { id: item.id },
          data: {
            status: 'failed',
            errorCode: errCode,
            errorMessage: errMsg,
          },
        });
        messageStore.updateMessage(item.id, { status: 'failed', errorCode: errCode, errorMessage: errMsg });
        realtimeHub.broadcast('message:status', {
          id: item.id,
          status: 'failed',
          errorCode: errCode,
          errorMessage: errMsg,
          customerId: directMsg.customerId,
          customerPhone: directMsg.customerPhone,
          timestamp: eventAt.toISOString(),
        });
      }
    } else {
      // In case message is only in memory
      const inMem = messageStore.find((m) => m.id === item.id);
      if (inMem) {
        let mappedStatus: 'sent' | 'delivered' | 'read' | 'failed' = 'sent';
        let errCode: string | undefined;
        let errMsg: string | undefined;
        if (item.status === 'delivered') mappedStatus = 'delivered';
        else if (item.status === 'read') mappedStatus = 'read';
        else if (item.status === 'failed') {
          mappedStatus = 'failed';
          const error = item.errors?.[0];
          errCode = error?.code ? String(error.code) : 'META_FAILED';
          errMsg = error?.title || error?.message || 'Meta báo gửi thất bại.';
        }
        messageStore.updateMessage(item.id, {
          status: mappedStatus,
          errorCode: errCode,
          errorMessage: errMsg,
          isRead: mappedStatus === 'read' ? true : inMem.isRead,
          deliveredAt: mappedStatus === 'delivered' ? eventAt.toISOString() : inMem.deliveredAt,
          readAt: mappedStatus === 'read' ? eventAt.toISOString() : inMem.readAt,
        });
        realtimeHub.broadcast('message:status', {
          id: item.id,
          status: mappedStatus,
          errorCode: errCode,
          errorMessage: errMsg,
          customerId: inMem.customerId,
          customerPhone: inMem.customerPhone,
          timestamp: eventAt.toISOString(),
        });
      }
    }
  }
  if (affectedCampaigns.size > 0) {
    await Promise.all(Array.from(affectedCampaigns, (campaignId) => aggregateCampaign(campaignId)));
  }
}

/**
 * Process entire Meta Webhook payload: parse, match, save, and update campaign delivery states
 */
export async function processWebhookPayload(body: any): Promise<number> {
  let parsedBody = body;
  if (typeof parsedBody === 'string') {
    try {
      parsedBody = JSON.parse(parsedBody);
    } catch (e) {}
  }

  console.log('[META WEBHOOK POST RECEIVED]', JSON.stringify(parsedBody, null, 2));

  await processIntegrationLifecycle(parsedBody);
  await processWebhookStatuses(parsedBody);
  const smbContactCount = await processSmbContacts(parsedBody);
  const smbMessageCount = await processSmbMessages(parsedBody);
  const extractedItems = extractWebhookItems(parsedBody);
  let processedCount = smbContactCount + smbMessageCount;

  for (const { msgData, valueObj } of extractedItems) {
    const contactData = valueObj?.contacts?.find((c: any) => c.wa_id === msgData.from) || valueObj?.contacts?.[0];
    const fromPhone = msgData.from || 'Khách Hàng';
    const businessPhoneNumberId = String(valueObj?.metadata?.phone_number_id || '') || undefined;
    const senderName = contactData?.profile?.name || `Khách WhatsApp (${fromPhone})`;

    // Determine message text body based on message type
    const textBody = getMessageText(msgData, businessPhoneNumberId);

    // Match customer in CRM
    const { customerId, customerName, isCrmCustomer } = await matchCustomerByPhone(fromPhone, senderName, businessPhoneNumberId);

    // Resolve reply context if applicable
    let replyContext: any = null;
    if (msgData.context?.id) {
      const origMsg = messageStore.find((m) => m.id === msgData.context.id) ||
        await prisma.whatsAppMessage.findUnique({ where: { id: msgData.context.id } }).catch(() => null);
      if (origMsg) {
        let rawOrigContent = (origMsg.content || '').replace(/^\[reply:\{.*?\}\]\n/, '');
        if (/^\[product(?:_list)?(?::\s*|\s*)\{/i.test(rawOrigContent)) {
          const nameMatch = rawOrigContent.match(/"name"\s*:\s*"([^"]+)"/i);
          rawOrigContent = nameMatch ? `[Sản phẩm] ${nameMatch[1]}` : '[Sản phẩm]';
        }
        replyContext = {
          id: origMsg.id,
          senderName: origMsg.agentName || origMsg.customerName || (origMsg.sender === 'agent' ? 'Nhân viên' : 'Khách hàng'),
          content: rawOrigContent.slice(0, 150)
        };
      } else {
        replyContext = {
          id: msgData.context.id,
          senderName: msgData.context.from ? `+${msgData.context.from}` : 'Tin nhắn trước',
          content: 'Tin nhắn WhatsApp gốc'
        };
      }
    }

    if (msgData.context?.id) {
      const campaignRecipient = await prisma.broadcastRecipient.findUnique({
        where: { metaMessageId: msgData.context.id },
        select: { id: true, campaignId: true, respondedAt: true },
      }).catch(() => null);
      if (campaignRecipient && !campaignRecipient.respondedAt) {
        await prisma.broadcastRecipient.update({
          where: { id: campaignRecipient.id },
          data: { respondedAt: new Date() },
        });
        const respondedCount = await prisma.broadcastRecipient.count({
          where: { campaignId: campaignRecipient.campaignId, respondedAt: { not: null } },
        });
        await prisma.broadcastCampaign.update({
          where: { id: campaignRecipient.campaignId },
          data: { respondedCount },
        });
      }
    }

    let fullTextBody = textBody;
    if (replyContext) {
      fullTextBody = `[reply:${JSON.stringify(replyContext)}]\n${textBody}`;
    }

    const newIncoming: InMemoryMessage = {
      id: msgData.id || `msg_meta_${Date.now()}`,
      customerId,
      customerName,
      customerPhone: fromPhone,
      businessPhoneNumberId,
      sender: 'customer',
      channel: 'WhatsApp',
      content: fullTextBody,
      timestamp: new Date(Number(msgData.timestamp) * 1000 || Date.now()).toISOString(),
      isRead: false,
      replyTo: replyContext || undefined
    };

    messageStore.add(newIncoming);

    const incomingMediaId = msgData.image?.id || msgData.document?.id || msgData.audio?.id || msgData.sticker?.id;
    if (incomingMediaId) {
      await enqueueMediaPrefetch({
        mediaId: incomingMediaId,
        businessPhoneNumberId,
      });
    }

    // Save incoming message to Database (Prisma)
    try {
      const createData: any = {
        id: newIncoming.id,
        customerName: newIncoming.customerName,
        customerPhone: newIncoming.customerPhone,
        businessPhoneNumberId: businessPhoneNumberId || null,
        sender: newIncoming.sender,
        channel: newIncoming.channel,
        content: newIncoming.content,
        isRead: newIncoming.isRead,
        timestamp: new Date(newIncoming.timestamp)
      };

      if (isCrmCustomer) {
        createData.customerId = customerId;
      }

      const savedDbMsg = await prisma.whatsAppMessage.upsert({
        where: { id: newIncoming.id },
        update: {},
        create: createData
      });
      console.log(`[DB SAVE SUCCESS] Saved INCOMING message ${savedDbMsg.id} to PostgreSQL Database!`);

      if (isCrmCustomer) {
        await prisma.customer.update({
          where: { id: customerId },
          data: { lastContact: new Date() }
        }).catch(() => {});
      }
    } catch (dbErr: any) {
      console.error('[DB SAVE ERROR] Failed to save incoming message to DB:', dbErr.message || dbErr);
    }

    console.log(`[INCOMING REAL WHATSAPP WEBHOOK] Added message from ${customerName} (${fromPhone}): "${textBody}"`);

    // Broadcast instant real-time event to all connected clients
    realtimeHub.broadcast('message:new', newIncoming);
    processedCount++;

    // Push Dify AI Auto-reply job into dedicated worker queue
    if (textBody && fromPhone) {
      const brandName = valueObj?.metadata?.display_phone_number || undefined;
      await enqueueDifyAutoReply({
        fromPhone,
        customerName,
        customerId,
        incomingText: textBody,
        isCrmCustomer,
        incomingMsgId: msgData?.id,
        brandName,
        businessPhoneNumberId,
      });
    }
  }

  return processedCount;
}
