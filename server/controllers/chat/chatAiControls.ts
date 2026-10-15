import type { Request, Response } from 'express';
import { realtimeHub } from '../../services/realtimeHub';
import { prisma } from '../../lib/prisma';
import {
  pauseAiForCustomer,
  resumeAiForCustomer,
  isAiActiveForCustomer,
  isGlobalAiEnabled,
  setGlobalAiEnabled,
  generateConversationSummary,
} from '../../services/difyService';

/**
 * Toggle AI auto-reply on/off for a specific customer
 */
export async function toggleCustomerAi(req: Request, res: Response) {
  try {
    const { phone, enabled, minutes } = req.body;
    if (!phone) {
      return res.status(400).json({ error: 'Thiếu số điện thoại khách hàng.' });
    }

    if (enabled) {
      resumeAiForCustomer(phone);
    } else {
      pauseAiForCustomer(phone, typeof minutes === 'number' ? minutes : 0);
    }

    const isActive = isAiActiveForCustomer(phone);
    realtimeHub.broadcast('ai:status', { phone, isAiActive: isActive });
    return res.json({
      success: true,
      phone,
      isAiActive: isActive,
      message: isActive ? 'Đã bật phản hồi AI cho khách hàng.' : 'Đã tạm dừng phản hồi AI cho khách hàng.'
    });
  } catch (error: any) {
    console.error('Error toggling customer AI:', error);
    return res.status(500).json({ error: error.message || 'Lỗi khi cập nhật trạng thái AI.' });
  }
}

/**
 * Get AI auto-reply status for a specific customer
 */
export async function getCustomerAiStatus(req: Request, res: Response) {
  try {
    const phone = req.params.phone || req.query.phone;
    if (!phone || typeof phone !== 'string') {
      return res.status(400).json({ error: 'Thiếu số điện thoại khách hàng.' });
    }

    const isActive = isAiActiveForCustomer(phone);
    return res.json({
      phone,
      isAiActive: isActive
    });
  } catch (error: any) {
    console.error('Error getting customer AI status:', error);
    return res.status(500).json({ error: error.message || 'Lỗi khi kiểm tra trạng thái AI.' });
  }
}

/** Read the AI auto-reply switch shared by all CRM users. */
export async function getGlobalAiStatus(req: Request, res: Response) {
  try {
    return res.json({ isAiEnabled: await isGlobalAiEnabled() });
  } catch (error: any) {
    console.error('Error getting global AI status:', error);
    return res.status(500).json({ error: error.message || 'Lỗi khi kiểm tra trạng thái AI toàn hệ thống.' });
  }
}

/** Enable or disable AI auto-replies globally for every user and conversation. */
export async function toggleGlobalAi(req: Request, res: Response) {
  try {
    if (typeof req.body?.enabled !== 'boolean') {
      return res.status(400).json({ error: 'Trạng thái AI không hợp lệ.' });
    }
    const isAiEnabled = await setGlobalAiEnabled(req.body.enabled);
    realtimeHub.broadcast('ai:status', { scope: 'global', isAiEnabled });
    return res.json({
      success: true,
      isAiEnabled,
      message: isAiEnabled
        ? 'Đã bật AI tự động cho toàn hệ thống.'
        : 'Đã tắt AI tự động cho toàn hệ thống.',
    });
  } catch (error: any) {
    console.error('Error toggling global AI:', error);
    return res.status(500).json({ error: error.message || 'Lỗi khi cập nhật trạng thái AI toàn hệ thống.' });
  }
}

/**
 * Summarize a chat conversation for CRM agents
 */
export async function summarizeChatConversation(req: Request, res: Response) {
  try {
    const { phone, customerName, messages, brandName } = req.body;
    if (!phone && (!messages || !Array.isArray(messages) || messages.length === 0)) {
      return res.status(400).json({ error: 'Thiếu thông tin số điện thoại hoặc tin nhắn hội thoại.' });
    }

    let conversationMessages = messages;

    // If messages not provided or empty, load from database
    if (!conversationMessages || !Array.isArray(conversationMessages) || conversationMessages.length === 0) {
      if (phone) {
        const cleanPhone = String(phone).replace(/\D/g, '');
        const dbMsgs = await prisma.whatsAppMessage.findMany({
          where: { customerPhone: cleanPhone },
          orderBy: { timestamp: 'desc' },
          take: 30,
        });
        conversationMessages = dbMsgs.reverse().map((m) => ({
          sender: m.sender,
          content: m.content,
          timestamp: m.timestamp.toISOString(),
        }));
      }
    }

    const summaryResult = await generateConversationSummary({
      phone: String(phone || 'unknown'),
      customerName: customerName ? String(customerName) : 'Khách hàng',
      messages: conversationMessages || [],
      brandName: brandName ? String(brandName) : undefined,
    });

    return res.json({
      success: true,
      ...summaryResult,
    });
  } catch (error: any) {
    console.error('Error generating chat conversation summary:', error);
    return res.status(500).json({ error: error.message || 'Lỗi khi tạo tóm tắt hội thoại.' });
  }
}
