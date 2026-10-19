import { serializeWhatsAppOrder } from '../../utils/whatsappOrder';
import { isMetaUserIdentifier } from '../../utils/metaRecipient';
import { normalizePhoneE164 } from '../../utils/phone';

/**
 * Extract incoming messages from diverse Meta Webhook payload formats
 */
export function extractWebhookItems(body: any): Array<{ msgData: any; valueObj: any }> {
  const extractedItems: Array<{ msgData: any; valueObj: any }> = [];

  const processValue = (val: any) => {
    if (!val || typeof val !== 'object') return;
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

  return extractedItems;
}

/**
 * Resolve the sender across Cloud API and BSUID-style webhook payloads.
 * Some Meta payloads omit `from` and expose the recipient-safe identity as
 * `from_user_id` or `user_id` instead.
 */
export interface WebhookSenderIdentity {
  recipient: string;
  bsuid: string;
  parentBsuid: string;
  phone: string;
  username: string;
}

export function getWebhookSenderIdentity(msgData: any, valueObj?: any): WebhookSenderIdentity {
  const primaryIdentity = String(msgData?.from_user_id || msgData?.user_id || msgData?.from || '');
  const contact = valueObj?.contacts?.find((item: any) => (
    [item?.user_id, item?.from_user_id, item?.wa_id]
      .some((value) => String(value || '') === primaryIdentity)
  )) || valueObj?.contacts?.[0];
  const bsuidCandidates = [
    msgData?.from_user_id,
    msgData?.user_id,
    msgData?.from?.user_id,
    msgData?.from?.id,
    msgData?.sender?.id,
    valueObj?.from_user_id,
    valueObj?.user_id,
    contact?.from_user_id,
    contact?.user_id,
    isMetaUserIdentifier(msgData?.from) ? msgData.from : '',
  ];
  let bsuid = '';
  for (const candidate of bsuidCandidates) {
    if (typeof candidate === 'string' || typeof candidate === 'number') {
      const identifier = String(candidate).trim();
      if (identifier && isMetaUserIdentifier(identifier)) {
        bsuid = identifier;
        break;
      }
    }
  }

  let phone = '';
  for (const candidate of [msgData?.from, contact?.wa_id]) {
    const value = String(candidate || '').trim();
    if (!value || isMetaUserIdentifier(value)) continue;
    phone = normalizePhoneE164(value);
    if (phone) break;
  }

  const parentCandidate = String(
    msgData?.from_parent_user_id || msgData?.parent_user_id || contact?.parent_user_id || '',
  ).trim();
  const username = String(
    contact?.username || contact?.profile?.username || msgData?.username || msgData?.profile?.username || '',
  ).trim();

  return {
    recipient: bsuid || phone,
    bsuid,
    parentBsuid: isMetaUserIdentifier(parentCandidate) ? parentCandidate : '',
    phone,
    username,
  };
}

export function getWebhookSenderIdentifier(msgData: any, valueObj?: any): string {
  return getWebhookSenderIdentity(msgData, valueObj).recipient;
}

export function extractWebhookStatuses(body: any): any[] {
  const statuses: any[] = [];
  const collect = (value: any) => {
    if (Array.isArray(value?.statuses)) statuses.push(...value.statuses);
  };
  if (Array.isArray(body?.entry)) {
    for (const entry of body.entry) {
      if (Array.isArray(entry?.changes)) {
        for (const change of entry.changes) collect(change?.value || change);
      } else collect(entry?.value || entry);
    }
  } else if (Array.isArray(body?.changes)) {
    for (const change of body.changes) collect(change?.value || change);
  } else {
    collect(body?.value || body);
  }
  return statuses;
}

export function extractWebhookChanges(body: any): Array<{ field: string; value: any; entryId?: string }> {
  const changes: Array<{ field: string; value: any; entryId?: string }> = [];
  for (const entry of Array.isArray(body?.entry) ? body.entry : []) {
    for (const change of Array.isArray(entry?.changes) ? entry.changes : []) {
      changes.push({
        field: String(change?.field || ''),
        value: change?.value || {},
        entryId: entry?.id ? String(entry.id) : undefined,
      });
    }
  }
  return changes;
}

export function getMessageText(msgData: any, businessPhoneNumberId?: string): string {
  const directText = msgData?.text?.body;
  if (directText) return directText;
  if (msgData?.type === 'order') {
    return serializeWhatsAppOrder(msgData) || '[Đơn hàng WhatsApp không hợp lệ]';
  }
  const phoneQuery = businessPhoneNumberId ? `?phoneId=${encodeURIComponent(businessPhoneNumberId)}` : '';
  if (msgData?.type === 'image') {
    const mediaId = msgData.image?.id;
    const caption = msgData.image?.caption || '';
    return mediaId
      ? `/api/meta/media/${mediaId}${phoneQuery}${caption ? `\n${caption}` : ''}`
      : caption ? `[Hình ảnh] ${caption}` : '[Hình ảnh]';
  }
  if (msgData?.type === 'sticker') {
    const mediaId = msgData.sticker?.id;
    return mediaId
      ? `/api/meta/media/${mediaId}${phoneQuery}`
      : '[Nhãn dán]';
  }
  if (msgData?.type === 'document') {
    const mediaId = msgData.document?.id;
    const filename = msgData.document?.filename || 'Tài liệu.pdf';
    const caption = msgData.document?.caption || '';
    const extraPhone = businessPhoneNumberId ? `&phoneId=${encodeURIComponent(businessPhoneNumberId)}` : '';
    return mediaId
      ? `/api/meta/media/${mediaId}?type=document&filename=${encodeURIComponent(filename)}${extraPhone}${caption ? `\n${caption}` : ''}`
      : caption ? `[Tài liệu] ${filename}\n${caption}` : `[Tài liệu] ${filename}`;
  }
  if (msgData?.type === 'audio') {
    const mediaId = msgData.audio?.id;
    const extraPhone = businessPhoneNumberId ? `&phoneId=${encodeURIComponent(businessPhoneNumberId)}` : '';
    return mediaId
      ? `/api/meta/media/${mediaId}?type=audio${extraPhone}`
      : '[Tin nhắn thoại (Audio)]';
  }
  if (msgData?.type === 'video') return '[Video]';
  if (msgData?.type === 'location') {
    return `[Vị trí] ${msgData.location?.name || ''} (${msgData.location?.latitude || ''}, ${msgData.location?.longitude || ''})`.trim();
  }
  if (msgData?.type === 'reaction') {
    const emoji = msgData.reaction?.emoji;
    return emoji ? `[Cảm xúc: ${emoji}]` : '[Gỡ cảm xúc]';
  }
  return msgData?.type ? `[${msgData.type} message]` : 'Tin nhắn WhatsApp';
}
