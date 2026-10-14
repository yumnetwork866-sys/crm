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

    const dbMsgs = await prisma.whatsAppMessage.findMany({
      where: whereClause,
      orderBy: { timestamp: 'asc' }
    });

    const formatted = dbMsgs.map((m) => {
      const cleanP = m.customerPhone ? m.customerPhone.replace(/\D/g, '') : '';
      return {
        ...m,
        customerId: m.customerId || (cleanP ? `cust_${cleanP}` : 'cust_unknown'),
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
        ? Prisma.sql`WHERE "businessPhoneNumberId" = ${activeBusinessPhoneId} AND ("customerName" ILIKE ${'%' + searchFilter + '%'} OR "customerPhone" LIKE ${'%' + searchFilter + '%'} OR "content" ILIKE ${'%' + searchFilter + '%'})`
        : Prisma.sql`WHERE "businessPhoneNumberId" = ${activeBusinessPhoneId}`
      : searchFilter
        ? Prisma.sql`WHERE ("customerName" ILIKE ${'%' + searchFilter + '%'} OR "customerPhone" LIKE ${'%' + searchFilter + '%'} OR "content" ILIKE ${'%' + searchFilter + '%'})`
        : Prisma.empty;
    const unreadFilterSql = activeBusinessPhoneId
      ? Prisma.sql`WHERE "businessPhoneNumberId" = ${activeBusinessPhoneId}`
      : Prisma.empty;

    const rawThreads: Array<{
      customerId: string | null;
      customerName: string;
      customerPhone: string;
      unreadCount: bigint;
      lastMsgId: string;
      lastMsgContent: string;
      lastMsgSender: string;
      lastMsgTimestamp: Date;
      lastMsgChannel: string;
    }> = await prisma.$queryRaw`
      WITH RankedMessages AS (
        SELECT 
          "id",
          "customerId",
          "customerName",
          "customerPhone",
          "content",
          "sender",
          "timestamp",
          "channel",
          "isRead",
          ROW_NUMBER() OVER (
            PARTITION BY COALESCE("customerPhone", "customerId", "id") 
            ORDER BY "timestamp" DESC, "id" DESC
          ) as rn
        FROM "WhatsAppMessage"
        ${filterSql}
      ),
      UnreadStats AS (
        SELECT 
          COALESCE("customerPhone", "customerId", "id") as thread_key,
          COUNT(*) FILTER (WHERE "sender" = 'customer' AND "isRead" = false) as unread_count
        FROM "WhatsAppMessage"
        ${unreadFilterSql}
        GROUP BY COALESCE("customerPhone", "customerId", "id")
      )
      SELECT 
        rm."customerId",
        rm."customerName",
        rm."customerPhone",
        COALESCE(us.unread_count, 0) as "unreadCount",
        rm."id" as "lastMsgId",
        rm."content" as "lastMsgContent",
        rm."sender" as "lastMsgSender",
        rm."timestamp" as "lastMsgTimestamp",
        rm."channel" as "lastMsgChannel"
      FROM RankedMessages rm
      LEFT JOIN UnreadStats us ON us.thread_key = COALESCE(rm."customerPhone", rm."customerId", rm."id")
      WHERE rm.rn = 1
      ORDER BY rm."timestamp" DESC
      LIMIT ${limit} OFFSET ${skip}
    `;

    const conversations = rawThreads.map((t) => ({
      customerId: t.customerId || `phone_${t.customerPhone}`,
      customerName: t.customerName,
      customerPhone: t.customerPhone,
      unreadCount: Number(t.unreadCount),
      lastMessage: {
        id: t.lastMsgId,
        content: t.lastMsgContent,
        sender: t.lastMsgSender,
        timestamp: t.lastMsgTimestamp,
        channel: t.lastMsgChannel,
      }
    }));

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
    const groups = await prisma.whatsAppMessage.groupBy({
      by: ['businessPhoneNumberId'],
      where: {
        sender: 'customer',
        isRead: false,
      },
      _count: { _all: true },
    });

    const byPhone = groups
      .filter((group) => Boolean(group.businessPhoneNumberId))
      .map((group) => ({
        phoneNumberId: group.businessPhoneNumberId as string,
        unreadCount: group._count._all,
      }));

    return res.json({
      total: groups.reduce((sum, group) => sum + group._count._all, 0),
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
