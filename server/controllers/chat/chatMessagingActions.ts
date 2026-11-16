import { ALL_BUSINESS_PHONES } from '../../../shared/whatsappScope';
import type { Request, Response } from 'express';
import type { AuthenticatedRequest } from '../../middleware/authMiddleware';
import { prisma } from '../../lib/prisma';
import { realtimeHub } from '../../services/realtimeHub';
import { getRouteParam } from '../../utils/requestParams';
import {
  getIntegrationSetting,
  getMetaAccessTokenForPhone,
  resolvePhoneNumberId,
  dispatchMetaMessage,
  dispatchMetaReaction,
} from '../../services/metaApiClient';
import { pauseNativeAi } from '../../services/ai/nativeAutoReply';
import { resolveWhatsAppBrandName } from '../../services/webhookService';
import { getPhoneLookupVariants, normalizePhoneE164, toWhatsAppDigits } from '../../utils/phone';
import { isMetaUserIdentifier, resolveMetaRecipient } from '../../utils/metaRecipient';
import {
  getWhatsAppDeliveryErrorMessage,
  getWhatsAppErrorDetails,
  WHATSAPP_UNREACHABLE_ERROR_CODE,
} from '../../utils/whatsappDeliveryError';
import { createLogger } from '../../lib/logger';

const log = createLogger('chat');

/**
 * Send real WhatsApp Cloud API message and save to CRM
 */
export async function sendMessage(req: AuthenticatedRequest, res: Response) {
  try {
    const { recipientId: requestedRecipientId, customerPhone, content, agentName, customerId, customerName, phoneNumberId: overridePhoneId, senderPhoneId, contextMessageId, replyTo } = req.body;

    if (senderPhoneId === ALL_BUSINESS_PHONES || overridePhoneId === ALL_BUSINESS_PHONES) {
      return res.status(400).json({ error: 'Chọn số WhatsApp doanh nghiệp cụ thể để gửi tin.' });
    }
    if (!content || (!requestedRecipientId && !customerPhone && !customerId)) {
      return res.status(400).json({ error: 'Vui lòng cung cấp số điện thoại người nhận và nội dung tin nhắn.' });
    }

    let rawPhone = requestedRecipientId || customerPhone
      || (customerId && /^(cust_|meta_)/.test(customerId)
        ? customerId.replace(/^(cust_|meta_)/, '')
        : (String(customerId).replace(/\D/g, '').length >= 7 ? customerId : ''))
      || '';
    let recipient = resolveMetaRecipient(rawPhone).recipient;
    let isUserIdentifier = isMetaUserIdentifier(rawPhone);
    let e164Phone = isUserIdentifier ? '' : normalizePhoneE164(rawPhone);
    let cleanPhone = isUserIdentifier ? '' : toWhatsAppDigits(rawPhone);

    let matchedCustomerId: string | null = null;
    let finalCustomerName = customerName;
    let whatsappReachability: string | null = null;

    try {
      if (customerId && !customerId.startsWith('cust_')) {
        const found = await prisma.customer.findUnique({
          where: { id: customerId },
          select: { id: true, name: true, phone: true, whatsappRecipientId: true, whatsappReachability: true }
        });
        if (found) {
          matchedCustomerId = found.id;
          whatsappReachability = found.whatsappReachability;
          if (!finalCustomerName) finalCustomerName = found.name;
          if (!recipient) {
            const resolved = resolveMetaRecipient(rawPhone, found.whatsappRecipientId || found.phone);
            rawPhone = resolved.raw;
            recipient = resolved.recipient;
            isUserIdentifier = isMetaUserIdentifier(rawPhone);
            e164Phone = isUserIdentifier ? '' : normalizePhoneE164(rawPhone);
            cleanPhone = isUserIdentifier ? '' : toWhatsAppDigits(rawPhone);
          }
        }
      }
      if (!matchedCustomerId && (isUserIdentifier || cleanPhone.length >= 7)) {
        const variants = isUserIdentifier ? [] : getPhoneLookupVariants(rawPhone);
        const found = isUserIdentifier
          ? await prisma.customer.findFirst({
              where: {
                OR: [
                  { whatsappRecipientId: rawPhone },
                  { phone: rawPhone },
                ],
              },
              select: { id: true, name: true, phone: true, whatsappRecipientId: true, whatsappReachability: true }
            })
          : variants.length > 0
          ? await prisma.customer.findFirst({
              where: {
                phone: { in: variants }
              },
              select: { id: true, name: true, phone: true, whatsappRecipientId: true, whatsappReachability: true }
            })
          : null;
        if (found) {
          matchedCustomerId = found.id;
          whatsappReachability = found.whatsappReachability;
          if (!finalCustomerName) finalCustomerName = found.name;
        } else if (e164Phone || isUserIdentifier) {
          // Auto-create new customer in CRM when agent initiates/replies to a new WhatsApp contact
          const defaultName = (finalCustomerName && !finalCustomerName.startsWith('Khách Hàng') && !finalCustomerName.startsWith('Khách WhatsApp'))
            ? finalCustomerName
            : isUserIdentifier ? rawPhone : `Khách WhatsApp (${cleanPhone.slice(-4)})`;
          const phoneId = senderPhoneId || overridePhoneId;
          const brandName = await resolveWhatsAppBrandName(phoneId);
          const newCust = await prisma.customer.create({
            data: {
              phone: isUserIdentifier ? '' : e164Phone,
              whatsappRecipientId: recipient || null,
              name: defaultName,
              source: 'WhatsApp',
              campaign: brandName || 'N/A',
              status: 'Contacted',
              group: 'group_1',
              firstContact: new Date(),
              lastContact: new Date(),
              ownerId: req.user?.id || null,
            }
          });
          matchedCustomerId = newCust.id;
          finalCustomerName = newCust.name;
          realtimeHub.broadcast('customers:sync', { source: 'chat-send-auto-create', customerId: newCust.id });
        }
      }
    } catch (e) {}

    if (matchedCustomerId && whatsappReachability === 'unreachable') {
      return res.status(409).json({
        error: 'Liên hệ đang ở trạng thái WhatsApp unreachable. Chỉ có tin nhắn mới từ khách mới mở lại khả năng gửi.',
        errorCode: 'WHATSAPP_UNREACHABLE',
      });
    }

    const resolvedCustomerId = matchedCustomerId || (customerId && !customerId.startsWith('cust_') ? customerId : (recipient ? `cust_${recipient}` : (customerId || 'cust_unknown')));
    const resolvedCustomerName = finalCustomerName || (recipient ? `Khách Hàng (${recipient})` : 'Khách Hàng');
    const resolvedCustomerPhone = isUserIdentifier ? recipient : (e164Phone || customerPhone || (cleanPhone ? `+${cleanPhone}` : ''));

    const setting = await getIntegrationSetting();
    const effectiveOverride = (overridePhoneId || senderPhoneId)?.trim();
    const phoneId = (effectiveOverride && !effectiveOverride.startsWith('phone_'))
      ? effectiveOverride
      : (await resolvePhoneNumberId(setting));
    const token = phoneId ? await getMetaAccessTokenForPhone(phoneId, setting) : '';

    let metaResult: any = null;
    let isRealSent = false;

    if (phoneId && token && recipient) {
      try {
        const effectiveContextId = contextMessageId || replyTo?.id;
        const dispatchRes = await dispatchMetaMessage({
          phoneId,
          token,
          cleanPhone: recipient,
          content,
          contextMessageId: effectiveContextId
        });
        isRealSent = dispatchRes.isRealSent;
        metaResult = dispatchRes.metaResult;
      } catch (graphErr) {
        log.error({ err: graphErr }, 'Error dispatching WhatsApp Graph API:');
      }
    }

    let initialStatus: 'sent' | 'failed' = 'sent';
    let initialErrorCode: string | null = null;
    let initialErrorMessage: string | null = null;
    let initialErrorDetails: string | null = null;

    if (!phoneId || !token || !recipient) {
      initialStatus = 'failed';
      initialErrorCode = 'CONFIG_MISSING';
      initialErrorMessage = !recipient ? 'Thiếu định danh người nhận' : 'Chưa cấu hình tài khoản Meta WhatsApp kết nối';
    } else if (!isRealSent) {
      initialStatus = 'failed';
      const metaError = metaResult?.error;
      initialErrorCode = metaError?.code ? String(metaError.code) : 'META_DISPATCH_FAILED';
      initialErrorMessage = getWhatsAppDeliveryErrorMessage(metaError);
      initialErrorDetails = getWhatsAppErrorDetails(metaError);
    }

    const authenticatedAgentName = req.user?.name?.trim();
    const newMsg = {
      id: metaResult?.messages?.[0]?.id || `msg_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      customerId: resolvedCustomerId,
      customerName: resolvedCustomerName,
      customerPhone: resolvedCustomerPhone,
      recipientId: recipient,
      businessPhoneNumberId: phoneId || undefined,
      sender: 'agent' as const,
      agentId: req.user?.id || null,
      agentName: authenticatedAgentName || agentName || 'Nhân viên',
      channel: 'WhatsApp',
      content,
      timestamp: new Date().toISOString(),
      isRead: true,
      isRealSent,
      status: initialStatus,
      errorCode: initialErrorCode,
      errorMessage: initialErrorMessage,
      errorDetails: initialErrorDetails,
      replyTo: replyTo || undefined
    };

    // Save to Database (Prisma)
    try {
      const createData: any = {
        id: newMsg.id,
        customerName: newMsg.customerName,
        customerPhone: newMsg.customerPhone,
        recipientId: newMsg.recipientId || null,
        businessPhoneNumberId: phoneId || null,
        sender: newMsg.sender,
        agentId: newMsg.agentId,
        agentName: newMsg.agentName,
        channel: newMsg.channel,
        content: newMsg.content,
        isRead: newMsg.isRead,
        isRealSent: newMsg.isRealSent,
        status: newMsg.status,
        errorCode: newMsg.errorCode,
        errorMessage: newMsg.errorMessage,
        errorDetails: newMsg.errorDetails,
        timestamp: new Date(newMsg.timestamp)
      };

      if (matchedCustomerId) {
        createData.customerId = matchedCustomerId;
      }

      if (matchedCustomerId && initialErrorCode === WHATSAPP_UNREACHABLE_ERROR_CODE) {
        await prisma.customer.update({
          where: { id: matchedCustomerId },
          data: {
            whatsappReachability: 'unreachable',
            whatsappUnreachableAt: new Date(newMsg.timestamp),
            whatsappUnreachableReason: WHATSAPP_UNREACHABLE_ERROR_CODE,
          },
        }).catch(() => {});
        realtimeHub.broadcast('customers:sync', {
          source: 'whatsapp-unreachable',
          customerId: matchedCustomerId,
        });
      }

      const savedOutDb = await prisma.whatsAppMessage.create({
        data: createData
      });
      log.debug({ messageId: savedOutDb.id, wabaId: phoneId }, 'Message saved');

      // Tự động đánh dấu tất cả các tin nhắn trước đó của khách trong thread này là đã phản hồi / đã đọc
      try {
        const readConditions: any[] = [];
        if (matchedCustomerId) {
          readConditions.push({ customerId: matchedCustomerId });
        }
        if (recipient) {
          readConditions.push({ recipientId: recipient });
        }
        if (cleanPhone && cleanPhone.length >= 7) {
          const lastDigits = cleanPhone.slice(-9);
          readConditions.push({ customerPhone: { contains: lastDigits } });
        }
        if (readConditions.length > 0) {
          await prisma.whatsAppMessage.updateMany({
            where: {
              OR: readConditions,
              sender: 'customer',
              isRead: false,
              ...(phoneId ? { businessPhoneNumberId: phoneId } : {}),
            },
            data: {
              isRead: true,
              readBy: authenticatedAgentName || agentName || 'Nhân viên',
              readAt: new Date(),
            },
          });
        }
      } catch (markReadErr) {
        log.warn({ err: markReadErr }, 'Failed to mark previous customer messages as read on agent send:');
      }

      if (matchedCustomerId && !matchedCustomerId.startsWith('cust_')) {
        const existingCust = await prisma.customer.findUnique({
          where: { id: matchedCustomerId },
          select: { status: true }
        }).catch(() => null);

        const updateData: any = { lastContact: new Date() };
        if (existingCust && existingCust.status === 'New Lead') {
          updateData.status = 'Contacted';
        }

        await prisma.customer.update({
          where: { id: matchedCustomerId },
          data: updateData
        }).catch(() => {});
        realtimeHub.broadcast('customers:sync', { source: 'chat-outgoing-activity', customerId: matchedCustomerId });
      }
    } catch (dbErr: any) {
      log.error({ err: dbErr }, '[DB SAVE ERROR] Failed to save outgoing message to DB:');
    }

    // Broadcast instant real-time event
    realtimeHub.broadcast('message:new', newMsg);
    realtimeHub.broadcast('message:read', {
      businessPhoneNumberId: phoneId,
      customerId: matchedCustomerId || resolvedCustomerId,
      customerPhone: resolvedCustomerPhone,
      readBy: authenticatedAgentName || agentName || 'Nhân viên',
      readAt: new Date().toISOString(),
    });

    // Khi nhân viên gửi tin nhắn từ CRM: Tự động tạm dừng AI trong 30 phút để nhân viên chăm sóc
    // Sau 30 phút nếu nhân viên không gửi thêm tin nhắn nào, AI sẽ tự động hoạt động trở lại
    if (resolvedCustomerPhone) {
      await pauseNativeAi(resolvedCustomerPhone, 30, phoneId).catch((error) => log.error({ err: error }, 'Cannot persist AI pause'));
      realtimeHub.broadcast('ai:status', { phone: resolvedCustomerPhone, isAiActive: false });
    }

    return res.json({
      success: true,
      isRealSent,
      status: initialStatus,
      errorCode: initialErrorCode,
      errorMessage: initialErrorMessage,
      errorDetails: initialErrorDetails,
      metaResponse: metaResult,
      message: newMsg
    });
  } catch (error: any) {
    log.error({ err: error }, 'Error sending WhatsApp message:');
    return res.status(500).json({ error: error.message || 'Lỗi khi gửi tin nhắn WhatsApp.' });
  }
}

/**
 * Send real WhatsApp Reaction
 */
export async function sendReaction(req: AuthenticatedRequest, res: Response) {
  try {
    const { messageId, emoji, customerPhone, customerId, phoneNumberId: overridePhoneId, senderPhoneId } = req.body;
    if (senderPhoneId === ALL_BUSINESS_PHONES || overridePhoneId === ALL_BUSINESS_PHONES) {
      return res.status(400).json({ error: 'Chọn số WhatsApp doanh nghiệp cụ thể để gửi cảm xúc.' });
    }

    if (!messageId || (!customerPhone && !customerId)) {
      return res.status(400).json({ error: 'Thiếu messageId hoặc số điện thoại người nhận' });
    }

    const rawRecipient = customerPhone
      || (customerId && /^(cust_|meta_)/.test(customerId)
        ? customerId.replace(/^(cust_|meta_)/, '')
        : (!String(customerId).includes('-') ? customerId : ''))
      || '';
    const recipient = resolveMetaRecipient(rawRecipient).recipient;

    const setting = await getIntegrationSetting();
    const effectiveOverride = (overridePhoneId || senderPhoneId)?.trim();
    const phoneId = (effectiveOverride && !effectiveOverride.startsWith('phone_'))
      ? effectiveOverride
      : (await resolvePhoneNumberId(setting));
    const token = phoneId ? await getMetaAccessTokenForPhone(phoneId, setting) : '';

    const target = await prisma.whatsAppMessage.findFirst({
      where: { id: messageId, businessPhoneNumberId: phoneId },
    });
    if (!target || !phoneId) {
      return res.status(404).json({ error: 'Không tìm thấy tin nhắn trong WABA đã chọn.' });
    }

    let isRealSent = false;
    let metaResult: any = null;

    if (phoneId && token && recipient && messageId) {
      try {
        const dispatchRes = await dispatchMetaReaction({
          phoneId,
          token,
          cleanPhone: recipient,
          messageId,
          emoji
        });
        isRealSent = dispatchRes.isRealSent;
        metaResult = dispatchRes.metaResult;
      } catch (metaErr) {
        log.error({ err: metaErr }, '[META REACTION DISPATCH ERROR]');
      }
    }

    // Keep the acknowledgement even if the emoji is later removed or replaced.
    // A failed dispatch or a customer reaction must never advance this watermark.
    const repliedAt = isRealSent && emoji ? new Date() : null;
    await prisma.$transaction(async (tx) => {
      await tx.whatsAppMessage.updateMany({
        where: { id: messageId, businessPhoneNumberId: phoneId },
        data: {
          reaction: emoji || null,
          ...(repliedAt ? { agentReactedAt: repliedAt } : {}),
        },
      });
      if (repliedAt) {
        await tx.whatsAppMessage.updateMany({
          where: {
            businessPhoneNumberId: phoneId,
            ...(target.customerId
              ? { customerId: target.customerId }
              : { customerPhone: target.customerPhone }),
            sender: 'customer',
            isRead: false,
            timestamp: { lte: repliedAt },
          },
          data: { isRead: true, readAt: repliedAt, readBy: req.user?.name || 'Nhân viên' },
        });
      }
    });

    realtimeHub.broadcast('message:reaction', {
      messageId,
      emoji: emoji || '',
      customerId: target.customerId,
      customerPhone: target.customerPhone,
      businessPhoneNumberId: phoneId,
      repliedAt: repliedAt?.toISOString() || null,
      isRealSent
    });

    log.info({ messageId, wabaId: phoneId, isRealSent, badgeCleared: Boolean(repliedAt) }, 'Reaction processed');

    return res.json({
      success: true,
      messageId,
      emoji: emoji || '',
      isRealSent,
      repliedAt: repliedAt?.toISOString() || null,
      metaResult
    });
  } catch (err: any) {
    log.error({ err: err }, '[REACTION ENDPOINT ERROR]');
    return res.status(500).json({ error: err.message || 'Lỗi gửi reaction' });
  }
}

/**
 * Clear all messages from DB
 */
export async function clearAllMessages(_req: Request, res: Response) {
  try {
    await prisma.whatsAppMessage.deleteMany();
  } catch (e) {}
  realtimeHub.broadcast('message:cleared', {});
  return res.json({ success: true, message: 'Đã xóa toàn bộ tin nhắn. Hệ thống sẵn sàng 100% cho tin nhắn thật từ Meta Webhook.' });
}

/**
 * Delete a specific conversation thread
 */
export async function deleteThread(req: Request, res: Response) {
  const customerId = getRouteParam(req.params.customerId);
  const { customerPhone, phoneNumberId } = req.query;
  if (phoneNumberId === ALL_BUSINESS_PHONES) {
    return res.status(400).json({ error: 'Chọn số WhatsApp doanh nghiệp cụ thể để xóa hội thoại.' });
  }
  const businessPhoneNumberId = typeof phoneNumberId === 'string' && /^\d+$/.test(phoneNumberId)
    ? phoneNumberId
    : '';
  const rawPhone = typeof customerPhone === 'string' ? customerPhone : customerId;
  const metaUserIdentifier = isMetaUserIdentifier(rawPhone) ? rawPhone : '';
  const cleanPhone = metaUserIdentifier ? '' : rawPhone.replace(/\D/g, '');
  const lastDigits = cleanPhone.length >= 7 ? cleanPhone.slice(-9) : cleanPhone;

  try {
    const deleteConditions: any[] = [{ customerId }];
    if (metaUserIdentifier) deleteConditions.push({ customerPhone: metaUserIdentifier });
    if (lastDigits) {
      deleteConditions.push({ customerPhone: { contains: lastDigits } });
      deleteConditions.push({ customerId: { contains: lastDigits } });
    }
    const result = await prisma.whatsAppMessage.deleteMany({
      where: {
        OR: deleteConditions,
        ...(businessPhoneNumberId ? { businessPhoneNumberId } : {}),
      }
    });
    log.info(`[DB DELETE THREAD SUCCESS] Deleted ${result.count} messages for customer ${customerId}`);
  } catch (e) {
    log.error({ err: e }, 'Error deleting thread from DB:');
  }

  realtimeHub.broadcast('message:thread_deleted', { customerId, customerPhone: metaUserIdentifier || cleanPhone, businessPhoneNumberId });

  return res.json({ success: true, message: `Đã xóa hội thoại của khách hàng ${customerId}` });
}

/**
 * Delete a single message by ID
 */
export async function deleteMessage(req: Request, res: Response) {
  const messageId = getRouteParam(req.params.messageId);

  try {
    await prisma.whatsAppMessage.deleteMany({
      where: { id: messageId }
    });
  } catch (e) {
    log.error({ err: e }, 'Error deleting message from DB:');
  }

  realtimeHub.broadcast('message:deleted', { messageId });

  return res.json({ success: true, message: `Đã xóa tin nhắn ${messageId}` });
}
