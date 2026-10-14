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
import { pauseAiForCustomer } from '../../services/difyService';
import { resolveWhatsAppBrandName } from '../../services/webhookService';
import { getPhoneLookupVariants, normalizePhoneE164, toWhatsAppDigits } from '../../utils/phone';
import { isMetaUserIdentifier, normalizeMetaRecipient } from '../../utils/metaRecipient';

/**
 * Send real WhatsApp Cloud API message and save to CRM
 */
export async function sendMessage(req: AuthenticatedRequest, res: Response) {
  try {
    const { customerPhone, content, agentName, customerId, customerName, phoneNumberId: overridePhoneId, senderPhoneId, contextMessageId, replyTo } = req.body;

    if (!content || (!customerPhone && !customerId)) {
      return res.status(400).json({ error: 'Vui lòng cung cấp số điện thoại người nhận và nội dung tin nhắn.' });
    }

    const rawPhone = customerPhone
      || (customerId && /^(cust_|meta_)/.test(customerId)
        ? customerId.replace(/^(cust_|meta_)/, '')
        : (String(customerId).replace(/\D/g, '').length >= 7 ? customerId : ''))
      || '';
    const isUserIdentifier = isMetaUserIdentifier(rawPhone);
    const e164Phone = isUserIdentifier ? '' : normalizePhoneE164(rawPhone);
    const cleanPhone = isUserIdentifier ? '' : toWhatsAppDigits(rawPhone);
    const recipient = normalizeMetaRecipient(rawPhone);

    let matchedCustomerId: string | null = null;
    let finalCustomerName = customerName;

    try {
      if (customerId && !customerId.startsWith('cust_')) {
        const found = await prisma.customer.findUnique({
          where: { id: customerId },
          select: { id: true, name: true, phone: true }
        });
        if (found) {
          matchedCustomerId = found.id;
          if (!finalCustomerName) finalCustomerName = found.name;
        }
      }
      if (!matchedCustomerId && (isUserIdentifier || cleanPhone.length >= 7)) {
        const variants = isUserIdentifier ? [] : getPhoneLookupVariants(rawPhone);
        const found = isUserIdentifier
          ? await prisma.customer.findFirst({
              where: { phone: rawPhone },
              select: { id: true, name: true, phone: true }
            })
          : variants.length > 0
          ? await prisma.customer.findFirst({
              where: {
                phone: { in: variants }
              },
              select: { id: true, name: true, phone: true }
            })
          : null;
        if (found) {
          matchedCustomerId = found.id;
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
              phone: isUserIdentifier ? rawPhone : e164Phone,
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
        console.error('Error dispatching WhatsApp Graph API:', graphErr);
      }
    }

    let initialStatus: 'sent' | 'failed' = 'sent';
    let initialErrorCode: string | null = null;
    let initialErrorMessage: string | null = null;

    if (!phoneId || !token || !recipient) {
      initialStatus = 'failed';
      initialErrorCode = 'CONFIG_MISSING';
      initialErrorMessage = !recipient ? 'Thiếu định danh người nhận' : 'Chưa cấu hình tài khoản Meta WhatsApp kết nối';
    } else if (!isRealSent) {
      initialStatus = 'failed';
      const metaError = metaResult?.error;
      initialErrorCode = metaError?.code ? String(metaError.code) : 'META_DISPATCH_FAILED';
      if (metaError?.code === 131047 || metaError?.error_subcode === 131047) {
        initialErrorMessage = 'Quá 24 giờ kể từ tin nhắn cuối của khách. Hãy dùng tin nhắn mẫu (template).';
      } else if (metaError?.code === 131026) {
        initialErrorMessage = 'Không thể gửi đến số này (Số chưa kích hoạt WhatsApp hoặc đã chặn).';
      } else if (metaError?.code === 190) {
        initialErrorMessage = 'Access Token của Meta đã hết hạn hoặc bị hủy quyền.';
      } else {
        initialErrorMessage = metaError?.message || metaError?.error_user_msg || 'Meta từ chối gửi tin nhắn.';
      }
    }

    const authenticatedAgentName = req.user?.name?.trim();
    const newMsg = {
      id: metaResult?.messages?.[0]?.id || `msg_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      customerId: resolvedCustomerId,
      customerName: resolvedCustomerName,
      customerPhone: resolvedCustomerPhone,
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
      replyTo: replyTo || undefined
    };

    // Save to Database (Prisma)
    try {
      const createData: any = {
        id: newMsg.id,
        customerName: newMsg.customerName,
        customerPhone: newMsg.customerPhone,
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
        timestamp: new Date(newMsg.timestamp)
      };

      if (matchedCustomerId) {
        createData.customerId = matchedCustomerId;
      }

      const savedOutDb = await prisma.whatsAppMessage.create({
        data: createData
      });
      console.log(`[DB SAVE SUCCESS] Saved OUTGOING message ${savedOutDb.id} to PostgreSQL Database!`);

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
      console.error('[DB SAVE ERROR] Failed to save outgoing message to DB:', dbErr.message || dbErr);
    }

    // Broadcast instant real-time event
    realtimeHub.broadcast('message:new', newMsg);

    // Khi nhân viên gửi tin nhắn từ CRM: Tự động tạm dừng AI trong 30 phút để nhân viên chăm sóc
    // Sau 30 phút nếu nhân viên không gửi thêm tin nhắn nào, AI sẽ tự động hoạt động trở lại
    if (resolvedCustomerPhone) {
      pauseAiForCustomer(resolvedCustomerPhone, 30);
      realtimeHub.broadcast('ai:status', { phone: resolvedCustomerPhone, isAiActive: false });
    }

    return res.json({
      success: true,
      isRealSent,
      status: initialStatus,
      errorCode: initialErrorCode,
      errorMessage: initialErrorMessage,
      metaResponse: metaResult,
      message: newMsg
    });
  } catch (error: any) {
    console.error('Error sending WhatsApp message:', error);
    return res.status(500).json({ error: error.message || 'Lỗi khi gửi tin nhắn WhatsApp.' });
  }
}

/**
 * Send real WhatsApp Reaction
 */
export async function sendReaction(req: Request, res: Response) {
  try {
    const { messageId, emoji, customerPhone, customerId, phoneNumberId: overridePhoneId, senderPhoneId } = req.body;

    if (!messageId || (!customerPhone && !customerId)) {
      return res.status(400).json({ error: 'Thiếu messageId hoặc số điện thoại người nhận' });
    }

    const rawPhone = customerPhone || (customerId && customerId.startsWith('cust_') ? customerId.replace('cust_', '') : (String(customerId).replace(/\D/g, '').length >= 7 ? customerId : '')) || '';
    let cleanPhone = rawPhone.replace(/\D/g, '');
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '84' + cleanPhone.substring(1);
    }

    const setting = await getIntegrationSetting();
    const effectiveOverride = (overridePhoneId || senderPhoneId)?.trim();
    const phoneId = (effectiveOverride && !effectiveOverride.startsWith('phone_'))
      ? effectiveOverride
      : (await resolvePhoneNumberId(setting));
    const token = phoneId ? await getMetaAccessTokenForPhone(phoneId, setting) : '';

    let isRealSent = false;
    let metaResult: any = null;

    if (phoneId && token && cleanPhone && messageId) {
      try {
        const dispatchRes = await dispatchMetaReaction({
          phoneId,
          token,
          cleanPhone,
          messageId,
          emoji
        });
        isRealSent = dispatchRes.isRealSent;
        metaResult = dispatchRes.metaResult;
      } catch (metaErr) {
        console.error('[META REACTION DISPATCH ERROR]', metaErr);
      }
    }

    realtimeHub.broadcast('message:reaction', {
      messageId,
      emoji: emoji || '',
      customerId,
      customerPhone: cleanPhone,
      isRealSent
    });

    return res.json({
      success: true,
      messageId,
      emoji: emoji || '',
      isRealSent,
      metaResult
    });
  } catch (err: any) {
    console.error('[REACTION ENDPOINT ERROR]', err);
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
  const businessPhoneNumberId = typeof phoneNumberId === 'string' && /^\d+$/.test(phoneNumberId)
    ? phoneNumberId
    : '';
  const rawPhone = typeof customerPhone === 'string' ? customerPhone : customerId;
  const cleanPhone = rawPhone.replace(/\D/g, '');
  const lastDigits = cleanPhone.length >= 7 ? cleanPhone.slice(-9) : cleanPhone;

  try {
    const deleteConditions: any[] = [{ customerId }];
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
    console.log(`[DB DELETE THREAD SUCCESS] Deleted ${result.count} messages for customer ${customerId}`);
  } catch (e) {
    console.error('Error deleting thread from DB:', e);
  }

  realtimeHub.broadcast('message:thread_deleted', { customerId, customerPhone: cleanPhone });

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
    console.error('Error deleting message from DB:', e);
  }

  realtimeHub.broadcast('message:deleted', { messageId });

  return res.json({ success: true, message: `Đã xóa tin nhắn ${messageId}` });
}
