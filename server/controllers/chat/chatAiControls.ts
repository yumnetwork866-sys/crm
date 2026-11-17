import type { Request, Response } from 'express';
import { realtimeHub } from '../../services/realtimeHub';
import { prisma } from '../../lib/prisma';
import { generateConversationSummary } from '../../services/difyService';
import {
  pauseNativeAi,
  resumeNativeAi,
  isNativeAiActive,
  isNativeGlobalAiEnabled as isGlobalAiEnabled,
  setNativeGlobalAiEnabled as setGlobalAiEnabled,
} from '../../services/ai/nativeAutoReply';
import { generateNativeAi } from '../../services/ai/nativeAiService';
import { AiFailure, generationInputSchema } from '../../services/ai/contracts';
import {
  MessageTranslationError,
  translateStoredMessage,
} from '../../services/messageTranslationService';
import { createLogger } from '../../lib/logger';

const log = createLogger('chatAiControls');

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
      await resumeNativeAi(phone, req.body.businessPhoneNumberId);
    } else {
      await pauseNativeAi(
        phone,
        typeof minutes === 'number' ? minutes : 0,
        req.body.businessPhoneNumberId,
      );
    }

    const isActive = await isNativeAiActive(
      phone,
      typeof req.body?.businessPhoneNumberId === 'string'
        ? req.body.businessPhoneNumberId
        : typeof req.query.businessPhoneNumberId === 'string'
          ? req.query.businessPhoneNumberId
          : undefined,
    );
    realtimeHub.broadcast('ai:status', { phone, isAiActive: isActive });
    return res.json({
      success: true,
      phone,
      isAiActive: isActive,
      message: isActive
        ? 'Đã bật phản hồi AI cho khách hàng.'
        : 'Đã tạm dừng phản hồi AI cho khách hàng.',
    });
  } catch (error: any) {
    log.error({ err: error }, 'Error toggling customer AI:');
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

    const isActive = await isNativeAiActive(
      phone,
      typeof req.body?.businessPhoneNumberId === 'string'
        ? req.body.businessPhoneNumberId
        : typeof req.query.businessPhoneNumberId === 'string'
          ? req.query.businessPhoneNumberId
          : undefined,
    );
    return res.json({
      phone,
      isAiActive: isActive,
    });
  } catch (error: any) {
    log.error({ err: error }, 'Error getting customer AI status:');
    return res.status(500).json({ error: error.message || 'Lỗi khi kiểm tra trạng thái AI.' });
  }
}

/** Read the AI auto-reply switch shared by all CRM users. */
export async function getGlobalAiStatus(req: Request, res: Response) {
  try {
    return res.json({ isAiEnabled: await isGlobalAiEnabled() });
  } catch (error: any) {
    log.error({ err: error }, 'Error getting global AI status:');
    return res
      .status(500)
      .json({ error: error.message || 'Lỗi khi kiểm tra trạng thái AI toàn hệ thống.' });
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
    log.error({ err: error }, 'Error toggling global AI:');
    return res
      .status(500)
      .json({ error: error.message || 'Lỗi khi cập nhật trạng thái AI toàn hệ thống.' });
  }
}

/**
 * Summarize a chat conversation for CRM agents
 */
export async function summarizeChatConversation(req: Request, res: Response) {
  try {
    const { phone, customerName, messages, brandName } = req.body;
    if (!phone && (!messages || !Array.isArray(messages) || messages.length === 0)) {
      return res
        .status(400)
        .json({ error: 'Thiếu thông tin số điện thoại hoặc tin nhắn hội thoại.' });
    }

    let conversationMessages = messages;

    // If messages not provided or empty, load from database
    if (
      !conversationMessages ||
      !Array.isArray(conversationMessages) ||
      conversationMessages.length === 0
    ) {
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
    log.error({ err: error }, 'Error generating chat conversation summary:');
    return res.status(500).json({ error: error.message || 'Lỗi khi tạo tóm tắt hội thoại.' });
  }
}

/**
 * Suggest reply messages for CRM agents based on customer context
 */
export async function suggestChatReplies(req: Request, res: Response) {
  const parsed = generationInputSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: 'Ngữ cảnh gợi ý không hợp lệ.', code: 'INVALID_CONTEXT' });
  try {
    return res.json(await generateNativeAi(parsed.data));
  } catch (error) {
    if (error instanceof AiFailure) {
      return res.status(error.status).json({
        error: error.message,
        code: error.code,
        stage: error.stage,
        runId: error.runId,
        requestId: res.locals.requestId,
      });
    }
    log.error({ err: error }, 'Native AI suggestion failed');
    return res.status(500).json({
      error: 'Không tạo được gợi ý AI.',
      code: 'AI_INTERNAL_ERROR',
      requestId: res.locals.requestId,
    });
  }
}

/** Translate one displayed chat message through the local Ollama TranslateGemma model. */
export async function translateChatMessage(req: Request, res: Response) {
  try {
    const messageId = typeof req.body?.messageId === 'string' ? req.body.messageId.trim() : '';
    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    const targetLanguage =
      typeof req.body?.targetLanguage === 'string' ? req.body.targetLanguage.trim() : 'vi';
    if (!messageId || !text) return res.status(400).json({ error: 'Thiếu tin nhắn cần dịch.' });

    const result = await translateStoredMessage(messageId, targetLanguage);
    return res.json({ success: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi khi dịch tin nhắn.';
    log.error({ err: error }, '[OLLAMA TRANSLATE] Error translating chat message:');
    return res
      .status(error instanceof MessageTranslationError ? error.status : 502)
      .json({ error: message });
  }
}
