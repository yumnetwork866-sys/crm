import type { Request, Response } from 'express';
import type { AuthenticatedRequest } from '../../middleware/authMiddleware';
import { prisma } from '../../lib/prisma';
import { realtimeHub } from '../../services/realtimeHub';
import { isMetaUserIdentifier } from '../../utils/metaRecipient';

/**
 * Mark messages as read in DB with user attribution
 */
export async function markMessagesAsRead(req: Request, res: Response) {
  try {
    const { customerId, customerPhone, messageIds, readBy, phoneNumberId } = req.body;
    const businessPhoneNumberId = typeof phoneNumberId === 'string' && /^\d+$/.test(phoneNumberId)
      ? phoneNumberId
      : '';
    const rawPhone = customerPhone || (customerId && (customerId.startsWith('cust_') || customerId.startsWith('phone_')) ? customerId.replace(/^(cust_|phone_)/, '') : (!String(customerId).includes('-') && String(customerId).replace(/\D/g, '').length >= 7 ? customerId : '')) || '';
    const metaUserIdentifier = isMetaUserIdentifier(rawPhone) ? rawPhone : '';
    const cleanPhone = metaUserIdentifier ? '' : rawPhone.replace(/\D/g, '');
    let lastDigits = cleanPhone.length >= 7 ? cleanPhone.slice(-9) : cleanPhone;

    if (!lastDigits && customerId && !customerId.startsWith('cust_') && !customerId.startsWith('phone_')) {
      try {
        const dbCust = await prisma.customer.findUnique({
          where: { id: customerId },
          select: { phone: true }
        });
        if (dbCust?.phone) {
          const cPhone = dbCust.phone.replace(/\D/g, '');
          if (cPhone.length >= 7) {
            lastDigits = cPhone.slice(-9);
          }
        }
      } catch (lookupErr) {}
    }

    const nowIso = new Date().toISOString();
    const reader = readBy || 'Nhân viên';

    // Update DB
    try {
      const orConditions: any[] = [];
      if (messageIds && Array.isArray(messageIds) && messageIds.length > 0) {
        orConditions.push({ id: { in: messageIds } });
      }
      if (customerId) {
        orConditions.push({ customerId });
      }
      if (metaUserIdentifier) {
        orConditions.push({ customerPhone: metaUserIdentifier });
      }
      if (lastDigits) {
        orConditions.push({ customerPhone: { contains: lastDigits } });
        orConditions.push({ customerId: { contains: lastDigits } });
      }
      if (orConditions.length > 0) {
        await prisma.whatsAppMessage.updateMany({
          where: {
            OR: orConditions,
            isRead: false,
            ...(businessPhoneNumberId ? { businessPhoneNumberId } : {}),
          },
          data: { isRead: true, readBy: reader, readAt: new Date() }
        });
      }
    } catch (dbErr) {
      console.warn('DB mark read offline fallback:', dbErr);
    }

    realtimeHub.broadcast('message:read', {
      customerId,
      customerPhone,
      messageIds,
      readBy: reader,
      readAt: nowIso
    });

    return res.json({ success: true, message: 'Đã đánh dấu đã đọc', readBy: reader, readAt: nowIso });
  } catch (err: any) {
    console.error('Error in /messages/read:', err);
    return res.status(500).json({ error: err.message || 'Lỗi cập nhật trạng thái đã đọc' });
  }
}

/**
 * SSE Real-time Stream Endpoint (GET /api/realtime/stream or /api/meta/messages/stream)
 */
export function getRealtimeStream(req: Request, res: Response) {
  const clientId = `client_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  realtimeHub.addClient(clientId, res);

  req.on('close', () => {
    realtimeHub.removeClient(clientId);
  });
}

/** Broadcast a short-lived internal typing indicator to other CRM users. */
export function updateTypingStatus(req: AuthenticatedRequest, res: Response) {
  const threadId = typeof req.body?.threadId === 'string' ? req.body.threadId.trim() : '';
  const businessPhoneNumberId = typeof req.body?.businessPhoneNumberId === 'string'
    ? req.body.businessPhoneNumberId.trim()
    : '';
  const customerPhone = typeof req.body?.customerPhone === 'string' ? req.body.customerPhone.trim() : '';
  const sourceId = typeof req.body?.sourceId === 'string' ? req.body.sourceId.trim().slice(0, 100) : '';
  const isTyping = req.body?.isTyping === true;

  if (!threadId || !businessPhoneNumberId || !req.user) {
    return res.status(400).json({ error: 'Thiếu thông tin hội thoại.' });
  }

  realtimeHub.broadcast('message:typing', {
    threadId,
    customerPhone,
    businessPhoneNumberId,
    userId: req.user.id,
    userName: req.user.name,
    userEmail: req.user.email,
    userAvatar: req.user.avatar,
    sourceId,
    isTyping,
    expiresAt: new Date(Date.now() + 6_500).toISOString(),
  });

  return res.json({ success: true });
}
