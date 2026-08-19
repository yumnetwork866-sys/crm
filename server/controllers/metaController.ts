import type { Request, Response } from 'express';
import {
  getIntegrationSetting,
  updateIntegrationSetting,
  resolvePhoneNumberId,
  ensureWabaSubscribed,
  fetchWabaPhoneNumbers,
  dispatchMetaMessage
} from '../services/metaApiClient';
import type { InMemoryMessage } from '../services/messageStore';
import { messageStore } from '../services/messageStore';
import { verifyWebhookChallenge, processWebhookPayload } from '../services/webhookService';
import { prisma } from '../lib/prisma';

/**
 * Read current integration configuration
 */
export async function getConfig(req: Request, res: Response) {
  try {
    const setting = await getIntegrationSetting();
    const effectivePhoneId = await resolvePhoneNumberId(setting);

    const maskedToken = setting.whatsappAccessToken
      ? `${setting.whatsappAccessToken.substring(0, 8)}...${setting.whatsappAccessToken.substring(setting.whatsappAccessToken.length - 6)}`
      : '';

    return res.json({
      id: setting.id,
      whatsappPhoneNumberId: effectivePhoneId || '',
      whatsappWabaId: setting.whatsappWabaId || '',
      whatsappVerifyToken: setting.whatsappVerifyToken || 'YUMNETWORK_CRM_META_VERIFY_TOKEN_2026',
      whatsappAppId: setting.whatsappAppId || '',
      whatsappAppSecret: setting.whatsappAppSecret || '',
      status: setting.status,
      lastConnectedAt: setting.lastConnectedAt,
      hasAccessToken: Boolean(setting.whatsappAccessToken && setting.whatsappAccessToken.trim().length > 0),
      maskedAccessToken: maskedToken,
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
 * Save or update integration configuration
 */
export async function saveConfig(req: Request, res: Response) {
  try {
    const {
      whatsappPhoneNumberId,
      whatsappWabaId,
      whatsappAccessToken,
      whatsappVerifyToken,
      whatsappAppId,
      whatsappAppSecret
    } = req.body;

    const existing = await getIntegrationSetting();

    const newToken = (whatsappAccessToken && whatsappAccessToken.trim().length > 0)
      ? whatsappAccessToken.trim()
      : existing.whatsappAccessToken;

    const finalPhoneId = whatsappPhoneNumberId !== undefined ? whatsappPhoneNumberId.trim() : existing.whatsappPhoneNumberId;
    const isFullyConfigured = Boolean(newToken && finalPhoneId);
    const newStatus = isFullyConfigured ? 'connected' : (existing.status || 'disconnected');
    const newLastConnected = isFullyConfigured ? (existing.lastConnectedAt || new Date()) : existing.lastConnectedAt;

    const updateData = {
      whatsappPhoneNumberId: finalPhoneId,
      whatsappWabaId: whatsappWabaId !== undefined ? whatsappWabaId.trim() : existing.whatsappWabaId,
      whatsappAccessToken: newToken,
      whatsappVerifyToken: (whatsappVerifyToken && whatsappVerifyToken.trim().length > 0) ? whatsappVerifyToken.trim() : existing.whatsappVerifyToken,
      whatsappAppId: whatsappAppId !== undefined ? whatsappAppId.trim() : existing.whatsappAppId,
      whatsappAppSecret: whatsappAppSecret !== undefined ? whatsappAppSecret.trim() : existing.whatsappAppSecret,
      status: newStatus,
      lastConnectedAt: newLastConnected
    };

    const updated = await updateIntegrationSetting(updateData);

    if (updated.whatsappWabaId && updated.whatsappAccessToken) {
      ensureWabaSubscribed(updated.whatsappWabaId, updated.whatsappAccessToken).catch(() => {});
    }

    return res.json({
      message: 'Cập nhật cấu hình tích hợp thành công! (Đã tự động kích hoạt Webhook nhận tin)',
      status: updated.status,
      whatsappPhoneNumberId: updated.whatsappPhoneNumberId,
      whatsappWabaId: updated.whatsappWabaId,
      whatsappVerifyToken: updated.whatsappVerifyToken,
      hasAccessToken: Boolean(updated.whatsappAccessToken && updated.whatsappAccessToken.trim().length > 0),
      lastConnectedAt: updated.lastConnectedAt
    });
  } catch (error) {
    console.error('Lỗi khi lưu cấu hình Meta Integration:', error);
    return res.status(500).json({ error: 'Không thể lưu cấu hình tích hợp Meta' });
  }
}

/**
 * Fetch all phone numbers associated with WABA ID
 */
export async function fetchPhoneNumbers(req: Request, res: Response) {
  try {
    const { wabaId: inputWabaId, accessToken: inputToken } = req.body;

    const setting = await getIntegrationSetting();
    const wabaId = (inputWabaId && inputWabaId.trim().length > 0) ? inputWabaId.trim() : setting.whatsappWabaId;
    const token = (inputToken && inputToken.trim().length > 0) ? inputToken.trim() : setting.whatsappAccessToken;

    if (!wabaId) {
      return res.status(400).json({ error: 'Vui lòng nhập WhatsApp Business Account ID (WABA ID).' });
    }
    if (!token) {
      return res.status(400).json({ error: 'Vui lòng nhập Permanent Access Token từ Meta.' });
    }

    const phoneNumbers = await fetchWabaPhoneNumbers(wabaId, token);
    return res.json({
      success: true,
      count: phoneNumbers.length,
      phoneNumbers: phoneNumbers.map((p: any) => ({
        id: p.id,
        verifiedName: p.verified_name || p.display_phone_number || 'Chưa đặt tên',
        displayPhoneNumber: p.display_phone_number || p.id,
        qualityRating: p.quality_rating || 'UNKNOWN',
        codeVerificationStatus: p.code_verification_status || 'VERIFIED'
      }))
    });
  } catch (error: any) {
    console.error('Fetch Phone Numbers Exception:', error);
    return res.status(500).json({ success: false, error: error.message || 'Lỗi hệ thống khi tải danh sách số điện thoại.' });
  }
}

/**
 * Test WhatsApp Cloud API connection by sending a message
 */
export async function testConnection(req: Request, res: Response) {
  try {
    const { recipientPhone, messageText, phoneNumberId: overridePhoneId, accessToken: overrideToken } = req.body;

    const setting = await getIntegrationSetting();
    const phoneId = overridePhoneId || (await resolvePhoneNumberId(setting));
    const token = overrideToken || setting.whatsappAccessToken;

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
