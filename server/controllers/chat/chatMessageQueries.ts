import type { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { getRouteParam } from '../../utils/requestParams';
import {
  getIntegrationSetting,
  resolvePhoneNumberId,
  fetchAndCacheMetaMedia
} from '../../services/metaApiClient';
import { fetchLinkPreview } from '../../services/linkPreviewService';
import { isMetaUserIdentifier } from '../../utils/metaRecipient';

/**
 * Fetch WhatsApp messages with Cursor-based pagination & thread filtering
 */
export async function getMessages(req: Request, res: Response) {
  try {
    const { cursor, limit: limitQuery, direction = 'before', customerId, customerPhone, phoneNumberId, paginate } = req.query;

    const isCursorPaginationRequested = cursor !== undefined || limitQuery !== undefined || paginate === 'true';
    const limit = Math.max(1, Math.min(100, parseInt(String(limitQuery || '30'), 10) || 30));

    const whereClause: any = {};
    const integrationSetting = await getIntegrationSetting();
    const requestedBusinessPhoneId = typeof phoneNumberId === 'string' && /^\d+$/.test(phoneNumberId)
      ? phoneNumberId
      : '';
    const activeBusinessPhoneId = requestedBusinessPhoneId || await resolvePhoneNumberId(integrationSetting);
    if (activeBusinessPhoneId) {
      whereClause.businessPhoneNumberId = activeBusinessPhoneId;
    }

    // Filter by customer or phone if specified
    const rawCustomerId = (typeof req.params?.customerId === 'string' && req.params.customerId)
      ? req.params.customerId.trim()
      : (typeof customerId === 'string' ? customerId.trim() : '');
    const rawCustomerPhone = typeof customerPhone === 'string' ? customerPhone.trim() : '';

    if (rawCustomerId || rawCustomerPhone) {
      let cleanP = '';
      const metaUserIdentifier = isMetaUserIdentifier(rawCustomerPhone)
        ? rawCustomerPhone
        : (rawCustomerId.startsWith('cust_') || rawCustomerId.startsWith('meta_'))
          && isMetaUserIdentifier(rawCustomerId.replace(/^(cust_|meta_)/, ''))
          ? rawCustomerId.replace(/^(cust_|meta_)/, '')
          : '';
      if (rawCustomerPhone && !metaUserIdentifier) {
        cleanP = rawCustomerPhone.replace(/\D/g, '');
      } else if (!metaUserIdentifier && (rawCustomerId.startsWith('cust_') || rawCustomerId.startsWith('phone_'))) {
        cleanP = rawCustomerId.replace(/^(cust_|phone_)/, '').replace(/\D/g, '');
      } else if (!rawCustomerId.includes('-') && rawCustomerId.replace(/\D/g, '').length >= 7) {
        cleanP = rawCustomerId.replace(/\D/g, '');
      } else if (rawCustomerId) {
        try {
          const dbCust = await prisma.customer.findUnique({
            where: { id: rawCustomerId },
            select: { phone: true },
          });
          if (dbCust?.phone) {
            cleanP = dbCust.phone.replace(/\D/g, '');
          }
        } catch {
          // Ignore customer lookup errors and fall back to customerId matching
        }
      }

      const lastDigits = cleanP.length >= 7 ? cleanP.slice(-9) : cleanP;
      const customerOrConditions: any[] = [];
      if (rawCustomerId) {
        customerOrConditions.push({ customerId: rawCustomerId });
      }
      if (metaUserIdentifier) {
        customerOrConditions.push({ customerPhone: metaUserIdentifier });
      }
      if (lastDigits) {
        customerOrConditions.push({ customerPhone: { contains: lastDigits } });
        customerOrConditions.push({ customerId: { contains: lastDigits } });
      } else if (rawCustomerPhone) {
        customerOrConditions.push({ customerPhone: { contains: rawCustomerPhone } });
      }

      if (customerOrConditions.length > 0) {
        whereClause.AND = [
          ...(whereClause.AND || []),
          { OR: customerOrConditions },
        ];
      }
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
        const metaUserIdentifier = isMetaUserIdentifier(m.customerPhone) ? m.customerPhone : '';
        const cleanP = !metaUserIdentifier && m.customerPhone ? m.customerPhone.replace(/\D/g, '') : '';
        return {
          ...m,
          customerId: m.customerId || (metaUserIdentifier ? `meta_${metaUserIdentifier}` : (cleanP ? `cust_${cleanP}` : 'cust_unknown')),
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

    const dbMsgs = await prisma.whatsAppMessage.findMany({
      where: whereClause,
      orderBy: { timestamp: 'asc' }
    });

    const formatted = dbMsgs.map((m) => {
      const metaUserIdentifier = isMetaUserIdentifier(m.customerPhone) ? m.customerPhone : '';
      const cleanP = !metaUserIdentifier && m.customerPhone ? m.customerPhone.replace(/\D/g, '') : '';
      return {
        ...m,
        customerId: m.customerId || (metaUserIdentifier ? `meta_${metaUserIdentifier}` : (cleanP ? `cust_${cleanP}` : 'cust_unknown')),
        timestamp: typeof m.timestamp === 'object' ? m.timestamp.toISOString() : m.timestamp
      };
    });

    return res.json(formatted);
  } catch (error) {
    console.error('Lỗi khi lấy tin nhắn:', error);
    return res.status(500).json({ error: 'Không thể tải tin nhắn' });
  }
}

/**
 * Proxy Meta Media (Images, Audio, Documents) with local disk caching
 */
export async function getMediaProxy(req: Request, res: Response) {
  const mediaId = getRouteParam(req.params.mediaId);
  const phoneId = typeof req.query.phoneId === 'string' ? req.query.phoneId.trim() : undefined;
  try {
    const media = await fetchAndCacheMetaMedia(mediaId, phoneId);
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
 * GET /api/meta/conversations
 * Aggregated conversation threads with unread count and latest message
 */
export async function getConversations(req: Request, res: Response) {
  try {
    const { search, phoneNumberId, limit: limitQuery, page: pageQuery } = req.query;
    const page = Math.max(1, parseInt(String(pageQuery || '1'), 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(String(limitQuery || '50'), 10) || 50));
    const skip = (page - 1) * limit;

    const searchFilter = search && typeof search === 'string' && search.trim() ? search.trim() : null;
    const integrationSetting = await getIntegrationSetting();
    const requestedBusinessPhoneId = typeof phoneNumberId === 'string' && /^\d+$/.test(phoneNumberId)
      ? phoneNumberId
      : '';
    const activeBusinessPhoneId = requestedBusinessPhoneId || await resolvePhoneNumberId(integrationSetting);
    const filterSql = activeBusinessPhoneId
      ? searchFilter
        ? Prisma.sql`WHERE "businessPhoneNumberId" = ${activeBusinessPhoneId} AND ("customerName" ILIKE ${'%' + searchFilter + '%'} OR "customerPhone" LIKE ${'%' + searchFilter + '%'} OR "recipientId" ILIKE ${'%' + searchFilter + '%'} OR "content" ILIKE ${'%' + searchFilter + '%'})`
        : Prisma.sql`WHERE "businessPhoneNumberId" = ${activeBusinessPhoneId}`
      : searchFilter
        ? Prisma.sql`WHERE ("customerName" ILIKE ${'%' + searchFilter + '%'} OR "customerPhone" LIKE ${'%' + searchFilter + '%'} OR "recipientId" ILIKE ${'%' + searchFilter + '%'} OR "content" ILIKE ${'%' + searchFilter + '%'})`
        : Prisma.empty;
    const unreadFilterSql = activeBusinessPhoneId
      ? Prisma.sql`WHERE "businessPhoneNumberId" = ${activeBusinessPhoneId}`
      : Prisma.empty;

    const rawThreads: Array<{
      customerId: string | null;
      customerName: string;
      customerPhone: string;
      recipientId: string | null;
      businessPhoneNumberId: string | null;
      unreadCount: bigint;
      lastCustomerMessageAt: Date | null;
      lastMsgId: string;
      lastMsgContent: string;
      lastMsgSender: string;
      lastMsgAgentId: string | null;
      lastMsgAgentName: string | null;
      lastMsgIsAi: boolean | null;
      lastMsgTimestamp: Date;
      lastMsgChannel: string;
      lastMsgIsRead: boolean;
      lastMsgReadBy: string | null;
      lastMsgReadAt: Date | null;
      lastMsgDeliveredAt: Date | null;
      lastMsgIsRealSent: boolean | null;
      lastMsgStatus: string | null;
      lastMsgErrorCode: string | null;
      lastMsgErrorMessage: string | null;
      lastMsgErrorDetails: string | null;
    }> = await prisma.$queryRaw`
      WITH RankedMessages AS (
        SELECT 
          "id",
          "customerId",
          "customerName",
          "customerPhone",
          "recipientId",
          "businessPhoneNumberId",
          "content",
          "sender",
          "agentId",
          "agentName",
          "isAi",
          "timestamp",
          "channel",
          "isRead",
          "readBy",
          "readAt",
          "deliveredAt",
          "isRealSent",
          "status",
          "errorCode",
          "errorMessage",
          "errorDetails",
          COALESCE(
            NULLIF(LOWER(CASE WHEN "recipientId" ILIKE 'MY.%' OR "recipientId" LIKE '@%' THEN "recipientId" END), ''),
            NULLIF(RIGHT(REGEXP_REPLACE(COALESCE("customerPhone", ''), '\D', '', 'g'), 9), ''),
            NULLIF("customerId", ''),
            "id"
          ) as thread_key,
          ROW_NUMBER() OVER (
            PARTITION BY COALESCE(
              NULLIF(LOWER(CASE WHEN "recipientId" ILIKE 'MY.%' OR "recipientId" LIKE '@%' THEN "recipientId" END), ''),
              NULLIF(RIGHT(REGEXP_REPLACE(COALESCE("customerPhone", ''), '\D', '', 'g'), 9), ''),
              NULLIF("customerId", ''),
              "id"
            )
            ORDER BY "timestamp" DESC, "id" DESC
          ) as rn
        FROM "WhatsAppMessage"
        ${filterSql}
      ),
      ReplyStats AS (
        SELECT 
          COALESCE(
            NULLIF(LOWER(CASE WHEN "recipientId" ILIKE 'MY.%' OR "recipientId" LIKE '@%' THEN "recipientId" END), ''),
            NULLIF(RIGHT(REGEXP_REPLACE(COALESCE("customerPhone", ''), '\D', '', 'g'), 9), ''),
            NULLIF("customerId", ''),
            "id"
          ) as thread_key,
          "customerId",
          "sender",
          "timestamp",
          MAX("timestamp") FILTER (
            WHERE "sender" = 'agent' AND COALESCE("status", 'sent') <> 'failed'
          ) OVER (
            PARTITION BY COALESCE(
              NULLIF(LOWER(CASE WHEN "recipientId" ILIKE 'MY.%' OR "recipientId" LIKE '@%' THEN "recipientId" END), ''),
              NULLIF(RIGHT(REGEXP_REPLACE(COALESCE("customerPhone", ''), '\D', '', 'g'), 9), ''),
              NULLIF("customerId", ''),
              "id"
            )
          ) as last_agent_reply_at
        FROM "WhatsAppMessage"
        ${unreadFilterSql}
      ),
      UnreadStats AS (
        SELECT
          thread_key,
          MAX("customerId") as customer_id,
          COUNT(*) FILTER (
            WHERE "sender" = 'customer'
              AND (last_agent_reply_at IS NULL OR "timestamp" > last_agent_reply_at)
          ) as unread_count,
          MAX("timestamp") FILTER (WHERE "sender" = 'customer') as last_customer_msg_at
        FROM ReplyStats
        GROUP BY thread_key
      )
      SELECT 
        COALESCE(rm."customerId", us.customer_id) as "customerId",
        rm."customerName",
        rm."customerPhone",
        rm."recipientId",
        rm."businessPhoneNumberId",
        COALESCE(us.unread_count, 0) as "unreadCount",
        us.last_customer_msg_at as "lastCustomerMessageAt",
        rm."id" as "lastMsgId",
        rm."content" as "lastMsgContent",
        rm."sender" as "lastMsgSender",
        rm."agentId" as "lastMsgAgentId",
        rm."agentName" as "lastMsgAgentName",
        rm."isAi" as "lastMsgIsAi",
        rm."timestamp" as "lastMsgTimestamp",
        rm."channel" as "lastMsgChannel",
        rm."isRead" as "lastMsgIsRead",
        rm."readBy" as "lastMsgReadBy",
        rm."readAt" as "lastMsgReadAt",
        rm."deliveredAt" as "lastMsgDeliveredAt",
        rm."isRealSent" as "lastMsgIsRealSent",
        rm."status" as "lastMsgStatus",
        rm."errorCode" as "lastMsgErrorCode",
        rm."errorMessage" as "lastMsgErrorMessage",
        rm."errorDetails" as "lastMsgErrorDetails"
      FROM RankedMessages rm
      LEFT JOIN UnreadStats us ON us.thread_key = rm.thread_key
      WHERE rm.rn = 1
      ORDER BY rm."timestamp" DESC
      LIMIT ${limit} OFFSET ${skip}
    `;

    const conversations = rawThreads.map((t) => {
      const metaUserIdentifier = isMetaUserIdentifier(t.customerPhone) ? t.customerPhone : '';
      const cleanP = !metaUserIdentifier && t.customerPhone ? t.customerPhone.replace(/\D/g, '') : '';
      const resolvedCustomerId = t.customerId || (metaUserIdentifier ? `meta_${metaUserIdentifier}` : (cleanP ? `cust_${cleanP}` : `phone_${t.customerPhone}`));
      const timestampIso = t.lastMsgTimestamp instanceof Date
        ? t.lastMsgTimestamp.toISOString()
        : String(t.lastMsgTimestamp);
      return {
        customerId: resolvedCustomerId,
        customerName: t.customerName,
        customerPhone: t.customerPhone,
        recipientId: t.recipientId || undefined,
        unreadCount: Number(t.unreadCount),
        lastCustomerMessageAt: t.lastCustomerMessageAt instanceof Date
          ? t.lastCustomerMessageAt.toISOString()
          : (t.lastCustomerMessageAt || null),
        lastMessage: {
          id: t.lastMsgId,
          customerId: resolvedCustomerId,
          customerName: t.customerName,
          customerPhone: t.customerPhone,
          recipientId: t.recipientId || undefined,
          businessPhoneNumberId: t.businessPhoneNumberId || activeBusinessPhoneId || undefined,
          content: t.lastMsgContent,
          sender: (t.lastMsgSender === 'agent' ? 'agent' : 'customer') as 'customer' | 'agent',
          agentId: t.lastMsgAgentId || undefined,
          agentName: t.lastMsgAgentName || undefined,
          isAi: Boolean(t.lastMsgIsAi),
          timestamp: timestampIso,
          channel: t.lastMsgChannel || 'WhatsApp',
          isRead: Boolean(t.lastMsgIsRead),
          readBy: t.lastMsgReadBy || undefined,
          readAt: t.lastMsgReadAt instanceof Date ? t.lastMsgReadAt.toISOString() : (t.lastMsgReadAt || undefined),
          deliveredAt: t.lastMsgDeliveredAt instanceof Date ? t.lastMsgDeliveredAt.toISOString() : (t.lastMsgDeliveredAt || undefined),
          isRealSent: t.lastMsgIsRealSent !== null && t.lastMsgIsRealSent !== undefined ? Boolean(t.lastMsgIsRealSent) : true,
          status: (t.lastMsgStatus as 'sending' | 'sent' | 'delivered' | 'read' | 'failed') || 'sent',
          errorCode: t.lastMsgErrorCode || null,
          errorMessage: t.lastMsgErrorMessage || null,
          errorDetails: t.lastMsgErrorDetails || null,
        }
      };
    });

    return res.json({
      data: conversations,
      page,
      limit,
      count: conversations.length,
    });
  } catch (error) {
    console.error('[CHAT CONTROLLER] getConversations error:', error);
    return res.status(500).json({ error: 'Không thể tải danh sách cuộc hội thoại.' });
  }
}

/**
 * GET /api/meta/messages/unread-summary
 * Global unread totals grouped by the receiving WhatsApp business number.
 */
export async function getUnreadMessageSummary(_req: Request, res: Response) {
  try {
    const groups: Array<{ phoneNumberId: string | null; unreadCount: bigint }> =
      await prisma.$queryRaw`
        WITH ReplyStats AS (
          SELECT
            "businessPhoneNumberId",
            "sender",
            "timestamp",
            MAX("timestamp") FILTER (
              WHERE "sender" = 'agent' AND COALESCE("status", 'sent') <> 'failed'
            ) OVER (
              PARTITION BY "businessPhoneNumberId", COALESCE(
                NULLIF(LOWER(CASE WHEN "recipientId" ILIKE 'MY.%' OR "recipientId" LIKE '@%' THEN "recipientId" END), ''),
                NULLIF(RIGHT(REGEXP_REPLACE(COALESCE("customerPhone", ''), '\D', '', 'g'), 9), ''),
                NULLIF("customerId", ''),
                "id"
              )
            ) as last_agent_reply_at
          FROM "WhatsAppMessage"
        )
        SELECT
          "businessPhoneNumberId" as "phoneNumberId",
          COUNT(*) FILTER (
            WHERE "sender" = 'customer'
              AND (last_agent_reply_at IS NULL OR "timestamp" > last_agent_reply_at)
          ) as "unreadCount"
        FROM ReplyStats
        GROUP BY "businessPhoneNumberId"
      `;

    const byPhone = groups
      .filter((group) => Boolean(group.phoneNumberId) && Number(group.unreadCount) > 0)
      .map((group) => ({
        phoneNumberId: group.phoneNumberId as string,
        unreadCount: Number(group.unreadCount),
      }));

    return res.json({
      total: groups.reduce((sum, group) => sum + Number(group.unreadCount), 0),
      byPhone,
    });
  } catch (error) {
    console.error('Error fetching global unread message summary:', error);
    return res.status(500).json({ error: 'Không thể lấy tổng số tin nhắn chưa đọc.' });
  }
}

/**
 * Fetch OpenGraph link preview metadata for WhatsApp-style card rendering
 */
export async function getLinkPreview(req: Request, res: Response) {
  try {
    const url = typeof req.query?.url === 'string' ? req.query.url.trim() : '';
    if (!url) {
      return res.status(400).json({ error: 'Tham số url là bắt buộc.' });
    }
    const preview = await fetchLinkPreview(url);
    if (!preview) {
      return res.status(404).json({ error: 'Không thể tạo bản xem trước cho URL này.' });
    }
    return res.json(preview);
  } catch (err: any) {
    console.warn('[LINK PREVIEW ERROR]', err?.message || err);
    return res.status(500).json({ error: 'Lỗi khi lấy thông tin xem trước liên kết.' });
  }
}
