import { prisma } from '../lib/prisma';
import type { InMemoryMessage } from './messageStore';
import { messageStore } from './messageStore';
import { realtimeHub } from './realtimeHub';
import { enqueueDifyAutoReply, enqueueMediaPrefetch } from './queueService';
import { matchCustomerByPhone } from './webhook/webhookCustomerSync';
import { extractWebhookItems, getMessageText } from './webhook/webhookMessageParser';
import {
  processIntegrationLifecycle,
  processSmbContacts,
  processSmbMessages,
  processWebhookStatuses,
} from './webhook/webhookStatusHandler';

export * from './webhook/webhookCustomerSync';
export * from './webhook/webhookMessageParser';
export * from './webhook/webhookStatusHandler';

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
