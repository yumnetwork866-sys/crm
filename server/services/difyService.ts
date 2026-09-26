import { prisma } from '../lib/prisma';
import type { InMemoryMessage } from './messageStore';
import { messageStore } from './messageStore';
import {
  getIntegrationSetting,
  resolvePhoneNumberId,
  getMetaAccessToken,
  dispatchMetaMessage,
} from './metaApiClient';
import { realtimeHub } from './realtimeHub';

interface DifyChatResponse {
  answer: string;
  conversation_id?: string;
  message_id?: string;
}

// Conversation ID per customer phone to maintain multi-turn chat history
const phoneToConversationId = new Map<string, string>();

// Timestamp (in ms) until when AI auto-reply is paused for a customer
const customerAiPausedUntil = new Map<string, number>();

/**
 * Retrieve current Dify configuration from environment variables
 */
export function getDifyConfig() {
  return {
    enabled: process.env.DIFY_AI_ENABLED === 'true',
    apiUrl: (process.env.DIFY_API_URL || 'https://dify.yumnetwork.vn/v1').replace(/\/+$/, ''),
    apiKey: process.env.DIFY_API_KEY || '',
    timeoutMs: Number(process.env.DIFY_TIMEOUT_MS) || 20000,
  };
}

/**
 * Check if AI auto-reply is currently active for a customer
 */
export function isAiActiveForCustomer(phone: string): boolean {
  const config = getDifyConfig();
  if (!config.enabled || !config.apiKey.trim()) {
    return false;
  }

  const cleanPhone = phone.replace(/\D/g, '');
  const pauseExpiration = customerAiPausedUntil.get(cleanPhone);
  if (pauseExpiration && Date.now() < pauseExpiration) {
    return false;
  }

  return true;
}

/**
 * Pause AI auto-reply for a customer (e.g. when staff manually intervenes)
 */
export function pauseAiForCustomer(phone: string, durationMinutes = 30) {
  const cleanPhone = phone.replace(/\D/g, '');
  const until = Date.now() + durationMinutes * 60 * 1000;
  customerAiPausedUntil.set(cleanPhone, until);
  console.log(`[Dify AI] Tạm dừng AI cho khách ${cleanPhone} trong ${durationMinutes} phút (đến ${new Date(until).toLocaleTimeString('vi-VN')})`);
}

/**
 * Resume AI auto-reply for a customer immediately
 */
export function resumeAiForCustomer(phone: string) {
  const cleanPhone = phone.replace(/\D/g, '');
  customerAiPausedUntil.delete(cleanPhone);
  console.log(`[Dify AI] Đã bật lại AI cho khách ${cleanPhone}`);
}

/**
 * Call Dify Chat Completion API with customer question
 */
export async function askDify(
  query: string,
  userPhone: string
): Promise<string | null> {
  const config = getDifyConfig();
  if (!config.enabled || !config.apiKey.trim()) {
    return null;
  }

  const cleanPhone = userPhone.replace(/\D/g, '') || 'guest_user';
  const existingConvId = phoneToConversationId.get(cleanPhone) || '';

  const controller = new AbortController();
  const timeoutTimer = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const endpoint = `${config.apiUrl}/chat-messages`;
    console.log(`[Dify API] Gửi câu hỏi của khách (${cleanPhone}) sang Dify: "${query.slice(0, 80)}..."`);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: {},
        query: query.trim(),
        response_mode: 'blocking',
        conversation_id: existingConvId,
        user: `user_${cleanPhone}`,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutTimer);

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.warn(`[Dify API Warn] Dify phản hồi lỗi HTTP ${response.status}:`, errText);
      return null;
    }

    const data = (await response.json()) as DifyChatResponse;

    if (data.conversation_id) {
      phoneToConversationId.set(cleanPhone, data.conversation_id);
    }

    if (data.answer && data.answer.trim()) {
      return data.answer.trim();
    }

    return null;
  } catch (error: any) {
    clearTimeout(timeoutTimer);
    if (error?.name === 'AbortError') {
      console.warn(`[Dify API Timeout] Quá thời gian chờ (${config.timeoutMs}ms) khi gọi Dify RAG.`);
    } else {
      console.error('[Dify API Error] Lỗi khi kết nối Dify:', error?.message || error);
    }
    return null;
  }
}

/**
 * Process incoming customer message, generate RAG response from Dify,
 * and dispatch back to customer WhatsApp automatically.
 */
export async function autoReplyWithDify(params: {
  fromPhone: string;
  customerName: string;
  customerId: string;
  incomingText: string;
  isCrmCustomer: boolean;
  incomingMsgId?: string;
}): Promise<boolean> {
  const { fromPhone, customerName, customerId, incomingText, isCrmCustomer, incomingMsgId } = params;

  // 1. Validate if AI is active for this customer
  if (!isAiActiveForCustomer(fromPhone)) {
    return false;
  }

  // 2. Ignore non-text or system messages (images, stickers, media)
  const trimmed = incomingText.trim();
  if (
    !trimmed ||
    trimmed.startsWith('[Hình ảnh]') ||
    trimmed.startsWith('[Sticker') ||
    trimmed.startsWith('[Tài liệu]') ||
    trimmed.startsWith('[Video]') ||
    trimmed.startsWith('[Tin nhắn thoại') ||
    trimmed.startsWith('/api/meta/media/')
  ) {
    return false;
  }

  try {
    // 3. Query Dify RAG
    const answer = await askDify(trimmed, fromPhone);
    if (!answer) {
      return false;
    }

    // 4. Send reply back to customer via WhatsApp Cloud API
    const cleanPhone = fromPhone.replace(/\D/g, '');
    const setting = await getIntegrationSetting();
    const phoneId = await resolvePhoneNumberId(setting);
    const token = await getMetaAccessToken(setting);

    let isRealSent = false;
    let metaSentId: string | null = null;

    if (phoneId && token && cleanPhone) {
      try {
        const dispatchRes = await dispatchMetaMessage({
          phoneId,
          token,
          cleanPhone,
          content: answer,
          contextMessageId: incomingMsgId,
        });
        isRealSent = dispatchRes.isRealSent;
        metaSentId = dispatchRes.metaResult?.messages?.[0]?.id || null;
      } catch (dispatchErr) {
        console.error('[Dify AI] Lỗi gửi tin nhắn WhatsApp phản hồi:', dispatchErr);
      }
    }

    // 5. Create in-memory message for CRM UI
    const aiMsg: InMemoryMessage = {
      id: metaSentId || `msg_dify_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      customerId,
      customerName,
      customerPhone: fromPhone,
      sender: 'agent',
      agentName: '🤖 Trợ lý AI (Dify)',
      channel: 'WhatsApp',
      content: answer,
      timestamp: new Date().toISOString(),
      isRead: true,
      isRealSent,
      replyTo: incomingMsgId
        ? {
            id: incomingMsgId,
            senderName: customerName,
            content: trimmed.slice(0, 120),
          }
        : undefined,
    };

    messageStore.add(aiMsg);

    // 6. Persist to PostgreSQL Database
    try {
      const createData: any = {
        id: aiMsg.id,
        customerName: aiMsg.customerName,
        customerPhone: aiMsg.customerPhone,
        sender: 'agent',
        agentName: aiMsg.agentName,
        channel: 'WhatsApp',
        content: aiMsg.content,
        isRead: true,
        isRealSent,
        timestamp: new Date(aiMsg.timestamp),
      };

      if (isCrmCustomer) {
        createData.customerId = customerId;
      }

      await prisma.whatsAppMessage.upsert({
        where: { id: aiMsg.id },
        update: {},
        create: createData,
      });

      if (isCrmCustomer) {
        await prisma.customer.update({
          where: { id: customerId },
          data: { lastContact: new Date() },
        }).catch(() => {});
      }
    } catch (dbErr: any) {
      console.warn('[Dify AI] Không lưu được tin AI vào DB:', dbErr?.message || dbErr);
    }

    // 7. Broadcast realtime update to CRM UI
    realtimeHub.broadcast('message:new', aiMsg);
    console.log(`[Dify AI Auto-reply] Đã trả lời tự động cho ${customerName} (${fromPhone}): "${answer.slice(0, 80)}..."`);
    return true;
  } catch (err) {
    console.error('[Dify AI Auto-reply Error]', err);
    return false;
  }
}
