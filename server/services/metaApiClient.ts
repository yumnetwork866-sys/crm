import fs from 'fs';
import path from 'path';
import { prisma } from '../lib/prisma';

export interface IntegrationSettingData {
  id: string;
  whatsappVerifyToken: string;
  whatsappPhoneNumberId?: string | null;
  whatsappWabaId?: string | null;
  whatsappAccessToken?: string | null;
  whatsappAppId?: string | null;
  whatsappAppSecret?: string | null;
  status: string;
  lastConnectedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

// In-memory fallback setting store when Database connection (PostgreSQL) is offline or unavailable
let inMemorySetting: IntegrationSettingData = {
  id: 'default',
  whatsappVerifyToken: process.env.META_VERIFY_TOKEN || 'YUMNETWORK_CRM_META_VERIFY_TOKEN_2026',
  whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
  whatsappWabaId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '',
  whatsappAccessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
  whatsappAppId: process.env.WHATSAPP_APP_ID || '',
  whatsappAppSecret: process.env.WHATSAPP_APP_SECRET || '',
  status: process.env.WHATSAPP_ACCESS_TOKEN ? 'connected' : 'disconnected',
  lastConnectedAt: null,
  createdAt: new Date(),
  updatedAt: new Date()
};

/**
 * Retrieve dynamic IntegrationSetting from DB (or fallback in-memory)
 */
export async function getIntegrationSetting(): Promise<IntegrationSettingData> {
  try {
    let setting = await prisma.integrationSetting.findUnique({ where: { id: 'default' } });
    if (!setting) {
      setting = await prisma.integrationSetting.create({
        data: {
          id: 'default',
          whatsappVerifyToken: inMemorySetting.whatsappVerifyToken,
          whatsappPhoneNumberId: inMemorySetting.whatsappPhoneNumberId,
          whatsappWabaId: inMemorySetting.whatsappWabaId,
          whatsappAccessToken: inMemorySetting.whatsappAccessToken,
        }
      });
    }
    // Environment variables take precedence over DB values if provided
    const envWabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID?.trim();
    const envToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
    const envPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
    const envVerifyToken = process.env.META_VERIFY_TOKEN?.trim();
    const envAppId = process.env.WHATSAPP_APP_ID?.trim();
    const envAppSecret = process.env.WHATSAPP_APP_SECRET?.trim();

    const mergedSetting: IntegrationSettingData = {
      ...setting,
      whatsappWabaId: envWabaId || setting.whatsappWabaId || '',
      whatsappAccessToken: envToken || setting.whatsappAccessToken || '',
      whatsappPhoneNumberId: envPhoneId || setting.whatsappPhoneNumberId || '',
      whatsappVerifyToken: envVerifyToken || setting.whatsappVerifyToken || 'YUMNETWORK_CRM_META_VERIFY_TOKEN_2026',
      whatsappAppId: envAppId || setting.whatsappAppId || '',
      whatsappAppSecret: envAppSecret || setting.whatsappAppSecret || '',
      status: (envToken || setting.whatsappAccessToken) ? 'connected' : (setting.status || 'disconnected')
    };
    // Sync in-memory store with DB & env
    inMemorySetting = { ...mergedSetting };
    return mergedSetting;
  } catch (dbError) {
    // If PostgreSQL DB connection fails, use in-memory store gracefully
    return inMemorySetting;
  }
}

/**
 * Update integration settings in DB and memory
 */
export async function updateIntegrationSetting(data: Partial<IntegrationSettingData>): Promise<IntegrationSettingData> {
  try {
    const updated = await prisma.integrationSetting.update({
      where: { id: 'default' },
      data
    });
    inMemorySetting = { ...updated };
    return inMemorySetting;
  } catch (dbErr) {
    inMemorySetting = { ...inMemorySetting, ...data, updatedAt: new Date() };
    return inMemorySetting;
  }
}

/**
 * Automatically resolve Phone Number ID from WABA ID if not explicitly specified
 */
export async function resolvePhoneNumberId(setting: IntegrationSettingData): Promise<string> {
  if (setting.whatsappPhoneNumberId && setting.whatsappPhoneNumberId.trim().length > 0) {
    return setting.whatsappPhoneNumberId.trim();
  }
  const wabaId = setting.whatsappWabaId?.trim();
  const token = setting.whatsappAccessToken?.trim();
  if (!wabaId || !token) {
    return '';
  }

  try {
    const metaApiUrl = `https://graph.facebook.com/v22.0/${wabaId}/phone_numbers`;
    const response = await fetch(metaApiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data: any = await response.json();
      if (Array.isArray(data?.data) && data.data.length > 0) {
        const autoPhoneId = data.data[0].id;
        const autoPhoneDisplay = data.data[0].display_phone_number || autoPhoneId;
        console.log(`✨ [META AUTO-RESOLVE] Tự động lấy Phone Number ID: ${autoPhoneId} (${autoPhoneDisplay}) từ WABA ID ${wabaId}`);
        setting.whatsappPhoneNumberId = autoPhoneId;
        inMemorySetting.whatsappPhoneNumberId = autoPhoneId;
        return autoPhoneId;
      }
    }
  } catch (err: any) {
    console.warn('[META AUTO-RESOLVE] Không thể tự động lấy Phone Number ID:', err.message || err);
  }
  return '';
}

/**
 * Automatically subscribe Meta App to WABA for incoming Webhooks
 */
export async function ensureWabaSubscribed(wabaId: string, token: string): Promise<boolean> {
  if (!wabaId || !token) return false;
  try {
    const res = await fetch(`https://graph.facebook.com/v26.0/${wabaId}/subscribed_apps`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    if (res.ok) {
      console.log(`✅ [META WABA SUBSCRIPTION] App successfully subscribed to WABA ${wabaId} for incoming Webhooks!`);
      return true;
    } else {
      const txt = await res.text();
      console.warn(`⚠️ [META WABA SUBSCRIPTION WARN]`, txt);
    }
  } catch (e: any) {
    console.error(`❌ [META WABA SUBSCRIPTION ERROR]`, e.message || e);
  }
  return false;
}

/**
 * Fetch phone numbers associated with WABA
 */
export async function fetchWabaPhoneNumbers(wabaId: string, token: string) {
  const metaApiUrl = `https://graph.facebook.com/v26.0/${wabaId}/phone_numbers`;

  const response = await fetch(metaApiUrl, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  const text = await response.text();
  let responseData: any = {};
  try {
    responseData = text ? JSON.parse(text) : {};
  } catch (e) {
    responseData = { error: { message: text } };
  }

  if (!response.ok) {
    throw new Error(responseData?.error?.message || responseData?.error?.error_user_msg || `Meta API error HTTP ${response.status}`);
  }

  return responseData.data || [];
}

/**
 * Upload media directly to Meta Graph API for real WhatsApp image dispatch
 */
export async function uploadMediaToMeta(
  phoneId: string,
  token: string,
  buffer: Buffer,
  mimeType: string,
  filename: string
): Promise<string | null> {
  try {
    const formData = new FormData();
    const blob = new Blob([buffer], { type: mimeType });
    formData.append('file', blob, filename);
    formData.append('messaging_product', 'whatsapp');
    formData.append('type', mimeType);

    const res = await fetch(`https://graph.facebook.com/v22.0/${phoneId}/media`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: formData
    });

    const data: any = await res.json().catch(() => ({}));
    if (res.ok && data?.id) {
      console.log(`✅ [META DIRECT MEDIA UPLOAD] Uploaded image to Meta Cloud CDN, Media ID: ${data.id}`);
      return data.id;
    } else {
      console.warn('❌ [META DIRECT MEDIA UPLOAD FAILED]', data);
      return null;
    }
  } catch (err) {
    console.error('❌ [META DIRECT MEDIA UPLOAD ERROR]', err);
    return null;
  }
}

/**
 * Helper to test if image URL is supported by Meta Cloud API
 */
export function isSupportedMetaImage(url: string): boolean {
  if (!url) return false;
  if (url.includes('.svg') || url.includes('/svg') || url.includes('image/svg')) return false;
  return Boolean(url.match(/\.(png|jpg|jpeg|webp)(\?.*)?$/i));
}

/**
 * Dispatch message to Meta WhatsApp Cloud API
 */
export async function dispatchMetaMessage(options: {
  phoneId: string;
  token: string;
  cleanPhone: string;
  content: string;
  contextMessageId?: string;
}): Promise<{ isRealSent: boolean; metaResult: any }> {
  const { phoneId, token, cleanPhone, content, contextMessageId } = options;

  const metaApiUrl = `https://graph.facebook.com/v26.0/${phoneId}/messages`;
  let payload: any;

  if (content.startsWith('http://') || content.startsWith('https://')) {
    const parts = content.split('\n');
    const imgUrl = parts[0];
    const caption = parts.slice(1).join('\n').trim();
    if (isSupportedMetaImage(imgUrl)) {
      payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanPhone,
        type: 'image',
        image: { link: imgUrl, ...(caption ? { caption } : {}) }
      };
    } else {
      payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanPhone,
        type: 'text',
        text: { body: caption ? `${imgUrl}\n${caption}` : imgUrl }
      };
    }
  } else if (content.startsWith('data:image/')) {
    const parts = content.split('\n');
    const dataUrl = parts[0];
    const caption = parts.slice(1).join('\n').trim();

    const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    let uploadedMediaId: string | null = null;
    if (matches && matches.length === 3) {
      const rawMime = matches[1];
      const mimeType = rawMime.includes('png') ? 'image/png' : (rawMime.includes('webp') ? 'image/webp' : 'image/jpeg');
      const buffer = Buffer.from(matches[2], 'base64');
      uploadedMediaId = await uploadMediaToMeta(phoneId, token, buffer, mimeType, `image_${Date.now()}.${mimeType.split('/')[1]}`);
    }

    if (uploadedMediaId) {
      payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanPhone,
        type: 'image',
        image: { id: uploadedMediaId, ...(caption ? { caption } : {}) }
      };
    } else {
      payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanPhone,
        type: 'text',
        text: { body: caption ? `[Hình ảnh] ${caption}` : '📷 [Hình ảnh gửi từ CRM]' }
      };
    }
  } else if (content.startsWith('/uploads/')) {
    const parts = content.split('\n');
    const imgPath = parts[0];
    const caption = parts.slice(1).join('\n').trim();
    const localFilePath = path.resolve(process.cwd(), 'public', imgPath.replace(/^\//, ''));

    let uploadedMediaId: string | null = null;
    if (fs.existsSync(localFilePath)) {
      try {
        const buffer = await fs.promises.readFile(localFilePath);
        const ext = path.extname(localFilePath).toLowerCase();
        const mimeType = ext === '.png' ? 'image/png' : (ext === '.webp' ? 'image/webp' : 'image/jpeg');
        uploadedMediaId = await uploadMediaToMeta(phoneId, token, buffer, mimeType, path.basename(localFilePath));
      } catch (readErr) {
        console.warn('Could not read file from disk for Meta upload:', readErr);
      }
    }

    if (uploadedMediaId) {
      payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanPhone,
        type: 'image',
        image: { id: uploadedMediaId, ...(caption ? { caption } : {}) }
      };
    } else {
      const appUrl = (process.env.APP_URL || '').replace(/\/$/, '');
      if (appUrl && isSupportedMetaImage(imgPath)) {
        payload = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cleanPhone,
          type: 'image',
          image: { link: `${appUrl}${imgPath}`, ...(caption ? { caption } : {}) }
        };
      } else {
        payload = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cleanPhone,
          type: 'text',
          text: { body: caption ? `[Hình ảnh] ${caption}` : '📷 [Hình ảnh gửi từ CRM]' }
        };
      }
    }
  } else {
    const cleanTextForMeta = content.replace(/^\[reply:\{.*?\}\]\n/, '');
    payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanPhone,
      type: 'text',
      text: { body: cleanTextForMeta }
    };
  }

  if (contextMessageId && (contextMessageId.startsWith('wamid.') || contextMessageId.length > 15)) {
    payload.context = { message_id: contextMessageId };
  }

  const apiRes = await fetch(metaApiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const resText = await apiRes.text();
  let metaResult: any = {};
  try {
    metaResult = resText ? JSON.parse(resText) : {};
  } catch {
    metaResult = { error: { message: resText } };
  }

  const isRealSent = Boolean(apiRes.ok && metaResult?.messages?.[0]?.id);
  if (isRealSent) {
    console.log(`[REAL WHATSAPP SENT] Message ID ${metaResult.messages[0].id} to ${cleanPhone}`);
  } else {
    console.warn('[REAL WHATSAPP API WARN]', metaResult);
  }

  return { isRealSent, metaResult };
}

/**
 * Dispatch reaction to Meta WhatsApp Cloud API
 */
export async function dispatchMetaReaction(options: {
  phoneId: string;
  token: string;
  cleanPhone: string;
  messageId: string;
  emoji: string;
}): Promise<{ isRealSent: boolean; metaResult: any }> {
  const { phoneId, token, cleanPhone, messageId, emoji } = options;

  const isRealWamid = messageId.startsWith('wamid.') || messageId.length > 20;
  if (!isRealWamid) {
    return { isRealSent: false, metaResult: null };
  }

  const metaApiUrl = `https://graph.facebook.com/v22.0/${phoneId}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: cleanPhone,
    type: 'reaction',
    reaction: {
      message_id: messageId,
      emoji: emoji || ''
    }
  };

  const apiRes = await fetch(metaApiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const resText = await apiRes.text();
  let metaResult: any = {};
  try {
    metaResult = JSON.parse(resText);
  } catch {
    metaResult = { error: { message: resText } };
  }

  const isRealSent = Boolean(apiRes.ok && metaResult?.messages?.[0]?.id);
  return { isRealSent, metaResult };
}

/**
 * Fetch media from Meta CDN, cache to disk, and return file buffer + mimeType
 */
export async function fetchAndCacheMetaMedia(mediaId: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  const chatDir = path.resolve(process.cwd(), 'public/uploads/chat');
  if (!fs.existsSync(chatDir)) {
    fs.mkdirSync(chatDir, { recursive: true });
  }

  // 1. Check disk cache
  const potentialExtensions = ['jpg', 'png', 'webp', 'jpeg'];
  for (const ext of potentialExtensions) {
    const cachedPath = path.join(chatDir, `meta_${mediaId}.${ext}`);
    if (fs.existsSync(cachedPath)) {
      const mimeType = ext === 'png' ? 'image/png' : (ext === 'webp' ? 'image/webp' : 'image/jpeg');
      const buffer = await fs.promises.readFile(cachedPath);
      return { buffer, contentType: mimeType };
    }
  }

  // 2. Query Meta API
  const setting = await getIntegrationSetting();
  const token = setting.whatsappAccessToken?.trim() || process.env.WHATSAPP_ACCESS_TOKEN?.trim() || process.env.META_ACCESS_TOKEN?.trim() || '';

  if (!token) {
    throw new Error('Meta Access Token not configured');
  }

  const metaMediaRes = await fetch(`https://graph.facebook.com/v22.0/${mediaId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!metaMediaRes.ok) {
    const errText = await metaMediaRes.text().catch(() => '');
    console.warn(`❌ [META MEDIA PROXY METADATA FAILED] Media ID: ${mediaId}, status: ${metaMediaRes.status}`, errText);
    return null;
  }

  const metaMediaData: any = await metaMediaRes.json();
  const downloadUrl = metaMediaData?.url;

  if (!downloadUrl) {
    return null;
  }

  // 3. Download binary
  const binaryRes = await fetch(downloadUrl, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!binaryRes.ok) {
    return null;
  }

  const contentType = binaryRes.headers.get('content-type') || metaMediaData?.mime_type || 'image/jpeg';
  const buffer = Buffer.from(await binaryRes.arrayBuffer());

  // 4. Save to disk cache
  let ext = 'jpg';
  if (contentType.includes('png')) ext = 'png';
  else if (contentType.includes('webp')) ext = 'webp';
  const diskPath = path.join(chatDir, `meta_${mediaId}.${ext}`);
  await fs.promises.writeFile(diskPath, buffer).catch((err) => {
    console.warn('Could not write cache file to disk:', err);
  });

  return { buffer, contentType };
}
