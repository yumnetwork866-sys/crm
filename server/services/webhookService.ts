import { prisma } from '../lib/prisma';
import type { InMemoryMessage } from './messageStore';
import { messageStore } from './messageStore';
import { getIntegrationSetting, updateIntegrationSetting } from './metaApiClient';
import { realtimeHub } from './realtimeHub';
import { aggregateCampaign } from './campaignWorker';
import { autoReplyWithDify } from './difyService';

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

/**
 * Match incoming phone number to an existing CRM customer
 */
export async function matchCustomerByPhone(fromPhone: string, senderName: string): Promise<{ customerId: string; customerName: string; isCrmCustomer: boolean }> {
  const cleanFrom = fromPhone.replace(/\D/g, '');
  let matchedCustomerId = `cust_${cleanFrom}`;
  let matchedCustomerName = senderName;
  let isCrmCustomer = false;

  try {
    const phoneVariants: string[] = [cleanFrom];
    if (cleanFrom.startsWith('84') && cleanFrom.length > 9) {
      phoneVariants.push('0' + cleanFrom.substring(2));
    }
    if (cleanFrom.startsWith('0')) {
      phoneVariants.push('84' + cleanFrom.substring(1));
    }

    const matchedCustomer = await prisma.customer.findFirst({
      where: {
        OR: phoneVariants.map((pv: string) => ({
          phone: { contains: pv }
        }))
      },
      select: { id: true, name: true, phone: true }
    });

    if (matchedCustomer) {
      matchedCustomerId = matchedCustomer.id;
      matchedCustomerName = matchedCustomer.name || senderName;
      isCrmCustomer = true;
      console.log(`[WEBHOOK CUSTOMER MATCH] Matched incoming phone ${fromPhone} to CRM customer: ${matchedCustomer.name} (${matchedCustomer.id})`);
    } else {
      console.log(`[WEBHOOK NO MATCH] No CRM customer found for phone ${fromPhone}, using fallback ID: ${matchedCustomerId}`);
    }
  } catch (lookupErr) {
    console.warn('[WEBHOOK CUSTOMER LOOKUP ERROR]', lookupErr);
  }

  return { customerId: matchedCustomerId, customerName: matchedCustomerName, isCrmCustomer };
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

function getMessageText(msgData: any): string {
  const directText = msgData?.text?.body;
  if (directText) return directText;
  if (msgData?.type === 'image') {
    const mediaId = msgData.image?.id;
    const caption = msgData.image?.caption || '';
    return mediaId
      ? `/api/meta/media/${mediaId}${caption ? `\n${caption}` : ''}`
      : caption ? `[Hình ảnh] ${caption}` : '[Hình ảnh]';
  }
  if (msgData?.type === 'sticker') return '[Sticker WhatsApp]';
  if (msgData?.type === 'document') return `[Tài liệu] ${msgData.document?.filename || 'Tập tin đính kèm'}`;
  if (msgData?.type === 'audio') return '[Tin nhắn thoại (Audio)]';
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
    if (setting.whatsappWabaId && eventWabaId && setting.whatsappWabaId !== eventWabaId) continue;

    await updateIntegrationSetting({
      whatsappPhoneNumberId: null,
      whatsappWabaId: null,
      metaBusinessId: null,
      whatsappAccessTokenEncrypted: null,
      whatsappTokenExpiresAt: null,
      status: 'disconnected',
      lastConnectedAt: null,
    }, { requirePersistence: true });
    realtimeHub.broadcast('integration:status', { status: 'disconnected', reason: eventName || change.field });
  }
}

async function processSmbContacts(body: any): Promise<number> {
  let processed = 0;
  for (const change of extractWebhookChanges(body)) {
    if (change.field !== 'smb_app_state_sync') continue;
    for (const state of Array.isArray(change.value?.state_sync) ? change.value.state_sync : []) {
      if (state?.type !== 'contact' || state?.contact?.action === 'remove') continue;
      const phone = String(state?.contact?.phone_number || '').replace(/\D/g, '');
      if (phone.length < 7) continue;
      const phoneSuffix = phone.slice(-9);
      const existing = await prisma.customer.findFirst({ where: { phone: { contains: phoneSuffix } } });
      if (!existing) {
        await prisma.customer.create({
          data: {
            phone: `+${phone}`,
            name: state.contact.full_name || state.contact.first_name || `Liên hệ WhatsApp ${phoneSuffix}`,
            source: 'WhatsApp',
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
  sender: 'agent' | 'customer';
  customerName?: string;
  broadcast?: boolean;
}): Promise<boolean> {
  const { msgData, customerPhone, sender, broadcast = false } = input;
  if (!msgData?.id || !customerPhone) return false;
  const matched = await matchCustomerByPhone(customerPhone, input.customerName || `Khách WhatsApp (${customerPhone})`);
  const mirrored: InMemoryMessage = {
    id: String(msgData.id),
    customerId: matched.customerId,
    customerName: matched.customerName,
    customerPhone,
    sender,
    agentName: sender === 'agent' ? 'WhatsApp Business App' : undefined,
    channel: 'WhatsApp',
    content: getMessageText(msgData),
    timestamp: new Date(Number(msgData.timestamp) * 1000 || Date.now()).toISOString(),
    isRead: true,
  };
  messageStore.add(mirrored);
  await prisma.whatsAppMessage.upsert({
    where: { id: mirrored.id },
    update: {},
    create: {
      id: mirrored.id,
      ...(matched.isCrmCustomer ? { customerId: matched.customerId } : {}),
      customerName: matched.customerName,
      customerPhone,
      sender: mirrored.sender,
      agentName: mirrored.agentName,
      channel: mirrored.channel,
      content: mirrored.content,
      isRead: true,
      timestamp: new Date(mirrored.timestamp),
    },
  });
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

async function processCampaignStatuses(body: any) {
  const affectedCampaigns = new Set<string>();
  for (const item of extractWebhookStatuses(body)) {
    if (!item?.id || !item?.status) continue;
    const recipient = await prisma.broadcastRecipient.findUnique({
      where: { metaMessageId: item.id },
      select: { id: true, campaignId: true },
    }).catch(() => null);
    if (!recipient) continue;

    const eventAt = new Date(Number(item.timestamp) * 1000 || Date.now());
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
  await Promise.all(Array.from(affectedCampaigns, (campaignId) => aggregateCampaign(campaignId)));
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
  await processCampaignStatuses(parsedBody);
  const smbContactCount = await processSmbContacts(parsedBody);
  const smbMessageCount = await processSmbMessages(parsedBody);
  const extractedItems = extractWebhookItems(parsedBody);
  let processedCount = smbContactCount + smbMessageCount;

  for (const { msgData, valueObj } of extractedItems) {
    const contactData = valueObj?.contacts?.find((c: any) => c.wa_id === msgData.from) || valueObj?.contacts?.[0];
    const fromPhone = msgData.from || 'Khách Hàng';
    const senderName = contactData?.profile?.name || `Khách WhatsApp (${fromPhone})`;

    // Determine message text body based on message type
    const textBody = getMessageText(msgData);

    // Match customer in CRM
    const { customerId, customerName, isCrmCustomer } = await matchCustomerByPhone(fromPhone, senderName);

    // Resolve reply context if applicable
    let replyContext: any = null;
    if (msgData.context?.id) {
      const origMsg = messageStore.find((m) => m.id === msgData.context.id) ||
        await prisma.whatsAppMessage.findUnique({ where: { id: msgData.context.id } }).catch(() => null);
      if (origMsg) {
        const rawOrigContent = (origMsg.content || '').replace(/^\[reply:\{.*?\}\]\n/, '');
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
      sender: 'customer',
      channel: 'WhatsApp',
      content: fullTextBody,
      timestamp: new Date(Number(msgData.timestamp) * 1000 || Date.now()).toISOString(),
      isRead: false,
      replyTo: replyContext || undefined
    };

    messageStore.add(newIncoming);

    // Save incoming message to Database (Prisma)
    try {
      const createData: any = {
        id: newIncoming.id,
        customerName: newIncoming.customerName,
        customerPhone: newIncoming.customerPhone,
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

    // Trigger Dify AI Auto-reply asynchronously (completely non-blocking)
    if (textBody && fromPhone) {
      const brandName = valueObj?.metadata?.display_phone_number || undefined;
      autoReplyWithDify({
        fromPhone,
        customerName,
        customerId,
        incomingText: textBody,
        isCrmCustomer,
        incomingMsgId: msgData?.id,
        brandName,
      }).catch((aiErr) => {
        console.warn('[Dify Auto-reply Hook Error]', aiErr?.message || aiErr);
      });
    }
  }

  return processedCount;
}
