import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import type { InMemoryMessage } from '../services/messageStore';
import { messageStore } from '../services/messageStore';
import { realtimeHub } from '../services/realtimeHub';
import {
  getIntegrationSetting,
  resolvePhoneNumberId,
  dispatchMetaMessage,
  dispatchMetaReaction,
  fetchAndCacheMetaMedia
} from '../services/metaApiClient';

/**
 * Fetch WhatsApp messages with Cursor-based pagination & thread filtering
 */
export async function getMessages(req: Request, res: Response) {
  try {
    const { cursor, limit: limitQuery, direction = 'before', customerId, customerPhone, paginate } = req.query;

    const isCursorPaginationRequested = cursor !== undefined || limitQuery !== undefined || paginate === 'true';
    const limit = Math.max(1, Math.min(100, parseInt(String(limitQuery || '30'), 10) || 30));

    const whereClause: any = {};

    // Filter by customer or phone if specified
    if (customerId && typeof customerId === 'string') {
      const cleanP = customerId.replace('cust_', '').replace(/\D/g, '');
      const lastDigits = cleanP.length >= 7 ? cleanP.slice(-9) : cleanP;
      whereClause.OR = [
        { customerId },
        ...(lastDigits ? [{ customerPhone: { contains: lastDigits } }] : [])
      ];
    } else if (customerPhone && typeof customerPhone === 'string') {
      const cleanP = customerPhone.replace(/\D/g, '');
      const lastDigits = cleanP.length >= 7 ? cleanP.slice(-9) : cleanP;
      whereClause.customerPhone = { contains: lastDigits || customerPhone };
    }

    if (isCursorPaginationRequested) {
      if (cursor && typeof cursor === 'string') {
        const cursorMsg = await prisma.whatsAppMessage.findUnique({
          where: { id: cursor },
          select: { id: true, timestamp: true }
        }).catch(() => null);

        if (cursorMsg) {
          // Use timestamp + id as a stable boundary so messages sharing the same
          // timestamp are not skipped between pages.
          whereClause.AND = [
            ...(whereClause.AND || []),
            direction === 'before'
              ? {
                  OR: [
                    { timestamp: { lt: cursorMsg.timestamp } },
                    { timestamp: cursorMsg.timestamp, id: { lt: cursorMsg.id } }
                  ]
                }
              : {
                  OR: [
                    { timestamp: { gt: cursorMsg.timestamp } },
                    { timestamp: cursorMsg.timestamp, id: { gt: cursorMsg.id } }
                  ]
                }
          ];
        }
      }

      let dbMsgs: any[] = [];
      try {
        dbMsgs = await prisma.whatsAppMessage.findMany({
          where: whereClause,
          take: limit + 1,
          orderBy: [
            { timestamp: direction === 'after' ? 'asc' : 'desc' },
            { id: direction === 'after' ? 'asc' : 'desc' }
          ]
        });
      } catch (e) {
        console.warn('DB query error in cursor-based messages:', e);
      }

      const hasMore = dbMsgs.length > limit;
      const slicedMsgs = hasMore ? dbMsgs.slice(0, limit) : dbMsgs;
      const nextCursor = slicedMsgs.length > 0 ? slicedMsgs[slicedMsgs.length - 1].id : null;

      const formattedMsgs = slicedMsgs.map((m: any) => {
        const cleanP = m.customerPhone ? m.customerPhone.replace(/\D/g, '') : '';
        return {
          ...m,
          customerId: m.customerId || (cleanP ? `cust_${cleanP}` : 'cust_unknown'),
          timestamp: typeof m.timestamp === 'object' ? m.timestamp.toISOString() : m.timestamp
        };
      }).sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      return res.json({
        messages: formattedMsgs,
        nextCursor,
        hasMore,
        limit,
        direction
      });
    }

    // Default full-fetch fallback (DB + Memory combined)
    let dbMsgs: any[] = [];
    try {
      dbMsgs = await prisma.whatsAppMessage.findMany({
        where: whereClause,
        orderBy: { timestamp: 'asc' }
      });
    } catch (e) {
      // DB offline fallback
    }

    const map = new Map<string, any>();
    for (const m of dbMsgs) {
      const cleanP = m.customerPhone ? m.customerPhone.replace(/\D/g, '') : '';
      map.set(m.id, {
        ...m,
        customerId: m.customerId || (cleanP ? `cust_${cleanP}` : 'cust_unknown'),
        timestamp: typeof m.timestamp === 'object' ? m.timestamp.toISOString() : m.timestamp
      });
    }
    for (const m of messageStore.getAll()) {
      if (!map.has(m.id)) {
        map.set(m.id, m);
      }
    }

    const combined = Array.from(map.values()).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    return res.json(combined);
  } catch (error) {
    console.error('Lỗi khi lấy tin nhắn:', error);
    return res.status(500).json({ error: 'Không thể tải tin nhắn' });
  }
}

/**
 * Mark messages as read in DB & in-memory store with user attribution
 */
export async function markMessagesAsRead(req: Request, res: Response) {
  try {
    const { customerId, customerPhone, messageIds, readBy } = req.body;
    const rawPhone = customerPhone || (customerId && customerId.startsWith('cust_') ? customerId.replace('cust_', '') : (String(customerId).replace(/\D/g, '').length >= 7 ? customerId : '')) || '';
    const cleanPhone = rawPhone.replace(/\D/g, '');
    let lastDigits = cleanPhone.length >= 7 ? cleanPhone.slice(-9) : cleanPhone;

    if (!lastDigits && customerId && !customerId.startsWith('cust_')) {
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

    // 1. Update in-memory messages
    messageStore.update((msgs) =>
      msgs.map((m) => {
        const mPhone = (m.customerPhone || '').replace(/\D/g, '');
        const isMatch = (messageIds && Array.isArray(messageIds) && messageIds.includes(m.id)) ||
          (customerId && m.customerId === customerId) ||
          (lastDigits && mPhone.endsWith(lastDigits));
        return isMatch
          ? {
              ...m,
              isRead: true,
              readBy: m.readBy || reader,
              readAt: m.readAt || nowIso
            }
          : m;
      })
    );

    // 2. Update DB
    try {
      if (messageIds && Array.isArray(messageIds) && messageIds.length > 0) {
        await prisma.whatsAppMessage.updateMany({
          where: { id: { in: messageIds } },
          data: { isRead: true, readBy: reader, readAt: new Date() }
        });
      } else if (customerId || lastDigits) {
        const orConditions: any[] = [];
        if (customerId) {
          orConditions.push({ customerId });
        }
        if (lastDigits) {
          orConditions.push({ customerPhone: { contains: lastDigits } });
          orConditions.push({ customerId: { contains: lastDigits } });
        }
        if (orConditions.length > 0) {
          await prisma.whatsAppMessage.updateMany({
            where: { OR: orConditions },
            data: { isRead: true, readBy: reader, readAt: new Date() }
          });
        }
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
 * Send real WhatsApp Cloud API message and save to CRM
 */
export async function sendMessage(req: Request, res: Response) {
  try {
    const { customerPhone, content, agentName, customerId, customerName, phoneNumberId: overridePhoneId, senderPhoneId, contextMessageId, replyTo } = req.body;

    if (!content || (!customerPhone && !customerId)) {
      return res.status(400).json({ error: 'Vui lòng cung cấp số điện thoại người nhận và nội dung tin nhắn.' });
    }

    const rawPhone = customerPhone || (customerId && customerId.startsWith('cust_') ? customerId.replace('cust_', '') : (String(customerId).replace(/\D/g, '').length >= 7 ? customerId : '')) || '';
    let cleanPhone = rawPhone.replace(/\D/g, '');
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '84' + cleanPhone.substring(1);
    }

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
      if (!matchedCustomerId && cleanPhone.length >= 7) {
        const lastDigits = cleanPhone.slice(-9);
        const found = await prisma.customer.findFirst({
          where: {
            phone: { contains: lastDigits }
          },
          select: { id: true, name: true, phone: true }
        });
        if (found) {
          matchedCustomerId = found.id;
          if (!finalCustomerName) finalCustomerName = found.name;
        }
      }
    } catch (e) {}

    const resolvedCustomerId = matchedCustomerId || (customerId && !customerId.startsWith('cust_') ? customerId : (cleanPhone ? `cust_${cleanPhone}` : (customerId || 'cust_unknown')));
    const resolvedCustomerName = finalCustomerName || (cleanPhone ? `Khách Hàng (${cleanPhone})` : 'Khách Hàng');
    const resolvedCustomerPhone = customerPhone || (cleanPhone ? `+${cleanPhone}` : '');

    const setting = await getIntegrationSetting();
    const effectiveOverride = (overridePhoneId || senderPhoneId)?.trim();
    const phoneId = (effectiveOverride && !effectiveOverride.startsWith('phone_'))
      ? effectiveOverride
      : (await resolvePhoneNumberId(setting));
    const token = process.env.WHATSAPP_ACCESS_TOKEN?.trim() || '';

    let metaResult: any = null;
    let isRealSent = false;

    if (phoneId && token && cleanPhone) {
      try {
        const effectiveContextId = contextMessageId || replyTo?.id;
        const dispatchRes = await dispatchMetaMessage({
          phoneId,
          token,
          cleanPhone,
          content,
          contextMessageId: effectiveContextId
        });
        isRealSent = dispatchRes.isRealSent;
        metaResult = dispatchRes.metaResult;
      } catch (graphErr) {
        console.error('Error dispatching WhatsApp Graph API:', graphErr);
      }
    }

    const newMsg: InMemoryMessage = {
      id: metaResult?.messages?.[0]?.id || `msg_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      customerId: resolvedCustomerId,
      customerName: resolvedCustomerName,
      customerPhone: resolvedCustomerPhone,
      sender: 'agent',
      agentName: agentName || 'Nguyễn Văn Ánh',
      channel: 'WhatsApp',
      content,
      timestamp: new Date().toISOString(),
      isRead: true,
      isRealSent,
      replyTo: replyTo || undefined
    };

    messageStore.add(newMsg);

    // Save to Database (Prisma)
    try {
      const createData: any = {
        id: newMsg.id,
        customerName: newMsg.customerName,
        customerPhone: newMsg.customerPhone,
        sender: newMsg.sender,
        agentName: newMsg.agentName,
        channel: newMsg.channel,
        content: newMsg.content,
        isRead: newMsg.isRead,
        isRealSent: newMsg.isRealSent,
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
        await prisma.customer.update({
          where: { id: matchedCustomerId },
          data: { lastContact: new Date() }
        }).catch(() => {});
      }
    } catch (dbErr: any) {
      console.error('[DB SAVE ERROR] Failed to save outgoing message to DB:', dbErr.message || dbErr);
    }

    // Broadcast instant real-time event
    realtimeHub.broadcast('message:new', newMsg);

    return res.json({
      success: true,
      isRealSent,
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
    const token = process.env.WHATSAPP_ACCESS_TOKEN?.trim() || '';

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
 * Clear all messages from DB and in-memory store
 */
export async function clearAllMessages(req: Request, res: Response) {
  messageStore.clear();
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
  const { customerId } = req.params;
  const { customerPhone } = req.query;
  const rawPhone = typeof customerPhone === 'string' ? customerPhone : customerId;
  const cleanPhone = rawPhone.replace(/\D/g, '');
  const lastDigits = cleanPhone.length >= 7 ? cleanPhone.slice(-9) : cleanPhone;

  messageStore.filter((m) => {
    const msgCleanPhone = m.customerPhone ? m.customerPhone.replace(/\D/g, '') : '';
    const matchId = m.customerId === customerId;
    const matchPhone = lastDigits && msgCleanPhone && msgCleanPhone.includes(lastDigits);
    return !matchId && !matchPhone;
  });

  try {
    const deleteConditions: any[] = [{ customerId }];
    if (lastDigits) {
      deleteConditions.push({ customerPhone: { contains: lastDigits } });
      deleteConditions.push({ customerId: { contains: lastDigits } });
    }
    const result = await prisma.whatsAppMessage.deleteMany({
      where: {
        OR: deleteConditions
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
  const { messageId } = req.params;
  messageStore.filter((m) => m.id !== messageId);

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

/**
 * Proxy Meta Media (Images, Audio, Documents) with local disk caching
 */
export async function getMediaProxy(req: Request, res: Response) {
  const { mediaId } = req.params;
  try {
    const media = await fetchAndCacheMetaMedia(mediaId);
    if (!media) {
      return res.status(404).json({ error: 'Media not found on Meta CDN' });
    }

    res.setHeader('Content-Type', media.contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.send(media.buffer);
  } catch (err: any) {
    console.error('[META MEDIA PROXY ERROR]', err);
    return res.status(500).json({ error: err.message || 'Media proxy failed' });
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
