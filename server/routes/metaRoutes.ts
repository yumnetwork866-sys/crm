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
  whatsappAppId: '',
  whatsappAppSecret: '',
  status: 'disconnected',
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
    // Merge environment variables if DB values are empty
    const mergedSetting = {
      ...setting,
      whatsappWabaId: setting.whatsappWabaId || process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '',
      whatsappAccessToken: setting.whatsappAccessToken || process.env.WHATSAPP_ACCESS_TOKEN || '',
      whatsappPhoneNumberId: setting.whatsappPhoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    };
    // Sync in-memory store with DB & env
    inMemorySetting = { ...mergedSetting };
    return mergedSetting;
  } catch (dbError) {
    // If PostgreSQL DB connection fails (ECONNREFUSED), use in-memory store gracefully
    return inMemorySetting;
  }
}

// Endpoint: GET /api/meta/config - Read current integration configuration
router.get('/config', async (req: Request, res: Response) => {
  try {
    const setting = await getIntegrationSetting();
    // Return sanitized setting (masking raw access token if present)
    const maskedToken = setting.whatsappAccessToken
      ? `${setting.whatsappAccessToken.substring(0, 8)}...${setting.whatsappAccessToken.substring(setting.whatsappAccessToken.length - 6)}`
      : '';

    return res.json({
      id: setting.id,
      whatsappPhoneNumberId: setting.whatsappPhoneNumberId || '',
      whatsappWabaId: setting.whatsappWabaId || '',
      whatsappVerifyToken: setting.whatsappVerifyToken || 'YUMNETWORK_CRM_META_VERIFY_TOKEN_2026',
      whatsappAppId: setting.whatsappAppId || '',
      whatsappAppSecret: setting.whatsappAppSecret || '',
      status: setting.status,
      lastConnectedAt: setting.lastConnectedAt,
      hasAccessToken: Boolean(setting.whatsappAccessToken && setting.whatsappAccessToken.trim().length > 0),
      maskedAccessToken: maskedToken,
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

    return res.json({
      message: 'Cập nhật cấu hình tích hợp thành công!',
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
    const phoneId = overridePhoneId || setting.whatsappPhoneNumberId;
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
  const EXPECTED_TOKEN = setting.whatsappVerifyToken || process.env.META_VERIFY_TOKEN || 'YUMNETWORK_CRM_META_VERIFY_TOKEN_2026';

  console.log(`[META WEBHOOK VERIFY REQUEST] Received mode: "${mode}", token: "${token}"`);

  if (mode === 'subscribe' && token && String(token).trim() === String(EXPECTED_TOKEN).trim()) {
    console.log('✅ Meta Webhook Verified Successfully! Returning challenge:', challenge);
    return res.status(200).send(challenge);
  }

  console.warn(`❌ Meta Webhook Verification Failed. Expected Token: "${EXPECTED_TOKEN}", Received Token: "${token}"`);
  return res.status(403).send('Webhook Verification Failed: Invalid Token or Mode');
});

// In-memory real WhatsApp messages log store
let inMemoryMessages: any[] = [];

// Endpoint: GET /api/meta/messages - Fetch all real WhatsApp messages (DB + memory fallback)
router.get('/messages', async (req: Request, res: Response) => {
  try {
    const dbMsgs = await prisma.whatsAppMessage.findMany({
      orderBy: { timestamp: 'asc' }
    });
    if (dbMsgs && dbMsgs.length > 0) {
      return res.json(dbMsgs);
    }
  } catch (e) {
    // DB offline fallback
  }
  return res.json(inMemoryMessages);
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
    const { customerPhone, content, agentName, customerId, customerName } = req.body;

    if (!customerPhone || !content) {
      return res.status(400).json({ error: 'Vui lòng cung cấp số điện thoại người nhận và nội dung tin nhắn.' });
    }

    const setting = await getIntegrationSetting();
    const phoneId = setting.whatsappPhoneNumberId;
    const token = setting.whatsappAccessToken;

    // Clean recipient phone format
    let cleanPhone = customerPhone.replace(/\D/g, '');
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '84' + cleanPhone.substring(1);
    }

    let metaResult: any = null;
    let isRealSent = false;

    // If Phone Number ID and Access Token are configured, attempt real Graph API dispatch
    if (phoneId && token) {
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
      id: metaResult?.messages?.[0]?.id || `msg_${Date.now()}`,
      customerId: customerId || `cust_${cleanPhone}`,
      customerName: customerName || `Khách Hàng (${cleanPhone})`,
      customerPhone,
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
      const savedOutDb = await prisma.whatsAppMessage.create({
        data: {
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
        }
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
    const entries = body?.entry || (body?.messages ? [{ changes: [{ value: body }] }] : (Array.isArray(body) ? body : [body]));

    for (const entry of entries) {
      const changes = entry?.changes || [{ value: entry }];
      for (const change of changes) {
        const value = change?.value || change;
        const messages = value?.messages;

        if (messages && Array.isArray(messages)) {
          for (const msgData of messages) {
            const contactData = value.contacts?.find((c: any) => c.wa_id === msgData.from) || value.contacts?.[0];
            const fromPhone = msgData.from || 'Khách Hàng';
            const senderName = contactData?.profile?.name || `Khách WhatsApp (${fromPhone})`;
            const textBody = msgData.text?.body || (msgData.type ? `[${msgData.type} message]` : 'Tin nhắn WhatsApp');
            const cleanFrom = fromPhone.replace(/\D/g, '');

            const newIncoming = {
              id: msgData.id || `msg_meta_${Date.now()}`,
              customerId: `cust_${cleanFrom}`,
              customerName: senderName,
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
              const savedDbMsg = await prisma.whatsAppMessage.upsert({
                where: { id: newIncoming.id },
                update: {},
                create: {
                  id: newIncoming.id,
                  customerName: newIncoming.customerName,
                  customerPhone: newIncoming.customerPhone,
                  sender: newIncoming.sender,
                  channel: newIncoming.channel,
                  content: newIncoming.content,
                  isRead: newIncoming.isRead,
                  timestamp: new Date(newIncoming.timestamp)
                }
              });
              console.log(`[DB SAVE SUCCESS] Saved INCOMING message ${savedDbMsg.id} to PostgreSQL Database!`);
            } catch (dbErr: any) {
              console.error('[DB SAVE ERROR] Failed to save incoming message to DB:', dbErr.message || dbErr);
            }

            console.log(`[INCOMING REAL WHATSAPP WEBHOOK] Added message from ${senderName} (${fromPhone}): "${textBody}"`);
          }
        }
      }
    }
  } catch (parseErr) {
    console.error('Error parsing WhatsApp Webhook payload:', parseErr);
  }

  return res.status(200).send('EVENT_RECEIVED');
});

export default router;
