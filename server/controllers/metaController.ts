import type { Request, Response } from 'express';
import {
  getIntegrationSetting,
  getMetaAccessToken,
  updateIntegrationSetting,
  resolvePhoneNumberId,
  ensureWabaSubscribed,
  fetchWabaPhoneNumbers,
  fetchWhatsAppBusinessProfile,
  dispatchMetaMessage
} from '../services/metaApiClient';
import { encryptMetaToken } from '../services/metaTokenCrypto';
import type { InMemoryMessage } from '../services/messageStore';
import { messageStore } from '../services/messageStore';
import { verifyWebhookChallenge, processWebhookPayload } from '../services/webhookService';
import { prisma } from '../lib/prisma';
import fs from 'fs';
import path from 'path';

/**
 * Read current integration configuration
 */
export async function getConfig(req: Request, res: Response) {
  try {
    const setting = await getIntegrationSetting();
    const effectivePhoneId = await resolvePhoneNumberId(setting);

    const accessToken = await getMetaAccessToken(setting);
    const maskedToken = accessToken
      ? `${accessToken.substring(0, 8)}...${accessToken.substring(accessToken.length - 6)}`
      : '';

    return res.json({
      id: setting.id,
      whatsappPhoneNumberId: effectivePhoneId || '',
      whatsappWabaId: setting.whatsappWabaId || '',
      whatsappVerifyToken: setting.whatsappVerifyToken || 'YUMNETWORK_CRM_META_VERIFY_TOKEN_2026',
      whatsappAppId: setting.whatsappAppId || '',
      status: setting.status,
      lastConnectedAt: setting.lastConnectedAt,
      hasAccessToken: Boolean(accessToken),
      maskedAccessToken: maskedToken,
      embeddedSignup: {
        appId: process.env.META_APP_ID?.trim() || process.env.WHATSAPP_APP_ID?.trim() || '',
        configurationId: process.env.META_EMBEDDED_SIGNUP_CONFIG_ID?.trim() || '',
        graphVersion: process.env.META_GRAPH_VERSION?.trim() || 'v26.0',
      },
      appUrl: process.env.APP_URL || '',
      webhookUrl: `${(process.env.APP_URL || '').replace(/\/$/, '')}/webhook`,
      updatedAt: setting.updatedAt
    });
  } catch (error) {
    console.error('Lỗi khi đọc cấu hình Meta Integration:', error);
    return res.status(500).json({ error: 'Lỗi khi lấy cấu hình tích hợp Meta' });
  }
}

/**
 * Finish Facebook Login for Business by exchanging its one-time code server-side.
 * WABA and phone IDs from the browser are verified against the returned token.
 */
export async function completeEmbeddedSignup(req: Request, res: Response) {
  const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
  const providedAccessToken = typeof req.body?.accessToken === 'string' ? req.body.accessToken.trim() : '';
  const wabaId = typeof req.body?.wabaId === 'string' ? req.body.wabaId.trim() : '';
  const phoneNumberId = typeof req.body?.phoneNumberId === 'string' ? req.body.phoneNumberId.trim() : '';
  const businessId = typeof req.body?.businessId === 'string' ? req.body.businessId.trim() : '';

  if (
    (!code && !providedAccessToken)
    || code.length > 4_096
    || providedAccessToken.length > 8_192
    || !/^\d+$/.test(wabaId)
    || !/^\d+$/.test(phoneNumberId)
  ) {
    return res.status(400).json({ error: 'Kết quả Embedded Signup không đầy đủ hoặc không hợp lệ.' });
  }
  if (businessId && !/^\d+$/.test(businessId)) {
    return res.status(400).json({ error: 'Meta Business ID không hợp lệ.' });
  }

  const appId = process.env.META_APP_ID?.trim() || process.env.WHATSAPP_APP_ID?.trim() || '';
  const appSecret = process.env.META_APP_SECRET?.trim() || process.env.WHATSAPP_APP_SECRET?.trim() || '';
  const graphVersion = process.env.META_GRAPH_VERSION?.trim() || 'v26.0';
  if (!appId || !appSecret) {
    return res.status(503).json({ error: 'Backend chưa cấu hình META_APP_ID và META_APP_SECRET.' });
  }

  try {
    let accessToken = providedAccessToken;
    let expiresIn = 0;
    if (!accessToken) {
      const exchangeQuery = new URLSearchParams({ client_id: appId, client_secret: appSecret, code });
      const exchangeResponse = await fetch(
        `https://graph.facebook.com/${graphVersion}/oauth/access_token?${exchangeQuery.toString()}`,
        { signal: AbortSignal.timeout(15_000) },
      );
      const exchangeResult: any = await exchangeResponse.json().catch(() => ({}));
      accessToken = typeof exchangeResult?.access_token === 'string' ? exchangeResult.access_token.trim() : '';
      expiresIn = Number(exchangeResult?.expires_in);
      if (!exchangeResponse.ok || !accessToken) {
        return res.status(502).json({
          error: exchangeResult?.error?.message || 'Meta không thể đổi authorization code thành access token.',
        });
      }
    }

    const phoneNumbers = await fetchWabaPhoneNumbers(wabaId, accessToken);
    const selectedPhone = phoneNumbers.find((phone: any) => String(phone?.id || '') === phoneNumberId);
    if (!selectedPhone) {
      return res.status(403).json({ error: 'Phone Number ID không thuộc WABA mà Meta vừa cấp quyền.' });
    }

    const subscribed = await ensureWabaSubscribed(wabaId, accessToken);
    if (!subscribed) {
      return res.status(502).json({ error: 'Đã nhận quyền WABA nhưng chưa thể đăng ký webhook cho tài khoản này.' });
    }

    const tokenExpiresAt = Number.isFinite(expiresIn) && expiresIn > 0
      ? new Date(Date.now() + expiresIn * 1_000)
      : null;
    const now = new Date();
    await updateIntegrationSetting({
      whatsappPhoneNumberId: phoneNumberId,
      whatsappWabaId: wabaId,
      metaBusinessId: businessId || null,
      whatsappAppId: appId,
      whatsappAccessTokenEncrypted: encryptMetaToken(accessToken),
      whatsappTokenExpiresAt: tokenExpiresAt,
      status: 'connected',
      lastConnectedAt: now,
    }, { requirePersistence: true });

    return res.json({
      success: true,
      status: 'connected',
      wabaId,
      phoneNumberId,
      businessId: businessId || null,
      displayPhoneNumber: selectedPhone.display_phone_number || '',
      verifiedName: selectedPhone.verified_name || '',
      lastConnectedAt: now,
    });
  } catch (error: any) {
    console.error('[META EMBEDDED SIGNUP] Không thể hoàn tất kết nối:', error?.message || error);
    return res.status(502).json({ error: error?.message || 'Không thể hoàn tất Embedded Signup với Meta.' });
  }
}

/**
 * Save or update integration configuration
 */
export async function saveConfig(req: Request, res: Response) {
  try {
    const {
      whatsappPhoneNumberId,
      whatsappWabaId,
      whatsappVerifyToken,
      whatsappAppId
    } = req.body;

    const existing = await getIntegrationSetting();

    const accessToken = await getMetaAccessToken(existing);

    const finalPhoneId = whatsappPhoneNumberId !== undefined ? whatsappPhoneNumberId.trim() : existing.whatsappPhoneNumberId;
    const isFullyConfigured = Boolean(accessToken && finalPhoneId);
    const newStatus = isFullyConfigured ? 'connected' : (existing.status || 'disconnected');
    const newLastConnected = isFullyConfigured ? (existing.lastConnectedAt || new Date()) : existing.lastConnectedAt;

    const updateData = {
      whatsappPhoneNumberId: finalPhoneId,
      whatsappWabaId: whatsappWabaId !== undefined ? whatsappWabaId.trim() : existing.whatsappWabaId,
      whatsappVerifyToken: (whatsappVerifyToken && whatsappVerifyToken.trim().length > 0) ? whatsappVerifyToken.trim() : existing.whatsappVerifyToken,
      whatsappAppId: whatsappAppId !== undefined ? whatsappAppId.trim() : existing.whatsappAppId,
      status: newStatus,
      lastConnectedAt: newLastConnected
    };

    const updated = await updateIntegrationSetting(updateData);

    if (updated.whatsappWabaId && accessToken) {
      ensureWabaSubscribed(updated.whatsappWabaId, accessToken).catch(() => {});
    }

    return res.json({
      message: 'Cập nhật cấu hình tích hợp thành công! (Đã tự động kích hoạt Webhook nhận tin)',
      status: updated.status,
      whatsappPhoneNumberId: updated.whatsappPhoneNumberId,
      whatsappWabaId: updated.whatsappWabaId,
      whatsappVerifyToken: updated.whatsappVerifyToken,
      hasAccessToken: Boolean(accessToken),
      lastConnectedAt: updated.lastConnectedAt
    });
  } catch (error) {
    console.error('Lỗi khi lưu cấu hình Meta Integration:', error);
    return res.status(500).json({ error: 'Không thể lưu cấu hình tích hợp Meta' });
  }
}

const AVATAR_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 1 ngày (24 giờ) cho avatar

async function getOrUpdateWabaAvatar(phoneId: string, token: string, forceRefresh = false): Promise<string | undefined> {
  const uploadsDir = path.resolve(process.cwd(), 'public/uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  const filename = `waba_avatar_${phoneId}.jpg`;
  const filePath = path.join(uploadsDir, filename);

  const now = Date.now();
  // 1. Kiểm tra cache file avatar trên đĩa: nếu đã tải và trong vòng 24h thì dùng ngay (0ms)
  if (!forceRefresh && fs.existsSync(filePath)) {
    try {
      const stat = fs.statSync(filePath);
      if (now - stat.mtimeMs < AVATAR_CACHE_TTL_MS && stat.size > 0) {
        return `/uploads/${filename}`;
      }
    } catch {
      // Bỏ qua lỗi stat
    }
  }

  // 2. Nếu chưa có hoặc file đã quá 1 ngày (24h): gọi Meta để lấy profile và tải avatar mới về
  try {
    const profile = await fetchWhatsAppBusinessProfile(phoneId, token);
    if (profile?.profile_picture_url) {
      const res = await fetch(profile.profile_picture_url, { signal: AbortSignal.timeout(10_000) });
      if (res.ok) {
        const buffer = Buffer.from(await res.arrayBuffer());
        fs.writeFileSync(filePath, buffer);
        return `/uploads/${filename}`;
      }
    }
  } catch (err) {
    console.warn(`[WABA Avatar] Lỗi khi cập nhật avatar cho ${phoneId}:`, err);
  }

  if (fs.existsSync(filePath)) {
    return `/uploads/${filename}`;
  }
  return undefined;
}

/**
 * Fetch all phone numbers associated with WABA ID
 * (Danh sách số điện thoại KHÔNG lưu cache, luôn lấy danh sách mới nhất từ Meta.
 *  Chỉ lưu cache avatar của từng số về máy và update 1 ngày 1 lần.)
 */
export async function fetchPhoneNumbers(req: Request, res: Response) {
  try {
    const { wabaId: inputWabaId, forceRefreshAvatar } = req.body;

    const setting = await getIntegrationSetting();
    const wabaId = (inputWabaId && inputWabaId.trim().length > 0) ? inputWabaId.trim() : setting.whatsappWabaId;
    const token = await getMetaAccessToken(setting);

    if (!wabaId) {
      return res.status(400).json({ error: 'Vui lòng nhập WhatsApp Business Account ID (WABA ID).' });
    }
    if (!token) {
      return res.status(400).json({ error: 'Vui lòng nhập Permanent Access Token từ Meta.' });
    }

    // LUÔN gọi Meta để lấy danh sách số điện thoại mới nhất (KHÔNG lưu cache danh sách số)
    const phoneNumbers = await fetchWabaPhoneNumbers(wabaId, token);
    const phoneNumbersWithProfiles = await Promise.all(
      phoneNumbers.map(async (phone: any) => {
        // Chỉ avatar được lưu về máy và cache 1 ngày 1 lần
        const avatarUrl = await getOrUpdateWabaAvatar(phone.id, token, Boolean(forceRefreshAvatar));

        return {
          id: phone.id,
          verifiedName: phone.verified_name || phone.display_phone_number || 'Chưa đặt tên',
          displayPhoneNumber: phone.display_phone_number || phone.id,
          profilePictureUrl: avatarUrl,
          qualityRating: phone.quality_rating || 'UNKNOWN',
          codeVerificationStatus: phone.code_verification_status || 'VERIFIED',
        };
      }),
    );

    return res.json({
      success: true,
      count: phoneNumbersWithProfiles.length,
      phoneNumbers: phoneNumbersWithProfiles,
    });
  } catch (error: any) {
    console.error('Fetch Phone Numbers Exception:', error);
    return res.status(500).json({ success: false, error: error.message || 'Lỗi hệ thống khi tải danh sách số điện thoại.' });
  }
}

/** Read-only phone list for authenticated messaging users. */
export async function getBusinessPhones(req: Request, res: Response) {
  try {
    const setting = await getIntegrationSetting();
    const wabaId = setting.whatsappWabaId?.trim() || '';
    const token = await getMetaAccessToken(setting);
    if (!wabaId || !token) {
      return res.json({ success: true, phoneNumbers: [], selectedPhoneNumberId: '' });
    }

    const phoneNumbers = await fetchWabaPhoneNumbers(wabaId, token);
    const normalized = await Promise.all(phoneNumbers.map(async (phone: any) => ({
      id: String(phone.id),
      verifiedName: phone.verified_name || phone.display_phone_number || 'WhatsApp Business',
      displayPhoneNumber: phone.display_phone_number || String(phone.id),
      profilePictureUrl: await getOrUpdateWabaAvatar(String(phone.id), token),
      qualityRating: phone.quality_rating || 'UNKNOWN',
      codeVerificationStatus: phone.code_verification_status || 'VERIFIED',
    })));

    return res.json({
      success: true,
      phoneNumbers: normalized,
      selectedPhoneNumberId: setting.whatsappPhoneNumberId || normalized[0]?.id || '',
    });
  } catch (error: any) {
    console.error('[META BUSINESS PHONES]', error?.message || error);
    return res.status(502).json({ error: error?.message || 'Không thể tải số WhatsApp Business từ Meta.' });
  }
}

/**
 * Test WhatsApp Cloud API connection by sending a message
 */
export async function testConnection(req: Request, res: Response) {
  try {
    const { recipientPhone, messageText, phoneNumberId: overridePhoneId } = req.body;

    const setting = await getIntegrationSetting();
    const phoneId = overridePhoneId || (await resolvePhoneNumberId(setting));
    const token = await getMetaAccessToken(setting);

    if (!phoneId) {
      return res.status(400).json({ error: 'Chưa cấu hình Phone Number ID. Vui lòng nhập Phone Number ID trước khi test.' });
    }
    if (!token) {
      return res.status(400).json({ error: 'Chưa cấu hình Access Token. Vui lòng nhập Permanent Token từ Meta.' });
    }
    if (!recipientPhone) {
      return res.status(400).json({ error: 'Vui lòng nhập số điện thoại người nhận thử nghiệm (ví dụ: 84901234567).' });
    }

    let cleanPhone = recipientPhone.replace(/\D/g, '');
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '84' + cleanPhone.substring(1);
    }

    const testContent = messageText || `[YumNetwork CRM Test] Xin chào! Kết nối WhatsApp Cloud API thành công vào lúc ${new Date().toLocaleString('vi-VN')}!`;

    const { isRealSent, metaResult } = await dispatchMetaMessage({
      phoneId,
      token,
      cleanPhone,
      content: testContent
    });

    if (!isRealSent) {
      await updateIntegrationSetting({ status: 'error' });
      return res.status(400).json({
        success: false,
        error: metaResult?.error?.message || 'Kết nối Meta WhatsApp thất bại.',
        details: metaResult
      });
    }

    const now = new Date();
    await updateIntegrationSetting({ status: 'connected', lastConnectedAt: now });

    const testMsgId = metaResult?.messages?.[0]?.id || `msg_test_${Date.now()}`;
    const testMsgRecord: InMemoryMessage = {
      id: testMsgId,
      customerId: `cust_${cleanPhone}`,
      customerName: `Khách WhatsApp (${cleanPhone})`,
      customerPhone: recipientPhone,
      sender: 'agent',
      agentName: 'Hệ Thống CRM (Test)',
      channel: 'WhatsApp',
      content: testContent,
      timestamp: now.toISOString(),
      isRead: true,
      isRealSent: true
    };

    messageStore.add(testMsgRecord);

    try {
      await prisma.whatsAppMessage.create({
        data: {
          id: testMsgRecord.id,
          customerName: testMsgRecord.customerName || `Khách WhatsApp (${cleanPhone})`,
          customerPhone: testMsgRecord.customerPhone || recipientPhone,
          sender: testMsgRecord.sender,
          agentName: testMsgRecord.agentName,
          channel: testMsgRecord.channel,
          content: testMsgRecord.content,
          isRead: testMsgRecord.isRead,
          isRealSent: testMsgRecord.isRealSent,
          timestamp: now
        }
      });
    } catch (dbErr) {}

    return res.json({
      success: true,
      message: 'Kết nối WhatsApp Cloud API thành công! Tin nhắn thử nghiệm đã được gửi.',
      metaResponse: metaResult,
      lastConnectedAt: now
    });
  } catch (error: any) {
    console.error('Test Connection Exception:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Lỗi không xác định khi kiểm tra kết nối WhatsApp API'
    });
  }
}

/**
 * Meta User Data Deletion Callback
 */
export function handleDataDeletion(req: Request, res: Response) {
  try {
    const confirmationCode = `YUM_DEL_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
    const domain = `${req.protocol}://${req.get('host')}`;
    const statusUrl = `${domain}/#data-deletion?code=${confirmationCode}`;

    return res.json({
      url: statusUrl,
      confirmation_code: confirmationCode
    });
  } catch (error) {
    console.error('Meta Data Deletion Callback Error:', error);
    return res.status(500).json({ error: 'Failed to process data deletion callback' });
  }
}

/**
 * Meta Webhook Verification (GET)
 */
export async function handleWebhookGet(req: Request, res: Response) {
  const result = await verifyWebhookChallenge(req.query);
  if (result.isValid && result.challenge) {
    return res.status(200).send(result.challenge);
  }
  return res.status(403).send('Webhook Verification Failed: Invalid Token or Mode');
}

/**
 * Meta Webhook Event Handler (POST)
 */
export async function handleWebhookPost(req: Request, res: Response) {
  await processWebhookPayload(req.body);
  return res.status(200).send('EVENT_RECEIVED');
}
