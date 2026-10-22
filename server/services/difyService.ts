import { prisma } from '../lib/prisma';
import {
  getIntegrationSetting,
  updateIntegrationSetting,
  resolvePhoneNumberId,
  getMetaAccessTokenForPhone,
  dispatchMetaMessage,
} from './metaApiClient';
import { realtimeHub } from './realtimeHub';
import { normalizeMetaRecipient } from '../utils/metaRecipient';

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

/** Global AI switch shared by every CRM user and every WhatsApp conversation. */
export async function isGlobalAiEnabled(): Promise<boolean> {
  const config = getDifyConfig();
  if (!config.enabled) return false;
  const setting = await getIntegrationSetting();
  return setting.difyAiEnabled !== false;
}

export async function setGlobalAiEnabled(enabled: boolean): Promise<boolean> {
  await updateIntegrationSetting({ difyAiEnabled: enabled }, { requirePersistence: true });
  return isGlobalAiEnabled();
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

export interface PhoneCountryProfile {
  countryCode: string;
  countryName: string;
  primaryLanguage: string;
  secondaryLanguage?: string;
  currency: string;
  instruction: string;
}

/**
 * Detect customer country, primary language and system instruction based on phone prefix
 */
export function detectCustomerCountryProfile(phone: string): PhoneCountryProfile {
  const clean = phone.replace(/\D/g, '');

  // 1. Vietnam (+84 hoặc số nội địa bắt đầu bằng 0)
  if (clean.startsWith('84') || (clean.startsWith('0') && clean.length === 10)) {
    return {
      countryCode: '+84',
      countryName: 'Vietnam',
      primaryLanguage: 'Tiếng Việt',
      currency: 'VNĐ',
      instruction: 'Khách hàng sử dụng số điện thoại Việt Nam (+84). Hãy ưu tiên phản hồi bằng Tiếng Việt thân thiện, tự nhiên và báo giá bằng VNĐ.',
    };
  }

  // 2. Malaysia (+60)
  if (clean.startsWith('60')) {
    return {
      countryCode: '+60',
      countryName: 'Malaysia',
      primaryLanguage: 'Bahasa Melayu',
      secondaryLanguage: 'English',
      currency: 'RM (MYR)',
      instruction: 'Khách hàng sử dụng số điện thoại Malaysia (+60). Hãy ưu tiên phản hồi bằng tiếng Bahasa Melayu thân thiện, lịch sự (hoặc song ngữ Malay/English nếu khách dùng tiếng Anh), ưu tiên báo giá kèm RM (Ringgit Malaysia). Nếu khách chủ động nhắn tiếng Việt thì trả lời bằng tiếng Việt.',
    };
  }

  // 3. Singapore (+65)
  if (clean.startsWith('65')) {
    return {
      countryCode: '+65',
      countryName: 'Singapore',
      primaryLanguage: 'English',
      secondaryLanguage: 'Chinese',
      currency: 'SGD ($)',
      instruction: 'Khách hàng sử dụng số điện thoại Singapore (+65). Hãy ưu tiên phản hồi bằng Tiếng Anh (English) chuyên nghiệp hoặc Tiếng Trung nếu khách dùng tiếng Trung, và ưu tiên báo giá bằng SGD / USD.',
    };
  }

  // 4. Taiwan (+886)
  if (clean.startsWith('886')) {
    return {
      countryCode: '+886',
      countryName: 'Taiwan',
      primaryLanguage: 'Traditional Chinese (繁體中文)',
      currency: 'TWD (NT$)',
      instruction: 'Khách hàng sử dụng số điện thoại Đài Loan (+886). Hãy ưu tiên phản hồi bằng Tiếng Trung Phồn thể (繁體中文) lịch sự, thân thiện.',
    };
  }

  // 5. China (+86)
  if (clean.startsWith('86')) {
    return {
      countryCode: '+86',
      countryName: 'China',
      primaryLanguage: 'Simplified Chinese (简体中文)',
      currency: 'RMB / CNY (¥)',
      instruction: 'Khách hàng sử dụng số điện thoại Trung Quốc (+86). Hãy ưu tiên phản hồi bằng Tiếng Trung Giản thể (简体中文) lịch sự, thân thiện.',
    };
  }

  // 6. Thailand (+66)
  if (clean.startsWith('66')) {
    return {
      countryCode: '+66',
      countryName: 'Thailand',
      primaryLanguage: 'Thai (ภาษาไทย)',
      secondaryLanguage: 'English',
      currency: 'THB (฿)',
      instruction: 'Khách hàng sử dụng số điện thoại Thái Lan (+66). Hãy phản hồi bằng Tiếng Thái (ภาษาไทย) hoặc Tiếng Anh thân thiện.',
    };
  }

  // 7. Philippines (+63)
  if (clean.startsWith('63')) {
    return {
      countryCode: '+63',
      countryName: 'Philippines',
      primaryLanguage: 'English',
      secondaryLanguage: 'Tagalog',
      currency: 'PHP (₱)',
      instruction: 'Khách hàng sử dụng số điện thoại Philippines (+63). Hãy phản hồi bằng Tiếng Anh (English) hoặc Tagalog thân thiện.',
    };
  }

  // 8. Indonesia (+62)
  if (clean.startsWith('62')) {
    return {
      countryCode: '+62',
      countryName: 'Indonesia',
      primaryLanguage: 'Bahasa Indonesia',
      currency: 'IDR (Rp)',
      instruction: 'Khách hàng sử dụng số điện thoại Indonesia (+62). Hãy phản hồi bằng tiếng Bahasa Indonesia thân thiện.',
    };
  }

  // 9. Japan (+81)
  if (clean.startsWith('81')) {
    return {
      countryCode: '+81',
      countryName: 'Japan',
      primaryLanguage: 'Japanese (日本語)',
      currency: 'JPY (¥)',
      instruction: 'Khách hàng sử dụng số điện thoại Nhật Bản (+81). Hãy phản hồi bằng Tiếng Nhật (日本語) lịch sự (Keigo).',
    };
  }

  // 10. Korea (+82)
  if (clean.startsWith('82')) {
    return {
      countryCode: '+82',
      countryName: 'Korea',
      primaryLanguage: 'Korean (한국어)',
      currency: 'KRW (₩)',
      instruction: 'Khách hàng sử dụng số điện thoại Hàn Quốc (+82). Hãy phản hồi bằng Tiếng Hàn (한국어) lịch thiệp.',
    };
  }

  // 11. US / Canada (+1)
  if (clean.startsWith('1') && clean.length >= 10) {
    return {
      countryCode: '+1',
      countryName: 'US/Canada',
      primaryLanguage: 'English',
      currency: 'USD ($)',
      instruction: 'Khách hàng sử dụng số điện thoại Mỹ/Canada (+1). Hãy phản hồi bằng Tiếng Anh (English) chuyên nghiệp và báo giá USD.',
    };
  }

  // Default fallback
  return {
    countryCode: 'Unknown',
    countryName: 'International',
    primaryLanguage: 'Tiếng Việt / English',
    currency: 'USD / VNĐ',
    instruction: 'Hãy phản hồi theo ngôn ngữ mà khách hàng đang sử dụng trong câu hỏi (nếu khách dùng tiếng Việt thì trả lời tiếng Việt, nếu dùng tiếng Anh thì trả lời tiếng Anh).',
  };
}

/**
 * Return tailored handover messages in customer native language
 */
export function getHandoverMessagesByCountry(phone: string, brandName: string) {
  const profile = detectCustomerCountryProfile(phone);
  const brand = resolveBrandName(brandName);

  if (profile.countryName === 'Malaysia') {
    return {
      angry: `Hai, pihak ${brand} memohon maaf atas sebarang kesulitan yang dihadapi. Kami telah memanjangkan perbualan ini kepada pihak pengurusan dan pegawai kami untuk menghubungi dan membantu anda dengan segera.`,
      human: `Permintaan anda telah kami terima. Kami sedang menyambungkan perbualan ini kepada pegawai perkhidmatan pelanggan kami untuk menghubungi anda sebentar lagi ya.`,
      optOut: `Sistem telah menjeda maklum balas automatik mengikut permintaan anda. Sila hantar mesej pada bila-bila masa jika anda memerlukan bantuan lanjut ya!`,
    };
  }

  if (profile.countryName === 'Singapore' || profile.countryName === 'US/Canada') {
    return {
      angry: `Dear customer, ${brand} sincerely apologizes for your unsatisfactory experience. We have immediately escalated this conversation to our management team to contact and assist you directly.`,
      human: `Your request has been noted. We are connecting you with a customer support specialist to assist you directly shortly!`,
      optOut: `Auto-reply has been paused as requested. Please message us anytime if you need further assistance!`,
    };
  }

  if (profile.countryName === 'Taiwan') {
    return {
      angry: `您好，${brand} 對於造成您的不便深感抱歉。我們已將您的對話轉交給主管及專員，將會盡快與您直接聯繫處理。`,
      human: `已收到您的需求，我們正在為您轉接真人專員，專員將會盡快與您聯繫協助！`,
      optOut: `系統已為您暫停自動回覆。若後續有任何需要，歡迎隨時留言發送訊息給我們！`,
    };
  }

  // Default Vietnamese
  return {
    angry: `Dạ ${brand} rất lấy làm tiếc vì trải nghiệm chưa hài lòng của quý khách. Em đã lập tức chuyển cuộc trò chuyện này cho quản lý và chuyên viên phụ trách để liên hệ xử lý trực tiếp ngay cho quý khách ạ.`,
    human: `Dạ em đã ghi nhận yêu cầu của quý khách. Em đang kết nối và chuyển thông tin cho chuyên viên hỗ trợ trực tiếp liên hệ lại với quý khách ngay nhé ạ!`,
    optOut: `Dạ hệ thống đã tạm dừng phản hồi tự động theo yêu cầu của quý khách. Nếu cần hỗ trợ thêm, quý khách có thể gửi tin nhắn bất kỳ lúc nào nhé ạ!`,
  };
}

/**
 * Call Dify Chat Completion API with customer question and country-aware language guidance
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
  const countryProfile = detectCustomerCountryProfile(cleanPhone);

  const controller = new AbortController();
  const timeoutTimer = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const endpoint = `${config.apiUrl}/chat-messages`;
    console.log(`[Dify API] Gửi câu hỏi của khách (${cleanPhone} - ${countryProfile.countryName}) [Brand: ${finalBrandName}] sang Dify: "${query.slice(0, 80)}..."`);

    // Gắn chỉ thị ngôn ngữ tự động vào câu hỏi dựa trên quốc gia của đầu số điện thoại
    const contextualQuery = `[Ngữ cảnh: ${countryProfile.instruction}]: ${query.trim()}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: {
          brand_name: finalBrandName,
          customer_country: countryProfile.countryName,
          target_language: countryProfile.primaryLanguage,
        },
        query: contextualQuery,
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
    .replace(/^(\s*)[*-]\s+/gm, '$1• ')
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
  businessPhoneNumberId?: string;
}): Promise<boolean> {
  const { fromPhone, customerName, customerId, incomingText, isCrmCustomer, incomingMsgId, brandName, businessPhoneNumberId } = params;

  // 1. Validate both the shared system switch and the per-customer pause state.
  if (!(await isGlobalAiEnabled()) || !isAiActiveForCustomer(fromPhone)) {
    return false;
  }

  // 1.1 Ignore WhatsApp official system notifications (account setup, announcements, verification)
  const cleanFrom = fromPhone.replace(/\D/g, '');
  if (
    cleanFrom === '16465894168' ||
    customerName?.toLowerCase().includes('whatsapp business') ||
    incomingText.includes('Continue setting up your account') ||
    incomingText.includes('Setup guidance')
  ) {
    console.log(`[Dify AI] Bỏ qua tin nhắn hệ thống từ WhatsApp Business (${fromPhone}).`);
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
    const handoverMsgs = getHandoverMessagesByCountry(fromPhone, brandName || '');

    if (isAngryOrComplaining) {
      answer = handoverMsgs.angry;
      shouldPauseAfterReply = true;
      console.log(`[Dify AI] Khách tức giận/khiếu nại (${fromPhone}): Kích hoạt phản hồi xoa dịu theo ngôn ngữ bản địa.`);
    } else if (isDemandingHuman) {
      answer = handoverMsgs.human;
      shouldPauseAfterReply = true;
      console.log(`[Dify AI] Khách yêu cầu gặp người thật (${fromPhone}): Kích hoạt phản hồi chuyển giao theo ngôn ngữ bản địa.`);
    } else if (isExplicitCustomerOptOut) {
      answer = handoverMsgs.optOut;
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
    const cleanPhone = normalizeMetaRecipient(fromPhone);
    const setting = await getIntegrationSetting();
    const phoneId = businessPhoneNumberId || await resolvePhoneNumberId(setting);
    const token = phoneId ? await getMetaAccessTokenForPhone(phoneId, setting) : '';

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

    // 5. Create message payload for CRM UI & Database
    const configuredAgentName = setting.aiName?.trim() || process.env.DIFY_AGENT_NAME?.trim() || '🤖 Trợ lý AI';
    const aiMsg = {
      id: metaSentId || `msg_dify_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      customerId,
      customerName,
      customerPhone: fromPhone,
      businessPhoneNumberId: phoneId || undefined,
      sender: 'agent' as const,
      agentName: configuredAgentName,
      isAi: true,
      channel: 'WhatsApp',
      content: answer,
      timestamp: new Date().toISOString(),
      isRead: true,
      isRealSent,
      status: (isRealSent ? 'sent' : 'failed') as 'sent' | 'failed',
      errorCode: isRealSent ? null : 'META_DISPATCH_FAILED',
      errorMessage: isRealSent ? null : 'Dify AI gửi tin qua Meta thất bại',
      replyTo: incomingMsgId
        ? {
            id: incomingMsgId,
            senderName: customerName,
            content: trimmed.slice(0, 120),
          }
        : undefined,
    };

    // 6. Persist to PostgreSQL Database
    try {
      const createData: any = {
        id: aiMsg.id,
        customerName: aiMsg.customerName,
        customerPhone: aiMsg.customerPhone,
        businessPhoneNumberId: phoneId || null,
        sender: 'agent',
        agentName: aiMsg.agentName,
        isAi: true,
        channel: 'WhatsApp',
        content: aiMsg.content,
        isRead: true,
        isRealSent,
        status: aiMsg.status,
        errorCode: aiMsg.errorCode,
        errorMessage: aiMsg.errorMessage,
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

export interface ConversationSummaryResult {
  summary: string;
  intent: string;
  currentStatus: string;
  suggestedAction: string;
  source: 'ai' | 'smart_analysis';
}

function detectIntentFromTranscript(text: string): string {
  const clean = text.toLowerCase();
  if (/(giá|bao nhiêu|nhiêu tiền|báo giá|chi phí|khuyến mãi|giảm giá|voucher|discount)/i.test(clean)) {
    return 'Hỏi giá & Chương trình khuyến mãi';
  }
  if (/(đặt|mua|chốt|order|lấy|mua hàng|đặt hàng|gửi đơn|lên đơn)/i.test(clean)) {
    return 'Đặt mua sản phẩm';
  }
  if (/(ship|giao hàng|vận chuyển|phí ship|khi nào tới|bao lâu|địa chỉ|nhận hàng)/i.test(clean)) {
    return 'Tra cứu vận chuyển & Giao hàng';
  }
  if (/(lỗi|hỏng|bể|vỡ|sai|đổi|trả|bảo hành|khiếu nại|hoàn tiền|kém|tệ|lừa)/i.test(clean)) {
    return 'Khiếu nại & Hỗ trợ kỹ thuật';
  }
  if (/(tư vấn|sản phẩm|loại nào|mẫu nào|size|công dụng|hướng dẫn|cách dùng)/i.test(clean)) {
    return 'Tư vấn thông tin sản phẩm';
  }
  return 'Trao đổi & Tìm hiểu thông tin';
}

function detectCurrentStatus(messages: Array<{ sender: string; content: string }>): string {
  if (messages.length === 0) return 'Chưa có tin nhắn';
  const last = messages[messages.length - 1];
  if (last.sender === 'customer') {
    return 'Khách hàng đang chờ nhân viên tư vấn phản hồi';
  }
  return 'Tư vấn viên đã phản hồi, đang chờ tương tác từ khách';
}

function detectSuggestedAction(intent: string, lastSender: string): string {
  if (lastSender === 'customer') {
    if (intent.includes('Hỏi giá')) return 'Gửi báo giá sản phẩm kèm chương trình ưu đãi hiện hành.';
    if (intent.includes('Đặt mua')) return 'Xác nhận thông tin giao hàng và hỗ trợ lên đơn hàng mới.';
    if (intent.includes('Khiếu nại')) return 'Liên hệ trực tiếp hỗ trợ xử lý vấn đề và xoa dịu khách hàng.';
    if (intent.includes('vận chuyển')) return 'Kiểm tra mã vận đơn và thông báo lộ trình đơn hàng.';
    return 'Phản hồi giải đáp thắc mắc và gợi ý sản phẩm phù hợp.';
  }
  return 'Theo dõi phản hồi từ khách hoặc gửi lời nhắc nhẹ sau 2-4 giờ.';
}

/**
 * Generate a concise conversation summary using Dify AI or smart heuristic analysis
 */
export async function generateConversationSummary(params: {
  phone: string;
  customerName?: string;
  messages: Array<{ sender: string; content: string; timestamp?: string }>;
  brandName?: string;
}): Promise<ConversationSummaryResult> {
  const { phone, customerName = 'Khách hàng', messages, brandName } = params;
  const cleanPhone = phone.replace(/\D/g, '') || 'guest_user';

  if (!messages || messages.length === 0) {
    return {
      summary: 'Chưa có dữ liệu hội thoại nào để tóm tắt.',
      intent: 'Chưa xác định',
      currentStatus: 'Chưa có tin nhắn',
      suggestedAction: 'Bắt đầu cuộc trò chuyện với khách hàng',
      source: 'smart_analysis',
    };
  }

  // Use last 20 messages for transcript
  const recentMessages = messages.slice(-20);
  const transcript = recentMessages
    .map((m) => {
      const senderLabel = m.sender === 'customer' ? customerName : 'Tư vấn viên (CRM)';
      return `${senderLabel}: ${m.content.trim()}`;
    })
    .join('\n');

  const intent = detectIntentFromTranscript(transcript);
  const lastSender = recentMessages[recentMessages.length - 1]?.sender || 'customer';
  const currentStatus = detectCurrentStatus(recentMessages);
  const suggestedAction = detectSuggestedAction(intent, lastSender);

  // Try calling Dify AI for LLM summary
  const config = getDifyConfig();
  if (config.enabled && config.apiKey.trim()) {
    try {
      const controller = new AbortController();
      const timeoutTimer = setTimeout(() => controller.abort(), Math.min(config.timeoutMs, 10000));
      const endpoint = `${config.apiUrl}/chat-messages`;
      const prompt = `[BẢN TÓM TẮT HỘI THOẠI CHO TƯ VẤN VIÊN CRM]\nKhách hàng: ${customerName} (${phone})\nHội thoại gần nhất:\n${transcript}\n\nHãy tóm tắt ngắn gọn trong 3 ý rõ ràng:\n1. Nhu cầu/vấn đề chính của khách\n2. Tiến trình trao đổi hiện tại\n3. Đề xuất hành động tiếp theo cho nhân viên`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey.trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: {
            brand_name: resolveBrandName(brandName),
          },
          query: prompt,
          response_mode: 'blocking',
          user: `summary_agent_${cleanPhone}`,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutTimer);

      if (response.ok) {
        const data = (await response.json()) as DifyChatResponse;
        if (data.answer && data.answer.trim().length > 15) {
          return {
            summary: data.answer.trim(),
            intent,
            currentStatus,
            suggestedAction,
            source: 'ai',
          };
        }
      }
    } catch (err) {
      console.warn('[Dify AI Summary] Bỏ qua lỗi Dify, dùng phân tích thông minh:', err);
    }
  }

  // Fallback: Smart heuristic summary
  const lastCustomerMsg = [...recentMessages].reverse().find((m) => m.sender === 'customer')?.content.trim() || 'Không có';
  const fallbackSummary = `• Nhu cầu chính: ${intent}. Câu hỏi gần nhất của khách: "${lastCustomerMsg.slice(0, 80)}${lastCustomerMsg.length > 80 ? '...' : ''}"\n• Trạng thái hiện tại: ${currentStatus}\n• Đề xuất tiếp theo: ${suggestedAction}`;

  return {
    summary: fallbackSummary,
    intent,
    currentStatus,
    suggestedAction,
    source: 'smart_analysis',
  };
}

export interface SuggestedRepliesResult {
  suggestions: string[];
  source: 'ai' | 'smart_suggestions';
}

function buildSmartReplySuggestions(
  lastContent: string,
  countryProfile: PhoneCountryProfile,
  brand: string,
  _customerName: string
): string[] {
  const clean = lastContent.toLowerCase();

  // If Malaysia (+60)
  if (countryProfile.countryCode === '+60') {
    if (/(harga|price|berapa|cost|diskaun|discount|voucher)/i.test(clean)) {
      return [
        `Hai, terima kasih atas pertanyaan anda! Untuk produk ini kami sedang ada promosi istimewa dalam ${countryProfile.currency}. Boleh saya tahu anda mencari saiz atau kuantiti berapa ya?`,
        `Hai! Kami ada senarai harga promosi terkini. Boleh kongsikan lokasi anda untuk semakan penghantaran percuma ya.`,
        `Hai, sebut harga rasmi daripada ${brand} sedia membantu anda. Sila beritahu jika anda perlukan maklumat lanjut ya!`,
      ];
    }
    if (/(pos|hantar|shipping|postage|bila sampai|track|alamat)/i.test(clean)) {
      return [
        `Hai! Penghantaran ke seluruh Malaysia biasanya mengambil masa 2-4 hari bekerja. Boleh kongsikan alamat atau poskod anda ya?`,
        `Hai, setiap pesanan di ${brand} akan dibungkus dengan selamat dan dihantar menggunakan kurier pantas dengan nombor penjejakan (tracking number).`,
      ];
    }
    if (/(order|beli|nak|ambil|tempah)/i.test(clean)) {
      return [
        `Baik, terima kasih! Boleh kongsikan nama penuh, alamat penghantaran dan nombor telefon untuk kami proseskan pesanan anda sekarang ya.`,
        `Kami boleh bantu sediakan pesanan anda dengan segera. Anda boleh pilih bayaran secara pemindahan bank atau COD jika tersedia.`,
      ];
    }
    return [
      `Hai! Terima kasih kerana menghubungi ${brand}. Boleh kami bantu anda hari ini?`,
      `Hai, kami sedia membantu menjawab sebarang pertanyaan anda tentang produk dan perkhidmatan kami!`,
    ];
  }

  // If Singapore (+65) or English
  if (countryProfile.countryCode === '+65' || countryProfile.primaryLanguage === 'English') {
    if (/(price|how much|cost|discount|promo|rate)/i.test(clean)) {
      return [
        `Hello! Thanks for reaching out. We currently have a special promotion. Which package or quantity are you interested in so I can provide the best quote?`,
        `Hi there! Our pricing is very competitive with promotional rates in ${countryProfile.currency}. Where would you like this delivered?`,
        `Hello! I'd be happy to share our official price list and current deals with you.`,
      ];
    }
    if (/(ship|delivery|postage|how long|tracking|address)/i.test(clean)) {
      return [
        `Hi! Standard delivery typically takes 2-4 business days. Could you please share your delivery area or postal code?`,
        `Hello! All parcels from ${brand} are carefully packed and dispatched with tracking provided upon shipment.`,
      ];
    }
    if (/(order|buy|purchase|take this)/i.test(clean)) {
      return [
        `Great! Please kindly share your name, delivery address, and contact number so we can process your order right away.`,
        `Thank you for your order! We will confirm your order details and invoice shortly.`,
      ];
    }
    return [
      `Hello! Thank you for contacting ${brand}. How may we assist you today?`,
      `Hi there! Let us know if you have any questions regarding our products or shipping.`,
    ];
  }

  // Vietnam / Default Tiếng Việt (+84 or domestic)
  if (/(giá|bao nhiêu|nhiêu tiền|báo giá|chi phí|khuyến mãi|giảm giá|voucher|discount|ưu đãi)/i.test(clean)) {
    return [
      `Dạ em chào anh/chị ạ! Giá sản phẩm bên em hiện đang có chương trình ưu đãi rất tốt. Anh/chị đang quan tâm đến mẫu nào hay số lượng bao nhiêu để em báo giá chi tiết nhất ạ?`,
      `Dạ em gửi anh/chị bảng giá và các chương trình khuyến mãi đang áp dụng trong tháng này ạ. Anh/chị cần ship về khu vực nào để em kiểm tra ưu đãi freeship cho mình nhé ạ!`,
      `Dạ em chào anh/chị, bên em có sẵn hàng ạ. Anh/chị xem qua mẫu này và báo em để em hỗ trợ giữ suất ưu đãi kèm quà tặng cho mình nhé ạ!`,
    ];
  }

  if (/(ship|giao hàng|vận chuyển|phí ship|khi nào tới|bao lâu|địa chỉ|nhận hàng|vận đơn|tra mã)/i.test(clean)) {
    return [
      `Dạ bên em có hỗ trợ giao hàng tận nơi trên toàn quốc và quốc tế, thời gian nhận hàng dự kiến từ 2-4 ngày làm việc tuỳ khu vực ạ.`,
      `Dạ anh/chị cho em xin địa chỉ nhận hàng cụ thể để em kiểm tra và báo phí ship chính xác kèm ưu đãi hỗ trợ cước vận chuyển cho mình nhé ạ!`,
      `Dạ đơn hàng của mình sẽ được đóng gói cẩn thận và gửi qua đơn vị chuyển phát nhanh uy tín, có mã vận đơn để mình tiện theo dõi hành trình ạ.`,
    ];
  }

  if (/(đặt|mua|chốt|order|lấy|mua hàng|đặt hàng|gửi đơn|lên đơn|cho 1|cho 2|cho mình)/i.test(clean)) {
    return [
      `Dạ vâng ạ, em đã ghi nhận thông tin sản phẩm. Anh/chị cho em xin họ tên, số điện thoại và địa chỉ nhận hàng để em lên đơn ngay cho mình nhé ạ!`,
      `Dạ em xác nhận đơn cho mình ạ. Bên em có hỗ trợ thanh toán khi nhận hàng (COD) hoặc chuyển khoản, anh/chị tiện hình thức nào để em chuẩn bị ạ?`,
      `Dạ em lên đơn cho anh/chị ngay ạ, hàng sẽ được đóng gói và bàn giao bên vận chuyển trong hôm nay luôn nhé ạ!`,
    ];
  }

  if (/(lỗi|hỏng|bể|vỡ|sai|đổi|trả|bảo hành|khiếu nại|hoàn tiền|chưa nhận|lâu quá)/i.test(clean)) {
    return [
      `Dạ em chào anh/chị, ${brand} rất xin lỗi vì sự bất tiện này ạ! Anh/chị cho em xin hình ảnh hoặc thông tin chi tiết để em kiểm tra và hỗ trợ xử lý ngay cho mình nhé ạ.`,
      `Dạ anh/chị hoàn toàn yên tâm ạ, bên em có chính sách bảo hành và đổi trả tận nơi. Em sẽ kiểm tra tình trạng đơn và giải quyết thỏa đáng ngay cho mình ạ!`,
    ];
  }

  if (/(cảm ơn|cam on|thanks|thank you|cám ơn|\b(ok|oke)\b)/i.test(clean)) {
    return [
      `Dạ vâng ạ, ${brand} cảm ơn anh/chị rất nhiều! Cần hỗ trợ thêm bất cứ thông tin gì anh/chị cứ nhắn em nhé ạ.`,
      `Dạ chúc anh/chị một ngày thật nhiều niềm vui! Em luôn sẵn sàng hỗ trợ mình bất cứ lúc nào ạ.`,
    ];
  }

  if (/(chào|hello|\bhi\b|\balo\b|shop ơi|ad ơi|bạn ơi|có đó ko|tư vấn)/i.test(clean)) {
    return [
      `Dạ em chào anh/chị ạ! Rất vui được hỗ trợ anh/chị, mình đang cần tư vấn sản phẩm hay dịch vụ nào của ${brand} ạ?`,
      `Dạ em chào anh/chị, chúc anh/chị một ngày tốt lành! Anh/chị cần em hỗ trợ thông tin gì cứ nhắn em nhé ạ.`,
      `Dạ em chào anh/chị! Hôm nay bên em đang có nhiều chương trình ưu đãi hấp dẫn, anh/chị quan tâm dòng nào để em tư vấn chi tiết ạ?`,
    ];
  }

  // Fallback generic
  return [
    `Dạ em chào anh/chị, em đã nhận được tin nhắn. Anh/chị cần em tư vấn thêm thông tin nào cứ nhắn em nhé ạ!`,
    `Dạ vâng ạ, ${brand} luôn sẵn sàng hỗ trợ anh/chị. Mình còn thắc mắc gì về sản phẩm hay chính sách giao hàng không ạ?`,
  ];
}

/**
 * Generate 2-3 suggested replies for CRM agents based on customer context
 */
export async function generateReplySuggestions(params: {
  phone: string;
  customerName?: string;
  messages: Array<{ sender: string; content: string; timestamp?: string }>;
  brandName?: string;
}): Promise<SuggestedRepliesResult> {
  const { phone, customerName = 'Khách hàng', messages, brandName } = params;
  const cleanPhone = phone.replace(/\D/g, '') || 'guest_user';
  const brand = resolveBrandName(brandName);
  const countryProfile = detectCustomerCountryProfile(phone);

  if (!messages || messages.length === 0) {
    return {
      suggestions: [
        `Dạ em chào anh/chị ạ! Rất vui được hỗ trợ anh/chị, mình đang quan tâm đến sản phẩm nào của ${brand} ạ?`,
      ],
      source: 'smart_suggestions',
    };
  }

  // Find the latest message from customer
  const lastCustomerMsg = [...messages].reverse().find((m) => m.sender === 'customer');
  const lastContent = lastCustomerMsg ? lastCustomerMsg.content.trim() : '';

  // Generate fallback smart suggestions first
  const smartSuggestions = buildSmartReplySuggestions(lastContent, countryProfile, brand, customerName);

  // If Dify is enabled, try AI generation
  const config = getDifyConfig();
  if (config.enabled && config.apiKey.trim() && lastContent) {
    try {
      const controller = new AbortController();
      const timeoutTimer = setTimeout(() => controller.abort(), Math.min(config.timeoutMs, 6000));
      const endpoint = `${config.apiUrl}/chat-messages`;

      const recentMessages = messages.slice(-10);
      const transcript = recentMessages
        .map((m) => {
          const senderLabel = m.sender === 'customer' ? customerName : 'Tư vấn viên';
          return `${senderLabel}: ${m.content.trim()}`;
        })
        .join('\n');

      const prompt = `[GỢI Ý PHẢN HỒI TIN NHẮN CHO TƯ VẤN VIÊN CRM]\nThương hiệu: ${brand}\nKhách hàng: ${customerName} (${countryProfile.countryName}, ${countryProfile.primaryLanguage})\nTin nhắn mới nhất từ khách: "${lastContent}"\n\nHội thoại gần đây:\n${transcript}\n\nHãy gợi ý đúng 2 đến 3 câu phản hồi ngắn gọn, tự nhiên, lịch sự nhất để nhân viên tư vấn gửi lại khách hàng.\nYêu cầu:\n- Trả về 2-3 dòng, mỗi dòng bắt đầu bằng 1., 2., 3.\n- Ngôn ngữ: ${countryProfile.primaryLanguage}\n- Không viết thêm bất kỳ lời dẫn giải hay giải thích nào khác.`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey.trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: {
            brand_name: brand,
          },
          query: prompt,
          response_mode: 'blocking',
          user: `suggest_agent_${cleanPhone}`,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutTimer);

      if (response.ok) {
        const data = (await response.json()) as DifyChatResponse;
        if (data.answer && data.answer.trim().length > 10) {
          const rawLines = data.answer.split('\n');
          const aiSuggestions = rawLines
            .map((line) => line.replace(/^(\d+[.)]|[-•*])\s*/, '').trim())
            .filter((line) => line.length >= 8 && !/^(chào bạn|dưới đây là|đây là gợi ý)/i.test(line));

          if (aiSuggestions.length > 0) {
            const merged = [...aiSuggestions];
            for (const s of smartSuggestions) {
              if (merged.length < 3 && !merged.includes(s)) {
                merged.push(s);
              }
            }
            return {
              suggestions: merged.slice(0, 3),
              source: 'ai',
            };
          }
        }
      }
    } catch (err) {
      console.warn('[Dify AI Suggest Reply] Bỏ qua lỗi Dify, dùng gợi ý thông minh:', err);
    }
  }

  return {
    suggestions: smartSuggestions.slice(0, 3),
    source: 'smart_suggestions',
  };
}
