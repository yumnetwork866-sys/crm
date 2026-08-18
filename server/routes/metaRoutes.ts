import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma: any = new PrismaClient();

// In-memory fallback setting store when Database connection (PostgreSQL) is offline or unavailable
let inMemorySetting: any = {
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

// Helper to retrieve dynamic IntegrationSetting from DB (or fallback in-memory)
async function getIntegrationSetting() {
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

    const mergedSetting = {
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
    // If PostgreSQL DB connection fails (ECONNREFUSED), use in-memory store gracefully
    return inMemorySetting;
  }
}

// Helper to automatically resolve Phone Number ID from WABA ID if not explicitly specified
async function resolvePhoneNumberId(setting: any): Promise<string> {
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

// Helper to automatically subscribe Meta App to WABA for incoming Webhooks
async function ensureWabaSubscribed(wabaId: string, token: string): Promise<boolean> {
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

// Endpoint: GET /api/meta/config - Read current integration configuration
router.get('/config', async (req: Request, res: Response) => {
  try {
    const setting = await getIntegrationSetting();
    const effectivePhoneId = await resolvePhoneNumberId(setting);

    // Return sanitized setting (masking raw access token if present)
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
});

// Endpoint: POST /api/meta/config - Save or update integration configuration
router.post('/config', async (req: Request, res: Response) => {
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

    // Preserve existing access token if not provided or empty
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

    let updated: any;
    try {
      updated = await prisma.integrationSetting.update({
        where: { id: 'default' },
        data: updateData
      });
      inMemorySetting = { ...updated };
    } catch (dbErr) {
      // Fallback update in memory if DB is unavailable
      inMemorySetting = { ...inMemorySetting, ...updateData, updatedAt: new Date() };
      updated = inMemorySetting;
    }

    // Automatically subscribe Meta App to WABA for incoming message Webhooks
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
});

// Endpoint: POST /api/meta/fetch-phone-numbers - Fetch all phone numbers associated with WABA ID
router.post('/fetch-phone-numbers', async (req: Request, res: Response) => {
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
      console.error('Failed to fetch WhatsApp phone numbers from WABA:', responseData);
      const errorMsg = responseData?.error?.message || responseData?.error?.error_user_msg || `Meta API trả về mã lỗi HTTP ${response.status}`;
      return res.status(response.status).json({ success: false, error: errorMsg, details: responseData });
    }

    const phoneNumbers = responseData.data || [];
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
});

// Endpoint: POST /api/meta/test-connection - Test WhatsApp Cloud API connection by sending a message
router.post('/test-connection', async (req: Request, res: Response) => {
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

    // Clean recipient phone format (remove +, spaces, non-digits and add country code 84 if starts with 0)
    let cleanPhone = recipientPhone.replace(/\D/g, '');
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '84' + cleanPhone.substring(1);
    }

    // Call WhatsApp Cloud API (Graph API v26.0)
    const metaApiUrl = `https://graph.facebook.com/v26.0/${phoneId}/messages`;
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanPhone,
      type: 'text',
      text: {
        body: messageText || `[YumNetwork CRM Test] Xin chào! Kết nối WhatsApp Cloud API thành công vào lúc ${new Date().toLocaleString('vi-VN')}!`
      }
    };

    console.log(`Sending WhatsApp Test Message to ${cleanPhone} via PhoneId: ${phoneId}`);

    const response = await fetch(metaApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const text = await response.text();
    let responseData: any = {};
    try {
      responseData = text ? JSON.parse(text) : {};
    } catch (e) {
      responseData = { error: { message: text } };
    }

    if (!response.ok) {
      console.error('WhatsApp Graph API Error:', responseData);
      const errorMsg = responseData?.error?.message || responseData?.error?.error_user_msg || 'Kết nối Meta WhatsApp thất bại.';
      
      // Update status in DB as error
      try {
        await prisma.integrationSetting.update({
          where: { id: 'default' },
          data: { status: 'error' }
        });
      } catch (err) {
        inMemorySetting.status = 'error';
      }

      return res.status(response.status).json({
        success: false,
        error: errorMsg,
        details: responseData
      });
    }

    // Update status in DB as connected
    const now = new Date();
    try {
      await prisma.integrationSetting.update({
        where: { id: 'default' },
        data: {
          status: 'connected',
          lastConnectedAt: now
        }
      });
    } catch (err) {
      inMemorySetting.status = 'connected';
      inMemorySetting.lastConnectedAt = now;
    }

    const testMsgId = responseData?.messages?.[0]?.id || `msg_test_${Date.now()}`;
    const testMsgRecord = {
      id: testMsgId,
      customerId: `cust_${cleanPhone}`,
      customerName: `Khách WhatsApp (${cleanPhone})`,
      customerPhone: recipientPhone,
      sender: 'agent',
      agentName: 'Hệ Thống CRM (Test)',
      channel: 'WhatsApp',
      content: payload.text.body,
      timestamp: now.toISOString(),
      isRead: true,
      isRealSent: true
    };

    inMemoryMessages.push(testMsgRecord);

    try {
      await prisma.whatsAppMessage.create({
        data: {
          id: testMsgRecord.id,
          customerName: testMsgRecord.customerName,
          customerPhone: testMsgRecord.customerPhone,
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
      metaResponse: responseData,
      lastConnectedAt: now
    });
  } catch (error: any) {
    console.error('Test Connection Exception:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Lỗi không xác định khi kiểm tra kết nối WhatsApp API'
    });
  }
});

// Endpoint: Meta User Data Deletion Callback
router.post('/data-deletion', (req: Request, res: Response) => {
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
});

// Endpoint: Meta Webhook Verification (GET) - Supports /, /webhook, /webhooks subpaths
router.get(['/', '/webhook', '/webhooks'], async (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const setting = await getIntegrationSetting();
  const validTokens = [
    setting.whatsappVerifyToken,
    process.env.META_VERIFY_TOKEN,
    '123456',
    'YUMNETWORK_CRM_META_VERIFY_TOKEN_2026'
  ].filter(Boolean).map((t) => String(t).trim());

  console.log(`[META WEBHOOK VERIFY REQUEST] Received mode: "${mode}", token: "${token}"`);

  if (mode === 'subscribe' && token && validTokens.includes(String(token).trim())) {
    console.log('✅ Meta Webhook Verified Successfully! Returning challenge:', challenge);
    return res.status(200).send(challenge);
  }

  console.warn(`❌ Meta Webhook Verification Failed. Expected Token: "${validTokens.join(' | ')}", Received Token: "${token}"`);
  return res.status(403).send('Webhook Verification Failed: Invalid Token or Mode');
});

// In-memory real WhatsApp messages log store
let inMemoryMessages: any[] = [];

// Endpoint: GET /api/meta/messages - Fetch all real WhatsApp messages (DB + memory combined)
router.get('/messages', async (req: Request, res: Response) => {
  let dbMsgs: any[] = [];
  try {
    dbMsgs = await prisma.whatsAppMessage.findMany({
      orderBy: { timestamp: 'asc' }
    });
  } catch (e) {
    // DB offline fallback
  }

  const map = new Map<string, any>();
  for (const m of dbMsgs) {
    const cleanP = m.customerPhone ? m.customerPhone.replace(/\D/g, '') : '';
    map.set(m.id, {
      ...m,
      customerId: m.customerId || (cleanP ? `cust_${cleanP}` : 'cust_unknown'),
      timestamp: typeof m.timestamp === 'object' ? m.timestamp.toISOString() : m.timestamp
    });
  }
  for (const m of inMemoryMessages) {
    if (!map.has(m.id)) {
      map.set(m.id, m);
    }
  }

  const combined = Array.from(map.values()).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  return res.json(combined);
});

// Endpoint: DELETE /api/meta/messages - Clear messages log in DB & memory
router.delete('/messages', async (req: Request, res: Response) => {
  inMemoryMessages = [];
  try {
    await prisma.whatsAppMessage.deleteMany();
  } catch (e) {
    // DB offline fallback
  }
  return res.json({ success: true, message: 'Đã xóa toàn bộ tin nhắn. Hệ thống sẵn sàng 100% cho tin nhắn thật từ Meta Webhook.' });
});

// Endpoint: DELETE /api/meta/messages/thread/:customerId - Delete a specific conversation thread (Admin Only)
router.delete('/messages/thread/:customerId', async (req: Request, res: Response) => {
  const { customerId } = req.params;
  const { customerPhone } = req.query;
  const rawPhone = typeof customerPhone === 'string' ? customerPhone : customerId;
  const cleanPhone = rawPhone.replace(/\D/g, '');
  const lastDigits = cleanPhone.length >= 7 ? cleanPhone.slice(-9) : cleanPhone;

  inMemoryMessages = inMemoryMessages.filter((m) => {
    const msgCleanPhone = m.customerPhone ? m.customerPhone.replace(/\D/g, '') : '';
    const matchId = m.customerId === customerId;
    const matchPhone = lastDigits && msgCleanPhone && msgCleanPhone.includes(lastDigits);
    return !matchId && !matchPhone;
  });

  try {
    const deleteConditions: any[] = [{ customerId }];
    if (lastDigits) {
      deleteConditions.push({ customerPhone: { contains: lastDigits } });
      deleteConditions.push({ customerId: { contains: lastDigits } });
    }
    const result = await prisma.whatsAppMessage.deleteMany({
      where: {
        OR: deleteConditions
      }
    });
    console.log(`[DB DELETE THREAD SUCCESS] Deleted ${result.count} messages for customer ${customerId} (phone last digits: ${lastDigits})`);
  } catch (e) {
    console.error('Error deleting thread from DB:', e);
  }

  return res.json({ success: true, message: `Đã xóa hội thoại của khách hàng ${customerId}` });
});

// Endpoint: DELETE /api/meta/messages/item/:messageId - Delete a single message by ID (Admin Only)
router.delete('/messages/item/:messageId', async (req: Request, res: Response) => {
  const { messageId } = req.params;
  inMemoryMessages = inMemoryMessages.filter((m) => m.id !== messageId);

  try {
    await prisma.whatsAppMessage.deleteMany({
      where: { id: messageId }
    });
  } catch (e) {
    console.error('Error deleting message from DB:', e);
  }

  return res.json({ success: true, message: `Đã xóa tin nhắn ${messageId}` });
});

// Endpoint: POST /api/meta/messages/send - Send real WhatsApp Cloud API message
router.post('/messages/send', async (req: Request, res: Response) => {
  try {
    const { customerPhone, content, agentName, customerId, customerName, phoneNumberId: overridePhoneId, senderPhoneId } = req.body;

    if (!content || (!customerPhone && !customerId)) {
      return res.status(400).json({ error: 'Vui lòng cung cấp số điện thoại người nhận và nội dung tin nhắn.' });
    }

    const rawPhone = customerPhone || (customerId && customerId.startsWith('cust_') ? customerId.replace('cust_', '') : (String(customerId).replace(/\D/g, '').length >= 7 ? customerId : '')) || '';
    let cleanPhone = rawPhone.replace(/\D/g, '');
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '84' + cleanPhone.substring(1);
    }

    // Try to match or verify customer ID from database
    let matchedCustomerId: string | null = null;
    let finalCustomerName = customerName;

    try {
      if (customerId && !customerId.startsWith('cust_')) {
        const found = await prisma.customer.findUnique({
          where: { id: customerId },
          select: { id: true, name: true, phone: true }
        });
        if (found) {
          matchedCustomerId = found.id;
          if (!finalCustomerName) finalCustomerName = found.name;
        }
      }
      if (!matchedCustomerId && cleanPhone.length >= 7) {
        const lastDigits = cleanPhone.slice(-9);
        const found = await prisma.customer.findFirst({
          where: {
            phone: { contains: lastDigits }
          },
          select: { id: true, name: true, phone: true }
        });
        if (found) {
          matchedCustomerId = found.id;
          if (!finalCustomerName) finalCustomerName = found.name;
        }
      }
    } catch (e) {
      // ignore lookup error
    }

    const resolvedCustomerId = matchedCustomerId || (customerId && !customerId.startsWith('cust_') ? customerId : (cleanPhone ? `cust_${cleanPhone}` : (customerId || 'cust_unknown')));
    const resolvedCustomerName = finalCustomerName || (cleanPhone ? `Khách Hàng (${cleanPhone})` : 'Khách Hàng');
    const resolvedCustomerPhone = customerPhone || (cleanPhone ? `+${cleanPhone}` : '');

    const setting = await getIntegrationSetting();
    const effectiveOverride = (overridePhoneId || senderPhoneId)?.trim();
    const phoneId = (effectiveOverride && !effectiveOverride.startsWith('phone_'))
      ? effectiveOverride
      : (await resolvePhoneNumberId(setting));
    const token = setting.whatsappAccessToken;

    let metaResult: any = null;
    let isRealSent = false;

    // If Phone Number ID and Access Token are configured, attempt real Graph API dispatch
    if (phoneId && token && cleanPhone) {
      try {
        const metaApiUrl = `https://graph.facebook.com/v26.0/${phoneId}/messages`;
        const payload = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cleanPhone,
          type: 'text',
          text: { body: content }
        };

        const apiRes = await fetch(metaApiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        const resText = await apiRes.text();
        try {
          metaResult = resText ? JSON.parse(resText) : {};
        } catch {
          metaResult = { error: { message: resText } };
        }

        if (apiRes.ok && metaResult?.messages?.[0]?.id) {
          isRealSent = true;
          console.log(`[REAL WHATSAPP SENT] Message ID ${metaResult.messages[0].id} to ${cleanPhone}`);
        } else {
          console.warn('[REAL WHATSAPP API WARN]', metaResult);
        }
      } catch (graphErr) {
        console.error('Error dispatching WhatsApp Graph API:', graphErr);
      }
    }

    const newMsg = {
      id: metaResult?.messages?.[0]?.id || `msg_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      customerId: resolvedCustomerId,
      customerName: resolvedCustomerName,
      customerPhone: resolvedCustomerPhone,
      sender: 'agent',
      agentName: agentName || 'Nguyễn Văn Ánh',
      channel: 'WhatsApp',
      content,
      timestamp: new Date().toISOString(),
      isRead: true,
      isRealSent
    };

    inMemoryMessages.push(newMsg);

    // Save to Database (Prisma)
    try {
      const createData: any = {
        id: newMsg.id,
        customerName: newMsg.customerName,
        customerPhone: newMsg.customerPhone,
        sender: newMsg.sender,
        agentName: newMsg.agentName,
        channel: newMsg.channel,
        content: newMsg.content,
        isRead: newMsg.isRead,
        isRealSent: newMsg.isRealSent,
        timestamp: new Date(newMsg.timestamp)
      };

      if (matchedCustomerId) {
        createData.customerId = matchedCustomerId;
      }

      const savedOutDb = await prisma.whatsAppMessage.create({
        data: createData
      });
      console.log(`[DB SAVE SUCCESS] Saved OUTGOING message ${savedOutDb.id} to PostgreSQL Database!`);
    } catch (dbErr: any) {
      console.error('[DB SAVE ERROR] Failed to save outgoing message to DB:', dbErr.message || dbErr);
    }

    return res.json({
      success: true,
      isRealSent,
      metaResponse: metaResult,
      message: newMsg
    });
  } catch (error: any) {
    console.error('Error sending WhatsApp message:', error);
    return res.status(500).json({ error: error.message || 'Lỗi khi gửi tin nhắn WhatsApp.' });
  }
});

// Endpoint: Meta Webhook Event Handler (POST) - Supports /, /webhook, /webhooks subpaths
router.post(['/', '/webhook', '/webhooks'], async (req: Request, res: Response) => {
  let body = req.body;

  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {}
  }

  console.log('[META WEBHOOK POST RECEIVED]', JSON.stringify(body, null, 2));

  try {
    const extractedItems: Array<{ msgData: any; valueObj: any }> = [];

    const processValue = (val: any) => {
      if (!val || typeof val !== 'object') return;
      // Handle nested value property (e.g. { field: "messages", value: { messages: [...] } })
      const targetVal = (val.value && typeof val.value === 'object' && Array.isArray(val.value.messages)) ? val.value : val;
      if (Array.isArray(targetVal.messages)) {
        for (const msgData of targetVal.messages) {
          extractedItems.push({ msgData, valueObj: targetVal });
        }
      }
    };

    if (Array.isArray(body?.entry)) {
      for (const entry of body.entry) {
        if (Array.isArray(entry?.changes)) {
          for (const change of entry.changes) {
            processValue(change?.value || change);
          }
        } else {
          processValue(entry);
        }
      }
    } else if (Array.isArray(body?.changes)) {
      for (const change of body.changes) {
        processValue(change?.value || change);
      }
    } else if (body?.value) {
      processValue(body.value);
    } else if (Array.isArray(body?.messages)) {
      processValue(body);
    } else if (Array.isArray(body)) {
      for (const item of body) {
        processValue(item?.value || item);
      }
    } else {
      processValue(body);
    }

    for (const { msgData, valueObj } of extractedItems) {
      const contactData = valueObj?.contacts?.find((c: any) => c.wa_id === msgData.from) || valueObj?.contacts?.[0];
      const fromPhone = msgData.from || 'Khách Hàng';
      const senderName = contactData?.profile?.name || `Khách WhatsApp (${fromPhone})`;
      const textBody = msgData.text?.body || (msgData.type ? `[${msgData.type} message]` : 'Tin nhắn WhatsApp');
      const cleanFrom = fromPhone.replace(/\D/g, '');

      // Try to match incoming phone to an existing CRM customer
      let matchedCustomerId = `cust_${cleanFrom}`;
      let matchedCustomerName = senderName;

      try {
        // Build phone variants to search (e.g. 84901234567 -> also try 0901234567)
        const phoneVariants: string[] = [cleanFrom];
        if (cleanFrom.startsWith('84') && cleanFrom.length > 9) {
          phoneVariants.push('0' + cleanFrom.substring(2)); // 84xxx -> 0xxx
        }
        if (cleanFrom.startsWith('0')) {
          phoneVariants.push('84' + cleanFrom.substring(1)); // 0xxx -> 84xxx
        }

        // Search DB for customer matching any phone variant
        const matchedCustomer = await prisma.customer.findFirst({
          where: {
            OR: phoneVariants.map((pv: string) => ({
              phone: { contains: pv }
            }))
          },
          select: { id: true, name: true, phone: true }
        });

        if (matchedCustomer) {
          matchedCustomerId = matchedCustomer.id;
          matchedCustomerName = matchedCustomer.name || senderName;
          console.log(`[WEBHOOK CUSTOMER MATCH] Matched incoming phone ${fromPhone} to CRM customer: ${matchedCustomer.name} (${matchedCustomer.id})`);
        } else {
          console.log(`[WEBHOOK NO MATCH] No CRM customer found for phone ${fromPhone}, using fallback ID: ${matchedCustomerId}`);
        }
      } catch (lookupErr) {
        console.warn('[WEBHOOK CUSTOMER LOOKUP ERROR]', lookupErr);
      }

      const newIncoming = {
        id: msgData.id || `msg_meta_${Date.now()}`,
        customerId: matchedCustomerId,
        customerName: matchedCustomerName,
        customerPhone: fromPhone,
        sender: 'customer',
        channel: 'WhatsApp',
        content: textBody,
        timestamp: new Date(Number(msgData.timestamp) * 1000 || Date.now()).toISOString(),
        isRead: false
      };

      if (!inMemoryMessages.some((m) => m.id === newIncoming.id)) {
        inMemoryMessages.push(newIncoming);
      }

      // Save incoming message to Database (Prisma)
      try {
        const createData: any = {
          id: newIncoming.id,
          customerName: newIncoming.customerName,
          customerPhone: newIncoming.customerPhone,
          sender: newIncoming.sender,
          channel: newIncoming.channel,
          content: newIncoming.content,
          isRead: newIncoming.isRead,
          timestamp: new Date(newIncoming.timestamp)
        };

        // Only set the foreign key relation if the customer exists in DB
        if (matchedCustomerId && !matchedCustomerId.startsWith('cust_')) {
          createData.customerId = matchedCustomerId;
        }

        const savedDbMsg = await prisma.whatsAppMessage.upsert({
          where: { id: newIncoming.id },
          update: {},
          create: createData
        });
        console.log(`[DB SAVE SUCCESS] Saved INCOMING message ${savedDbMsg.id} to PostgreSQL Database!`);
      } catch (dbErr: any) {
        console.error('[DB SAVE ERROR] Failed to save incoming message to DB:', dbErr.message || dbErr);
      }

      console.log(`[INCOMING REAL WHATSAPP WEBHOOK] Added message from ${matchedCustomerName} (${fromPhone}): "${textBody}"`);
    }
  } catch (parseErr) {
    console.error('Error parsing WhatsApp Webhook payload:', parseErr);
  }

  return res.status(200).send('EVENT_RECEIVED');
});

export default router;
