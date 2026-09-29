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

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

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
 * Retrieve current Dify configuration, reloading .env if needed
 */
export function getDifyConfig() {
  if (!process.env.DIFY_API_KEY) {
    try {
      const envPath = path.resolve(process.cwd(), '.env');
      if (fs.existsSync(envPath)) {
        const envConfig = dotenv.parse(fs.readFileSync(envPath));
        for (const k in envConfig) {
          if (!process.env[k]) {
            process.env[k] = envConfig[k];
          }
        }
      }
    } catch (e) {
      console.warn('[Dify AI] Không thể đọc động file .env:', e);
    }
  }

  return {
    enabled: process.env.DIFY_AI_ENABLED === 'true' || process.env.DIFY_AI_ENABLED === undefined,
    apiUrl: (process.env.DIFY_API_URL || 'https://dify.yumnetwork.vn/v1').replace(/\/+$/, ''),
    apiKey: process.env.DIFY_API_KEY || '',
    timeoutMs: Number(process.env.DIFY_TIMEOUT_MS) || 20000,
  };
}

/**
 * Check if AI auto-reply is currently active for a customer
 */
export function isAiActiveForCustomer(phone: string): boolean {
  const cleanPhone = phone.replace(/\D/g, '');
  const pauseExpiration = customerAiPausedUntil.get(cleanPhone);
  if (pauseExpiration && Date.now() < pauseExpiration) {
    return false;
  }

  return true;
}

/**
/**
 * Pause AI auto-reply for a customer (durationMinutes = 0 means indefinite until manually resumed in CRM)
 */
export function pauseAiForCustomer(phone: string, durationMinutes = 0) {
  const cleanPhone = phone.replace(/\D/g, '');
  const until = durationMinutes > 0 ? Date.now() + durationMinutes * 60 * 1000 : Number.MAX_SAFE_INTEGER;
  customerAiPausedUntil.set(cleanPhone, until);
  if (durationMinutes > 0) {
    console.log(`[Dify AI] Tạm dừng AI cho khách ${cleanPhone} trong ${durationMinutes} phút (đến ${new Date(until).toLocaleTimeString('vi-VN')})`);
  } else {
    console.log(`[Dify AI] Tắt AI cho khách ${cleanPhone} cho đến khi bấm Bật lại trên CRM`);
  }
}

/**
 * Resume AI auto-reply for a customer immediately
 */
export function resumeAiForCustomer(phone: string) {
  const cleanPhone = phone.replace(/\D/g, '');
  customerAiPausedUntil.delete(cleanPhone);
  console.log(`[Dify AI] Đã bật lại AI cho khách ${cleanPhone}`);
}

export function resolveBrandName(rawBrand?: string): string {
  const defaultBrand = process.env.DIFY_DEFAULT_BRAND_NAME?.trim() || 'Yum Network';
  if (!rawBrand) return defaultBrand;
  const trimmed = rawBrand.trim();
  // Nếu brandName là toàn chữ số điện thoại (ví dụ '601110716895'), tự động dùng tên thương hiệu chuẩn
  if (/^\+?\d+$/.test(trimmed)) {
    return defaultBrand;
  }
  return trimmed;
}

/**
 * Call Dify Chat Completion API with customer question
 */
export async function askDify(
  query: string,
  userPhone: string,
  brandName?: string
): Promise<string | null> {
  const config = getDifyConfig();
  if (!config.enabled || !config.apiKey.trim()) {
    return null;
  }

  const cleanPhone = userPhone.replace(/\D/g, '') || 'guest_user';
  const existingConvId = phoneToConversationId.get(cleanPhone) || '';
  const finalBrandName = resolveBrandName(brandName);

  const controller = new AbortController();
  const timeoutTimer = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const endpoint = `${config.apiUrl}/chat-messages`;
    console.log(`[Dify API] Gửi câu hỏi của khách (${cleanPhone}) [Brand: ${finalBrandName}] sang Dify: "${query.slice(0, 80)}..."`);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: {
          brand_name: finalBrandName,
        },
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
 * Convert standard Markdown syntax into native WhatsApp formatting:
 * - Markdown bold **text** -> WhatsApp bold *text*
 * - Markdown lists (* item or - item) -> bullet • item
 * - Markdown headers (### Header) -> *Header*
 */
export function formatToWhatsAppMarkdown(text: string): string {
  if (!text) return '';
  return text
    .replace(/^#{1,6}\s+(.+)$/gm, '*$1*')
    .replace(/^(\s*)[*\-]\s+/gm, '$1• ')
    .replace(/\*\*(.+?)\*\*/g, '*$1*')
    .replace(/\*\*\*(.+?)\*\*\*/g, '*_$1_*');
}

/**
 * Detect if customer explicitly demands to talk to a human / consultant
 */
export function isCustomerDemandingHuman(text: string): boolean {
  if (!text) return false;
  const clean = text.toLowerCase().trim();

  const patterns = [
    // Gặp nhân viên, người thật, tư vấn viên, chuyên viên, quản lý
    /(cho\s+(tôi|mình|em|anh|chị)?\s*)?(gặp|nói\s+chuyện|kết\s+nối|chuyển\s+máy|gọi)\s*(với)?\s*(người\s*thật|nhân\s*viên|tư\s*vấn\s*viên|cskh|chăm\s*sóc|quản\s*lý|admin|chuyên\s*viên|hỗ\s*trợ\s*viên)/i,
    // Nhân viên đâu, có ai trực không
    /(nhân\s*viên|tư\s*vấn\s*viên|người\s*thật|cskh|admin)\s*(đâu|có\s*(đó|ở\s*đây)\s*không|trực\s*không|hỗ\s*trợ\s*đi)/i,
    // Cần / muốn gặp người
    /(cần|muốn)\s*(gặp|nói\s*chuyện|hỗ\s*trợ\s*bởi|trao\s*đổi\s*với)\s*(người|nhân\s*viên|tư\s*vấn|người\s*thật)/i,
    // Phản đối bot
    /(đừng\s*chat\s*bot|tắt\s*bot|bot\s*ngu|ngừng\s*bot|không\s*muốn\s*chat\s*với\s*bot|đổi\s*người\s*đi|cho\s*người\s*khác)/i,
    // Yêu cầu gọi điện thoại
    /(gọi\s*(điện|cho\s*(tôi|mình|em|anh|chị)|lại\s*cho\s*(tôi|mình|em))|alo\s*trực\s*tiếp|liên\s*hệ\s*trực\s*tiếp)/i,
    // Tiếng Anh / Mã
    /(talk|speak)\s*to\s*(a\s*)?(human|person|agent|representative|operator|manager)/i,
    /(real\s*person|human\s*agent|customer\s*service\s*agent|support\s*agent)/i,
    /(sambungkan|bercakap|cakap)\s*dengan\s*(orang|ejen|pegawai|staf)/i,
    /(nak\s*cakap\s*dengan\s*orang|nak\s*ejen)/i,
  ];

  return patterns.some((p) => p.test(clean));
}

/**
 * Detect if customer is angry, abusive, or escalating a critical complaint
 */
export function isCustomerAngryOrComplaining(text: string): boolean {
  if (!text) return false;
  const clean = text.toLowerCase().trim();

  const patterns = [
    // Tố cáo lừa đảo, gian lận
    /(lừa\s*đảo|lua\s*dao|scam|scammer|gian\s*lận|bịp\s*bợm)/i,
    // Chửi bới, văng tục, xúc phạm
    /(đ[c|m]|d[c|m]|đ\s*ụ|địt|đéo|vcl|v[c|l]|vãi\s*l|đ[c|m]m|dcm|bố\s*láo|mất\s*dạy|vô\s*học|chó\s*chết)/i,
    /(làm\s*ăn\s*(như|quá)\s*(cặc|lồn|buồi|hạch|cc|cl|tệ|vớ\s*vẩn|tào\s*lao|rác))/i,
    /(vớ\s*vẩn|tào\s*lao|nhảm\s*nhí|như\s*hạch|như\s*cặc|như\s*lồn)/i,
    // Bức xúc, tức giận
    /(bực\s*(mình|cả\s*mình)|tức\s*(điên|chết|mình)|quá\s*thất\s*vọng|bực\s*bội|bực\s*mình\s*thật)/i,
    // Khiếu nại, dọa nạt, kiện tụng
    /(khiếu\s*nại|thưa\s*kiện|kiện|báo\s*công\s*an|ra\s*công\s*an|phốt|bóc\s*phốt|tẩy\s*chay|báo\s*chí)/i,
    // Đòi tiền, đòi hoàn tiền trong giận dữ
    /(trả\s*(lại\s*)?tiền|hoàn\s*tiền\s*ngay|đòi\s*tiền|bồi\s*thường|dẹp\s*(mẹ\s*)?đi|dẹp\s*tiệm)/i,
    // Tiếng Anh / Mã
    /(terrible|horrible|worst\s*service|fraud|sue\s*you|police|refund\s*now|fuck|bullshit|damn|idiot|stupid)/i,
    /(penipu|teruk|bodoh|gila|marah|nak\s*duit\s*balik|refund\s*sekarang)/i,
  ];

  return patterns.some((p) => p.test(clean));
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
  brandName?: string;
}): Promise<boolean> {
  const { fromPhone, customerName, customerId, incomingText, isCrmCustomer, incomingMsgId, brandName } = params;

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
    const isDemandingHuman = isCustomerDemandingHuman(trimmed);
    const isAngryOrComplaining = isCustomerAngryOrComplaining(trimmed);
    const isExplicitCustomerOptOut = /^(stop|huy|dung|unsubscribe|tam dung)$/i.test(trimmed);

    let answer = '';
    let shouldPauseAfterReply = false;

    if (isAngryOrComplaining) {
      const brand = resolveBrandName(brandName);
      answer = `Dạ ${brand} rất lấy làm tiếc vì trải nghiệm chưa hài lòng của quý khách. Em đã lập tức chuyển cuộc trò chuyện này cho quản lý và chuyên viên phụ trách để liên hệ xử lý trực tiếp ngay cho quý khách ạ.`;
      shouldPauseAfterReply = true;
      console.log(`[Dify AI] Khách tức giận/khiếu nại (${fromPhone}): Kích hoạt phản hồi xoa dịu và chuyển giao.`);
    } else if (isDemandingHuman) {
      answer = `Dạ em đã ghi nhận yêu cầu của quý khách. Em đang kết nối và chuyển thông tin cho chuyên viên hỗ trợ trực tiếp liên hệ lại với quý khách ngay nhé ạ!`;
      shouldPauseAfterReply = true;
      console.log(`[Dify AI] Khách yêu cầu gặp người thật (${fromPhone}): Kích hoạt phản hồi chuyển giao.`);
    } else if (isExplicitCustomerOptOut) {
      answer = `Dạ hệ thống đã tạm dừng phản hồi tự động theo yêu cầu của quý khách. Nếu cần hỗ trợ thêm, quý khách có thể gửi tin nhắn bất kỳ lúc nào nhé ạ!`;
      shouldPauseAfterReply = true;
      console.log(`[Dify AI] Khách yêu cầu dừng bot (${fromPhone}): Tạm dừng bot.`);
    } else {
      // 3. Normal question: Query Dify RAG with dynamic brand name
      const rawAnswer = await askDify(trimmed, fromPhone, brandName);
      if (!rawAnswer) {
        return false;
      }
      answer = formatToWhatsAppMarkdown(rawAnswer);

      // Check if Dify itself decided to escalate to human
      const isDifyHandover =
        /(đang chuyển|đã chuyển|bàn giao|kết nối).*(nhân viên|quản lý|người thật|cấp trên|senior)/i.test(answer) ||
        /(hubungi pegawai|sambungkan ke ejen|pegawai akan hubungi)/i.test(answer);
      if (isDifyHandover) {
        shouldPauseAfterReply = true;
      }
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

    // If triggered human request, angry customer or handover, pause AI indefinitely until user toggles back on in CRM
    if (shouldPauseAfterReply) {
      pauseAiForCustomer(fromPhone, 0);
      realtimeHub.broadcast('ai:status', { phone: fromPhone, isAiActive: false });
      console.log(`[Dify AI] Đã tắt AI tự động cho khách ${fromPhone} (khách muốn gặp người / tức giận / chuyển giao). Chờ nhân viên bật lại trên CRM.`);
    }

    // 5. Create in-memory message for CRM UI
    const configuredAgentName = process.env.DIFY_AGENT_NAME?.trim() || '🤖 Trợ lý AI';
    const aiMsg: InMemoryMessage = {
      id: metaSentId || `msg_dify_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      customerId,
      customerName,
      customerPhone: fromPhone,
      sender: 'agent',
      agentName: configuredAgentName,
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
