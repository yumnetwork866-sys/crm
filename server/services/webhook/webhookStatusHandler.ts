import { prisma } from '../../lib/prisma';
import { getIntegrationSetting, updateIntegrationSetting } from '../metaApiClient';
import { realtimeHub } from '../realtimeHub';
import { aggregateCampaign } from '../campaignWorker';
import { enqueueMediaPrefetch } from '../queueService';
import { getPhoneLookupVariants, normalizePhoneE164 } from '../../utils/phone';
import { matchCustomerByPhone } from './webhookCustomerSync';
import {
  extractWebhookChanges,
  extractWebhookStatuses,
  getMessageText,
} from './webhookMessageParser';

export async function processIntegrationLifecycle(body: any): Promise<void> {
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

export async function processSmbContacts(body: any): Promise<number> {
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

export async function saveMirroredMessage(input: {
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

  if (msgData?.type === 'reaction') {
    const targetMessageId = msgData.reaction?.message_id;
    const emoji = msgData.reaction?.emoji || null;
    if (targetMessageId) {
      await prisma.whatsAppMessage.updateMany({
        where: { id: targetMessageId },
        data: { reaction: emoji },
      }).catch(() => {});
      realtimeHub.broadcast('message:reaction', {
        messageId: targetMessageId,
        emoji: emoji || '',
        customerId: matched.customerId,
        customerPhone,
        isRealSent: true,
      });
      return true;
    }
    return false;
  }

  const mirrored = {
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

export async function processSmbMessages(body: any): Promise<number> {
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

export async function processWebhookStatuses(body: any) {
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
    }
  }
  if (affectedCampaigns.size > 0) {
    await Promise.all(Array.from(affectedCampaigns, (campaignId) => aggregateCampaign(campaignId)));
  }
}
