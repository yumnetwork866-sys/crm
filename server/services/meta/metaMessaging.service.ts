import fs from 'fs';
import path from 'path';
import { isSupportedMetaImage, type MetaTemplateDispatchResult } from './types';
import { uploadMediaToMeta } from './metaMedia.service';
import { getMetaRecipientAddress } from '../../utils/metaRecipient';

function setMetaRecipient(payload: Record<string, any>, recipient: string): void {
  delete payload.to;
  delete payload.recipient;
  Object.assign(payload, getMetaRecipientAddress(recipient));
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

    const matches = dataUrl.match(/^data:([-A-Za-z+/]+);base64,(.+)$/);
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
  } else if (content.startsWith('data:audio/')) {
    const parts = content.split('\n');
    const dataUrl = parts[0];
    const caption = parts.slice(1).join('\n').trim();

    const matches = dataUrl.match(/^data:([-A-Za-z0-9+/;=]+);base64,(.+)$/);
    let uploadedMediaId: string | null = null;
    if (matches && matches.length === 3) {
      const rawMime = matches[1].split(';')[0].toLowerCase();
      let mimeType = 'audio/ogg';
      let fileExt = 'ogg';
      if (rawMime.includes('mp4') || rawMime.includes('m4a')) {
        mimeType = 'audio/mp4';
        fileExt = 'mp4';
      } else if (rawMime.includes('mpeg') || rawMime.includes('mp3')) {
        mimeType = 'audio/mpeg';
        fileExt = 'mp3';
      } else if (rawMime.includes('aac')) {
        mimeType = 'audio/aac';
        fileExt = 'aac';
      } else if (rawMime.includes('ogg')) {
        mimeType = 'audio/ogg';
        fileExt = 'ogg';
      } else if (rawMime.includes('webm')) {
        mimeType = 'audio/webm';
        fileExt = 'webm';
      }
      const buffer = Buffer.from(matches[2], 'base64');
      uploadedMediaId = await uploadMediaToMeta(phoneId, token, buffer, mimeType, `voice_${Date.now()}.${fileExt}`);
    }

    if (uploadedMediaId) {
      payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanPhone,
        type: 'audio',
        audio: { id: uploadedMediaId }
      };
    } else {
      payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanPhone,
        type: 'text',
        text: { body: caption ? `[Tin nhắn thoại] ${caption}` : '🎙️ [Tin nhắn thoại gửi từ CRM]' }
      };
    }
  } else if (/^\[product(?::\s*|\s*)\{/i.test(content)) {
    // Single Product Message: [product:{"catalog_id":"...","product_retailer_id":"...","name":"...","price":"...","image":"..."}]\nOptional body text
    const match = content.match(/^\[product(?::\s*|\s*)(\{.*?\})\]\n?([\s\S]*)$/i);
    if (match) {
      try {
        const productData = JSON.parse(match[1]);
        const bodyText = match[2]?.trim() || '';
        payload = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cleanPhone,
          type: 'interactive',
          interactive: {
            type: 'product',
            ...(bodyText ? { body: { text: bodyText } } : {}),
            action: {
              catalog_id: String(productData.catalog_id),
              product_retailer_id: String(productData.product_retailer_id)
            }
          }
        };
      } catch (err) {
        console.warn('[META DISPATCH] Lỗi phân tích [product:...]:', err);
        payload = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cleanPhone,
          type: 'text',
          text: { body: content }
        };
      }
    }
  } else if (/^\[product_list(?::\s*|\s*)\{/i.test(content)) {
    // Multi-Product Message: [product_list:{"catalog_id":"...","header":"...","title":"...","sections":[...]}]\nOptional body text
    const match = content.match(/^\[product_list(?::\s*|\s*)(\{.*?\})\]\n?([\s\S]*)$/i);
    if (match) {
      try {
        const listData = JSON.parse(match[1]);
        const bodyText = match[2]?.trim() || 'Xin gửi quý khách danh sách sản phẩm nổi bật của cửa hàng:';
        payload = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cleanPhone,
          type: 'interactive',
          interactive: {
            type: 'product_list',
            header: {
              type: 'text',
              text: listData.header || 'Danh Mục Sản Phẩm'
            },
            body: { text: bodyText },
            action: {
              catalog_id: String(listData.catalog_id),
              sections: listData.sections
            }
          }
        };
      } catch (err) {
        console.warn('[META DISPATCH] Lỗi phân tích [product_list:...]:', err);
        payload = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cleanPhone,
          type: 'text',
          text: { body: content }
        };
      }
    }
  } else if (content.startsWith('[document:')) {
    const match = content.match(/^\[document:(\{.*?\})\]\n?([\s\S]*)$/);
    if (match) {
      try {
        const meta = JSON.parse(match[1]);
        const caption = match[2]?.trim() || '';
        const filename = meta.filename || 'Tài liệu.pdf';
        const docUrl = meta.url;
        let uploadedMediaId: string | null = null;

        if (docUrl && docUrl.startsWith('data:')) {
          const m = docUrl.match(/^data:([-A-Za-z0-9+/;=.]+);base64,(.+)$/);
          if (m) {
            const rawMime = m[1].split(';')[0].toLowerCase();
            const buffer = Buffer.from(m[2], 'base64');
            uploadedMediaId = await uploadMediaToMeta(phoneId, token, buffer, rawMime, filename);
          }
        } else if (docUrl && docUrl.startsWith('/uploads/')) {
          const localPath = path.resolve(process.cwd(), 'public', docUrl.replace(/^\//, ''));
          if (fs.existsSync(localPath)) {
            const buffer = await fs.promises.readFile(localPath);
            const ext = path.extname(localPath).toLowerCase().replace('.', '');
            const mimeType = ext === 'pdf' ? 'application/pdf' : 'application/octet-stream';
            uploadedMediaId = await uploadMediaToMeta(phoneId, token, buffer, mimeType, filename);
          }
        }

        if (uploadedMediaId) {
          payload = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: cleanPhone,
            type: 'document',
            document: {
              id: uploadedMediaId,
              filename,
              ...(caption ? { caption } : {})
            }
          };
        } else {
          payload = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: cleanPhone,
            type: 'text',
            text: { body: caption ? `[Tài liệu: ${filename}]\n${caption}` : `📄 [Tài liệu: ${filename}]` }
          };
        }
      } catch (err) {
        console.warn('Error processing document for Meta dispatch:', err);
      }
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

  setMetaRecipient(payload, cleanPhone);

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

export async function dispatchMetaTextMessage(options: {
  phoneId: string;
  token: string;
  cleanPhone: string;
  content: string;
}): Promise<MetaTemplateDispatchResult> {
  const { phoneId, token, cleanPhone, content } = options;
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: cleanPhone,
    type: 'text',
    text: {
      body: content,
      preview_url: false,
    },
  };
  setMetaRecipient(payload, cleanPhone);

  try {
    const response = await fetch(`https://graph.facebook.com/v26.0/${phoneId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20_000),
    });
    const metaResult: any = await response.json().catch(() => ({}));
    const messageId = metaResult?.messages?.[0]?.id;
    const metaCode = metaResult?.error?.code;
    const retryable = response.status === 429 || response.status >= 500 || [1, 2, 4, 17, 32, 613].includes(metaCode);

    return {
      isRealSent: Boolean(response.ok && messageId),
      messageId,
      errorCode: metaCode ? String(metaCode) : undefined,
      errorMessage: metaResult?.error?.message,
      retryable,
      metaResult,
    };
  } catch (error: any) {
    return {
      isRealSent: false,
      errorCode: error?.name === 'TimeoutError' ? 'TIMEOUT' : 'NETWORK_ERROR',
      errorMessage: error?.message || 'Không thể kết nối WhatsApp Cloud API.',
      retryable: true,
      metaResult: null,
    };
  }
}

export async function dispatchMetaTemplateMessage(options: {
  phoneId: string;
  token: string;
  cleanPhone: string;
  templateName: string;
  languageCode: string;
  bodyParameters?: string[];
}): Promise<MetaTemplateDispatchResult> {
  const { phoneId, token, cleanPhone, templateName, languageCode, bodyParameters = [] } = options;
  const payload: any = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: cleanPhone,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode }
    }
  };
  setMetaRecipient(payload, cleanPhone);

  if (bodyParameters.length > 0) {
    payload.template.components = [{
      type: 'body',
      parameters: bodyParameters.map((text) => ({ type: 'text', text }))
    }];
  }

  try {
    const response = await fetch(`https://graph.facebook.com/v26.0/${phoneId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20_000)
    });
    const metaResult: any = await response.json().catch(() => ({}));
    const messageId = metaResult?.messages?.[0]?.id;
    const metaCode = metaResult?.error?.code;
    const retryable = response.status === 429 || response.status >= 500 || [1, 2, 4, 17, 32, 613].includes(metaCode);

    return {
      isRealSent: Boolean(response.ok && messageId),
      messageId,
      errorCode: metaCode ? String(metaCode) : undefined,
      errorMessage: metaResult?.error?.message,
      retryable,
      metaResult
    };
  } catch (error: any) {
    return {
      isRealSent: false,
      errorCode: error?.name === 'TimeoutError' ? 'TIMEOUT' : 'NETWORK_ERROR',
      errorMessage: error?.message || 'Không thể kết nối WhatsApp Cloud API.',
      retryable: true,
      metaResult: null
    };
  }
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

  const metaApiUrl = `https://graph.facebook.com/v26.0/${phoneId}/messages`;
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
  setMetaRecipient(payload, cleanPhone);

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
