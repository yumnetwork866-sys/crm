import { prisma } from '../lib/prisma';
import { realtimeHub } from './realtimeHub';
import { enqueueDifyAutoReply, enqueueMediaPrefetch } from './queueService';
import { matchCustomerByPhone } from './webhook/webhookCustomerSync';
import { extractWebhookItems, getMessageText, getWebhookSenderIdentity } from './webhook/webhookMessageParser';
import { isMetaUserIdentifier, normalizeMetaRecipient } from '../utils/metaRecipient';
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
    const senderIdentity = getWebhookSenderIdentity(msgData, valueObj);
    const fromPhone = senderIdentity.recipient;
    if (!fromPhone) {
      console.warn('[META WEBHOOK] Skipping message without from/from_user_id/user_id:', msgData?.id || 'unknown');
      continue;
    }
    const contactData = valueObj?.contacts?.find((c: any) =>
      [c?.wa_id, c?.from_user_id, c?.user_id].some((id) => String(id || '') === fromPhone)
    ) || valueObj?.contacts?.[0];
    const businessPhoneNumberId = String(valueObj?.metadata?.phone_number_id || '') || undefined;
    const senderName = contactData?.profile?.name
      || contactData?.username
      || msgData?.profile?.name
      || msgData?.username
      || valueObj?.username
      || (isMetaUserIdentifier(fromPhone) ? fromPhone : `Khách WhatsApp (${fromPhone})`);

    // Determine message text body based on message type
    const textBody = getMessageText(msgData, businessPhoneNumberId);

    // Match customer in CRM
    const { customerId, customerName, isCrmCustomer } = await matchCustomerByPhone(
      fromPhone,
      senderName,
      businessPhoneNumberId,
      {
        incomingActivity: true,
        incomingActivityAt: new Date(Number(msgData.timestamp) * 1000 || Date.now()),
        recipientId: senderIdentity.bsuid,
        parentRecipientId: senderIdentity.parentBsuid,
        phone: senderIdentity.phone,
        username: senderIdentity.username,
      },
    );

    // Handle WhatsApp reaction: update the target message instead of creating a new message record
    if (msgData?.type === 'reaction') {
      const targetMessageId = msgData.reaction?.message_id;
      const emoji = msgData.reaction?.emoji || null;

      if (targetMessageId) {
        try {
          await prisma.whatsAppMessage.updateMany({
            where: { id: targetMessageId },
            data: { reaction: emoji },
          });
        } catch (dbErr) {
          console.error('[META WEBHOOK REACTION DB ERROR]', dbErr);
        }

        realtimeHub.broadcast('message:reaction', {
          messageId: targetMessageId,
          emoji: emoji || '',
          customerId,
          customerPhone: fromPhone,
          isRealSent: true,
        });

        processedCount++;
      }
      continue;
    }

    // Resolve reply context if applicable
    let replyContext: any = null;
    if (msgData.context?.id) {
      const origMsg = await prisma.whatsAppMessage.findUnique({ where: { id: msgData.context.id } }).catch(() => null);
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

    const newIncoming = {
      id: msgData.id || `msg_meta_${Date.now()}`,
      customerId,
      customerName,
      customerPhone: senderIdentity.phone || fromPhone,
      recipientId: senderIdentity.bsuid || normalizeMetaRecipient(fromPhone),
      businessPhoneNumberId,
      sender: 'customer' as const,
      channel: 'WhatsApp',
      content: fullTextBody,
      timestamp: new Date(Number(msgData.timestamp) * 1000 || Date.now()).toISOString(),
      isRead: false,
      replyTo: replyContext || undefined
    };

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
        recipientId: newIncoming.recipientId || null,
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
